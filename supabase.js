// =====================================================================
// supabase.js — CACD Dashboard shared Supabase client
// Loaded by every page via <script src="supabase.js"></script>
// Requires: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// =====================================================================

const SUPABASE_URL = 'https://bacyzdchxovwccoliodh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhY3l6ZGNoeG92d2Njb2xpb2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzE5MjUsImV4cCI6MjA5NDYwNzkyNX0.goMicgH3MTxl7eKjgmBqIlx1F9xn9UPwJ1GMTEudEGE';
const ADMIN_CODE   = 'CACD2026@admin'; // code needed to register as admin

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── RBAC permission matrix ───────────────────────────────────────────
const ROLE_PERMISSIONS = {
  super_admin:  ['*'],
  admin:        ['manage_content','manage_users','manage_news','view_analytics',
                 'manage_groups','manage_subscriptions','handle_reports'],
  moderator:    ['moderate_groups','handle_reports','view_content','view_reports'],
  premium_user: ['flashcards','simulados','analytics','grupos','news','segunda_fase'],
  free_user:    ['flashcards','analytics_basic','news'],
  banned_user:  [],
  // legacy compatibility
  admin_legacy: ['manage_content','manage_users','manage_news','view_analytics'],
  user:         ['flashcards','analytics_basic','news'],
};

const ADMIN_ROLES = ['super_admin', 'admin'];
const MOD_ROLES   = ['super_admin', 'admin', 'moderator'];

// ── cached profile (avoid redundant DB calls within a page) ──────────
let _profile = null;

