const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é professor especializado no CACD (Concurso de Admissão à Carreira Diplomática).
A partir de uma questão de CERTO/ERRADO que o candidato errou, gere um flashcard didático.
front = conceito principal da questão (nome do tema, máx 80 chars).
back = explicação clara e objetiva do que é correto e por quê (2-3 frases, sem rodeios).
Responda APENAS em JSON válido, sem markdown, sem texto extra:
{"front":"...","back":"..."}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { question, correct_answer, subject_label, section } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question é obrigatório' });

  const userContent = [
    subject_label ? `Matéria: ${subject_label}` : null,
    section ? `Tópico: ${section}` : null,
    `Questão: ${question}`,
    `Resposta correta: ${correct_answer || ''}`,
  ].filter(Boolean).join('\n');

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Resposta inválida do modelo' }); }

    return res.status(200).json({
      front: String(parsed.front || '').trim().slice(0, 120),
      back: String(parsed.back || '').trim().slice(0, 600),
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
