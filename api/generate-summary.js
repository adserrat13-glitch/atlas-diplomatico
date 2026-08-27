const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é professor especializado no CACD (Concurso de Admissão à Carreira Diplomática).
A partir de uma lista de questões de CERTO/ERRADO que o candidato errou, gere um resumo em bullet points,
bem sucinto, cobrindo os pontos-chave que o candidato precisa revisar.
Cada bullet point deve ser uma frase curta e objetiva (máx 1-2 linhas), afirmando o conceito correto
(não repita a questão, vá direto ao ponto que precisa ser corrigido/entendido).
Agrupe por tema quando fizer sentido. Não use markdown além do "-" no início de cada bullet.
Responda APENAS em JSON válido, sem markdown, sem texto extra:
{"bullets":["...", "..."]}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items é obrigatório' });

  const userContent = items.slice(0, 40).map((it, i) =>
    [
      `${i + 1}. Questão: ${it.question || ''}`,
      it.subject_label ? `Matéria: ${it.subject_label}` : null,
      `Resposta correta: ${it.correct_answer || ''}`,
    ].filter(Boolean).join(' | ')
  ).join('\n');

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Resposta inválida do modelo' }); }

    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.map(b => String(b || '').trim()).filter(Boolean).slice(0, 40)
      : [];

    return res.status(200).json({ bullets });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
