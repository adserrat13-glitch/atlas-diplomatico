// One-shot RSS ingest: fetch all feeds, classify, save to Supabase
// Run: node ingest.js
import 'dotenv/config';
import Parser from 'rss-parser';
import {
  FEEDS,
  classifyArticle,
  detectEntities,
  detectConcepts,
  findFlashcardTopics,
} from './rssFeeds.js';
import { saveNews, getStats } from './newsService.js';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'RadarDiplomatico/1.0 (+https://cacd.app)' },
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content',   'mediaContent'],
      ['enclosure',       'enclosure'],
    ],
  },
});

function extractThumbnail(item) {
  return (
    item.mediaThumbnail?.$.url ||
    item.mediaContent?.$.url ||
    item.enclosure?.url ||
    null
  );
}

function normalizeItem(feedMeta, item) {
  const text = (item.title || '') + ' ' + (item.contentSnippet || item.content || item.summary || '');
  const cacd = classifyArticle(item);

  return {
    source_id:        feedMeta.id,
    source_name:      feedMeta.name,
    title:            (item.title || '').slice(0, 500),
    description:      (item.contentSnippet || item.summary || '').replace(/<[^>]+>/g, '').slice(0, 1000),
    url:              item.link || item.guid || '',
    thumbnail:        extractThumbnail(item),
    published_at:     item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    cacd_category:    cacd.primary,
    cacd_secondary:   cacd.secondary,
    cacd_relevance:   cacd.relevance,
    cacd_concepts:    detectConcepts(text),
    detected_entities: detectEntities(text),
    fc_topics:        findFlashcardTopics(item),
  };
}

async function ingestFeed(feed) {
  try {
    console.log(`  → Fetching ${feed.name} (${feed.url})`);
    const parsed = await parser.parseURL(feed.url);
    const articles = (parsed.items || [])
      .filter(it => it.link || it.guid)
      .map(it => normalizeItem(feed, it));
    console.log(`    ${articles.length} items parsed`);
    return articles;
  } catch (err) {
    console.error(`  ✗ ${feed.name}: ${err.message}`);
    return [];
  }
}

export async function runIngest() {
  console.log(`\n[${new Date().toISOString()}] Starting RSS ingest…`);

  const results = await Promise.allSettled(FEEDS.map(ingestFeed));
  const allArticles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(a => a.url);

  console.log(`\n  Total articles to save: ${allArticles.length}`);
  const { saved, skipped, errors } = await saveNews(allArticles);
  console.log(`  ✓ Saved: ${saved}  │  Skipped (duplicates): ${skipped}  │  Errors: ${errors}`);

  const stats = await getStats();
  console.log(`  DB total: ${stats.total} articles, latest: ${stats.latestIngestion}`);
  console.log('  By source:', stats.bySource);
  console.log(`[${new Date().toISOString()}] Done.\n`);

  return { saved, skipped, errors, total: stats.total };
}

// Run immediately when called directly
runIngest().catch(err => {
  console.error('Fatal ingest error:', err);
  process.exit(1);
});
