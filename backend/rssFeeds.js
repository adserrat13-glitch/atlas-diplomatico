// RSS feed configs and CACD classification logic
// Mirror of the frontend classification — single source of truth for the backend

export const FEEDS = [
  { id: 'bbc',      name: 'BBC WORLD',  url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'alj',      name: 'AL JAZEERA', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw',       name: 'DW',         url: 'https://rss.dw.com/xml/rss-en-world' },
  { id: 'guardian', name: 'GUARDIAN',   url: 'https://www.theguardian.com/world/rss' },
  { id: 'cfr',      name: 'CFR',        url: 'https://www.cfr.org/rss/rss.xml' },
];

const CACD_CATEGORIES = [
  {
    id: 'PI', label: 'Pol. Internacional', color: '#8ea7ff',
    keys: [
      'china', 'russia', 'nato', 'multipolar', 'south global', 'sul global',
      'indo-pacific', 'asean', 'g20', 'g7', 'brics', 'cold war', 'sanction',
      'geopolit', 'diplomac', 'foreign policy', 'united states', 'superpower',
      'hegemony', 'middle east', 'ukraine', 'taiwan', 'tensions', 'allian',
    ],
  },
  {
    id: 'PEB', label: 'Pol. Externa Brasileira', color: '#fb923c',
    keys: [
      'brazil', 'brasil', 'lula', 'itamaraty', 'mercosul', 'south america',
      'amazon', 'embrapa', 'bndes', 'petrobras', 'mercosur', 'latin america',
      'latin', 'selva', 'deforestat',
    ],
  },
  {
    id: 'ECO', label: 'Economia', color: '#6ee7b7',
    keys: [
      'economy', 'economic', 'gdp', 'inflation', 'trade', 'tariff', 'wto',
      'imf', 'world bank', 'recession', 'dollar', 'interest rate', 'fiscal',
      'deficit', 'debt', 'market', 'supply chain', 'commerce', 'import',
      'export', 'stock', 'invest',
    ],
  },
  {
    id: 'SEG', label: 'Segurança', color: '#f87171',
    keys: [
      'war', 'guerra', 'conflict', 'military', 'nuclear', 'weapon', 'attack',
      'ceasefire', 'missile', 'drone', 'terror', 'troops', 'soldiers',
      'offensive', 'defense', 'armament', 'insurgent', 'rebel',
    ],
  },
  {
    id: 'DIR', label: 'Direito Internacional', color: '#c084fc',
    keys: [
      'international court', 'icj', 'icc', 'treaty', 'convention',
      'human rights', 'sanction', 'jurisdiction', 'sovereignty', 'law',
      'refugee', 'asylum', 'tribunal', 'verdict', 'ruling', 'charter',
    ],
  },
  {
    id: 'GEO', label: 'Geopolítica', color: '#fbbf24',
    keys: [
      'climate', 'energy', 'oil', 'gas', 'arctic', 'territory', 'border',
      'region', 'geography', 'continent', 'ocean', 'pipeline', 'resource',
      'food', 'water', 'corridor', 'strateg', 'pivot', 'sphere of influence',
    ],
  },
  {
    id: 'OI', label: 'Org. Internacionais', color: '#38bdf8',
    keys: [
      'united nations', 'un ', 'onu', 'who', 'wto', 'nato', 'african union',
      'european union', 'oas', 'asean', 'world health', 'security council',
      'general assembly', 'peacekeeping', 'multilateral', 'g20', 'g7',
      'brics', 'cplp', 'mercosur',
    ],
  },
];

const CACD_CONCEPTS = [
  'multipolaridade', 'hegemonia', 'balança de poder', 'sul global', 'brics',
  'g20', 'mercosul', 'asean', 'otan', 'onu', 'omc', 'fmi', 'diplomacia',
  'política externa', 'soberania', 'autodeterminação', 'direito internacional',
  'sanções', 'conflito', 'nuclear', 'deterrência', 'imperialismo', 'globalização',
  'ordem internacional', 'multilateralismo', 'unilateralismo', 'soft power',
  'hard power', 'indo-pacífico', 'integração regional', 'livre-comércio',
  'protecionismo', 'ciberguerra',
];

const COUNTRIES = [
  'china', 'estados unidos', 'russia', 'brasil', 'união europeia', 'alemanha',
  'frança', 'reino unido', 'japão', 'índia', 'irã', 'israel', 'palestina',
  'gaza', 'ucrânia', 'turquia', 'arábia saudita', 'coreia do norte',
  'coreia do sul', 'áfrica do sul', 'nigéria', 'argentina', 'méxico',
  'venezuela', 'colômbia', 'peru', 'chile', 'paquistão', 'afeganistão',
  'síria', 'líbia', 'etiópia', 'congo', 'indonesia', 'vietnam', 'tailândia',
  // English forms (for EN feeds)
  'china', 'united states', 'russia', 'brazil', 'european union', 'germany',
  'france', 'uk', 'japan', 'india', 'iran', 'israel', 'palestine', 'ukraine',
  'turkey', 'saudi arabia', 'north korea', 'south korea', 'south africa',
  'nigeria', 'argentina', 'mexico', 'venezuela', 'colombia', 'pakistan',
  'afghanistan', 'syria', 'libya', 'ethiopia',
];

const TOPIC_FLASHCARD_MAP = {
  china:       ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  brics:       ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  russia:      ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  nato:        ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  mercosul:    ['POLITICA INTERNACIONAL', 'HISTORIA DO BRASIL', 'REPOSITÓRIO'],
  africa:      ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  europe:      ['HISTÓRIA MUNDIAL', 'DIP', 'REPOSITÓRIO'],
  economia:    ['ECONOMIA'],
  onu:         ['POLITICA INTERNACIONAL', 'DIP', 'REPOSITÓRIO'],
  direito:     ['DIP'],
  trade:       ['ECONOMIA', 'POLITICA INTERNACIONAL'],
  nuclear:     ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  guerra:      ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  brazil:      ['HISTORIA DO BRASIL', 'POLITICA INTERNACIONAL'],
  brasil:      ['HISTORIA DO BRASIL', 'POLITICA INTERNACIONAL'],
  lula:        ['HISTORIA DO BRASIL'],
  cplp:        ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  asean:       ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  asia:        ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  ukraine:     ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  climate:     ['GEOGRAFIA', 'POLITICA INTERNACIONAL'],
};

export function classifyArticle(item) {
  const text = (
    (item.title || '') + ' ' +
    (item.contentSnippet || item.content || item.summary || '')
  ).toLowerCase();

  const scores = {};
  for (const cat of CACD_CATEGORIES) {
    scores[cat.id] = cat.keys.filter(k => text.includes(k)).length;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary   = sorted[0][1] > 0 ? sorted[0][0] : 'PI';
  const secondary = sorted[1][1] > 0 ? sorted[1][0] : null;
  const totalMatches = sorted.reduce((s, [, v]) => s + v, 0);
  const relevance = Math.min(5, Math.max(1, Math.round(totalMatches / 2)));

  return { primary, secondary, relevance };
}

export function detectEntities(text) {
  const t = (text || '').toLowerCase();
  const found = [];
  const seen = new Set();
  for (const c of COUNTRIES) {
    if (t.includes(c) && !seen.has(c)) {
      found.push(c);
      seen.add(c);
    }
  }
  return found.slice(0, 10);
}

export function detectConcepts(text) {
  const t = (text || '').toLowerCase();
  return CACD_CONCEPTS.filter(c => t.includes(c)).slice(0, 8);
}

export function findFlashcardTopics(item) {
  const text = (
    (item.title || '') + ' ' +
    (item.contentSnippet || item.content || '')
  ).toLowerCase();
  const topics = new Set();
  for (const [key, folders] of Object.entries(TOPIC_FLASHCARD_MAP)) {
    if (text.includes(key)) folders.forEach(f => topics.add(f));
  }
  if (topics.size === 0) topics.add('POLITICA INTERNACIONAL');
  return [...topics];
}
