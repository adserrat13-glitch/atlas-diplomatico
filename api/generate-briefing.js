const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é professor especialista em concursos diplomáticos (CACD).
Para o tema fornecido, gere exatamente 6 bullet points concisos em português que indiquem
os principais pontos, argumentos e exemplos a abordar numa dissertação de 2ª Fase do CACD.
Cada bullet deve ter 1-2 linhas, ser direto e acionável.
Responda APENAS em JSON válido, sem markdown, sem texto extra:
{ "bullets": ["<ponto 1>", "<ponto 2>", "<ponto 3>", "<ponto 4>", "<ponto 5>", "<ponto 6>"] }`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { subject, topico, descricao } = req.body || {};

  if (!topico || typeof topico !== 'string' || !topico.trim()) {
    return res.status(400).json({ error: 'topico é obrigatório' });
  }

  const parts = [
    subject ? `Matéria: ${subject}` : null,
    `Tópico: ${topico.trim()}`,
    descricao ? `Descrição: ${descricao.trim()}` : null,
  ].filter(Boolean);

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: parts.join('\n') },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Resposta do modelo não é JSON válido' });
    }

    if (!Array.isArray(parsed.bullets)) parsed.bullets = [];
    parsed.bullets = parsed.bullets.slice(0, 6).map(String);

    return res.status(200).json(parsed);
  } catch (err) {
    const msg = err?.message || 'Erro interno';
    const status = err?.status || 500;
    return res.status(status).json({ error: msg });
  }
};
