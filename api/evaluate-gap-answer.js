const { geminiJSON } = require('./_lib/gemini');

const SYSTEM_PROMPT = `Você é um examinador do CACD avaliando se o candidato realmente domina o conceito testado.

Avalie a resposta do candidato com foco em revelar a LACUNA DE CONHECIMENTO (se existir).

Critérios (0–10 cada):
1. Domínio Conceitual: o candidato demonstra entender o mecanismo, não só a definição
2. Aplicação Prática: consegue usar o conceito para analisar um caso/situação
3. Precisão Técnica: usa corretamente os termos e relações do conceito

Seja cirúrgico: identifique EXATAMENTE qual lacuna foi revelada (ou confirme que não há lacuna).

Responda APENAS em JSON válido, sem markdown:
{
  "dominio": <0-10>,
  "aplicacao": <0-10>,
  "precisao": <0-10>,
  "total": <soma>,
  "lacuna_revelada": "<descrição precisa da lacuna conceitual encontrada, ou 'Nenhuma — candidato demonstra domínio real'>",
  "o_que_faltou": ["<ponto específico ausente ou errado 1>", "<ponto 2>"],
  "o_que_acertou": ["<ponto forte específico 1>"],
  "resposta_modelo": "<resposta de referência que demonstraria domínio real (3-4 frases)>"
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada' });

  const { pergunta, conceito_alvo, resposta } = req.body || {};

  if (!pergunta || typeof pergunta !== 'string')
    return res.status(400).json({ error: 'pergunta é obrigatório' });
  if (!resposta || typeof resposta !== 'string')
    return res.status(400).json({ error: 'resposta é obrigatório' });
  if (resposta.trim().length < 5)
    return res.status(400).json({ error: 'Resposta muito curta' });
  if (resposta.trim().length > 3000)
    return res.status(400).json({ error: 'Resposta muito longa (máximo 3000 caracteres)' });

  const userContent = [
    conceito_alvo ? `Conceito testado: ${conceito_alvo}` : null,
    `Pergunta: ${pergunta.trim()}`,
    `Resposta do candidato:\n${resposta.trim()}`,
  ].filter(Boolean).join('\n\n');

  try {
    const parsed = await geminiJSON({ systemPrompt: SYSTEM_PROMPT, userPrompt: userContent, temperature: 0.3, maxTokens: 1024 });

    const scores = ['dominio', 'aplicacao', 'precisao'];
    for (const k of scores) {
      parsed[k] = Math.min(10, Math.max(0, Math.round(Number(parsed[k]) || 0)));
    }
    parsed.total = scores.reduce((s, k) => s + parsed[k], 0);
    parsed.lacuna_revelada = String(parsed.lacuna_revelada || '');
    if (!Array.isArray(parsed.o_que_faltou)) parsed.o_que_faltou = [];
    if (!Array.isArray(parsed.o_que_acertou)) parsed.o_que_acertou = [];
    parsed.o_que_faltou = parsed.o_que_faltou.slice(0, 5).map(String);
    parsed.o_que_acertou = parsed.o_que_acertou.slice(0, 3).map(String);
    parsed.resposta_modelo = String(parsed.resposta_modelo || '');

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
