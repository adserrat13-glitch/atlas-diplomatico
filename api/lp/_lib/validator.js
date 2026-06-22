const crypto = require('crypto');

const REQUIRED_FIELDS = ['statement', 'answer', 'explanation', 'grammar_justification', 'keywords', 'recurrence_degree'];

/**
 * Normaliza o enunciado para geração de hash (remove pontuação extra, lowercase).
 */
function normalizeStatement(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula SHA-256 do enunciado normalizado.
 */
function computeHash(statement) {
  return crypto.createHash('sha256').update(normalizeStatement(statement)).digest('hex');
}

/**
 * Valida estrutura e qualidade da questão gerada.
 * @param {Object} q - questão parseada do modelo
 * @param {string} topicName - tópico esperado
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateQuestion(q, topicName) {
  const errors = [];

  // Campos obrigatórios
  for (const field of REQUIRED_FIELDS) {
    if (q[field] === undefined || q[field] === null || q[field] === '') {
      errors.push(`Campo obrigatório ausente: ${field}`);
    }
  }

  // Tipo de answer
  if (typeof q.answer !== 'boolean') {
    errors.push('Campo "answer" deve ser boolean (true/false)');
  }

  // Tamanho do enunciado (padrão CESPE: 30-400 chars)
  if (typeof q.statement === 'string') {
    if (q.statement.length < 30) errors.push('Enunciado muito curto (mínimo 30 chars)');
    if (q.statement.length > 500) errors.push('Enunciado muito longo (máximo 500 chars)');
  }

  // Explicação mínima
  if (typeof q.explanation === 'string' && q.explanation.split(' ').length < 20) {
    errors.push('Explicação muito curta (mínimo 20 palavras)');
  }

  // Keywords deve ser array
  if (q.keywords !== undefined && !Array.isArray(q.keywords)) {
    errors.push('Campo "keywords" deve ser array');
  }

  // recurrence_degree
  if (q.recurrence_degree !== undefined) {
    const rd = Number(q.recurrence_degree);
    if (isNaN(rd) || rd < 1 || rd > 5) errors.push('recurrence_degree deve ser entre 1 e 5');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Prepara a questão para inserção no banco.
 * @param {Object} q - questão validada
 * @param {Object} meta - { topicName, subtopic, area, difficulty, topicId, userId }
 * @returns {Object} registro pronto para inserção
 */
function prepareRecord(q, meta) {
  const hash = computeHash(q.statement);
  return {
    user_id:               meta.userId || null,
    topic_id:              meta.topicId || null,
    topic_name:            meta.topicName,
    subtopic:              q.subtopic || meta.subtopic || null,
    area:                  meta.area || null,
    statement:             q.statement.trim(),
    answer:                q.answer,
    explanation:           q.explanation.trim(),
    grammar_justification: q.grammar_justification.trim(),
    difficulty:            meta.difficulty,
    keywords:              Array.isArray(q.keywords) ? q.keywords.slice(0, 8) : [],
    recurrence_degree:     Math.min(5, Math.max(1, Number(q.recurrence_degree) || 3)),
    is_trap:               q.is_trap === true,
    content_hash:          hash,
  };
}

module.exports = { validateQuestion, prepareRecord, computeHash };
