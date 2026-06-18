const Groq = require('groq-sdk');

/* ── Prompts por modo (derivados do system prompt do Tutor de Idiomas CACD) ──
   Cada prompt instrui o modelo a gerar um exercício INÉDITO, nível B2 avançado/C1/C2,
   com temas relevantes ao CACD. NUNCA fornecer gabarito/texto-modelo.
   Saída sempre em JSON estruturado para o front renderizar. */

const CACD_THEMES =
  'Temas relevantes ao CACD: política internacional, relações internacionais, ' +
  'história mundial, história do Brasil, geopolítica, economia internacional, ' +
  'comércio exterior, meio ambiente, energia, organizações internacionais, ' +
  'direitos humanos, segurança internacional, integração regional, ' +
  'tecnologia e IA, desenvolvimento econômico, governança global.';

const BASE_RULES =
  'Regras: o conteúdo deve ser 100% original e inédito; linguagem sofisticada, ' +
  'natural e contemporânea; nível entre B2 avançado, C1 e C2. ' + CACD_THEMES +
  ' Responda APENAS em JSON válido, sem markdown e sem texto extra.';

const PROMPTS = {
  // MODO 1 — COMPOSITION (inglês)
  COMPOSITION: `You are a CACD examiner. Generate an ORIGINAL English composition prompt in CACD style.
${BASE_RULES}
JSON schema:
{"title":"<exam-style title>","task":"<precise instructions in English>","points":["<point 1>","<point 2>","<point 3>"],"word_count":"350-500 words","difficulty":"C1 or C2"}
Provide 3 to 5 points to consider. Do NOT write the essay.`,

  // MODO 2 — PTEN (português → inglês)
  PTEN: `You are a CACD translation examiner. Generate an ORIGINAL Portuguese text (120-220 words),
journalistic, essayistic or diplomatic in style, C1/C2 level, on a CACD-relevant theme.
${BASE_RULES}
JSON schema:
{"source_text":"<texto em português>","instruction":"Translate into English."}
Do NOT provide any answer key or translation.`,

  // MODO 3 — ENPT (inglês → português)
  ENPT: `You are a CACD translation examiner. Generate an ORIGINAL English text (120-220 words),
C1/C2 level, on a CACD-relevant theme.
${BASE_RULES}
JSON schema:
{"source_text":"<text in English>","instruction":"Translate into Portuguese."}
Do NOT provide any answer key or translation.`,

  // MODO 4 — SUMMARY (inglês)
  SUMMARY: `You are a CACD examiner. Generate an ORIGINAL English text (350-600 words), C1/C2 level,
on a CACD-relevant theme, suitable for a summarising exercise.
${BASE_RULES}
JSON schema:
{"source_text":"<text in English>","instruction":"Summarize the text in 120-180 words."}
Do NOT provide any model summary.`,

  // MODO 5 — PTESP (português → espanhol)
  PTESP: `Eres examinador del CACD. Genera un texto ORIGINAL en portugués (120-220 palabras),
nivel C1/C2, sobre un tema relevante para el CACD.
${BASE_RULES}
Esquema JSON:
{"source_text":"<texto en portugués>","instruction":"Traduzca al español."}
No proporciones ninguna traducción ni clave de respuestas.`,

  // MODO 6 — ESPPT (espanhol → português)
  ESPPT: `Eres examinador del CACD. Genera un texto ORIGINAL en español (120-220 palabras),
nivel C1/C2, sobre un tema relevante para el CACD.
${BASE_RULES}
Esquema JSON:
{"source_text":"<texto en español>","instruction":"Traduza para o português."}
No proporciones ninguna traducción ni clave de respuestas.`,

  // MODO 7 — RESUMEN (espanhol)
  RESUMEN: `Eres examinador del CACD. Genera un texto ORIGINAL en español (350-600 palabras),
nivel C1/C2, sobre un tema relevante para el CACD, apto para un ejercicio de resumen.
${BASE_RULES}
Esquema JSON:
{"source_text":"<texto en español>","instruction":"Redacte un resumen de 120-180 palabras."}
No proporciones ningún resumen modelo.`,
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { mode } = req.body || {};
  const systemPrompt = PROMPTS[mode];
  if (!systemPrompt) return res.status(400).json({ error: 'mode inválido' });

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        // Carimbo aleatório força variação e evita repetição entre chamadas.
        { role: 'user', content: `Gere um novo exercício inédito. ref:${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ],
      temperature: 0.9,
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Resposta inválida do modelo' }); }

    return res.status(200).json({ mode, exercise: parsed });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
