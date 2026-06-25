const { geminiJSON } = require('../../_lib/gemini');

const DIFFICULTY_INSTRUCTIONS = {
  easy:   'Nível fácil: enunciado direto, erro/acerto evidente, sem ambiguidade. Adequado para revisão inicial.',
  medium: 'Nível médio: enunciado elaborado, exige conhecimento sólido da norma culta, um ponto de atenção sutil.',
  hard:   'Nível difícil: enunciado com construção complexa, múltiplas estruturas sintáticas, exige domínio avançado da gramática normativa.',
  cacd:   'Nível CACD avançado: enunciado com período longo, estrutura subordinada elaborada, ambiguidade controlada, exige conhecimento profundo da norma culta e capacidade de análise morfossintática precisa — equivalente às provas reais do CESPE/CEBRASPE para o Concurso de Admissão à Carreira Diplomática.',
};

const SYSTEM_PROMPT = `Você é elaborador sênior de questões do CESPE/CEBRASPE para a prova de Língua Portuguesa do CACD (Concurso de Admissão à Carreira Diplomática), realizado pelo Instituto Rio Branco.

REGRAS OBRIGATÓRIAS:
1. Formato exclusivo: UMA afirmação para julgamento como CERTO ou ERRADO (nunca múltipla escolha).
2. O enunciado deve ser um período único, completo e autossuficiente — sem contexto externo necessário.
3. Quando Certo: a frase deve estar gramaticalmente correta segundo a norma culta brasileira.
4. Quando Errado: o desvio deve ser tecnicamente preciso, não óbvio, explorável como "pegadinha" CESPE.
5. Nunca fabricar citações de autores. Se usar trecho literário, mantê-lo genérico ou claramente fictício.
6. A explicação deve ser didática, completa e suficiente para o candidato entender sem consulta externa.
7. A justificativa gramatical deve citar a regra específica da norma culta (NGB, Bechara, Cunha & Cintra ou VOLP quando aplicável).
8. Responda APENAS em JSON válido, sem markdown, sem texto extra fora do JSON.

JSON SCHEMA OBRIGATÓRIO:
{
  "statement": "<enunciado único para julgamento Certo/Errado, 30-400 caracteres>",
  "answer": true,
  "explanation": "<explicação didática completa, mínimo 80 palavras>",
  "grammar_justification": "<regra gramatical específica com referência à norma culta>",
  "keywords": ["<palavra-chave 1>", "<palavra-chave 2>", "<palavra-chave 3>"],
  "recurrence_degree": 4,
  "subtopic": "<subtópico específico abordado na questão>",
  "is_trap": false
}

Onde:
- "answer": true = CERTO, false = ERRADO
- "recurrence_degree": 1 (raro) a 5 (muito frequente em provas CACD)
- "is_trap": true se a questão contiver pegadinha intencional CESPE`;

/**
 * Gera UMA questão CESPE/CEBRASPE via Groq.
 * @param {Object} params
 * @param {string} params.topicName
 * @param {string} params.subtopic
 * @param {string} params.area
 * @param {string} params.difficulty - 'easy'|'medium'|'hard'|'cacd'
 * @param {boolean} params.isTrap - forçar geração de pegadinha
 * @param {string[]} params.existingHashes - hashes a evitar
 * @param {string} params.apiKey
 * @returns {Promise<Object>} questão parseada
 */
async function generateQuestion({ topicName, subtopic, area, difficulty, isTrap }) {
  const diffInstruction = DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.cacd;
  const trapInstruction = isTrap
    ? 'IMPORTANTE: Esta questão DEVE ser do tipo "Errado" e conter uma pegadinha típica do CESPE — erro sutil de concordância, regência, colocação pronominal ou crase que passa despercebido na leitura rápida.'
    : 'A questão pode ser Certo ou Errado, conforme seu julgamento técnico.';

  const userPrompt = [
    `Tópico principal: ${topicName}`,
    `Subtópico: ${subtopic || topicName}`,
    `Área gramatical: ${area}`,
    `Dificuldade: ${diffInstruction}`,
    trapInstruction,
    `Referência aleatória (garante originalidade): ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ].join('\n');

  return geminiJSON({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.85, maxTokens: 1200 });
}

module.exports = { generateQuestion };
