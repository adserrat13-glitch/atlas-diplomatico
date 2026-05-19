// Scheduled RSS ingest — runs continuously, ingests every hour at :00
// Run: node cron.js  (keep process alive, e.g. with pm2 or in a terminal)
import 'dotenv/config';
import cron from 'node-cron';
import { runIngest } from './ingest.js';

const SCHEDULE = '0 * * * *'; // every hour at :00

console.log(`[RadarDiplomático] Cron scheduler started — schedule: "${SCHEDULE}"`);
console.log('[RadarDiplomático] Running initial ingest on startup…\n');

// Run immediately on start, then follow the schedule
runIngest().catch(console.error);

cron.schedule(SCHEDULE, () => {
  runIngest().catch(console.error);
});
