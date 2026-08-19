const { groqCall } = require('./_lib/groq-client');

// Groq PlayAI TTS voice ids usable for module languages. PlayAI's stable
// voices are English/Arabic; non-English languages reuse the same voices —
// pronunciation quality varies but every module language is coverable this way.
const VOICES = [
  { id: 'Fritz-PlayAI',    label: 'Fritz (masculino)' },
  { id: 'Arista-PlayAI',   label: 'Arista (feminino)' },
  { id: 'Atlas-PlayAI',    label: 'Atlas (masculino)' },
  { id: 'Indigo-PlayAI',   label: 'Indigo (neutro)' },
  { id: 'Mikail-PlayAI',   label: 'Mikail (masculino)' },
  { id: 'Thunder-PlayAI',  label: 'Thunder (masculino grave)' }
];
const DEFAULT_VOICE = 'Fritz-PlayAI';
const TTS_MODEL = 'playai-tts';
const WHISPER_MODEL = 'whisper-large-v3';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ voices: VOICES, defaultVoice: DEFAULT_VOICE });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text é obrigatório' });
    }
    const voiceId = VOICES.some(v => v.id === voice) ? voice : DEFAULT_VOICE;

    const speechResponse = await groqCall(client => client.audio.speech.create({
      model: TTS_MODEL,
      voice: voiceId,
      input: text,
      response_format: 'wav'
    }));
    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());

    const transcription = await groqCall(client => client.audio.transcriptions.create({
      file: new File([audioBuffer], 'speech.wav', { type: 'audio/wav' }),
      model: WHISPER_MODEL,
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    }));

    const words = (transcription.words || []).map(w => ({
      word: w.word,
      start: w.start,
      end: w.end
    }));

    return res.status(200).json({
      audio: audioBuffer.toString('base64'),
      mime: 'audio/wav',
      words
    });
  } catch (err) {
    console.error('speed-read-tts error:', err);
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({ error: err?.message || 'Falha ao gerar áudio' });
  }
};
