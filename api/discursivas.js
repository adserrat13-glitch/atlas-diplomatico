const { groqCreate } = require('./_lib/groq-client');
const { authenticate } = require('./_lib/auth');

const APPROVAL_THRESHOLD = 80;

const SYSTEM_PROMPT = `Você é um corretor de questões discursivas para um candidato do CACD (Concurso de Admissão à Carreira Diplomática).

Sua tarefa é comparar a resposta do candidato com a resposta de referência e avaliar a COMPREENSÃO DO CONTEÚDO, não a similaridade textual.

Regras obrigatórias:
- Aceite respostas escritas com palavras diferentes das da resposta de referência, desde que o significado esteja correto.
- Não penalize diferenças de estilo, ordem das ideias ou redação.
- Avalie principalmente: precisão conceitual, completude, entendimento do tema, ausência de erros graves, equivalência semântica.
- Penalize apenas erros conceituais relevantes (fatos errados, confusões de conceito, afirmações incorretas). Pequenas imprecisões de redação não devem reduzir a nota.
- "correct_points" deve listar os pontos do conteúdo que o candidato acertou, de forma específica.
- "missing_points" deve listar os pontos essenciais da resposta de referência que o candidato não mencionou.
- "errors" deve listar erros conceituais graves cometidos pelo candidato (array vazio se não houver).
- "feedback" deve ter entre 2 e 5 linhas, direto e construtivo.

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "score": <inteiro 0-100>,
  "correct_points": ["...", "..."],
  "missing_points": ["...", "..."],
  "errors": ["..."],
  "feedback": "..."
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await authenticate(req);
  if (auth.error) return res.status(401).json({ error: auth.error });

  const { question, referenceAnswer, userAnswer } = req.body || {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question é obrigatório' });
  }
  if (!referenceAnswer || typeof referenceAnswer !== 'string') {
    return res.status(400).json({ error: 'referenceAnswer é obrigatório' });
  }
  if (!userAnswer || typeof userAnswer !== 'string') {
    return res.status(400).json({ error: 'userAnswer é obrigatório' });
  }
  const trimmedAnswer = userAnswer.trim();
  if (trimmedAnswer.length < 5) {
    return res.status(400).json({ error: 'Resposta muito curta (mínimo 5 caracteres)' });
  }
  if (trimmedAnswer.length > 6000) {
    return res.status(400).json({ error: 'Resposta muito longa (máximo 6000 caracteres)' });
  }

  const userContent = [
    `Pergunta: ${question.trim()}`,
    `Resposta de referência: ${referenceAnswer.trim()}`,
    `Resposta do candidato:\n${trimmedAnswer}`,
  ].join('\n\n');

  try {
    const completion = await groqCreate({
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

    parsed.score = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 0)));
    parsed.approved = parsed.score >= APPROVAL_THRESHOLD;
    if (!Array.isArray(parsed.correct_points)) parsed.correct_points = [];
    if (!Array.isArray(parsed.missing_points)) parsed.missing_points = [];
    if (!Array.isArray(parsed.errors))         parsed.errors = [];
    parsed.correct_points = parsed.correct_points.slice(0, 6).map(String);
    parsed.missing_points = parsed.missing_points.slice(0, 6).map(String);
    parsed.errors         = parsed.errors.slice(0, 5).map(String);
    parsed.feedback = String(parsed.feedback || '');

    return res.status(200).json(parsed);
  } catch (err) {
    const msg = err?.message || 'Erro interno';
    const status = err?.status || 500;
    return res.status(status).json({ error: msg });
  }
};
