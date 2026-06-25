const { geminiJSON } = require('./_lib/gemini');

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

  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada' });

  const { text } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ error: 'text é obrigatório' });

  try {
    const parsed = await geminiJSON({ systemPrompt: SYSTEM_PROMPT, userPrompt: text.slice(0, 12000), temperature: 0.3, maxTokens: 4096 });

    return res.status(200).json({
      corrected: String(parsed.corrected || '').trim(),
      changes: Array.isArray(parsed.changes) ? parsed.changes.slice(0, 20) : [],
      summary: String(parsed.summary || '').trim(),
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
