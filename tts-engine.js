/* Atlas Diplomático — TTS engine
   Wraps window.speechSynthesis with per-language voice selection and
   real-time single-word display, spoken with natural (non-choppy) audio.

   Sync strategy: each sentence is spoken as ONE utterance (no chunking, so
   no queueing gaps between utterances). Word position is driven by the
   browser's own SpeechSynthesisUtterance 'boundary' event, which carries
   the true charIndex into the utterance text. However, Chrome/Edge fire
   'boundary' with a systematic lag behind the actual audio (a long-known
   Web Speech API quirk, ~100-250ms, present across languages/voices) — so
   using it directly makes the on-screen word visibly trail the voice. We
   correct for this: each boundary event is used only to calibrate a
   per-voice "ms between words" estimate and a learned lead offset (how
   early we must show the word to land on the real audio), and the actual
   on-screen update is scheduled via a short predictive timer rather than
   fired synchronously from the event. The timer is re-armed from every
   real boundary, so estimation error never accumulates across a sentence.
   If a voice/engine never fires boundary events at all (common for
   network-backed voices, e.g. Chrome's "Google" voices used for Spanish/
   English), we detect that within ~400ms and fall back to a drift-
   corrected per-word clock (recomputed each tick from real elapsed time,
   not chained timeouts) so the estimate doesn't trail further behind the
   audio as the sentence goes on. Both the pace and the lead-offset
   estimates are calibrated per language+voice so switching languages/
   voices mid-session can't corrupt an unrelated voice's estimates. */

