const { geminiJSON } = require('./_lib/gemini');

/* ── MODO DE CORREÇÃO (fiel ao system prompt do Tutor de Idiomas CACD) ──
   Nota 0-100, rigor do CACD, tabela de 5 categorias, reescrita de trechos,
   soluções nível C2 e observações de diplomata. Saída em JSON estruturado. */

const SYSTEM_PROMPT = `Você é um examinador e professor do CACD (Concurso de Admissão à Carreira de Diplomata), com domínio nativo de inglês, espanhol e português. Corrija a resposta do candidato simulando o rigor do CACD e padrão equivalente ao nível C2 do CEFR.

Você receberá: o MODO do exercício, o ENUNCIADO/TEXTO-FONTE e a RESPOSTA DO CANDIDATO.

Avalie:
- Erros gramaticais
- Erros de vocabulário
- Problemas de estilo
- Problemas de coesão
- Problemas de registro
- Adequação ao tema/enunciado (e, em traduções, fidelidade ao texto-fonte)

Atribua uma nota de 0 a 100. Se a nota for superior a 90, faça observações refinadas de estilo e naturalidade.

Reescreva trechos problemáticos, mostrando soluções de nível C2 e explicando como um diplomata ou tradutor profissional escreveria a mesma ideia.

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "score": <inteiro 0-100>,
  "table": [
    {"categoria":"Gramática","nota":<0-100>},
    {"categoria":"Vocabulário","nota":<0-100>},
    {"categoria":"Clareza","nota":<0-100>},
    {"categoria":"Estilo","nota":<0-100>},
    {"categoria":"Adequação ao tema","nota":<0-100>}
  ],
  "errors": [{"trecho":"...","problema":"...","correcao":"..."}],
  "rewrites": [{"original":"...","c2":"..."}],
  "diplomatic_note": "<como um diplomata/tradutor profissional escreveria a mesma ideia>",
  "summary": "<avaliação geral em 1-2 frases>"
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada' });

  const { mode, prompt, answer } = req.body || {};
  if (!answer || answer.trim().length < 10) {
    return res.status(400).json({ error: 'answer é obrigatório' });
  }

  const userContent = [
    `MODO: ${mode || '(não informado)'}`,
    `ENUNCIADO / TEXTO-FONTE:\n${String(prompt || '').slice(0, 8000)}`,
    `RESPOSTA DO CANDIDATO:\n${String(answer).slice(0, 8000)}`,
  ].join('\n\n');

  try {
    const parsed = await geminiJSON({ systemPrompt: SYSTEM_PROMPT, userPrompt: userContent, temperature: 0.3, maxTokens: 4096 });

    return res.status(200).json({
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null,
      table: Array.isArray(parsed.table) ? parsed.table.slice(0, 5) : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors.slice(0, 30) : [],
      rewrites: Array.isArray(parsed.rewrites) ? parsed.rewrites.slice(0, 30) : [],
      diplomatic_note: String(parsed.diplomatic_note || '').trim(),
      summary: String(parsed.summary || '').trim(),
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
