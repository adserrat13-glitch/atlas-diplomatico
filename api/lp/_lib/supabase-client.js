const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_KEY não configuradas');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

module.exports = { getSupabase };
