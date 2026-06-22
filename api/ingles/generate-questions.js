const Groq = require('groq-sdk');

const DIFFICULTY_INSTRUCTIONS = {
  easy:   'Easy level: straightforward statement, evident correct/incorrect, no ambiguity. Suitable for initial review.',
  medium: 'Medium level: elaborated statement requiring solid B2/C1 English knowledge, one subtle point of attention.',
  hard:   'Hard level: complex syntax, multiple subordinate clauses, advanced grammatical structures, requires C1/C2 mastery.',
  cacd:   'Advanced CACD level: long period with elaborate subordinate structures, controlled ambiguity, nuanced vocabulary — equivalent to real CESPE/CEBRASPE questions for the CACD (Concurso de Admissão à Carreira Diplomática).',
};

// Tópicos baseados no edital oficial CACD — Língua Inglesa
const GRAMMAR_TOPICS = [
  // Adjetivos
  'use of adjectives (attributive vs predicative position)',
  'comparative and superlative adjectives',
  'opposite adjectives and antonyms',
  // Advérbios e conjunções
  'position of adverbs in English sentences',
  'adverbs of place, manner, time and frequency',
  'adverbs of degree, purpose and contrast',
  // Artigos
  'use of definite and indefinite articles (a, an, the)',
  // Determinantes e quantificadores
  'determiners and quantifiers (some, any, much, many, few, little)',
  // Substantivos
  'countable and uncountable nouns',
  'plural of nouns (regular and irregular)',
  // Números
  'cardinal and ordinal numbers in context',
  // Preposições
  'prepositions of time, place and movement',
  'prepositional phrases in academic English',
  // Pronomes
  'objective pronouns in formal written English',
  'possessive adjectives and possessive pronouns',
  'reflexive pronouns',
  'demonstrative pronouns',
  'relative clauses (defining and non-defining)',
  'question words and indirect questions',
  'subjective pronouns and subject-verb agreement',
  'indefinite pronouns (someone, anyone, everyone, no one)',
  // Palavras conectivas
  'connective words and cohesive devices in academic texts',
  // Tag questions
  'tag questions (formation and intonation)',
  // Verbos — tempos
  'simple present tense in formal English',
  'present continuous tense',
  'present perfect tense (since, for, already, yet)',
  'present perfect continuous tense',
  'simple past tense',
  'past continuous tense',
  'past perfect tense',
  'past perfect continuous tense',
  'simple future (will vs going to)',
  'future perfect tense',
  'future perfect continuous tense',
  'infinitive and gerund (verb patterns)',
  'imperative mood in formal English',
  'modal verbs (can, could, may, might, must, shall, should, will, would, ought to)',
  'phrasal verbs in academic and diplomatic contexts',
  // Voz
  'passive voice in formal and diplomatic texts',
  'active vs passive voice transformation',
  // Condicionais e discurso
  'conditional clauses (zero, first, second, third and mixed)',
  'reported speech (statements, questions and commands)',
  // Vocabulário e formação
  'false cognates between English and Portuguese',
  'synonyms in academic and diplomatic English',
  'word formation: prefixes and suffixes in English',
  'genitive case (possessive \'s and of-construction)',
  // Análise e compreensão
  'syntactic parsing and sentence structure',
  'linguistic aspects of academic written English',
  'reading comprehension and text interpretation',
  'translation of diplomatic and academic texts',
];

const DIPLOMATIC_TOPICS = [
  'international trade agreements and WTO disputes',
  'United Nations Security Council reform',
  'climate change negotiations and multilateral agreements',
  'human rights treaties and international law',
  'diplomatic immunity and the Vienna Convention',
  'regional integration processes (EU, Mercosur, African Union)',
  'peacekeeping operations and humanitarian intervention',
  'nuclear non-proliferation and arms control',
  'geopolitical competition in the Indo-Pacific',
  'global governance and multilateralism',
  'foreign debt, IMF conditionality, and development finance',
  'migration, refugees, and international protection',
];

const ALL_TOPICS = [...GRAMMAR_TOPICS, ...DIPLOMATIC_TOPICS];

