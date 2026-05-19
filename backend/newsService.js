// Supabase operations for news — uses service role key to bypass RLS
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Upsert articles into news_articles, skipping exact URL duplicates.
 * Returns { saved, skipped, errors }
 */
export async function saveNews(articles) {
  if (!articles.length) return { saved: 0, skipped: 0, errors: 0 };

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  // Batch in chunks of 50 to stay within Supabase payload limits
  const CHUNK = 50;
  for (let i = 0; i < articles.length; i += CHUNK) {
    const chunk = articles.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('news_articles')
      .upsert(chunk, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('  [saveNews] chunk error:', error.message);
      errors += chunk.length;
    } else {
      saved += data?.length ?? 0;
      skipped += chunk.length - (data?.length ?? 0);
    }
  }

  return { saved, skipped, errors };
}

/**
 * Fetch paginated news from the DB.
 * Used by the backend stats/testing — the frontend fetches directly via anon key.
 */
export async function fetchNews({ category = null, page = 0, limit = 21, search = null } = {}) {
  let q = supabase.from('news_articles').select('*');

  if (category && category !== 'ALL') {
    q = q.or(`cacd_category.eq.${category},cacd_secondary.eq.${category}`);
  }
  if (search && search.trim()) {
    const terms = search.trim().split(/\s+/).join(' & ');
    q = q.textSearch('search_vector', terms);
  }

  const from = page * limit;
  const { data, error } = await q
    .order('published_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw error;
  return data || [];
}

/**
 * Returns a summary: total articles, count per source, latest ingestion date.
 */
export async function getStats() {
  const { data, error } = await supabase
    .from('news_articles')
    .select('source_id, ingested_at')
    .order('ingested_at', { ascending: false });

  if (error) throw error;

  const counts = {};
  let latest = null;
  for (const row of (data || [])) {
    counts[row.source_id] = (counts[row.source_id] || 0) + 1;
    if (!latest) latest = row.ingested_at;
  }

  return { total: data?.length ?? 0, bySource: counts, latestIngestion: latest };
}
