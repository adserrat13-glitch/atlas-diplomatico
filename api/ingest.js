// Vercel Serverless Function — RSS ingest for Radar Diplomático
// GET  → called by Vercel cron (requires Authorization: Bearer <CRON_SECRET>)
// POST → called by frontend "↻ Atualizar" button (no auth required)

const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

// ── RSS Feeds ────────────────────────────────────────────────────
const FEEDS = [
  { id: 'bbc',      name: 'BBC WORLD',  url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'alj',      name: 'AL JAZEERA', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw',       name: 'DW',         url: 'https://rss.dw.com/xml/rss-en-world' },
  { id: 'guardian', name: 'GUARDIAN',   url: 'https://www.theguardian.com/world/rss' },
  { id: 'cfr',      name: 'CFR',        url: 'https://www.cfr.org/rss/rss.xml' },
];

// ── CACD Classification (mirrored from backend/rssFeeds.js) ──────
const CACD_CATEGORIES = [
  {
    id: 'PI',
    keys: ['china', 'russia', 'nato', 'multipolar', 'south global', 'sul global',
      'indo-pacific', 'asean', 'g20', 'g7', 'brics', 'cold war', 'sanction',
      'geopolit', 'diplomac', 'foreign policy', 'united states', 'superpower',
      'hegemony', 'middle east', 'ukraine', 'taiwan', 'tensions', 'allian'],
  },
  {
    id: 'PEB',
    keys: ['brazil', 'brasil', 'lula', 'itamaraty', 'mercosul', 'south america',
      'amazon', 'embrapa', 'bndes', 'petrobras', 'mercosur', 'latin america',
      'latin', 'selva', 'deforestat'],
  },
  {
    id: 'ECO',
    keys: ['economy', 'economic', 'gdp', 'inflation', 'trade', 'tariff', 'wto',
      'imf', 'world bank', 'recession', 'dollar', 'interest rate', 'fiscal',
      'deficit', 'debt', 'market', 'supply chain', 'commerce', 'import',
      'export', 'stock', 'invest'],
  },
  {
    id: 'SEG',
    keys: ['war', 'guerra', 'conflict', 'military', 'nuclear', 'weapon', 'attack',
      'ceasefire', 'missile', 'drone', 'terror', 'troops', 'soldiers',
      'offensive', 'defense', 'armament', 'insurgent', 'rebel'],
  },
  {
    id: 'DIR',
    keys: ['international court', 'icj', 'icc', 'treaty', 'convention',
      'human rights', 'sanction', 'jurisdiction', 'sovereignty', 'law',
      'refugee', 'asylum', 'tribunal', 'verdict', 'ruling', 'charter'],
  },
  {
    id: 'GEO',
    keys: ['climate', 'energy', 'oil', 'gas', 'arctic', 'territory', 'border',
      'region', 'geography', 'continent', 'ocean', 'pipeline', 'resource',
      'food', 'water', 'corridor', 'strateg', 'pivot', 'sphere of influence'],
  },
  {
    id: 'OI',
    keys: ['united nations', 'un ', 'onu', 'who', 'wto', 'nato', 'african union',
      'european union', 'oas', 'asean', 'world health', 'security council',
      'general assembly', 'peacekeeping', 'multilateral', 'g20', 'g7',
      'brics', 'cplp', 'mercosur'],
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
  'united states', 'brazil', 'european union', 'germany', 'france', 'uk',
  'japan', 'india', 'iran', 'palestine', 'ukraine', 'turkey', 'saudi arabia',
  'north korea', 'south korea', 'south africa', 'nigeria', 'colombia',
  'pakistan', 'afghanistan', 'syria', 'libya', 'ethiopia',
];

const TOPIC_FLASHCARD_MAP = {
  china:    ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  brics:    ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  russia:   ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  nato:     ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  mercosul: ['POLITICA INTERNACIONAL', 'HISTORIA DO BRASIL', 'REPOSITÓRIO'],
  africa:   ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  europe:   ['HISTÓRIA MUNDIAL', 'DIP', 'REPOSITÓRIO'],
  economia: ['ECONOMIA'],
  onu:      ['POLITICA INTERNACIONAL', 'DIP', 'REPOSITÓRIO'],
  direito:  ['DIP'],
  trade:    ['ECONOMIA', 'POLITICA INTERNACIONAL'],
  nuclear:  ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  guerra:   ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  brazil:   ['HISTORIA DO BRASIL', 'POLITICA INTERNACIONAL'],
  brasil:   ['HISTORIA DO BRASIL', 'POLITICA INTERNACIONAL'],
  lula:     ['HISTORIA DO BRASIL'],
  cplp:     ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  asean:    ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  asia:     ['POLITICA INTERNACIONAL', 'REPOSITÓRIO'],
  ukraine:  ['HISTÓRIA MUNDIAL', 'POLITICA INTERNACIONAL'],
  climate:  ['GEOGRAFIA', 'POLITICA INTERNACIONAL'],
};

function classifyArticle(item) {
  const text = (
    (item.title || '') + ' ' +
    (item.contentSnippet || item.content || item.summary || '')
  ).toLowerCase();
  const scores = {};
  for (const cat of CACD_CATEGORIES) {
    scores[cat.id] = cat.keys.filter(k => text.includes(k)).length;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary      = sorted[0][1] > 0 ? sorted[0][0] : 'PI';
  const secondary    = sorted[1][1] > 0 ? sorted[1][0] : null;
  const totalMatches = sorted.reduce((s, [, v]) => s + v, 0);
  const relevance    = Math.min(5, Math.max(1, Math.round(totalMatches / 2)));
  return { primary, secondary, relevance };
}

function detectEntities(text) {
  const t = (text || '').toLowerCase();
  const found = [], seen = new Set();
  for (const c of COUNTRIES) {
    if (t.includes(c) && !seen.has(c)) { found.push(c); seen.add(c); }
  }
  return found.slice(0, 10);
}

function detectConcepts(text) {
  return CACD_CONCEPTS.filter(c => (text || '').toLowerCase().includes(c)).slice(0, 8);
}

function findFlashcardTopics(item) {
  const text = (
    (item.title || '') + ' ' + (item.contentSnippet || item.content || '')
  ).toLowerCase();
  const topics = new Set();
  for (const [key, folders] of Object.entries(TOPIC_FLASHCARD_MAP)) {
    if (text.includes(key)) folders.forEach(f => topics.add(f));
  }
  if (topics.size === 0) topics.add('POLITICA INTERNACIONAL');
  return [...topics];
}

function extractThumbnail(item) {
  return (
    item.mediaThumbnail?.$.url ||
    item.mediaContent?.$.url ||
    item.enclosure?.url ||
    null
  );
}

function normalizeItem(feedMeta, item) {
  const cacd = classifyArticle(item);
  const text = (item.title || '') + ' ' + (item.contentSnippet || item.content || item.summary || '');
  return {
    source_id:         feedMeta.id,
    source_name:       feedMeta.name,
    title:             (item.title || '').slice(0, 500),
    description:       (item.contentSnippet || item.summary || '').replace(/<[^>]+>/g, '').slice(0, 1000),
    url:               item.link || item.guid || '',
    thumbnail:         extractThumbnail(item),
    published_at:      item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    cacd_category:     cacd.primary,
    cacd_secondary:    cacd.secondary,
    cacd_relevance:    cacd.relevance,
    cacd_concepts:     detectConcepts(text),
    detected_entities: detectEntities(text),
    fc_topics:         findFlashcardTopics(item),
  };
}

async function runIngest() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  // Short timeout so we stay within Vercel's 10s function limit
  const parser = new Parser({
    timeout: 6000,
    headers: { 'User-Agent': 'RadarDiplomatico/1.0' },
    customFields: {
      item: [
        ['media:thumbnail', 'mediaThumbnail'],
        ['media:content',   'mediaContent'],
        ['enclosure',       'enclosure'],
      ],
    },
  });

  const results = await Promise.allSettled(
    FEEDS.map(async feed => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || [])
        .filter(it => it.link || it.guid)
        .map(it => normalizeItem(feed, it));
    })
  );

  const allArticles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(a => a.url);

  let saved = 0, skipped = 0, errors = 0;
  for (let i = 0; i < allArticles.length; i += 50) {
    const chunk = allArticles.slice(i, i + 50);
    const { data, error } = await supabase
      .from('news_articles')
      .upsert(chunk, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');
    if (error) { errors += chunk.length; }
    else { saved += data?.length ?? 0; skipped += chunk.length - (data?.length ?? 0); }
  }

  return { saved, skipped, errors, total: allArticles.length };
}

// ── Vercel handler ───────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS for same-origin frontend calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cron (GET) requires Authorization header; frontend (POST) does not
  if (req.method === 'GET') {
    const auth = req.headers['authorization'] || '';
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars' });
  }

  try {
    const result = await runIngest();
    return res.status(200).json({ ok: true, ...result, ts: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
