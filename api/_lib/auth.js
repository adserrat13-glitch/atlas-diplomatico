const { createClient } = require('@supabase/supabase-js');
const { getSupabase } = require('../lp/_lib/supabase-client');

const ADMIN_ROLES = ['super_admin', 'admin', 'moderator'];

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { error: 'Token de autenticação ausente' };

  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { error: 'Token inválido ou expirado' };
  return { user_id: user.id };
}

async function requireAdmin(req) {
  const auth = await authenticate(req);
  if (auth.error) return { error: auth.error, status: 401 };

  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user_id)
    .maybeSingle();

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return { error: 'Acesso restrito a administradores', status: 403 };
  }
  return { user_id: auth.user_id, role: profile.role };
}

module.exports = { authenticate, requireAdmin };
