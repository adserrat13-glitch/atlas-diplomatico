const { groqCreate } = require('./_lib/groq-client');

/* ── Prompts por modo (derivados do system prompt do Tutor de Idiomas CACD) ──
   Cada prompt instrui o modelo a gerar um exercício INÉDITO, nível B2 avançado/C1/C2,
   com temas relevantes ao CACD. NUNCA fornecer gabarito/texto-modelo.
   Saída sempre em JSON estruturado para o front renderizar. */

const CACD_TOPIC_POOL = [
  'reforma do Conselho de Segurança da ONU e multilateralismo',
  'disputas comerciais e OMC',
  'acordos de livre-comércio e protecionismo',
  'mudança climática e acordos multilaterais (Acordo de Paris, COPs)',
  'transição energética e segurança energética',
  'tratados de direitos humanos e direito internacional humanitário',
  'imunidade diplomática e Convenção de Viena',
  'integração regional no Mercosul',
  'integração regional na União Europeia',
  'integração regional na União Africana e ASEAN',
  'operações de paz e intervenção humanitária',
  'não-proliferação nuclear e controle de armamentos',
  'competição geopolítica no Indo-Pacífico e disputas no Mar do Sul da China',
  'governança global e reforma das instituições de Bretton Woods',
  'dívida externa, condicionalidades do FMI e financiamento do desenvolvimento',
  'migrações, refugiados e proteção internacional',
  'política externa brasileira e diplomacia presidencial',
  'BRICS e cooperação Sul-Sul',
  'G20 e governança econômica global',
  'segurança cibernética e governança da internet',
  'inteligência artificial e regulação tecnológica',
  'geopolítica da tecnologia e disputa por semicondutores',
  'biodiversidade, Amazônia e diplomacia ambiental',
  'crise no Oriente Médio e diplomacia regional',
  'guerra e diplomacia no Leste Europeu',
  'conflitos e mediação de crises na África',
  'história diplomática do Brasil e o Barão do Rio Branco',
  'política externa republicana brasileira',
  'a ONU e a arquitetura de segurança coletiva',
  'a OMC e o sistema multilateral de comércio',
  'o FMI, o Banco Mundial e a arquitetura financeira internacional',
  'a OCDE e padrões de governança econômica',
  'diplomacia comercial e cadeias globais de valor',
  'segurança alimentar e diplomacia agrícola',
  'saúde global e diplomacia sanitária (OMS, pandemias)',
  'espaço exterior e direito internacional espacial',
  'diplomacia cultural e soft power',
  'diplomacia climática e transição justa',
  'sanções internacionais e direito internacional',
  'direito do mar e a Convenção de Montego Bay',
];

function pickRandomTopic() {
  return CACD_TOPIC_POOL[Math.floor(Math.random() * CACD_TOPIC_POOL.length)];
}

function buildThemeInstruction() {
  const chosen = pickRandomTopic();
  return `Tema obrigatório para este exercício: "${chosen}". Desenvolva o texto exclusivamente sobre esse tema — não substitua por outro tema, mesmo que pareça mais familiar.`;
}

const REGISTER_GUIDANCE =
  'Registro e vocabulário: utilize terminologia técnica própria de tratados, ' +
  'documentos diplomáticos e organismos internacionais (ex.: "communiqué", ' +
  '"multilateral framework", "ratification", "sanctions regime", "bilateral accord"); ' +
  'evite coloquialismos; prefira estruturas sintáticas complexas e coesão típica de ' +
  'textos jornalísticos e diplomáticos de alto nível (The Economist, Foreign Affairs, ' +
  'documentos da ONU e do Itamaraty).';