const DB = {

  // ── AUTH ────────────────────────────────────────────────────────────

  async getUser() {
    const { data: { user } } = await _sb.auth.getUser();
    return user;
  },

  async getProfile(forceRefresh = false) {
    if (_profile && !forceRefresh) return _profile;
    const user = await this.getUser();
    if (!user) return null;
    const { data } = await _sb.from('profiles').select('*').eq('id', user.id).single();
    _profile = data;
    return data;
  },

  async isAdmin() {
    const p = await this.getProfile();
    return ADMIN_ROLES.includes(p?.role);
  },

  async isSuperAdmin() {
    const p = await this.getProfile();
    return p?.role === 'super_admin';
  },

  async isModerator() {
    const p = await this.getProfile();
    return MOD_ROLES.includes(p?.role);
  },

  async hasPermission(perm) {
    const p = await this.getProfile();
    if (!p) return false;
    const perms = ROLE_PERMISSIONS[p.role] || [];
    return perms.includes('*') || perms.includes(perm);
  },

  /** Redirects to login.html if not authenticated. Redirects to banned.html if banned. Returns user. */
  async requireAuth() {
    const user = await this.getUser();
    if (!user) { window.location.href = 'login.html'; throw new Error('unauthenticated'); }
    const profile = await this.getProfile();
    if (profile?.banned_at) { window.location.href = 'banned.html'; throw new Error('banned'); }
    return user;
  },

  /** Redirects to index.html if not admin/super_admin. Returns profile. */
  async requireAdmin() {
    const profile = await this.getProfile();
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      window.location.href = 'index.html'; throw new Error('not admin');
    }
    return profile;
  },

  /** Redirects to index.html unless user has one of the given roles. */
  async requireRole(...roles) {
    const profile = await this.getProfile();
    if (!profile || !roles.includes(profile.role)) {
      window.location.href = 'index.html'; throw new Error('insufficient role');
    }
    return profile;
  },

  async loginWithGoogle() {
    return await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/index.html' },
    });
  },

  async login(email, password) {
    return await _sb.auth.signInWithPassword({ email, password });
  },

  async register(email, password, name) {
    return await _sb.auth.signUp({
      email, password,
      options: { data: { name: name || email.split('@')[0], role: 'free_user' } }
    });
  },

  async logout() {
    _profile = null;
    await _sb.auth.signOut();
    window.location.href = 'login.html';
  },

  // ── NAV HELPER ──────────────────────────────────────────────────────

  /** Call after DOM ready. Populates #navUser with name + logout btn. */
  async renderNav() {
    const el = document.getElementById('navUser');
    if (!el) return;
    const profile = await this.getProfile();
    if (!profile) return;
    const isAdminRole = ADMIN_ROLES.includes(profile.role) || profile.role === 'moderator';
    const adminLabel  = profile.role === 'super_admin' ? 'SUPER' : profile.role === 'moderator' ? 'MOD' : 'ADMIN';
    const adminBadge  = isAdminRole
      ? `<a href="admin.html" style="font-size:11px;padding:3px 9px;border-radius:20px;background:rgba(250,204,21,0.15);border:1px solid rgba(250,204,21,0.4);color:#facc15;text-decoration:none;font-weight:600">${adminLabel}</a>`
      : '';
    el.innerHTML = `
      ${adminBadge}
      <span style="font-size:13px;color:#c5d5ff">${profile.name || profile.email}</span>
      <button onclick="DB.logout()" style="background:none;border:1px solid rgba(255,255,255,0.12);color:var(--muted,#8f8f8f);padding:4px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit">Sair</button>`;
  },

  // ── SESSIONS ────────────────────────────────────────────────────────

  async getSessions(userId) {
    const { data } = await _sb.from('sessions')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async addSession(session) {
    const user = await this.getUser();
    if (!user) return null;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await _sb.from('sessions').insert({
      user_id: user.id,
      date: today,
      type:    session.type,
      deck:    session.deck,
      subject: session.subject,
      total:   session.total,
      correct: session.correct,
      wrong:   session.wrong,
      time_seconds: session.time_seconds || 0,
      wrong_items:  session.wrong_items  || []
    }).select().single();
    if (!error) {
      // increment activity (uses db function to avoid race conditions)
      await _sb.rpc('upsert_activity', { p_user_id: user.id, p_date: today });
    }
    return data;
  },

  // ── CARD STATUS ─────────────────────────────────────────────────────

  /** Returns map: { question: {status, reviews} } for a deck */
  async getCardStatusMap(deckName) {
    const user = await this.getUser();
    if (!user) return {};
    const { data } = await _sb.from('card_status')
      .select('question, status, reviews')
      .eq('user_id', user.id).eq('deck_name', deckName);
    const map = {};
    (data || []).forEach(r => { map[r.question] = { status: r.status, reviews: r.reviews }; });
    return map;
  },

  async upsertCard(deckName, question, status) {
    const user = await this.getUser();
    if (!user) return;
    await _sb.from('card_status').upsert({
      user_id: user.id,
      deck_name: deckName,
      question,
      status,
      reviews: 1,
      last_review: new Date().toISOString()
    }, {
      onConflict: 'user_id,deck_name,question',
      ignoreDuplicates: false
    });
  },

  // ── ACTIVITY ────────────────────────────────────────────────────────

  async getActivity(userId) {
    const { data } = await _sb.from('activity').select('date, session_count').eq('user_id', userId);
    const result = {};
    (data || []).forEach(r => { result[r.date] = r.session_count; });
    return result;
  },

  // ── REVIEWED ITEMS ──────────────────────────────────────────────────

  async getReviewed() {
    const user = await this.getUser();
    if (!user) return {};
    const { data } = await _sb.from('reviewed_items').select('item_key').eq('user_id', user.id);
    const result = {};
    (data || []).forEach(r => { result[r.item_key] = true; });
    return result;
  },

  async toggleReviewed(itemKey) {
    const user = await this.getUser();
    if (!user) return false;
    const { data } = await _sb.from('reviewed_items')
      .select('id').eq('user_id', user.id).eq('item_key', itemKey).maybeSingle();
    if (data) {
      await _sb.from('reviewed_items').delete().eq('id', data.id);
      return false;
    } else {
      await _sb.from('reviewed_items').insert({ user_id: user.id, item_key: itemKey });
      return true;
    }
  },

  // ── ANNOUNCEMENTS ───────────────────────────────────────────────────

  async getAnnouncements() {
    const { data } = await _sb.from('announcements')
      .select('*, profiles(name)').order('created_at', { ascending: false }).limit(5);
    return data || [];
  },

  async addAnnouncement(title, body) {
    const user = await this.getUser();
    if (!user) return;
    await _sb.from('announcements').insert({ admin_id: user.id, title, body });
  },

  async deleteAnnouncement(id) {
    await _sb.from('announcements').delete().eq('id', id);
  },

  // ── STUDY GOALS ─────────────────────────────────────────────────────

  async getGoals() {
    const { data } = await _sb.from('study_goals').select('*');
    const result = {};
    (data || []).forEach(g => { result[g.subject] = g; });
    return result;
  },

  async setGoal(subject, targetScore, description) {
    const user = await this.getUser();
    await _sb.from('study_goals').upsert({
      subject,
      target_score: parseInt(targetScore),
      description,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'subject' });
  },

  async deleteGoal(subject) {
    await _sb.from('study_goals').delete().eq('subject', subject);
  },

  // ── ADMIN: ALL USERS STATS ──────────────────────────────────────────

  async getAllUsersStats() {
    const [{ data: profiles }, { data: sessions }, { data: activity }] = await Promise.all([
      _sb.from('profiles').select('*').order('created_at'),
      _sb.from('sessions').select('user_id, total, correct, date, subject'),
      _sb.from('activity').select('user_id, date')
    ]);
    return (profiles || []).map(p => {
      const us = (sessions || []).filter(s => s.user_id === p.id);
      const ua = (activity || []).filter(a => a.user_id === p.id);
      const avg = us.length > 0
        ? Math.round(us.reduce((a, s) => a + (s.correct / s.total * 100), 0) / us.length)
        : 0;
      const lastActive = us.length > 0
        ? us.sort((a,b) => b.date > a.date ? 1 : -1)[0].date
        : null;
      return { ...p, totalSessions: us.length, totalCards: us.reduce((a,s)=>a+s.total,0), avgScore: avg, studyDays: ua.length, lastActive };
    });
  },

  async setUserRole(userId, role) {
    const { error } = await _sb.from('profiles').update({ role }).eq('id', userId);
    return !error;
  },

  async getAllSessions() {
    const { data } = await _sb.from('sessions')
      .select('*, profiles(name, email)').order('created_at', { ascending: false });
    return data || [];
  },

  // ── LEADERBOARD ─────────────────────────────────────────────────────

  async getLeaderboard(since = null) {
    if (!since) {
      const { data } = await _sb.from('leaderboard_tps').select('*');
      return data || [];
    }
    const [{ data: sessions }, { data: profiles }] = await Promise.all([
      _sb.from('sessions').select('user_id, correct, total').eq('type','simulado').gte('date', since),
      _sb.from('profiles').select('id, name')
    ]);
    const map = {};
    (sessions || []).forEach(s => {
      if (!map[s.user_id]) map[s.user_id] = { sessions:0, correct:0, total:0, best:0 };
      const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
      map[s.user_id].sessions++;
      map[s.user_id].correct += s.correct;
      map[s.user_id].total   += s.total;
      map[s.user_id].best     = Math.max(map[s.user_id].best, pct);
    });
    return (profiles || []).map(p => ({
      id: p.id, name: p.name,
      tps_sessions:    map[p.id]?.sessions    || 0,
      avg_score:       map[p.id]?.total > 0 ? Math.round(map[p.id].correct / map[p.id].total * 100) : 0,
      best_score:      map[p.id]?.best        || 0,
      total_questions: map[p.id]?.total       || 0
    })).sort((a,b) => b.avg_score - a.avg_score);
  },

  // ── SUBJECT FILES ───────────────────────────────────────────────────

  async getSubjectFiles() {
    const { data } = await _sb.from('subject_files').select('*').order('subject_id').order('created_at');
    return data || [];
  },

  async addSubjectFile(subject_id, name, path, type) {
    const { data, error } = await _sb.from('subject_files').insert({ subject_id, name, path, type }).select().single();
    if (error) return { error: error.message };
    return data;
  },

  async deleteSubjectFile(id) {
    const { error } = await _sb.from('subject_files').delete().eq('id', id);
    return error ? { error: error.message } : { ok: true };
  },

  // ── GROUPS ──────────────────────────────────────────────────────────

  async getMyGroups() {
    const user = await this.getUser();
    if (!user) return [];
    const { data: mem } = await _sb.from('group_members').select('group_id').eq('user_id', user.id);
    const ids = (mem || []).map(r => r.group_id);
    if (!ids.length) return [];
    const { data } = await _sb.from('groups').select('*').in('id', ids);
    return data || [];
  },

  async createGroup(name, description) {
    const user = await this.getUser();
    if (!user) return { error: 'Não autenticado' };
    const invite_code = Math.random().toString(36).slice(2,6).toUpperCase() +
                        Math.random().toString(36).slice(2,6).toUpperCase();
    const { data: grp, error } = await _sb.from('groups')
      .insert({ name, description, created_by: user.id, invite_code }).select().single();
    if (error || !grp) return { error: error?.message || 'Erro ao criar grupo' };
    await _sb.from('group_members').insert({ group_id: grp.id, user_id: user.id, role: 'owner' });
    return grp;
  },

  async joinGroup(inviteCode) {
    const user = await this.getUser();
    if (!user) return null;
    const { data: grp } = await _sb.from('groups').select('id, name').eq('invite_code', inviteCode.trim()).maybeSingle();
    if (!grp) return null;
    await _sb.from('group_members').upsert({ group_id: grp.id, user_id: user.id, role: 'member' }, { onConflict: 'group_id,user_id' });
    return grp;
  },

  async getGroupMembers(groupId) {
    const { data } = await _sb.from('group_members')
      .select('*, profiles(id, name, email)').eq('group_id', groupId);
    return data || [];
  },

  async getGroupActivity(groupId) {
    const { data: mem } = await _sb.from('group_members').select('user_id').eq('group_id', groupId);
    const ids = (mem || []).map(m => m.user_id);
    if (!ids.length) return [];
    const { data } = await _sb.from('sessions')
      .select('*, profiles(name)').in('user_id', ids)
      .order('created_at', { ascending: false }).limit(100);
    return data || [];
  },

  async leaveGroup(groupId) {
    const user = await this.getUser();
    if (!user) return;
    await _sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id);
  },

  async updateGroupTopics(groupId, topics) {
    const { error } = await _sb.from('groups').update({ topics }).eq('id', groupId);
    return error ? { error: error.message } : { ok: true };
  },

  async getGroupFiles(groupId) {
    const { data } = await _sb.from('group_files')
      .select('*, profiles(name)').eq('group_id', groupId).order('created_at', { ascending: false });
    return data || [];
  },

  async addGroupFile(groupId, name, url) {
    const user = await this.getUser();
    if (!user) return { error: 'Não autenticado' };
    const { data, error } = await _sb.from('group_files')
      .insert({ group_id: groupId, uploaded_by: user.id, name, url }).select().single();
    if (error) return { error: error.message };
    return data;
  },

  async uploadGroupFile(groupId, file) {
    const user = await this.getUser();
    if (!user) return { error: 'Não autenticado' };
    const ext = file.name.split('.').pop();
    const path = `${groupId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await _sb.storage.from('group-files').upload(path, file);
    if (upErr) return { error: upErr.message };
    const { data: { publicUrl } } = _sb.storage.from('group-files').getPublicUrl(path);
    return this.addGroupFile(groupId, file.name, publicUrl);
  },

  async deleteGroupFile(fileId) {
    const { error } = await _sb.from('group_files').delete().eq('id', fileId);
    return error ? { error: error.message } : { ok: true };
  },

  // ── AGENDA ──────────────────────────────────────────────────────────

  async getAgendaItems(from, to, groupId = null) {
    const user = await this.getUser();
    if (!user) return [];
    let q = _sb.from('agenda_items').select('*').gte('date', from).lte('date', to);
    if (groupId) q = q.eq('group_id', groupId);
    else         q = q.eq('user_id', user.id);
    const { data } = await q.order('date').order('time_start', { nullsFirst: true });
    return data || [];
  },

  async addAgendaItem(item) {
    const user = await this.getUser();
    if (!user) return null;
    const { data, error } = await _sb.from('agenda_items')
      .insert({ ...item, user_id: user.id }).select().single();
    return error ? null : data;
  },

  async updateAgendaItem(id, updates) {
    const { data } = await _sb.from('agenda_items').update(updates).eq('id', id).select().single();
    return data;
  },

  async deleteAgendaItem(id) {
    await _sb.from('agenda_items').delete().eq('id', id);
  },

  async resetUserRanking(userId) {
    await _sb.from('leaderboard_tps').delete().eq('user_id', userId);
  },

  async resetAllRankings() {
    await _sb.from('leaderboard_tps').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  },

  async searchUsers(query) {
    const { data } = await _sb.from('profiles')
      .select('id, name, email').ilike('name', `%${query}%`).limit(8);
    return data || [];
  },

  async getPublicAgenda(userId, from, to) {
    const { data } = await _sb.from('agenda_items')
      .select('*').eq('user_id', userId).gte('date', from).lte('date', to)
      .order('date').order('time_start', { nullsFirst: true });
    return data || [];
  },

  // ── DISCURSIVAS ──────────────────────────────────────────────────────

  async getDiscursivas(subject = null) {
    let q = _sb.from('discursivas').select('*').order('created_at', { ascending: false });
    if (subject) q = q.eq('subject', subject);
    const { data } = await q;
    return data || [];
  },

  async addDiscursiva(subject, year, prompt, gabarito) {
    const user = await this.getUser();
    const { data } = await _sb.from('discursivas')
      .insert({ admin_id: user.id, subject, year: year || null, prompt, gabarito: gabarito || null })
      .select().single();
    return data;
  },

  async deleteDiscursiva(id) {
    await _sb.from('discursivas').delete().eq('id', id);
  },

  async submitDiscursiva(discursivaId, response, selfScore) {
    const user = await this.getUser();
    if (!user) return null;
    const { data } = await _sb.from('discursiva_responses')
      .upsert({ discursiva_id: discursivaId, user_id: user.id, response, self_score: selfScore,
                submitted_at: new Date().toISOString() }, { onConflict: 'discursiva_id,user_id' })
      .select().single();
    return data;
  },

  async getMyDiscursivaResponse(discursivaId) {
    const user = await this.getUser();
    if (!user) return null;
    const { data } = await _sb.from('discursiva_responses')
      .select('*').eq('discursiva_id', discursivaId).eq('user_id', user.id).maybeSingle();
    return data;
  },

  async getDiscursivaResponses(discursivaId) {
    const { data } = await _sb.from('discursiva_responses')
      .select('*, profiles(name)').eq('discursiva_id', discursivaId).order('submitted_at');
    return data || [];
  },

  async gradeDiscursiva(responseId, adminScore, adminComment) {
    await _sb.from('discursiva_responses')
      .update({ admin_score: adminScore, admin_comment: adminComment }).eq('id', responseId);
  },

  // ── EDITAL ──────────────────────────────────────────────────────────

  async getEditalTree(subject = null) {
    let q = _sb.from('edital_items').select('*').order('order_n');
    if (subject) q = q.eq('subject', subject);
    const { data } = await q;
    const items = data || [];
    const roots = items.filter(i => !i.parent);
    roots.forEach(r => { r.children = items.filter(i => i.parent === r.id); });
    return roots;
  },

  async addEditalItem(subject, code, title, parentId = null, order = 0) {
    const { data } = await _sb.from('edital_items')
      .insert({ subject, code, title, parent: parentId || null, order_n: order }).select().single();
    return data;
  },

  async deleteEditalItem(id) {
    await _sb.from('edital_items').delete().eq('id', id);
  },

  async getFlashcardEditalMap(deckName) {
    const { data } = await _sb.from('flashcard_edital')
      .select('question, edital_id, edital_items(id, code, title, subject)')
      .eq('deck_name', deckName);
    const map = {};
    (data || []).forEach(r => {
      if (!map[r.question]) map[r.question] = [];
      if (r.edital_items) map[r.question].push(r.edital_items);
    });
    return map;
  },

  async mapFlashcardToEdital(deckName, question, editalId) {
    await _sb.from('flashcard_edital')
      .upsert({ deck_name: deckName, question, edital_id: editalId },
               { onConflict: 'deck_name,question,edital_id' });
  },

  async bulkMapToEdital(deckName, questions, editalIds) {
    const rows = [];
    for (const q of questions) {
      for (const eid of editalIds) {
        rows.push({ deck_name: deckName, question: q, edital_id: eid });
      }
    }
    if (!rows.length) return;
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await _sb.from('flashcard_edital')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'deck_name,question,edital_id' });
    }
  },

  async getEditalFlat(subject) {
    const { data } = await _sb.from('edital_items').select('*').eq('subject', subject).order('order_n');
    return data || [];
  },

  async getTopicEnrichment(editalId) {
    const { data } = await _sb.from('topic_enrichment').select('*').eq('edital_id', editalId).maybeSingle();
    return data;
  },

  async getTopicConnections(editalId) {
    const { data } = await _sb.from('topic_connections')
      .select(`*, source:source_id(id,code,title,subject), target:target_id(id,code,title,subject)`)
      .or(`source_id.eq.${editalId},target_id.eq.${editalId}`);
    return data || [];
  },

  // ── SETTINGS ────────────────────────────────────────────────────────

  async getExamDate() {
    const { data } = await _sb.from('settings').select('value').eq('key','exam_date_2027').maybeSingle();
    return data?.value ? new Date(data.value) : new Date('2027-12-01');
  },

  async setExamDate(dateStr) {
    await _sb.from('settings').upsert({ key: 'exam_date_2027', value: dateStr }, { onConflict: 'key' });
  },

  // ── NEWS ────────────────────────────────────────────────────────────

  async getNews({ category = null, search = null, page = 0, limit = 21, favoritesOnly = false } = {}) {
    let q = _sb.from('news_articles').select('*');

    if (favoritesOnly) {
      const user = await this.getUser();
      if (!user) return [];
      const { data: favs } = await _sb.from('news_favorites')
        .select('article_id').eq('user_id', user.id);
      const ids = (favs || []).map(f => f.article_id);
      if (!ids.length) return [];
      q = q.in('id', ids);
    }

    if (category && category !== 'ALL') {
      q = q.or(`cacd_category.eq.${category},cacd_secondary.eq.${category}`);
    }

    if (search && search.trim()) {
      const terms = search.trim().split(/\s+/).filter(Boolean).join(' & ');
      if (terms) q = q.textSearch('search_vector', terms);
    }

    const from = page * limit;
    const { data, error } = await q
      .order('published_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) { console.error('getNews error:', error.message); return []; }
    return data || [];
  },

  async getNewsFavoriteIds() {
    const user = await this.getUser();
    if (!user) return new Set();
    const { data } = await _sb.from('news_favorites')
      .select('article_id').eq('user_id', user.id);
    return new Set((data || []).map(r => r.article_id));
  },

  async toggleNewsFavorite(articleId) {
    const user = await this.getUser();
    if (!user) return false;
    const { data } = await _sb.from('news_favorites')
      .select('id').eq('user_id', user.id).eq('article_id', articleId).maybeSingle();
    if (data) {
      await _sb.from('news_favorites').delete().eq('id', data.id);
      return false;
    } else {
      await _sb.from('news_favorites').insert({ user_id: user.id, article_id: articleId });
      return true;
    }
  },

  subscribeToNews(callback) {
    return _sb.channel('radar_news_insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_articles' }, callback)
      .subscribe();
  },

  // ── AUDIT LOGS ──────────────────────────────────────────────────────

  async logAudit(action, targetType = null, targetId = null, metadata = {}) {
    const user = await this.getUser();
    if (!user) return;
    await _sb.from('audit_logs').insert({
      actor_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      metadata,
    });
  },

  async getAuditLogs({ userId = null, action = null, page = 0, limit = 50 } = {}) {
    let q = _sb.from('audit_logs')
      .select('*, actor:actor_id(name,email), target_user:user_id(name,email)')
      .order('created_at', { ascending: false });
    if (userId)  q = q.eq('actor_id', userId);
    if (action)  q = q.eq('action', action);
    const from = page * limit;
    const { data } = await q.range(from, from + limit - 1);
    return data || [];
  },

  // ── SECURITY EVENTS ─────────────────────────────────────────────────

  async logSecurityEvent(eventType, metadata = {}) {
    const user = await this.getUser();
    await _sb.from('security_events').insert({
      user_id:    user?.id || null,
      event_type: eventType,
      user_agent: navigator.userAgent,
      metadata,
    });
  },

  async getSecurityEvents({ userId = null, type = null, limit = 100 } = {}) {
    let q = _sb.from('security_events')
      .select('*, profiles(name,email)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (userId) q = q.eq('user_id', userId);
    if (type)   q = q.eq('event_type', type);
    const { data } = await q;
    return data || [];
  },

  // ── DEVICE / SESSION TRACKING ────────────────────────────────────────

  async trackSession() {
    const user = await this.getUser();
    if (!user) return;
    const { data: { session } } = await _sb.auth.getSession();
    await _sb.from('user_sessions').upsert({
      user_id:             user.id,
      supabase_session_id: session?.access_token?.slice(-16) || null,
      user_agent:          navigator.userAgent,
      device_info:         { screen: `${screen.width}x${screen.height}`, lang: navigator.language },
      last_seen:           new Date().toISOString(),
    }, { onConflict: 'supabase_session_id', ignoreDuplicates: false });
  },

  async getUserDeviceSessions(userId) {
    const { data } = await _sb.from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('last_seen', { ascending: false });
    return data || [];
  },

  async revokeUserSessions(userId) {
    await _sb.from('user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);
    await this.logAudit('revoke_sessions', 'user', userId);
  },

  // ── USER MANAGEMENT (ADMIN) ──────────────────────────────────────────

  async banUser(userId, reason) {
    const { error } = await _sb.from('profiles').update({
      banned_at: new Date().toISOString(),
      banned_reason: reason || 'Violação dos termos de uso',
      role: 'banned_user',
    }).eq('id', userId);
    if (!error) await this.logAudit('ban_user', 'user', userId, { reason });
    return !error;
  },

  async suspendUser(userId, untilIso) {
    const { error } = await _sb.from('profiles').update({
      suspended_until: untilIso,
    }).eq('id', userId);
    if (!error) await this.logAudit('suspend_user', 'user', userId, { until: untilIso });
    return !error;
  },

  async unbanUser(userId) {
    const { error } = await _sb.from('profiles').update({
      banned_at: null,
      banned_reason: null,
      suspended_until: null,
      role: 'free_user',
    }).eq('id', userId);
    if (!error) await this.logAudit('unban_user', 'user', userId);
    return !error;
  },

  async changeUserRole(userId, newRole) {
    const { error } = await _sb.from('profiles').update({ role: newRole }).eq('id', userId);
    if (!error) await this.logAudit('change_role', 'user', userId, { new_role: newRole });
    return !error;
  },

  async deleteUser(userId) {
    const { error } = await _sb.rpc('delete_auth_user', { user_id: userId });
    return !error;
  },

  // ── REPORTS / DENÚNCIAS ──────────────────────────────────────────────

  async getReports({ status = null, page = 0, limit = 30 } = {}) {
    let q = _sb.from('reports')
      .select('*, reporter:reporter_id(name,email), reviewer:reviewed_by(name,email)')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const from = page * limit;
    const { data } = await q.range(from, from + limit - 1);
    return data || [];
  },

  async addReport(targetType, targetId, reason, description = '') {
    const user = await this.getUser();
    if (!user) return null;
    const { data, error } = await _sb.from('reports').insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id:   String(targetId),
      reason,
      description,
    }).select().single();
    if (!error) await this.logAudit('submit_report', targetType, targetId, { reason });
    return error ? null : data;
  },

  async resolveReport(reportId, status) {
    const user = await this.getUser();
    const { error } = await _sb.from('reports').update({
      status,
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', reportId);
    if (!error) await this.logAudit('resolve_report', 'report', reportId, { status });
    return !error;
  },

  // ── SUBSCRIPTIONS ────────────────────────────────────────────────────

  async getSubscription(userId = null) {
    const uid = userId || (await this.getUser())?.id;
    if (!uid) return null;
    const { data } = await _sb.from('subscriptions').select('*').eq('user_id', uid).maybeSingle();
    return data;
  },

  async getAllSubscriptions() {
    const { data } = await _sb.from('subscriptions')
      .select('*, profiles(id,name,email,role)')
      .order('created_at', { ascending: false });
    return data || [];
  },

  async setSubscriptionTier(userId, tier, expiresAt = null) {
    const { error } = await _sb.from('subscriptions').upsert({
      user_id:    userId,
      tier,
      status:     'active',
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (!error) {
      await _sb.from('profiles').update({ subscription_tier: tier, subscription_expires_at: expiresAt }).eq('id', userId);
      await this.logAudit('change_subscription', 'user', userId, { tier, expires_at: expiresAt });
    }
    return !error;
  },

  // ── APP SETTINGS ─────────────────────────────────────────────────────

  async getAppSettings() {
    const { data } = await _sb.from('app_settings').select('*');
    const result = {};
    (data || []).forEach(r => { result[r.key] = r.value; });
    return result;
  },

  async setAppSetting(key, value) {
    const user = await this.getUser();
    const { error } = await _sb.from('app_settings').upsert({
      key,
      value: typeof value === 'object' ? value : { v: value },
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    if (!error) await this.logAudit('change_setting', 'app_settings', key, { value });
    return !error;
  },

  // ── ADMIN METRICS ────────────────────────────────────────────────────

  async getAdminMetrics() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];

    const [{ data: profiles }, { data: sessions }, { data: activity }] = await Promise.all([
      _sb.from('profiles').select('role, subscription_tier, created_at'),
      _sb.from('sessions').select('date, subject, type, correct, total').gte('date', thirtyDaysAgo),
      _sb.from('activity').select('date, session_count').gte('date', thirtyDaysAgo),
    ]);

    const byRole = {};
    const byTier = {};
    (profiles || []).forEach(p => {
      byRole[p.role] = (byRole[p.role] || 0) + 1;
      byTier[p.subscription_tier || 'free'] = (byTier[p.subscription_tier || 'free'] || 0) + 1;
    });

    const dau = (activity || []).find(a => a.date === today)?.session_count || 0;
    const mau = new Set((sessions || []).map(s => s.date?.slice(0,7))).size;

    const subjectCounts = {};
    let totalCorrect = 0, totalQuestions = 0;
    (sessions || []).forEach(s => {
      subjectCounts[s.subject] = (subjectCounts[s.subject] || 0) + 1;
      totalCorrect   += s.correct || 0;
      totalQuestions += s.total   || 0;
    });

    return {
      totalUsers:       (profiles || []).length,
      byRole,
      byTier,
      dau,
      mauSessions:      (sessions || []).length,
      avgScore:         totalQuestions > 0 ? Math.round(totalCorrect / totalQuestions * 100) : 0,
      subjectCounts,
      sessionsLast30d:  sessions || [],
      activityLast30d:  activity || [],
    };
  },

  // ── Settings CRUD ────────────────────────────────────────────────────
  async getSettings() {
    const { data } = await _sb.from('app_settings').select('*').order('key');
    return data || [];
  },
  async setSetting(key, value) {
    const user = await this.getUser();
    await _sb.from('app_settings').upsert(
      { key, value: String(value), updated_by: user?.id },
      { onConflict: 'key' }
    );
    await this.logAudit('change_setting', 'setting', key, { value });
  },
  async getSetting(key) {
    const { data } = await _sb.from('app_settings').select('value').eq('key', key).single();
    return data?.value ?? null;
  },

  // ── Métricas avançadas ───────────────────────────────────────────────
  async getAdvancedMetrics() {
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [mauRes, subsRes, sessRes] = await Promise.all([
      _sb.from('activity').select('user_id', { count: 'exact', head: true }).gte('date', since30),
      _sb.from('profiles').select('subscription_tier'),
      _sb.from('sessions').select('user_id,time_seconds,correct,total').gte('date', since30),
    ]);
    const tiers = { free: 0, premium: 0, elite: 0 };
    (subsRes.data || []).forEach(s => {
      const t = s.subscription_tier || 'free';
      tiers[t] = (tiers[t] || 0) + 1;
    });
    const total = Object.values(tiers).reduce((a, b) => a + b, 0) || 1;
    const convRate = Math.round(((tiers.premium + tiers.elite) / total) * 100);
    const sess = sessRes.data || [];
    const avgTime = sess.length
      ? Math.round(sess.reduce((a, s) => a + (s.time_seconds || 0), 0) / sess.length / 60)
      : 0;
    const avgScore = sess.length
      ? Math.round(sess.filter(s => s.total > 0)
          .reduce((a, s) => a + (s.correct / s.total * 100), 0) / (sess.filter(s => s.total > 0).length || 1))
      : 0;
    return { mau: mauRes.count || 0, tiers, convRate, avgTime, avgScore };
  },

  // ── Analytics: retenção e heatmap ────────────────────────────────────
  async getRetentionMetrics() {
    const { data: allSess } = await _sb.from('sessions').select('user_id,date').order('date');
    if (!allSess?.length) return { d1: 0, d7: 0, d30: 0 };
    const firstByUser = {};
    allSess.forEach(s => {
      if (!firstByUser[s.user_id]) firstByUser[s.user_id] = s.date;
    });
    let d1 = 0, d7 = 0, d30 = 0, total = 0;
    Object.entries(firstByUser).forEach(([uid, firstDate]) => {
      total++;
      const fd = new Date(firstDate).getTime();
      const hasSessAfter = (days) =>
        allSess.some(s => s.user_id === uid && new Date(s.date).getTime() >= fd + days * 86400000);
      if (hasSessAfter(1))  d1++;
      if (hasSessAfter(7))  d7++;
      if (hasSessAfter(30)) d30++;
    });
    const pct = n => total > 0 ? Math.round(n / total * 100) : 0;
    return { d1: pct(d1), d7: pct(d7), d30: pct(d30), total };
  },
  async getSubjectHeatmap() {
    const { data } = await _sb.from('sessions').select('subject,correct,total')
      .not('subject', 'is', null).gte('total', 1);
    if (!data?.length) return [];
    const map = {};
    data.forEach(s => {
      if (!s.subject) return;
      if (!map[s.subject]) map[s.subject] = { correct: 0, total: 0 };
      map[s.subject].correct += s.correct || 0;
      map[s.subject].total   += s.total   || 0;
    });
    return Object.entries(map)
      .map(([subject, { correct, total }]) => ({ subject, pct: Math.round(correct / total * 100) }))
      .sort((a, b) => b.pct - a.pct);
  },

  // ── Leaderboard management ───────────────────────────────────────────
  async getLeaderboardData(limit = 100) {
    const { data } = await _sb.from('leaderboard_tps')
      .select('*').order('score', { ascending: false }).limit(limit);
    return data || [];
  },
  async hideFromLeaderboard(userId, hide) {
    await _sb.from('profiles').update({ hide_from_leaderboard: hide }).eq('id', userId);
    await this.logAudit(hide ? 'hide_leaderboard' : 'show_leaderboard', 'user', userId);
  },

  // ── Forçar reset de senha ────────────────────────────────────────────
  async sendPasswordReset(email) {
    const { error } = await _sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.replace(/\/[^/]*(\?.*)?$/, '/login.html'),
    });
    if (!error) await this.logAudit('password_reset_forced', 'user', email);
    return { error };
  },

  // ── Alertas de segurança ─────────────────────────────────────────────
  async getSecurityAlerts() {
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: events } = await _sb.from('security_events')
      .select('*').gte('created_at', since).order('created_at', { ascending: false });
    const failed = (events || []).filter(e => e.event_type === 'login_failed');
    const alerts = [];
    const byIp = {};
    failed.forEach(e => {
      const ip = e.metadata?.ip || '?';
      byIp[ip] = (byIp[ip] || 0) + 1;
    });
    Object.entries(byIp).forEach(([ip, n]) => {
      if (n >= 5) alerts.push({ type: 'brute_force', ip, count: n, level: 'danger' });
    });
    if (failed.length > 20) alerts.push({ type: 'spike', count: failed.length, level: 'warning' });
    const { data: pendingReports } = await _sb.from('reports')
      .select('id', { count: 'exact', head: true }).eq('status', 'pending');
    const pendingCount = pendingReports?.length || 0;
    if (pendingCount > 5) alerts.push({ type: 'reports', count: pendingCount, level: 'warning' });
    return { alerts, recentEvents: (events || []).slice(0, 20) };
  },

  // ── IP blocklist ─────────────────────────────────────────────────────
  async getBlockedIPs() {
    const val = await this.getSetting('blocked_ips');
    try { return JSON.parse(val) || []; } catch { return []; }
  },
  async blockIP(ip, reason) {
    const list = await this.getBlockedIPs();
    if (!list.find(e => e.ip === ip)) {
      list.push({ ip, reason, blocked_at: new Date().toISOString() });
      await this.setSetting('blocked_ips', JSON.stringify(list));
    }
  },
  async unblockIP(ip) {
    const list = await this.getBlockedIPs();
    await this.setSetting('blocked_ips', JSON.stringify(list.filter(e => e.ip !== ip)));
  },
};

window.DB = DB;
window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
window.ADMIN_ROLES = ADMIN_ROLES;
window.MOD_ROLES = MOD_ROLES;