const SYSTEM_PROMPT_ISOLATED = `You are a senior CESPE/CEBRASPE question writer specializing in the English Language exam for the CACD (Concurso de Admissão à Carreira Diplomática), administered by Instituto Rio Branco (Brazil).

MANDATORY RULES:
1. Exclusive format: ONE statement for True/False judgment (never multiple choice).
2. The statement must be a single, complete, self-sufficient sentence — no external text required.
3. When True (answer: true): the statement must be linguistically correct and factually/semantically accurate.
4. When False (answer: false): the error must be technically precise and non-obvious — a classic CESPE "trap": false cognate, subtle grammar error, wrong collocation, misleading cohesive device, or inaccurate paraphrase.
5. Focus areas must align with the official CACD English syllabus: grammar (all verb tenses, modal verbs, conditional clauses, passive voice, reported speech, relative clauses, phrasal verbs, gerund/infinitive), vocabulary (false cognates, synonyms, word formation, collocations), reading comprehension and text interpretation, translation of diplomatic/academic texts.
6. The explanation (in Portuguese) must be didactic, complete, and self-sufficient — minimum 80 words.
7. The linguistic justification must cite the specific grammar rule or vocabulary principle.
8. Respond ONLY in valid JSON, no markdown, no text outside the JSON.

MANDATORY JSON SCHEMA:
{
  "statement": "<single statement for True/False judgment, 30-400 characters, in English>",
  "answer": true,
  "explanation": "<didactic explanation in Portuguese, minimum 80 words>",
  "linguistic_justification": "<specific grammar rule or vocabulary principle in Portuguese>",
  "keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>"],
  "category": "grammar",
  "difficulty": "cacd",
  "is_trap": false
}

Where:
- "answer": true = CORRECT/TRUE, false = WRONG/FALSE
- "category": one of "reading-comprehension", "vocabulary", "grammar"
- "is_trap": true if the question contains an intentional CESPE trap`;

const SYSTEM_PROMPT_TEXT_BASED = `You are a senior CESPE/CEBRASPE question writer specializing in the English Language exam for the CACD (Concurso de Admissão à Carreira Diplomática), administered by Instituto Rio Branco (Brazil).

Your task is to generate a source text in English and then create True/False questions based on it — exactly as the CESPE/CEBRASPE exam does.

MANDATORY RULES:
1. Generate one original English text (120–250 words) on a diplomatic/geopolitical topic. The text must be written at C1/C2 academic level, similar to The Economist, Foreign Affairs, or UN documents.
2. Create the requested number of True/False statements derived from this text.
3. Each statement must: reference content from the text; test reading comprehension, vocabulary in context, or grammatical structure found in the text; be self-contained but clearly tied to the source text.
4. Mix of True and False statements — roughly balanced but not forced.
5. False statements must use classic CESPE traps: paraphrase errors, negation inversions, false synonyms, wrong scope (absolute vs. partial), or misread cohesion.
6. The explanation (in Portuguese) must be didactic and minimum 80 words, citing the specific line or phrase in the text.
7. Respond ONLY in valid JSON, no markdown, no text outside the JSON.

MANDATORY JSON SCHEMA:
{
  "source_text": "<original English text, 120-250 words>",
  "questions": [
    {
      "statement": "<statement in English for True/False judgment>",
      "answer": true,
      "explanation": "<didactic explanation in Portuguese, minimum 80 words, referencing the text>",
      "linguistic_justification": "<specific rule or vocabulary principle in Portuguese>",
      "keywords": ["<keyword 1>", "<keyword 2>"],
      "category": "reading-comprehension",
      "difficulty": "cacd",
      "is_trap": false
    }
  ]
}

Where:
- "answer": true = CORRECT/TRUE, false = WRONG/FALSE
- "category": one of "reading-comprehension", "vocabulary", "grammar"
- "is_trap": true if the question contains an intentional CESPE trap`;

function randomTopic(override) {
  if (override) return override;
  return ALL_TOPICS[Math.floor(Math.random() * ALL_TOPICS.length)];
}

