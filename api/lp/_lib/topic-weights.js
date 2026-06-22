/**
 * Pesos de incidência dos tópicos nas provas de Língua Portuguesa do CACD.
 * Baseados no índice do arquivo fornecido (port index.pdf) e no histórico
 * das provas CESPE/CEBRASPE para o CACD.
 *
 * Escala: 0.00 a 1.00 (normalizada dentro de cada área).
 * Peso total entre todas as áreas deve somar ~1.00.
 */

const TOPIC_WEIGHTS = [
  // ─── ÁREA 1: MORFOSSINTAXE DO PERÍODO (peso ~30%) ──────────────────────────
  { area: 'Morfossintaxe', name: 'Concordância verbal', subtopic: 'Regras gerais e especiais', weight: 0.065 },
  { area: 'Morfossintaxe', name: 'Concordância nominal', subtopic: 'Regra geral e regras especiais', weight: 0.045 },
  { area: 'Morfossintaxe', name: 'Regência verbal', subtopic: 'Casos especiais de regência verbal', weight: 0.055 },
  { area: 'Morfossintaxe', name: 'Regência nominal', subtopic: 'Relações preposicionais dos nomes', weight: 0.030 },
  { area: 'Morfossintaxe', name: 'Crase', subtopic: 'Casos obrigatórios, facultativos e proibidos', weight: 0.055 },
  { area: 'Morfossintaxe', name: 'Colocação pronominal', subtopic: 'Próclise, mesóclise, ênclise', weight: 0.040 },
  { area: 'Morfossintaxe', name: 'Pontuação', subtopic: 'Uso da vírgula, ponto e vírgula, dois-pontos', weight: 0.035 },
  { area: 'Morfossintaxe', name: 'Sintaxe do período composto', subtopic: 'Subordinação e coordenação', weight: 0.025 },
  { area: 'Morfossintaxe', name: 'Paralelismo', subtopic: 'Paralelismo sintático e semântico', weight: 0.020 },
  { area: 'Morfossintaxe', name: 'Funções morfossintáticas de QUE/SE/COMO', subtopic: 'Polissemia gramatical', weight: 0.015 },
  { area: 'Morfossintaxe', name: 'Termos da oração', subtopic: 'Sujeito, predicado, objetos, adjuntos', weight: 0.015 },

  // ─── ÁREA 2: INTERPRETAÇÃO DE TEXTO (peso ~25%) ────────────────────────────
  { area: 'Interpretação de Texto', name: 'Reescrita de frases e parágrafos', subtopic: 'Equivalência, substituição e reorganização', weight: 0.065 },
  { area: 'Interpretação de Texto', name: 'Coesão textual', subtopic: 'Mecanismos de referenciação e sequenciação', weight: 0.040 },
  { area: 'Interpretação de Texto', name: 'Coerência textual', subtopic: 'Fatores de coerência narrativa, argumentativa e temporal', weight: 0.030 },
  { area: 'Interpretação de Texto', name: 'Inferência textual', subtopic: 'Pressupostos e subentendidos', weight: 0.030 },
  { area: 'Interpretação de Texto', name: 'Tipologias textuais', subtopic: 'Dissertativo-argumentativo, expositivo, narrativo', weight: 0.025 },
  { area: 'Interpretação de Texto', name: 'Funções da linguagem', subtopic: 'Referencial, emotiva, conativa, metalinguística, fática, poética', weight: 0.020 },
  { area: 'Interpretação de Texto', name: 'Figuras de linguagem', subtopic: 'Figuras de palavras, pensamento, construção e fônicas', weight: 0.020 },
  { area: 'Interpretação de Texto', name: 'Intertextualidade', subtopic: 'Paráfrase, paródia, citação, alusão', weight: 0.015 },
  { area: 'Interpretação de Texto', name: 'Linguagem denotativa e conotativa', subtopic: 'Sentido próprio e figurado', weight: 0.010 },

  // ─── ÁREA 3: SEMÂNTICA (peso ~15%) ─────────────────────────────────────────
  { area: 'Semântica', name: 'Sinonímia e antonímia', subtopic: 'Relações de significação entre palavras', weight: 0.045 },
  { area: 'Semântica', name: 'Polissemia e homonímia', subtopic: 'Acepções e múltiplos sentidos', weight: 0.035 },
  { area: 'Semântica', name: 'Parônimos e homônimos', subtopic: 'Distinção e emprego correto', weight: 0.030 },
  { area: 'Semântica', name: 'Campo lexical e semântico', subtopic: 'Hiperônimos e hipônimos', weight: 0.020 },
  { area: 'Semântica', name: 'Dificuldades da língua portuguesa', subtopic: 'Por que/porque, onde/aonde, cujo, à medida que', weight: 0.025 },

  // ─── ÁREA 4: MORFOLOGIA (peso ~15%) ────────────────────────────────────────
  { area: 'Morfologia', name: 'Classes de palavras', subtopic: 'Verbos, pronomes, conjunções, preposições', weight: 0.040 },
  { area: 'Morfologia', name: 'Emprego dos verbos', subtopic: 'Modos, tempos, vozes e correlação verbal', weight: 0.035 },
  { area: 'Morfologia', name: 'Emprego dos pronomes', subtopic: 'Pronomes pessoais, demonstrativos, relativos', weight: 0.030 },
  { area: 'Morfologia', name: 'Formação das palavras', subtopic: 'Derivação, composição, neologismo', weight: 0.020 },
  { area: 'Morfologia', name: 'Flexão nominal e verbal', subtopic: 'Gênero, número, grau, conjugação', weight: 0.020 },

  // ─── ÁREA 5: ORTOGRAFIA E ACENTUAÇÃO (peso ~10%) ───────────────────────────
  { area: 'Ortografia', name: 'Acentuação gráfica', subtopic: 'Regras de acentuação e acento diferencial', weight: 0.040 },
  { area: 'Ortografia', name: 'Ortografia oficial', subtopic: 'Grafia correta, hífen, maiúsculas/minúsculas', weight: 0.035 },
  { area: 'Ortografia', name: 'Sinais diacríticos', subtopic: 'Til, cedilha, hífen, apóstrofo', weight: 0.015 },
  { area: 'Ortografia', name: 'Fonologia', subtopic: 'Ditongo, hiato, dígrafo, divisão silábica', weight: 0.010 },

  // ─── ÁREA 6: LITERATURA (peso ~5%) ─────────────────────────────────────────
  { area: 'Literatura', name: 'Movimentos literários brasileiros', subtopic: 'Barroco ao Pós-Modernismo', weight: 0.025 },
  { area: 'Literatura', name: 'Gêneros literários', subtopic: 'Épico, lírico, dramático', weight: 0.015 },
  { area: 'Literatura', name: 'Figuras de linguagem literárias', subtopic: 'Estilística, versificação, rima', weight: 0.010 },
];

