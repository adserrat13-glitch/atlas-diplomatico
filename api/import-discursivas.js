const { getSupabase } = require('./lp/_lib/supabase-client');
const { requireAdmin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items (array) é obrigatório' });
  }

  const rows = items
    .filter(it => it && typeof it.category === 'string' && typeof it.question === 'string' && typeof it.reference_answer === 'string')
    .map(it => ({
      category: it.category.trim(),
      question: it.question.trim(),
      reference_answer: it.reference_answer.trim(),
    }))
    .filter(it => it.category && it.question && it.reference_answer);

  if (!rows.length) {
    return res.status(400).json({ error: 'Nenhum item válido em items' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('discursivas_questions')
      .upsert(rows, { onConflict: 'category,question', ignoreDuplicates: true })
      .select('id');

    if (error) throw error;

    return res.status(200).json({
      received: rows.length,
      inserted: data ? data.length : 0,
    });
  } catch (err) {
    const msg = err?.message || 'Erro interno';
    return res.status(500).json({ error: msg });
  }
};