const BASE_RULES =
  'Regras: o conteúdo deve ser 100% original e inédito; linguagem sofisticada, ' +
  'natural e contemporânea; nível entre B2 avançado, C1 e C2. ' +
  REGISTER_GUIDANCE +
  ' O tema específico do exercício será informado na mensagem do usuário — use exclusivamente esse tema.' +
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
  ENPT: `You are a CACD translation examiner. Generate an ORIGINAL text (120-220 words),
C1/C2 level, on a CACD-relevant theme.
CRITICAL: "source_text" MUST be written ENTIRELY IN ENGLISH (it is the text to be translated INTO Portuguese).
${BASE_RULES}
JSON schema:
{"source_text":"<the text, in ENGLISH>","instruction":"Translate into Portuguese."}
Do NOT provide any answer key or translation.`,

  // MODO 4 — SUMMARY (inglês) — texto-fonte EM INGLÊS (resumo EN→EN)
  SUMMARY: `You are a CACD examiner. Generate an ORIGINAL text (350-600 words), C1/C2 level,
on a CACD-relevant theme, suitable for a summarising exercise.
CRITICAL: "source_text" MUST be written ENTIRELY IN ENGLISH. Do NOT write it in Portuguese or Spanish.
The candidate will read the English text and summarise it in English.
${BASE_RULES}
JSON schema:
{"source_text":"<the full text, in ENGLISH>","instruction":"Summarize the text in 120-180 words."}
Do NOT provide any model summary.`,

  // MODO 5 — PTESP (português → espanhol)
  PTESP: `Eres examinador del CACD. Genera un texto ORIGINAL en portugués (120-220 palabras),
nivel C1/C2, sobre un tema relevante para el CACD.
${BASE_RULES}
Esquema JSON:
{"source_text":"<texto en portugués>","instruction":"Traduzca al español."}
No proporciones ninguna traducción ni clave de respuestas.`,

  // MODO 6 — ESPPT (espanhol → português)
  ESPPT: `Eres examinador del CACD. Genera un texto ORIGINAL (120-220 palabras),
nivel C1/C2, sobre un tema relevante para el CACD.
CRÍTICO: "source_text" DEBE estar redactado ENTERAMENTE EN ESPAÑOL (es el texto que se traducirá AL portugués).
${BASE_RULES}
Esquema JSON:
{"source_text":"<el texto, EN ESPAÑOL>","instruction":"Traduza para o português."}
No proporciones ninguna traducción ni clave de respuestas.`,

  // MODO 7 — RESUMEN (espanhol) — texto-fonte EM ESPANHOL (resumo ESP→ESP)
  RESUMEN: `Eres examinador del CACD. Genera un texto ORIGINAL (350-600 palabras),
nivel C1/C2, sobre un tema relevante para el CACD, apto para un ejercicio de resumen.
CRÍTICO: "source_text" DEBE estar redactado ENTERAMENTE EN ESPAÑOL. NO lo escribas en portugués ni en inglés.
El candidato leerá el texto en español y lo resumirá en español.
${BASE_RULES}
Esquema JSON:
{"source_text":"<el texto completo, EN ESPAÑOL>","instruction":"Redacte un resumen de 120-180 palabras."}
No proporciones ningún resumen modelo.`,

  // MODO 8 — GRAMATICA_TEORIA — teoria gramatical C2
  GRAMATICA_TEORIA: `You are a C2-level grammar expert for the Brazilian diplomatic exam (CACD/IRBr).
Write a rigorous theoretical explanation for the given grammar topic in the specified language.
- Portuguese topics: write in formal Brazilian Portuguese
- English topics: write in formal academic English
- Spanish topics: write in formal Castilian Spanish
Focus on: edge cases, formal exceptions, constructions from literary/diplomatic/legal registers, and common traps in high-level exams.
Do NOT explain basic rules — assume the reader already knows them. Go deep.
Length: ~350 words for conteudo, 3-5 illustrative examples.
Respond ONLY in valid JSON, no markdown, no extra text:
{"conteudo":"...","exemplos":["...","...","..."]}`,

  // MODO 9 — GRAMATICA_QUIZ — quiz gramatical C2
  GRAMATICA_QUIZ: `You are a C2-level grammar examiner for the Brazilian diplomatic exam (CACD/IRBr).
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
{"questoes":[{"enunciado":"...","opcoes":["A) ...","B) ...","C) ...","D) ..."],"correta":0,"explicacao":"..."}]}`,
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { mode, idioma, topico } = req.body || {};
  const systemPrompt = PROMPTS[mode];
  if (!systemPrompt) return res.status(400).json({ error: 'mode inválido' });

  const isGramatica = mode === 'GRAMATICA_TEORIA' || mode === 'GRAMATICA_QUIZ';
  const userContent = isGramatica
    ? `Language: ${idioma}\nGrammar topic: ${topico}`
    : `${buildThemeInstruction()}\nGere um novo exercício inédito sobre esse tema. ref:${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const maxTokens = mode === 'GRAMATICA_TEORIA' ? 1200 : mode === 'GRAMATICA_QUIZ' ? 2000 : 2048;
  const temperature = isGramatica ? 0.4 : 0.9;

  try {
    const completion = await groqCreate({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: maxTokens,
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
