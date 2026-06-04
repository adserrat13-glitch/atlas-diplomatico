const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é um examinador da prova de Segunda Fase do CACD (Concurso de Admissão à Carreira Diplomática).
Avalie a dissertação nos 4 critérios oficiais (0-25 pts cada, total 100):
1. Acuidade Temática: domínio do tema, precisão factual, profundidade analítica
2. Argumentação: coerência lógica, desenvolvimento de teses, uso de evidências e exemplos
3. Organização Textual: estrutura dissertativa, coesão, encadeamento de parágrafos
4. Vocabulário e Gramática: português formal-diplomático, ausência de erros graves

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "acuidade": <inteiro 0-25>,
  "argumentacao": <inteiro 0-25>,
  "organizacao": <inteiro 0-25>,
  "vocabulario": <inteiro 0-25>,
  "total": <soma dos quatro>,
  "feedback": "<2-3 parágrafos em português destacando pontos fortes e sugestões de melhoria>",
  "temas_similares": ["<tema 1>", "<tema 2>", "<tema 3>"]
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { subject, topic_context, essay_text } = req.body || {};

  if (!essay_text || typeof essay_text !== 'string') {
    return res.status(400).json({ error: 'essay_text é obrigatório' });
  }
  const trimmed = essay_text.trim();
  if (trimmed.length < 30) {
    return res.status(400).json({ error: 'Dissertação muito curta (mínimo 30 caracteres)' });
  }
  if (trimmed.length > 12000) {
    return res.status(400).json({ error: 'Dissertação muito longa (máximo 12000 caracteres)' });
  }

  const userContent = [
    subject ? `Matéria: ${subject}` : null,
    topic_context ? `Contexto do tema: ${topic_context}` : null,
    `Dissertação:\n${trimmed}`,
  ].filter(Boolean).join('\n\n');

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
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

    const scores = ['acuidade', 'argumentacao', 'organizacao', 'vocabulario'];
    for (const k of scores) {
      parsed[k] = Math.min(25, Math.max(0, Math.round(Number(parsed[k]) || 0)));
    }
    parsed.total = scores.reduce((s, k) => s + parsed[k], 0);
    if (!Array.isArray(parsed.temas_similares)) parsed.temas_similares = [];
    parsed.temas_similares = parsed.temas_similares.slice(0, 3).map(String);

    return res.status(200).json(parsed);
  } catch (err) {
    const msg = err?.message || 'Erro interno';
    const status = err?.status || 500;
    return res.status(status).json({ error: msg });
  }
}
