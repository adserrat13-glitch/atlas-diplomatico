const Groq = require('groq-sdk');

const SYSTEM_TEORIA = `You are a C2-level grammar expert for the Brazilian diplomatic exam (CACD/IRBr).
Write a rigorous theoretical explanation for the given grammar topic in the specified language.
- Portuguese topics: write in formal Brazilian Portuguese
- English topics: write in formal academic English
- Spanish topics: write in formal Castilian Spanish
Focus on: edge cases, formal exceptions, constructions from literary/diplomatic/legal registers, and common traps in high-level exams.
Do NOT explain basic rules — assume the reader already knows them. Go deep.
Length: ~350 words for conteudo, 3-5 illustrative examples.
Respond ONLY in valid JSON, no markdown, no extra text:
{"conteudo":"...","exemplos":["...","...","..."]}`;

const SYSTEM_QUIZ = `You are a C2-level grammar examiner for the Brazilian diplomatic exam (CACD/IRBr).
Generate 5 multiple-choice questions about the given grammar topic in the specified language.
- Portuguese topics: questions and options in formal Brazilian Portuguese
- English topics: questions and options in formal academic English
- Spanish topics: questions and options in formal Castilian Spanish
Rules:
- All questions must target C2-level difficulty: ambiguous cases, subtle distinctions, formal register nuances
- Avoid trivial or obvious questions — every question must require deep grammatical reasoning
- Each question has exactly 4 options (A-D), only one correct
- Include a detailed explanation for why the correct answer is right and why the others are wrong
Respond ONLY in valid JSON, no markdown, no extra text:
{"questoes":[{"enunciado":"...","opcoes":["A) ...","B) ...","C) ...","D) ..."],"correta":0,"explicacao":"..."}]}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { idioma, topico, modo } = req.body || {};
  if (!idioma || !topico || !modo) {
    return res.status(400).json({ error: 'idioma, topico e modo são obrigatórios' });
  }
  if (!['pt', 'en', 'es'].includes(idioma)) {
    return res.status(400).json({ error: 'idioma inválido' });
  }
  if (!['teoria', 'quiz'].includes(modo)) {
    return res.status(400).json({ error: 'modo deve ser teoria ou quiz' });
  }

  const systemPrompt = modo === 'teoria' ? SYSTEM_TEORIA : SYSTEM_QUIZ;
  const userContent = `Language: ${idioma}\nGrammar topic: ${topico}`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
      max_tokens: modo === 'teoria' ? 1200 : 2000,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Resposta inválida do modelo' }); }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
