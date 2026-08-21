/* Atlas Diplomático — Groq TTS engine
   Replaces the browser speechSynthesis engine with Groq Orpheus TTS audio
   plus Whisper word-level timestamps, so word-boundary sync is driven by
   the audio's own transcription instead of an estimated timer. Exposes the
   global TTSEngine (same name/interface as the old browser-based
   tts-engine.js) so the page controller code is unchanged. */

const GroqTTSEngine = (function () {
  const API_URL = 'api/tutor.js?tool=speed-read-tts';

  let sentences = [];
  let sentenceIdx = 0;
  let rate = 1.0;
  let volume = 1.0;
  let voiceId = null;
  let chunkSize = 1;
  let sentencePauseMs = 500; // gap between sentences: short=150, medium=500, long=1000
  let paused = false;
  let onSentenceChange = null;
  let onWordBoundary = null;
  let onStateChange = null;
  let onUsageChange = null;
  let onLoadProgress = null;

  // Bumped by load() so a preload run from a superseded text (user switched
  // text/language while preloading) can recognize it's stale and stop.
  let loadToken = 0;

  const audio = new Audio();
  audio.preload = 'auto';

  // sentenceIdx -> { url, words: [{word,start,end}] }, kept for the session
  // so srPrev/srRestart/WPM changes replay instantly with no refetch.
  const cache = new Map();
  const pending = new Map(); // sentenceIdx -> in-flight fetch promise

  let currentWords = [];
  let rafId = null;
  let lastReportedIdx = -1;
  let lastReportedChunkStart = -1;
  // Bumped by reset()/startSentence() so a stale in-flight fetch or play()
  // from a superseded call (voice change, rapid next/prev, WPM change while
  // loading) can recognize it's obsolete and skip touching audio/state.
  let playToken = 0;

  function reset() {
    playToken++;
    cancelAnimationFrame(rafId);
    audio.pause();
    audio.src = '';
    currentWords = [];
    lastReportedIdx = -1;
    lastReportedChunkStart = -1;
  }

  function load(textObj, language) {
    loadToken++;
    reset();
    cache.clear();
    pending.clear();
    sentences = (textObj.text || '').match(/[^.!?…]+[.!?…]*/g) || [textObj.text || ''];
    // Drop fragments with no letter/digit (stray punctuation/quotes left
    // over from the split, e.g. a lone "..." between sentences) — Groq's
    // API rejects those with a 400, which used to surface silently as a
    // per-sentence on-demand fetch failure but now aborts the whole preload.
    sentences = sentences.map(s => s.trim()).filter(s => s && /[\p{L}\p{N}]/u.test(s));
    sentenceIdx = 0;
    preloadAll();
  }

  // Preloading every sentence at full concurrency blew through Groq's
  // per-minute token rate limit on long texts (149 sentences fired near-
  // simultaneously). Instead: load a small head window fast (so playback
  // can start almost immediately) at low concurrency, then keep fetching
  // the rest in small spaced-out batches in the background while the user
  // is reading, well under the rate limit.
  const PRELOAD_HEAD = 20;
  const PRELOAD_HEAD_CONCURRENCY = 2;
  const PRELOAD_BATCH_SIZE = 5;
  const PRELOAD_BATCH_DELAY_MS = 4000;

  async function preloadRange(myToken, start, end, concurrency) {
    let next = start;
    async function worker() {
      while (true) {
        if (myToken !== loadToken) return; // superseded by a newer load()
        const idx = next++;
        if (idx >= end) return;
        try {
          await fetchSentence(idx);
        } catch (err) {
          console.error('GroqTTSEngine preload error:', err);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, end - start) }, worker));
  }

  async function preloadAll() {
    const myToken = loadToken;
    const total = sentences.length;
    if (!total) return;

    const headEnd = Math.min(PRELOAD_HEAD, total);
    if (onLoadProgress) onLoadProgress(0, headEnd);
    await preloadRange(myToken, 0, headEnd, PRELOAD_HEAD_CONCURRENCY);
    if (myToken !== loadToken) return;
    if (onLoadProgress) onLoadProgress(headEnd, headEnd);

    // Background: fetch the remainder in small batches with a pause between
    // each, so total request rate stays well under Groq's per-minute cap.
    for (let start = headEnd; start < total; start += PRELOAD_BATCH_SIZE) {
      if (myToken !== loadToken) return;
      await new Promise(r => setTimeout(r, PRELOAD_BATCH_DELAY_MS));
      if (myToken !== loadToken) return;
      await preloadRange(myToken, start, Math.min(start + PRELOAD_BATCH_SIZE, total), 2);
    }
  }

  async function fetchSentence(idx) {
    if (cache.has(idx)) return cache.get(idx);
    if (pending.has(idx)) return pending.get(idx);
    const text = sentences[idx];
    if (!text) return null;

    const p = fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceId })
    })
      .then(r => r.json().then(data => {
        if (!r.ok) throw new Error(data.error || 'Falha ao gerar áudio');
        if (data.usage && onUsageChange) onUsageChange(data.usage.used, data.usage.limit);
        const blob = b64ToBlob(data.audio, data.mime || 'audio/wav');
        const entry = { url: URL.createObjectURL(blob), words: data.words || [] };
        cache.set(idx, entry);
        return entry;
      }))
      .finally(() => pending.delete(idx));

    pending.set(idx, p);
    return p;
  }

  function b64ToBlob(b64, mime) {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function tick() {
    const t = audio.currentTime;
    let idx = lastReportedIdx;
    while (idx + 1 < currentWords.length && currentWords[idx + 1].start <= t) idx++;
    if (idx > lastReportedIdx) {
      // Report in chunkSize-word groups: align the chunk's start to a
      // chunkSize boundary so flashes are stable regardless of which word
      // in the chunk the audio just crossed.
      const chunkStart = Math.floor(idx / chunkSize) * chunkSize;
      if (chunkStart > lastReportedChunkStart) {
        lastReportedChunkStart = chunkStart;
        const chunkEnd = Math.min(chunkStart + chunkSize, currentWords.length);
        const text = currentWords.slice(chunkStart, chunkEnd).map(w => w.word).join(' ');
        if (onWordBoundary) onWordBoundary(text);
      }
      lastReportedIdx = idx;
    }
    rafId = requestAnimationFrame(tick);
  }

  async function startSentence() {
    const myToken = ++playToken;
    const text = sentences[sentenceIdx];
    if (!text) { if (onStateChange) onStateChange('ended'); return; }
    if (onSentenceChange) onSentenceChange(text, sentenceIdx, sentences.length);

    let entry;
    try {
      entry = await fetchSentence(sentenceIdx);
    } catch (err) {
      if (myToken !== playToken) return; // superseded while fetching
      if (onWordBoundary) onWordBoundary('—');
      if (onStateChange) onStateChange('error', err.message);
      console.error('GroqTTSEngine:', err);
      return;
    }
    if (myToken !== playToken) return; // superseded (voice/text/next/prev changed while fetching)

    currentWords = entry.words;
    lastReportedIdx = -1;
    lastReportedChunkStart = -1;
    audio.src = entry.url;
    audio.playbackRate = rate;
    audio.volume = volume;

    audio.onended = () => {
      if (myToken !== playToken) return;
      cancelAnimationFrame(rafId);
      if (paused) return;
      sentenceIdx++;
      if (sentenceIdx >= sentences.length) { if (onStateChange) onStateChange('ended'); return; }
      setTimeout(() => {
        if (myToken !== playToken || paused) return; // superseded or paused during the gap
        startSentence();
      }, sentencePauseMs);
    };

    try {
      await audio.play();
      if (myToken !== playToken) return; // superseded while play() was pending
      if (onStateChange) onStateChange('playing');
      rafId = requestAnimationFrame(tick);
    } catch (err) {
      if (myToken !== playToken || err.name === 'AbortError') return; // expected: superseded by a newer load/play
      console.error('GroqTTSEngine playback error:', err);
      if (onStateChange) onStateChange('error');
    }
  }

  function play() {
    if (!sentences.length) return;
    paused = false;
    startSentence();
  }

  function pauseToggle() {
    if (paused) {
      paused = false;
      if (!audio.src) { startSentence(); return; } // src was cleared (reset) while paused — reload it
      const myToken = playToken;
      audio.play().then(() => {
        if (myToken !== playToken) return;
        rafId = requestAnimationFrame(tick);
        if (onStateChange) onStateChange('playing');
      }).catch(err => {
        if (myToken !== playToken || err.name === 'AbortError') return;
        console.error('GroqTTSEngine resume error:', err);
        if (onStateChange) onStateChange('error');
      });
    } else if (!audio.paused) {
      paused = true;
      cancelAnimationFrame(rafId);
      audio.pause();
      if (onStateChange) onStateChange('paused');
    }
  }

  function stop() {
    paused = false;
    reset();
    if (onStateChange) onStateChange('stopped');
  }

  function next() {
    if (sentenceIdx < sentences.length - 1) { sentenceIdx++; reset(); play(); }
  }
  function prev() {
    if (sentenceIdx > 0) { sentenceIdx--; reset(); play(); }
  }
  function restart() {
    sentenceIdx = 0;
    reset();
    play();
  }

  function setRate(n) {
    rate = Math.max(0.5, Math.min(2, n));
    audio.playbackRate = rate;
  }
  function setPitch() { /* Groq PlayAI has no runtime pitch control */ }
  function setVolume(n) {
    volume = Math.max(0, Math.min(1, n));
    audio.volume = volume;
  }
  // No natural-pace calibration available before first fetch; use a fixed
  // average so WPM chips behave sanely from the first sentence onward.
  function setTargetWPM(wpm) {
    const NATURAL_WPM = 150;
    setRate(wpm / NATURAL_WPM);
  }
  function getRate() { return rate; }
  function setChunkSize(n) {
    chunkSize = Math.max(1, Math.min(3, n));
    lastReportedChunkStart = -1; // re-align chunk boundaries on next tick
  }
  function setSentencePause(ms) { sentencePauseMs = Math.max(0, ms); }
  function setVoiceURI(id) {
    voiceId = id;
    loadToken++; // invalidate any in-flight preload run for the old voice
    cache.clear(); // cached audio was generated with the old voice
    pending.clear();
    if (sentences.length) preloadAll();
    if (!paused && sentences.length) { reset(); startSentence(); }
  }
  function getVoicesForLang() { return []; } // populated separately via GET on the API

  function getSentenceIndex() { return sentenceIdx; }
  function getSentenceCount() { return sentences.length; }
  function getProgress() { return sentences.length ? sentenceIdx / sentences.length : 0; }
  function isSpeaking() { return paused || !audio.paused; }

  return {
    load, play, pauseToggle, stop, next, prev, restart,
    setRate, setPitch, setVolume, setVoiceURI, setTargetWPM, setChunkSize, setSentencePause, getRate,
    getVoicesForLang, getSentenceIndex, getSentenceCount, getProgress, isSpeaking,
    set onSentenceChange(fn) { onSentenceChange = fn; },
    set onWordBoundary(fn) { onWordBoundary = fn; },
    set onStateChange(fn) { onStateChange = fn; },
    set onUsageChange(fn) { onUsageChange = fn; },
    set onLoadProgress(fn) { onLoadProgress = fn; }
  };
})();