function buildIsolatedUserPrompt({ topic, difficulty, category, isTrap }) {
  const diffInstruction = DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.cacd;
  const chosenTopic = randomTopic(topic);
  const trapInstruction = isTrap
    ? 'IMPORTANT: This question MUST be False (answer: false) and contain a classic CESPE trap — a subtle false cognate, wrong collocation, misleading cohesive device, or inaccurate grammar structure that passes unnoticed on quick reading.'
    : 'The statement may be True or False according to your technical judgment.';
  const categoryInstruction = category
    ? `Focus category: ${category} (reading-comprehension = inference from text; vocabulary = diplomatic/academic terms, false cognates, collocations, synonyms, word formation; grammar = any item from the official CACD syllabus).`
    : 'Choose the most appropriate category from: reading-comprehension, vocabulary, grammar.';

  return [
    `CACD syllabus topic to base this question on: "${chosenTopic}"`,
    `Difficulty: ${diffInstruction}`,
    categoryInstruction,
    trapInstruction,
    `Originality token: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ].join('\n');
}

function buildTextBasedUserPrompt({ topic, difficulty, quantity }) {
  const diffInstruction = DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.cacd;
  const chosenTopic = randomTopic(topic);

  return [
    `Write a C1/C2 academic text on this topic (diplomatic or linguistic): "${chosenTopic}"`,
    `Difficulty: ${diffInstruction}`,
    `Number of True/False questions to generate from the text: ${quantity}`,
    `Questions must cover a mix of: reading comprehension, vocabulary in context, and grammar structures present in the text — aligned with the CACD English syllabus.`,
    `Originality token: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ].join('\n');
}

function sanitizeQuestion(q, index) {
  const validCategories = ['reading-comprehension', 'vocabulary', 'grammar'];
  return {
    id: index + 1,
    statement: String(q.statement || '').trim(),
    answer: Boolean(q.answer),
    explanation: String(q.explanation || '').trim(),
    linguistic_justification: String(q.linguistic_justification || '').trim(),
    keywords: Array.isArray(q.keywords) ? q.keywords.slice(0, 5).map(String) : [],
    category: validCategories.includes(q.category) ? q.category : 'reading-comprehension',
    difficulty: q.difficulty || 'cacd',
    is_trap: Boolean(q.is_trap),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const {
    mode = 'isolated',
    topic,
    difficulty = 'cacd',
    quantity = 3,
    category,
    force_trap: forceTrap = false,
  } = req.body || {};

  const validModes = ['isolated', 'text-based'];
  const validDifficulties = ['easy', 'medium', 'hard', 'cacd'];
  const validCategories = ['reading-comprehension', 'vocabulary', 'grammar'];

  if (!validModes.includes(mode))
    return res.status(400).json({ error: `mode must be one of: ${validModes.join(', ')}` });
  if (!validDifficulties.includes(difficulty))
    return res.status(400).json({ error: `difficulty must be one of: ${validDifficulties.join(', ')}` });
  if (category && !validCategories.includes(category))
    return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });

  const qty = Math.min(Math.max(parseInt(quantity) || 3, 1), 5);

  try {
    const groq = new Groq({ apiKey });

    if (mode === 'isolated') {
      const questions = [];
      for (let i = 0; i < qty; i++) {
        const isTrap = forceTrap || (i % 3 === 2);
        const userPrompt = buildIsolatedUserPrompt({ topic, difficulty, category, isTrap });

        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_ISOLATED },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.85,
          max_tokens: 1200,
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) return res.status(502).json({ error: 'Empty response from model' });

        let parsed;
        try { parsed = JSON.parse(raw); }
        catch { return res.status(502).json({ error: 'Invalid JSON response from model' }); }

        questions.push(sanitizeQuestion(parsed, i));
      }

      return res.status(200).json({ mode: 'isolated', questions });

    } else {
      const userPrompt = buildTextBasedUserPrompt({ topic, difficulty, quantity: qty });

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_TEXT_BASED },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 2000,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) return res.status(502).json({ error: 'Empty response from model' });

      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { return res.status(502).json({ error: 'Invalid JSON response from model' }); }

      if (!parsed.source_text || !Array.isArray(parsed.questions) || parsed.questions.length === 0)
        return res.status(502).json({ error: 'Model did not return valid source text or questions' });

      return res.status(200).json({
        mode: 'text-based',
        source_text: String(parsed.source_text).trim(),
        questions: parsed.questions.slice(0, qty).map(sanitizeQuestion),
      });
    }

  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
  }
};
