const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é revisor especializado em redações para concursos públicos de alto nível, em especial o CACD (Carreira Diplomática), padrão CESPE/CEBRASPE.
Corrija o texto abaixo mantendo as ideias do autor.
Foque em: clareza e objetividade; vocabulário formal-diplomático; coesão e coerência; gramática e concordância; eliminação de repetições e coloquialismos.
Responda APENAS em JSON válido, sem markdown, sem texto extra:
{"corrected":"<texto corrigido completo>","changes":[{"original":"...","corrected":"...","reason":"..."}],"summary":"<avaliação geral em 1 frase>"}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { text } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ error: 'text é obrigatório' });

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 12000) },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Resposta inválida do modelo' }); }

    return res.status(200).json({
      corrected: String(parsed.corrected || '').trim(),
      changes: Array.isArray(parsed.changes) ? parsed.changes.slice(0, 20) : [],
      summary: String(parsed.summary || '').trim(),
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
