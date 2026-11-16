// ─── Fila de estudo com cadeado ──────────────────────────────────────
// Matérias: uma por vez, inteira, e dentro dela um baralho por vez (ordem abaixo).
// A próxima matéria é escolhida quando a atual termina: a de menor % de acerto
// naquele momento (mesma conta da Análise TPS). Alemão e Russo vêm no fim.
// Provas TPS: trilha paralela, uma prova nova por dia; a próxima só abre quando
// a atual tiver ≥ 85% numa passada inteira (abaixo disso, refaz do zero).
// Sempre livres: revisões da agenda e baralhos já concluídos.
// "Concluído" = primeira passada inteira (troféu do baralho ou checkpoint no fim).
(function () {
  const PASS_PCT = 85;
  const STATE_DECK = '__fila_estudo__';
  const CACHE_KEY = 'deck_locks_v2';

  // Ordem dentro de cada matéria (fila única). [pasta, baralho]
  const SUBJECTS = [
    { code: 'DIP', label: 'Dir. Internacional', decks: [
      ['DIREITOINTERNACIONAL', 'DIREITOS HUMANOS'], ['DIREITOINTERNACIONAL', 'DIP PORTELA part 1'],
      ['DIREITOINTERNACIONAL', 'DIP PORTELA part 2'], ['DIREITOINTERNACIONAL', '1001 DIP'],
      ['DIREITOINTERNACIONAL', 'DIREITO INTERNACIONAL TPS']] },
    { code: 'DIR', label: 'Direito', decks: [
      ['DIREITOCONSTITUCIONAL', 'CONTROLE DE CONSTITUCIONALIDADE'], ['DIREITOCONSTITUCIONAL', 'REZEK'],
      ['DIREITOCONSTITUCIONAL', '1001 CONST'], ['DIREITOCONSTITUCIONAL', 'DIREITO MANUAL DO CANDIDATO'],
      ['DIREITOCONSTITUCIONAL', 'DIREITO CONSTITUCIONAL']] },
    { code: 'ECO', label: 'Economia', decks: [
      ['ECONOMIA', 'ECONOMIA'], ['ECONOMIA', 'FEB 2'], ['ECONOMIA', 'ECO 2'],
      ['ECONOMIA', 'FEB MANUAL'], ['ECONOMIA', 'ECONOMIA TPS'], ['ECONOMIA', 'ORDEM E PROGRESSO']] },
    { code: 'PI', label: 'Pol. Internacional', decks: [
      '01 - Teoria das Relacoes Internacionais', '02 - HPEB (Historia da Politica Externa Brasileira)',
      '03 - ONU', '04 - Seguranca Internacional', '05 - Meio Ambiente Internacional', '06 - Direitos Humanos',
      '07 - Coalizoes (BRICS, G20, Sul-Sul)', '08 - Sistema Financeiro Internacional',
      '09 - Sistema Comercial Internacional (OMC-GATT)', '10-11 - Blocos Economicos e Integracao Sul-Americana',
      '12 - EUA Politica Externa', '13 - Argentina', '14 - Americas (America Latina e Caribe)',
      '15 - Africa Politica Internacional', '16 - Asia Politica Internacional', '17 - Europa Politica Internacional',
      'ATUALIDADES 2024', 'ATUALIDADES 2025', 'LESSA 1', 'LESSA 2', 'PI COLE DIPLO',
      'POLITICA INTERNACIONAL TPS', 'POLITICAINTERNACIONAL', 'RELAÇÕES INTERNACIONAIS',
      'REPERTORIO FUNAG', 'TEORIA DAS RELAÇÕES INTERNACIONAIS'].map(n => ['POLITICA INTERNACIONAL', n]) },
    { code: 'HB', label: 'Hist. Brasil', decks: [
      ['HISTORIADOBRASIL', 'HISTORIA DO BRASIL JD'], ['HISTORIADOBRASIL', 'BRASIL IMPERIO'],
      ['HISTORIADOBRASIL', 'brasil republica'], ['HISTORIADOBRASIL', 'RUBENS RICCUPERIO 1700 2016'],
      ['HISTORIADOBRASIL', 'HPEB DORATIOTO'], ['HISTORIADOBRASIL', 'HISTORIA DO BRASIL 2 FASE'],
      ['HISTORIADOBRASIL', 'HPEB GAMBIAGI'], ['HISTORIADOBRASIL', 'POLITICA EXTERNA 193012'],
      ['HISTORIADOBRASIL', 'TPS HB']] },
    { code: 'ESP', label: 'Espanhol', decks: [['LINGUAS', 'ESPANHOL C1']] },
    { code: 'GEO', label: 'Geografia', decks: [
      ['GEOGRAFIA', 'GEOGRAFIA FUNAG'], ['GEOGRAFIA', 'GEOGRAFIA APOSTILA NOVA']] },
    { code: 'LP', label: 'Português', decks: [
      ['PORTUGUES', 'PORTUGUES DIPLOMATA'], ['PORTUGUES', 'portgues 1 pestana'], ['PORTUGUES', 'COMO ESCREVER'],
      ['PORTUGUES', 'poort diplo 2 anki'], ['PORTUGUES', 'INTERPRETAÇÃO DE TEXTOS']] },
    { code: 'HM', label: 'Hist. Mundial', decks: [
      ['HISTORIAMUNDIAL', 'BURNS'], ['HISTORIAMUNDIAL', 'HM SOMBRA SARAIVA'], ['HISTORIAMUNDIAL', 'HM DIPLOMACIA'],
      ['HISTORIAMUNDIAL', 'HM MANUAL'], ['HISTORIAMUNDIAL', 'HSITORIA DIFICIL']] },
    { code: 'ING', label: 'Inglês', decks: [
      ['LINGUAS', 'INGLÊS C2'], ['INGLES', 'VOCABULARIO'], ['INGLES', 'GRAMMAR TRANSFORMAR'],
      ['INGLES', 'INGLES GRAN'], ['LINGUAS', 'INGLÊS']] },
    // Sem % (não caem no CACD): sempre no fim, nesta ordem
    { code: 'RU', label: 'Russo', tail: true, decks: [['LINGUAS', 'RUSSO A2'], ['LINGUAS', 'RUSSO']] },
    { code: 'DE', label: 'Alemão', tail: true, decks: [['LINGUAS', 'ALEMÃO'], ['LINGUAS', 'DEUTSCH']] },
  ];
  const TPS = ['TPS 2013', 'TPS 2014', 'tps 2015', 'TPS 2016', 'TPS 2017', 'TPS 2018', 'TPS 2019', 'TPS 2021',
    'TPS 2022', 'TPS 2023', 'TPS 2024', 'TPS 2025', 'TPS 2025.1', 'TPS 2026', 'TPS 2026.1', 'TPS 00', 'DIRIETO ADM'];
  // Cópias locais seguem o baralho original (abre e conclui junto)
  const ALIASES = { 'POLITICA INTERNACIONAL - RELAÇÕES INTERNACIONAIS.local': 'POLITICA INTERNACIONAL - RELAÇÕES INTERNACIONAIS' };

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
  const keyFor = (folder, name) => folder ? `${folder} - ${name}` : name;
  const today = () => new Date().toLocaleDateString('en-CA');

  SUBJECTS.forEach(s => { s.keys = s.decks.map(([f, n]) => keyFor(f, n)); });
  const SUBJECT_OF = new Map();  // norm(key) → { subject, pos }
  SUBJECTS.forEach(s => s.keys.forEach((k, i) => SUBJECT_OF.set(norm(k), { subject: s, pos: i })));
  const TPS_POS = new Map(TPS.map((k, i) => [norm(k), i]));
  const ALIAS = new Map(Object.entries(ALIASES).map(([a, b]) => [norm(a), b]));

  // ── Estado (cache local para pintar na hora; Supabase é a fonte de verdade) ──
  let S = { done: [], passes: {}, pct: {}, current: null };
  try { Object.assign(S, JSON.parse(localStorage.getItem(CACHE_KEY)) || {}); } catch {}
  let _done = new Set(S.done);
  const saveCache = () => {
    S.done = [..._done];
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(S)); } catch {}
  };

  const realKey = key => ALIAS.get(norm(key)) || key;
  function localProg(key) {
    try { return JSON.parse(localStorage.getItem('sim_prog_' + key.replace(/\s+/g, '_'))); } catch { return null; }
  }
  function isDone(key) {
    key = realKey(key);
    if (_done.has(norm(key))) return true;
    const p = localProg(key);
    return !!(p && p.totalQ && p.lastDone >= p.totalQ);
  }
  const subjectDone = s => s.keys.every(isDone);
  const pctOf = s => (S.pct[s.code] && S.pct[s.code].total >= 20) ? S.pct[s.code].pct : null;

  // ── Fila de matérias ──
  function pickNextSubject() {
    const open = SUBJECTS.filter(s => !s.tail && !subjectDone(s));
    if (open.length) {
      return open.map((s, i) => ({ s, i, p: pctOf(s) ?? 101 }))
        .sort((a, b) => a.p - b.p || a.i - b.i)[0].s;
    }
    return SUBJECTS.find(s => s.tail && !subjectDone(s)) || null;
  }
  function currentSubject() {
    const cur = SUBJECTS.find(s => s.code === S.current);
    if (cur && !subjectDone(cur)) return cur;
    return pickNextSubject();
  }
  function currentDeckKey(s) {
    s = s || currentSubject();
    return s ? s.keys.find(k => !isDone(k)) || null : null;
  }
  // Ordem prevista das próximas (pela % de agora; recalculada a cada troca)
  function upcoming() {
    const cur = currentSubject();
    const rest = SUBJECTS.filter(s => s !== cur && !s.tail && !subjectDone(s))
      .map((s, i) => ({ s, i, p: pctOf(s) ?? 101 })).sort((a, b) => a.p - b.p || a.i - b.i).map(x => x.s);
    return rest.concat(SUBJECTS.filter(s => s !== cur && s.tail && !subjectDone(s)));
  }

  // ── Trilha TPS ──
  function tpsPass(key) {
    const p = S.passes[norm(key)];
    return p && p.pct >= PASS_PCT ? p : null;
  }
  function tpsCurrent() {
    const i = TPS.findIndex(k => !tpsPass(k));
    if (i === -1) return { key: null, waitTomorrow: false, index: TPS.length };
    const prev = i > 0 ? tpsPass(TPS[i - 1]) : null;
    const started = (() => { const p = localProg(TPS[i]); return !!(p && p.lastDone > 0); })();
    return { key: TPS[i], index: i, waitTomorrow: !!(prev && prev.date === today() && !started) };
  }
  function tpsDoneToday() {
    return TPS.some(k => { const p = tpsPass(k); return p && p.date === today(); });
  }
  // Passada completa abaixo de 85% → ao abrir de novo, recomeça do zero
  function tpsNeedsRetake(key, lastDone, total) {
    return TPS_POS.has(norm(key)) && !tpsPass(key) && total > 0 && lastDone >= total;
  }

  function status(deckKey) {
    const key = realKey(deckKey);
    const n = norm(key);
    if (TPS_POS.has(n)) {
      const pos = TPS_POS.get(n);
      const pass = tpsPass(key);
      if (pass) return { kind: 'tps', pos, total: TPS.length, done: true, locked: false, pass };
      const cur = tpsCurrent();
      if (cur.key && norm(cur.key) === n && !cur.waitTomorrow) return { kind: 'tps', pos, total: TPS.length, locked: false, current: true };
      const reason = cur.key && norm(cur.key) === n
        ? 'Uma prova TPS nova por dia: esta abre amanhã.'
        : `Provas TPS vão em ordem, uma por dia, com ≥ ${PASS_PCT}%. A da vez é ${cur.key}.`;
      return { kind: 'tps', pos, total: TPS.length, locked: true, reason };
    }
    const e = SUBJECT_OF.get(n);
    if (!e) return { kind: 'free', locked: false };
    const done = isDone(key);
    if (done) return { kind: 'subject', subject: e.subject, pos: e.pos, total: e.subject.keys.length, done, locked: false };
    const cur = currentSubject();
    const curKey = currentDeckKey(cur);
    if (cur === e.subject && curKey && norm(curKey) === n) {
      return { kind: 'subject', subject: e.subject, pos: e.pos, total: e.subject.keys.length, locked: false, current: true };
    }
    const reason = cur !== e.subject
      ? `Matéria da vez: ${cur ? cur.label : '—'}. ${e.subject.label} só abre quando chegar a vez dela (uma matéria inteira por vez, a de menor % primeiro).`
      : `Um baralho por vez em ${e.subject.label}. O da vez é: ${curKey ? curKey.replace(/^.* - /, '') : '—'}.`;
    return { kind: 'subject', subject: e.subject, pos: e.pos, total: e.subject.keys.length, locked: true, reason };
  }

  function explain(deckKey) {
    const st = status(deckKey);
    if (st.locked) alert(`🔒 Baralho bloqueado\n\n${st.reason}\n\nAs revisões da agenda continuam liberadas.`);
  }

  function markDone(deckKey) {
    _done.add(norm(realKey(deckKey)));
    saveCache();
    fire();
  }
  // Nota acumulada da passada atual (gravada junto do checkpoint)
  function notePass(deckKey, pass) {
    if (!TPS_POS.has(norm(deckKey)) || !pass || !pass.complete) return;
    const prev = S.passes[norm(deckKey)];
    if (!prev || prev.pct < PASS_PCT) S.passes[norm(deckKey)] = { pct: pass.pct, date: pass.date };
    saveCache();
    fire();
  }

  function fire() { try { window.dispatchEvent(new Event('decklocks:update')); } catch {} }

  async function subjectPct() {
    const user = await DB.getUser();
    if (!user) return null;
    const sessions = (await DB.getSessions(user.id)).filter(s => s.type === 'simulado');
    const acc = {};
    const add = (code, t, c) => { if (!code) return; acc[code] = acc[code] || { total: 0, correct: 0 }; acc[code].total += t; acc[code].correct += c; };
    sessions.forEach(s => {
      const bd = s.subjects_breakdown;
      if (bd && typeof bd === 'object' && Object.keys(bd).length) {
        Object.entries(bd).forEach(([code, v]) => {
          if (v && typeof v === 'object') add(code, v.total || 0, v.correct || 0);
        });
      } else add(s.subject, s.total || 0, s.correct || 0);
    });
    const out = {};
    Object.entries(acc).forEach(([code, v]) => { out[code] = { total: v.total, pct: v.total ? Math.round(v.correct / v.total * 100) : 0 }; });
    return out;
  }

  async function refresh() {
    const [trophies, ckpts, pct] = await Promise.all([
      DB.getDeckTrophies().catch(() => null),
      DB.getAllCheckpoints().catch(() => null),
      subjectPct().catch(() => null),
    ]);
    if (!trophies && !ckpts) return false;
    const done = new Set();
    const passes = {};
    const best = (k, pct, date) => { const p = passes[k]; if (!p || pct > p.pct) passes[k] = { pct, date }; };
    Object.entries(trophies || {}).forEach(([date, arr]) => (arr || []).forEach(d => {
      done.add(norm(d.deck));
      if (TPS_POS.has(norm(d.deck))) best(norm(d.deck), d.pct || 0, date);
    }));
    let state = null;
    (ckpts || []).forEach(c => {
      if (c.deck_name === STATE_DECK) { state = c.answers; return; }
      if (c.total_questions && c.current_index >= c.total_questions) done.add(norm(c.deck_name));
      const p = c.answers && c.answers.pass;
      if (p && p.complete && TPS_POS.has(norm(c.deck_name))) best(norm(c.deck_name), p.pct, p.date);
    });
    _done = done;
    S.passes = passes;
    if (pct) S.pct = pct;
    if (state && state.current) S.current = state.current;
    // Troca de matéria: só quando a atual termina (ou na primeira vez)
    const cur = SUBJECTS.find(s => s.code === S.current);
    if (!cur || subjectDone(cur)) {
      const next = pickNextSubject();
      if (next && next.code !== S.current) {
        S.current = next.code;
        DB.saveQueueState(STATE_DECK, { current: next.code, since: today() }).catch(e => console.warn('fila: salvar estado falhou', e));
      }
    }
    saveCache();
    fire();
    return true;
  }

  window.DeckLocks = {
    PASS_PCT, SUBJECTS, TPS, norm,
    status, explain, markDone, notePass, refresh, tpsNeedsRetake,
    currentSubject, currentDeckKey, upcoming, tpsCurrent, tpsDoneToday, pctOf,
    isTps: key => TPS_POS.has(norm(key)),
  };
})();