const TTSEngine = (function () {
  const LANG_VOICE_MAP = {
    'english':        'en-US',
    'russian':        'ru-RU',
    'german':         'de-DE',
    'french':         'fr-FR',
    'greek':          'el-GR',
    'spanish':        'es-ES',
    'portuguese-br':  'pt-BR'
  };

  const BOUNDARY_FALLBACK_TIMEOUT_MS = 400;

  let sentences = [];
  let sentenceIdx = 0;
  let words = [];       // words of the current sentence
  let wordStarts = [];  // char offset of each word within the current sentence text
  let rate = 1.0;
  let pitch = 1.0;
  let volume = 1.0;
  let voiceURI = null;
  let langKey = 'english';
  let paused = false;
  let chunkSize = 1; // words flashed together per onWordBoundary call (1-3)
  let onSentenceChange = null;
  let onWordBoundary = null;
  let onStateChange = null;

  // Per (langKey|voiceURI) adaptive pace estimate, used only by the fallback timer.
  const msPerCharByVoice = {};
  const DEFAULT_MS_PER_CHAR = 110;

  // Per (langKey|voiceURI) lead offset: how many ms Chrome/Edge's 'boundary'
  // event lags the real audio for that voice. There's no signal in the
  // boundary events themselves to measure this lag directly, so it's a
  // fixed, empirically-chosen default — kept per-voice-keyed so a future
  // per-voice override wouldn't require restructuring this.
  const leadOffsetByVoice = {};
  const DEFAULT_LEAD_OFFSET_MS = 150;

  let subWordTimer = null;
  let boundaryFallbackTimer = null;
  let wordDisplayTimer = null; // predictive timer that actually calls onWordBoundary
  let usingBoundaryEvents = false;
  let currentUtterance = null;
  let pausedWordIdx = 0; // word index to resume from after a native pause

  function splitSentences(text) {
    return (text.match(/[^.!?…]+[.!?…]*/g) || [text]).map(s => s.trim()).filter(Boolean);
  }

  function splitWordsWithOffsets(sentence) {
    const out = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(sentence))) out.push({ word: m[0], start: m.index });
    return out;
  }

  function langCode() {
    return LANG_VOICE_MAP[langKey] || 'pt-BR';
  }

  function voiceKey() {
    return langKey + '|' + (voiceURI || pickVoice()?.voiceURI || '');
  }

  function getMsPerChar() {
    return msPerCharByVoice[voiceKey()] || DEFAULT_MS_PER_CHAR;
  }

  function setMsPerChar(v) {
    msPerCharByVoice[voiceKey()] = v;
  }

  function getLeadOffset() {
    const v = leadOffsetByVoice[voiceKey()];
    return v === undefined ? DEFAULT_LEAD_OFFSET_MS : v;
  }

  function voicesForLang() {
    const code = langCode();
    const all = speechSynthesis.getVoices();
    const matches = all.filter(v => v.lang === code || v.lang.startsWith(code.split('-')[0]));
    // Local voices (Microsoft on Windows, etc.) fire onboundary reliably;
    // network-backed voices (Google's, used e.g. for Spanish/English on
    // Chrome) often don't, forcing the laggier estimated-timer fallback,
    // which is what causes the word display to drift/jump out of sync with
    // the audio. voice.localService is the Web Speech API's own signal for
    // this, so filter network voices out entirely whenever a local one is
    // available instead of just sorting them first — otherwise a user could
    // still pick a network voice from the dropdown and hit the desync.
    const local = matches.filter(v => v.localService);
    return local.length ? local : matches;
  }

  function pickVoice() {
    const candidates = voicesForLang();
    if (!candidates.length) return null;
    if (voiceURI) {
      const match = candidates.find(v => v.voiceURI === voiceURI);
      if (match) return match;
    }
    return candidates[0];
  }

  function load(textObj, language) {
    stop();
    langKey = language;
    sentences = splitSentences(textObj.text || '');
    sentenceIdx = 0;
  }

  // ── Fallback: estimated per-word timer (used only if boundary events don't fire) ──
  // Drift-corrected: rather than chaining setTimeout(dur) word-after-word
  // (which accumulates error — each word's duration estimate error adds to
  // the next, so the display trails further behind the audio as the
  // sentence goes on, producing a constant/growing lag by the end), each
  // tick recomputes the target word from real elapsed time since the
  // utterance actually started (u.onstart), so the estimate error for one
  // word never carries over into the next.
  //
  // Network-backed voices (Chrome's "Google" voices, used whenever a
  // language has no local voice — English, Spanish, French, German, Greek)
  // never fire onboundary AND have irregular network latency before onstart
  // that regularly exceeds BOUNDARY_FALLBACK_TIMEOUT_MS (measured up to
  // ~1.1s). If this function used "now" as the clock start whenever onstart
  // hadn't fired yet, the fallback clock would start ticking before any
  // audio had actually begun, running the displayed word ahead of the
  // sound by the remainder of that startup latency (measured ~700ms) —
  // audio then sounds like it's lagging behind the text. So: if onstart
  // hasn't fired yet, wait for it (or for a late boundary event) before the
  // clock starts, instead of assuming "now" is when playback began.
  function startFallbackTimer(fromWordIdx, utteranceStartedAt, waitForStart) {
    clearTimeout(subWordTimer);

    if (!utteranceStartedAt && typeof waitForStart === 'function') {
      // Poll briefly for onstart/onboundary to land, since neither had
      // fired when the fallback timeout elapsed (slow network voice).
      // waitForStart() returns null (not just falsy 0) once this utterance
      // is no longer current, so a stale poll from an abandoned/replaced
      // sentence stops instead of looping forever.
      const poll = () => {
        const started = waitForStart();
        if (started === null) return; // utterance superseded — abandon
        if (started) { startFallbackTimer(fromWordIdx, started); return; }
        subWordTimer = setTimeout(poll, 30);
      };
      poll();
      return;
    }

    let msPerChar = getMsPerChar();

    // Re-estimate pace from how much audio time has already elapsed vs.
    // how much text remains, so the fallback starts in sync rather than
    // already behind by BOUNDARY_FALLBACK_TIMEOUT_MS worth of drift.
    if (utteranceStartedAt) {
      const elapsedMs = performance.now() - utteranceStartedAt;
      const spokenChars = words.slice(0, fromWordIdx).reduce((s, w) => s + w.length + 1, 0);
      if (spokenChars > 0 && elapsedMs > 0) {
        const observed = (elapsedMs * rate) / spokenChars;
        if (observed > 5 && observed < 400) msPerChar = observed;
      }
    }
    setMsPerChar(msPerChar);

    // Cumulative char offset at the start of each word, for elapsed->word mapping.
    const cumChars = [];
    let acc = 0;
    for (const w of words) { cumChars.push(acc); acc += w.length + 1; }

    const clockStart = utteranceStartedAt || performance.now();
    let lastShown = fromWordIdx - 1;

    function tick() {
      const elapsedMs = performance.now() - clockStart;
      const targetChars = (elapsedMs * rate) / msPerChar;
      let idx = lastShown;
      while (idx + 1 < words.length && cumChars[idx + 1] <= targetChars) idx++;
      if (idx > lastShown) {
        lastShown = idx;
        if (onWordBoundary) onWordBoundary(chunkAt(idx));
        pausedWordIdx = idx;
      }
      if (lastShown < words.length - 1) {
        subWordTimer = setTimeout(tick, 60);
      }
    }
    tick();
  }

  // Groups words [idx, idx+chunkSize-1] into a single space-joined string for
  // display, without touching the underlying single-word sync index — audio
  // sync stays keyed to the leading word of the chunk exactly as before.
  function chunkAt(idx) {
    if (chunkSize <= 1) return words[idx];
    return words.slice(idx, idx + chunkSize).join(' ');
  }

  function wordIndexForCharIndex(charIndex) {
    // Find the last word whose start offset is <= charIndex.
    let lo = 0, hi = wordStarts.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (wordStarts[mid] <= charIndex) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }

  function speakSentence(fromWordIdx) {
    const text = sentences[sentenceIdx];
    if (!text) { advanceSentence(); return; }

    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    u.lang = langCode();
    const v = pickVoice();
    if (v) u.voice = v;

    currentUtterance = u;
    usingBoundaryEvents = false;
    let startedAt = 0;
    let lastReportedIdx = -1;
    let lastBoundaryAt = 0; // performance.now() of the previous real boundary event

    clearTimeout(boundaryFallbackTimer);
    boundaryFallbackTimer = setTimeout(() => {
      if (currentUtterance === u && !usingBoundaryEvents && !paused) {
        // No boundary events observed in time — this voice doesn't support
        // them. startedAt may still be 0 here (slow network voice whose
        // onstart hasn't fired yet) — pass a getter so the fallback waits
        // for real playback to begin instead of clocking from "now".
        startFallbackTimer(fromWordIdx, startedAt, () => (currentUtterance === u ? (startedAt || 0) : null));
      }
    }, BOUNDARY_FALLBACK_TIMEOUT_MS);

    u.onstart = function () {
      startedAt = performance.now();
    };

    u.onboundary = function (ev) {
      if (ev.name && ev.name !== 'word') return; // some engines also fire 'sentence'
      const now = performance.now();
      usingBoundaryEvents = true;
      clearTimeout(boundaryFallbackTimer);
      clearTimeout(subWordTimer);
      const idx = wordIndexForCharIndex(ev.charIndex || 0);
      if (idx === lastReportedIdx) return;

      // This event itself already lags the real audio (Chrome/Edge quirk),
      // so showing word N only when N's own event arrives is what produces
      // the audible lag. Instead: show word N right away — it's the best
      // information available for "now" — but use the real gap since the
      // *previous* boundary to predict, and proactively schedule, when word
      // N+1 should appear (interval minus the learned lead offset) rather
      // than waiting for N+1's own late event. If that real event does
      // still land first (short/irregular words), it wins and re-syncs.
      const interval = lastBoundaryAt ? now - lastBoundaryAt : 0;
      lastBoundaryAt = now;
      pausedWordIdx = idx;
      lastReportedIdx = idx;
      if (onWordBoundary) onWordBoundary(chunkAt(idx));

      clearTimeout(wordDisplayTimer);
      if (interval > 0) {
        const nextIdx = idx + 1;
        if (nextIdx < words.length) {
          // Boundary-to-boundary interval measures word pacing, not the
          // event's own lag (there is no signal to observe that lag from
          // boundary events alone — they carry no audio-relative
          // timestamp). getLeadOffset() is a fixed, voice-keyed guess based
          // on the known Chrome/Edge boundary-lag range; the interval only
          // tells us *when* the next word is likely to start.
          const predictedDelay = Math.max(0, interval - getLeadOffset());
          wordDisplayTimer = setTimeout(() => {
            if (nextIdx === lastReportedIdx + 1) {
              lastReportedIdx = nextIdx;
              pausedWordIdx = nextIdx;
              if (onWordBoundary) onWordBoundary(chunkAt(nextIdx));
            }
          }, predictedDelay);
        }
      }
    };

    u.onend = function () {
      clearTimeout(boundaryFallbackTimer);
      clearTimeout(subWordTimer);
      clearTimeout(wordDisplayTimer);
      currentUtterance = null;

      // Calibrate this voice's pace from real elapsed time, for fallback use.
      if (startedAt && text.length > 0) {
        const actualMs = performance.now() - startedAt;
        const observed = (actualMs * rate) / text.length;
        if (observed > 5 && observed < 400) {
          setMsPerChar(getMsPerChar() * 0.35 + observed * 0.65);
        }
      }

      if (paused) return; // resumed later via pauseToggle
      sentenceIdx++;
      if (sentenceIdx < sentences.length) startSentence();
      else if (onStateChange) onStateChange('ended');
    };

    speechSynthesis.speak(u);

    // If resuming mid-sentence in fallback mode, jump straight to that word.
    if (fromWordIdx > 0) {
      // Native pause/resume preserves position; for a full re-speak (fallback
      // path, or browsers without resume support) skip already-said words
      // once boundary/timer confirms playback has actually begun.
    }
  }

  function advanceSentence() {
    sentenceIdx++;
    if (sentenceIdx < sentences.length) {
      startSentence();
    } else if (onStateChange) {
      onStateChange('ended');
    }
  }

  function startSentence() {
    const text = sentences[sentenceIdx];
    const parsed = splitWordsWithOffsets(text || '');
    words = parsed.map(p => p.word);
    wordStarts = parsed.map(p => p.start);
    pausedWordIdx = 0;
    if (onSentenceChange) onSentenceChange(text, sentenceIdx, sentences.length);
    if (!words.length) { advanceSentence(); return; }
    speakSentence(0);
  }

  function play() {
    if (!sentences.length) return;
    paused = false;
    speechSynthesis.cancel();
    if (onStateChange) onStateChange('playing');
    startSentence();
  }

  function pauseToggle() {
    if (paused) {
      paused = false;
      if (onStateChange) onStateChange('playing');
      // Prefer native resume — picks up exactly where audio left off, no repeats.
      if (currentUtterance && speechSynthesis.paused) {
        speechSynthesis.resume();
        if (!usingBoundaryEvents) startFallbackTimer(pausedWordIdx);
      } else {
        // Native pause/resume unsupported for this engine: re-speak the
        // sentence but skip the words already spoken, instead of repeating them.
        speechSynthesis.cancel();
        speakSentence(pausedWordIdx);
      }
    } else if (speechSynthesis.speaking) {
      paused = true;
      clearTimeout(subWordTimer);
      clearTimeout(boundaryFallbackTimer);
      clearTimeout(wordDisplayTimer);
      speechSynthesis.pause();
      if (onStateChange) onStateChange('paused');
    }
  }

  function stop() {
    paused = false;
    clearTimeout(subWordTimer);
    clearTimeout(boundaryFallbackTimer);
    clearTimeout(wordDisplayTimer);
    currentUtterance = null;
    speechSynthesis.cancel();
    if (onStateChange) onStateChange('stopped');
  }

  function next() {
    if (sentenceIdx < sentences.length - 1) { sentenceIdx++; play(); }
  }

  function prev() {
    if (sentenceIdx > 0) { sentenceIdx--; play(); }
  }

  function restart() {
    sentenceIdx = 0;
    play();
  }

  function setChunkSize(n) { chunkSize = Math.max(1, Math.min(3, n | 0)); }
  function setRate(n) { rate = Math.max(0.5, Math.min(2, n)); }
  function setPitch(n) { pitch = Math.max(0, Math.min(2, n)); }
  function setVolume(n) { volume = Math.max(0, Math.min(1, n)); }
  // Converts a target words-per-minute into the TTS rate, using this voice's
  // own observed pace (msPerChar) and an average word length of ~5.3 chars.
  function setTargetWPM(wpm) {
    const AVG_WORD_CHARS = 5.3;
    const naturalWpm = 60000 / (AVG_WORD_CHARS * getMsPerChar());
    setRate(wpm / naturalWpm);
  }
  function getRate() { return rate; }
  function setVoiceURI(uri) {
    voiceURI = uri;
    // Changing voice mid-sentence would otherwise leave the old voice's
    // utterance queued; replay the current sentence immediately with the new one.
    if (speechSynthesis.speaking && !paused) {
      clearTimeout(subWordTimer);
      clearTimeout(boundaryFallbackTimer);
      clearTimeout(wordDisplayTimer);
      speechSynthesis.cancel();
      speakSentence(pausedWordIdx);
    }
  }
  function getVoicesForLang() { return voicesForLang(); }
  function getSentenceIndex() { return sentenceIdx; }
  function getSentenceCount() { return sentences.length; }
  function getProgress() { return sentences.length ? sentenceIdx / sentences.length : 0; }
  function isSpeaking() { return paused || (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking); }

  return {
    load, play, pauseToggle, stop, next, prev, restart,
    setRate, setPitch, setVolume, setVoiceURI, setTargetWPM, setChunkSize, getRate,
    getVoicesForLang, getSentenceIndex, getSentenceCount, getProgress, isSpeaking,
    set onSentenceChange(fn) { onSentenceChange = fn; },
    set onWordBoundary(fn) { onWordBoundary = fn; },
    set onStateChange(fn) { onStateChange = fn; }
  };
})();
