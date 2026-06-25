const { geminiJSON } = require('./_lib/gemini');

const SYSTEM_PROMPT = `Você é um examinador da prova de Terceira Fase do CACD (Concurso de Admissão à Carreira Diplomática).
Avalie a resposta do candidato a uma questão aberta dissertativa em 3 critérios (0–10 cada, total 30):
1. Precisão Factual (0–10): fatos corretos, datas, conceitos, personagens e eventos apresentados com exatidão
2. Profundidade Analítica (0–10): vai além da superfície, identifica relações causais, consequências, nuances e diferentes perspectivas
3. Clareza e Linguagem (0–10): português formal-diplomático, objetividade, estrutura lógica da resposta

Regras para o feedback:
- "erros" deve listar CADA erro factual ou omissão importante da resposta do candidato, de forma específica (ex: "Confundiu o Tratado de Assunção (1991) com o de Ouro Preto (1994)"). Se não houver erros, retorne array vazio.
- "correcoes" deve indicar, para CADA erro listado, o que está correto (mesma ordem dos erros).
- "pontos_fortes" deve listar o que o candidato acertou bem, de forma específica.
- "resposta_modelo" deve ser uma resposta de referência completa (3–5 frases) que cobriria todos os pontos essenciais.

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "precisao": <inteiro 0-10>,
  "profundidade": <inteiro 0-10>,
  "clareza": <inteiro 0-10>,
  "total": <soma dos três>,
  "erros": ["<erro específico 1>", "<erro específico 2>"],
  "correcoes": ["<o que está correto 1>", "<o que está correto 2>"],
  "pontos_fortes": ["<ponto forte 1>", "<ponto forte 2>"],
  "resposta_modelo": "<resposta de referência completa em 3-5 frases>"
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada' });

  const { question, answer, subject } = req.body || {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question é obrigatório' });
  }
  if (!answer || typeof answer !== 'string') {
    return res.status(400).json({ error: 'answer é obrigatório' });
  }
  const trimmedAnswer = answer.trim();
  if (trimmedAnswer.length < 10) {
    return res.status(400).json({ error: 'Resposta muito curta (mínimo 10 caracteres)' });
  }
  if (trimmedAnswer.length > 6000) {
    return res.status(400).json({ error: 'Resposta muito longa (máximo 6000 caracteres)' });
  }

  const userContent = [
    subject ? `Matéria: ${subject}` : null,
    `Questão: ${question.trim()}`,
    `Resposta do candidato:\n${trimmedAnswer}`,
  ].filter(Boolean).join('\n\n');

  try {
    const parsed = await geminiJSON({ systemPrompt: SYSTEM_PROMPT, userPrompt: userContent, temperature: 0.3, maxTokens: 1024 });

    const scores = ['precisao', 'profundidade', 'clareza'];
    for (const k of scores) {
      parsed[k] = Math.min(10, Math.max(0, Math.round(Number(parsed[k]) || 0)));
    }
    parsed.total = scores.reduce((s, k) => s + parsed[k], 0);
    if (!Array.isArray(parsed.erros))         parsed.erros = [];
    if (!Array.isArray(parsed.correcoes))     parsed.correcoes = [];
    if (!Array.isArray(parsed.pontos_fortes)) parsed.pontos_fortes = [];
    parsed.erros         = parsed.erros.slice(0, 5).map(String);
    parsed.correcoes     = parsed.correcoes.slice(0, 5).map(String);
    parsed.pontos_fortes = parsed.pontos_fortes.slice(0, 4).map(String);
    parsed.resposta_modelo = String(parsed.resposta_modelo || '');

    return res.status(200).json(parsed);
  } catch (err) {
    const msg = err?.message || 'Erro interno';
    const status = err?.status || 500;
    return res.status(status).json({ error: msg });
  }
}