/**
 * Normaliza os pesos para que a soma seja exatamente 1.0.
 */
function normalizeWeights(topics) {
  const total = topics.reduce((s, t) => s + t.weight, 0);
  return topics.map(t => ({ ...t, weight: parseFloat((t.weight / total).toFixed(6)) }));
}

const NORMALIZED_TOPICS = normalizeWeights(TOPIC_WEIGHTS);

/**
 * Seleciona tópicos ponderados para gerar `count` questões.
 * Respeita a distribuição proporcional dos pesos.
 * @param {number} count - número de questões a distribuir
 * @param {string[]} [filter] - filtrar por área ou nome de tópico
 * @param {Object[]} [userTopics] - tópicos customizados do banco (substituem os padrão)
 * @returns {Object[]} lista de tópicos com quantidade atribuída
 */
function distributeQuestions(count, filter = [], userTopics = null) {
  const pool = userTopics && userTopics.length > 0
    ? normalizeWeights(userTopics)
    : NORMALIZED_TOPICS;

  const filtered = filter.length > 0
    ? pool.filter(t => filter.includes(t.area) || filter.includes(t.name))
    : pool;

  if (filtered.length === 0) return [];

  // Re-normaliza o subconjunto filtrado
  const sub = normalizeWeights(filtered);

  // Distribuição proporcional com arredondamento inteligente
  const raw = sub.map(t => ({ ...t, rawCount: t.weight * count }));
  const floors = raw.map(t => ({ ...t, assigned: Math.floor(t.rawCount) }));
  const remainder = count - floors.reduce((s, t) => s + t.assigned, 0);

  // Distribui o resto pelos maiores fracionários
  floors
    .map((t, i) => ({ i, frac: raw[i].rawCount - t.assigned }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, remainder)
    .forEach(({ i }) => { floors[i].assigned++; });

  return floors.filter(t => t.assigned > 0);
}

module.exports = { NORMALIZED_TOPICS, distributeQuestions };
