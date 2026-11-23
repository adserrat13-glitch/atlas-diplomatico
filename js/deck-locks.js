// ─── Fila de estudo com cadeado ──────────────────────────────────────
// Rodízio entre matérias: um baralho por vez. Cada volta passa por todas as
// matérias da menor para a maior % de acerto (mesma conta da Análise TPS); as
// abaixo de 72% entram 2 vezes por volta. A ordem é recalculada a cada volta.
// Direito e Dir. Internacional nunca seguidos: Economia entra entre os dois.
// Dentro de cada matéria os baralhos seguem a ordem fixa abaixo.
// Hobby (Russo, Alemão): a cada 1.000 questões das outras matérias no dia,
// libera 200 questões de hobby.
// Provas TPS: trilha paralela, uma prova nova por dia; a próxima só abre quando
// a atual tiver >= 85% numa passada inteira (abaixo disso, refaz do zero).
// Fora da vez: concluídos e já começados abrem só para revisão.
// "Concluído" = primeira passada inteira (troféu do baralho ou checkpoint no fim).
(function () {
  const PASS_PCT = 85;
  const STATE_DECK = '__fila_estudo__';
  const CACHE_KEY = 'deck_locks_v3';
  const STATE_VERSION = 4; // estados de versões anteriores (outra regra/conta) são descartados
  const WEAK_PCT = 72;      // abaixo disso a matéria entra 2x por volta
  const HOBBY_BLOCK = 1000, HOBBY_GRANT = 200;
  const DAILY_TARGET = 200; // Inglês e Espanhol: exatamente 200 novas por dia (mínimo e limite)

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
    { code: 'ESP', label: 'Espanhol', daily: true, decks: [['LINGUAS', 'ESPANHOL C1']] },
    { code: 'GEO', label: 'Geografia', decks: [
      ['GEOGRAFIA', 'GEOGRAFIA FUNAG'], ['GEOGRAFIA', 'GEOGRAFIA APOSTILA NOVA']] },
    { code: 'LP', label: 'Português', decks: [
      ['PORTUGUES', 'PORTUGUES DIPLOMATA'], ['PORTUGUES', 'portgues 1 pestana'], ['PORTUGUES', 'COMO ESCREVER'],
      ['PORTUGUES', 'poort diplo 2 anki'], ['PORTUGUES', 'INTERPRETAÇÃO DE TEXTOS']] },
    { code: 'HM', label: 'Hist. Mundial', decks: [
      ['HISTORIAMUNDIAL', 'BURNS'], ['HISTORIAMUNDIAL', 'HM SOMBRA SARAIVA'], ['HISTORIAMUNDIAL', 'HM DIPLOMACIA'],
      ['HISTORIAMUNDIAL', 'HM MANUAL'], ['HISTORIAMUNDIAL', 'HSITORIA DIFICIL']] },
    { code: 'ING', label: 'Inglês', daily: true, decks: [
      ['LINGUAS', 'INGLÊS C2'], ['INGLES', 'VOCABULARIO'], ['INGLES', 'GRAMMAR TRANSFORMAR'],
      ['INGLES', 'INGLES GRAN'], ['LINGUAS', 'INGLÊS']] },
    // Hobby (não caem no CACD): fora do rodízio, liberados pela cota diária
    { code: 'RU', label: 'Russo', hobby: true, decks: [['LINGUAS', 'RUSSO A2'], ['LINGUAS', 'RUSSO']] },
    { code: 'DE', label: 'Alemão', hobby: true, decks: [['LINGUAS', 'ALEMÃO'], ['LINGUAS', 'DEUTSCH']] },
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
  let S = { done: [], passes: {}, pct: {}, queue: null, today: null };
  try { Object.assign(S, JSON.parse(localStorage.getItem(CACHE_KEY)) || {}); } catch {}
  let _done = new Set(S.done);
  let _started = new Set(S.started || []);
  const saveCache = () => {
    S.done = [..._done];
    S.started = [..._started];
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

  // ── Rodízio de matérias ──
  const MAIN = SUBJECTS.filter(x => !x.hobby && !x.daily);   // só estas entram no rodízio
  const byCode = c => SUBJECTS.find(x => x.code === c);
  const nextDeckOf = sub => sub ? sub.keys.find(k => !isDone(k)) || null : null;
  // Direito e Dir. Internacional nunca em sequência: Economia entra entre os dois
  const LAW = new Set(['DIR', 'DIP']);
  const SPACER = 'ECO';
  const isOpen = c => { const s = byCode(c); return !!(s && !subjectDone(s)); };
  function separateLaw(codes, prev) {
    if (!isOpen(SPACER)) return codes;
    const out = [];
    let last = prev;
    for (const c of codes) {
      if (!isOpen(c)) { out.push(c); continue; }   // matéria concluída é pulada: não conta como vizinha
      if (c === last) continue;                    // mesma matéria duas vezes seguidas: fica uma
      if (LAW.has(c) && LAW.has(last)) out.push(SPACER);
      out.push(c);
      last = c;
    }
    return out;
  }
  function buildCycle(prev = null) {
    const open = MAIN.filter(x => !subjectDone(x))
      .map((x, i) => ({ x, i, p: pctOf(x) ?? 101 })).sort((a, b) => a.p - b.p || a.i - b.i).map(o => o.x);
    const weak = open.filter(x => (pctOf(x) ?? 101) < WEAK_PCT);
    const half = Math.ceil(open.length / 2);
    return separateLaw([...open.slice(0, half), ...weak, ...open.slice(half)].map(x => x.code), prev);
  }
  function advance(Q, lastCode) {
    let cycle = Q.cycle.slice(), idx = Q.idx;
    for (let round = 0; round < 3; round++) {
      // primeiro tenta não repetir a matéria que acabou de terminar
      for (const avoidRepeat of [true, false]) {
        for (let i = idx + 1; i < cycle.length; i++) {
          const sub = byCode(cycle[i]);
          if (!sub || subjectDone(sub) || (avoidRepeat && cycle[i] === lastCode)) continue;
          if (LAW.has(lastCode) && LAW.has(cycle[i]) && isOpen(SPACER)) cycle.splice(i, 0, SPACER);
          return { v: STATE_VERSION, cycle, idx: i, deck: nextDeckOf(byCode(cycle[i])), since: today() };
        }
      }
      cycle = buildCycle(lastCode); idx = -1;   // volta nova, pela % de agora
      if (!cycle.length) break;
    }
    return { v: STATE_VERSION, cycle: [], idx: 0, deck: null, since: today() };
  }
  // Garante o estado da fila: cria a volta e avança quando o baralho da vez termina
  let _loaded = false;
  function ensureQueue() {
    let Q = S.queue, changed = false;
    if (!Q || Q.v !== STATE_VERSION || !Array.isArray(Q.cycle)) {
      Q = advance({ cycle: buildCycle(), idx: -1 }, null);
      changed = true;
    } else {
      // volta já salva: aplica a separação Direito / DIP no que falta dela
      const tail = Q.cycle.slice(Q.idx + 1);
      const fixed = separateLaw(tail, Q.cycle[Q.idx]);
      if (fixed.length !== tail.length) {
        Q = Object.assign({}, Q, { cycle: [...Q.cycle.slice(0, Q.idx + 1), ...fixed] });
        changed = true;
      }
    }
    if (Q.v === STATE_VERSION && (!Q.deck || isDone(Q.deck))) {
      const last = Q.deck ? (SUBJECT_OF.get(norm(Q.deck)) || {}).subject : null;
      const N = advance(Q, last ? last.code : null);
      if (N.deck !== Q.deck || N.idx !== Q.idx) { Q = N; changed = true; }
    }
    if (changed) {
      if (!_loaded) return Q; // antes de ler o servidor: só mostra, não grava
      S.queue = Q;
      saveCache();
      DB.saveQueueState(STATE_DECK, Q).catch(e => console.warn('fila: salvar estado falhou', e));
    }
    return S.queue;
  }
  function currentSubject() {
    const Q = ensureQueue();
    return Q.deck ? ((SUBJECT_OF.get(norm(Q.deck)) || {}).subject || null) : null;
  }
  function currentDeckKey() { return ensureQueue().deck; }
  // Próximas matérias da volta atual (ou da próxima volta, se esta acabou)
  function upcoming() {
    const Q = ensureQueue();
    const rest = Q.cycle.slice(Q.idx + 1).map(byCode).filter(x => x && !subjectDone(x));
    return rest.length ? rest : buildCycle(Q.cycle[Q.idx]).map(byCode);
  }

  // ── Hobby: cota diária ──
  const isHobbyName = name => /RUSSO|RUSSIAN|DEUTSCH|ALEMAO|GERMAN/.test(norm(name));
  function hobbyInfo() {
    const t = S.today && S.today.date === today() ? S.today : { main: 0, hobby: 0 };
    const budget = Math.floor(t.main / HOBBY_BLOCK) * HOBBY_GRANT;
    return { main: t.main, hobby: t.hobby, budget, remaining: Math.max(0, budget - t.hobby),
             toNext: HOBBY_BLOCK - (t.main % HOBBY_BLOCK), block: HOBBY_BLOCK, grant: HOBBY_GRANT };
  }

  // ── Obrigatórias do dia: Inglês e Espanhol, 200 novas cada (mínimo e limite) ──
  // Conta só questões novas (sessões "simulado") feitas hoje nos baralhos da matéria.
  // Matéria sem baralho por fazer conta como cumprida.
  const DAILY = SUBJECTS.filter(x => x.daily);
  function dailyInfo() {
    const t = S.today && S.today.date === today() ? S.today : { daily: {} };
    return DAILY.map(sub => {
      const doneQ = (t.daily && t.daily[sub.code]) || 0;
      const key = nextDeckOf(sub);
      const finished = !key;
      return { subject: sub, key, done: doneQ, target: DAILY_TARGET,
               remaining: finished ? 0 : Math.max(0, DAILY_TARGET - doneQ),
               ok: finished || doneQ >= DAILY_TARGET };
    });
  }
  const dailyAllOk = () => dailyInfo().every(d => d.ok);

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

  function isStarted(key) {
    key = realKey(key);
    if (_started.has(norm(key)) || isDone(key)) return true;
    const p = localProg(key);
    return !!(p && p.lastDone > 0);
  }

  // access: 'full' = questões novas liberadas (baralho/prova da vez)
  //         'review' = abre só para revisar (concluídos e já começados fora da vez)
  //         'none' = travado (nunca começado, não tem revisão)
  // locked = sem questões novas (true em 'review' e 'none')
  function status(deckKey) {
    const key = realKey(deckKey);
    const n = norm(key);
    const fin = (base, full, reason) => {
      const access = full ? 'full' : (isStarted(key) ? 'review' : 'none');
      return Object.assign(base, { access, locked: access !== 'full', reason });
    };
    if (TPS_POS.has(n)) {
      const pos = TPS_POS.get(n);
      const pass = tpsPass(key);
      const base = { kind: 'tps', pos, total: TPS.length, done: !!pass, pass };
      if (pass) return fin(base, false, `Prova já aprovada (${pass.pct}%): aqui ficam só as revisões dela.`);
      const cur = tpsCurrent();
      const isCur = cur.key && norm(cur.key) === n;
      if (isCur && !cur.waitTomorrow) return fin(Object.assign(base, { current: true }), true);
      return fin(base, false, isCur
        ? 'Uma prova TPS nova por dia: esta abre amanhã.'
        : `Provas TPS vão em ordem, uma por dia, com ≥ ${PASS_PCT}%. A da vez é ${cur.key}.`);
    }
    const e = SUBJECT_OF.get(n);
    if (!e) return { kind: 'free', access: 'full', locked: false };
    const sub = e.subject;
    const base = { kind: sub.hobby ? 'hobby' : 'subject', subject: sub, pos: e.pos, total: sub.keys.length, done: isDone(key) };
    if (base.done) return fin(base, false, 'Baralho já concluído: aqui ficam só as revisões dele.');
    if (sub.hobby) {
      const nxt = nextDeckOf(sub);
      if (norm(nxt || '') !== n) return fin(base, false, `Hobby: um baralho por vez em ${sub.label}. O da vez é ${(nxt || '—').replace(/^.*? - /, '')}.`);
      const h = hobbyInfo();
      if (h.remaining > 0) return fin(Object.assign(base, { current: true, hobbyRemaining: h.remaining }), true);
      return fin(base, false, `Cota de hobby de hoje: ${h.hobby}/${h.budget} questões. Faça mais ${h.toNext} questões das outras matérias para liberar +${HOBBY_GRANT}.`);
    }
    if (sub.daily) {
      const nxt = nextDeckOf(sub);
      if (norm(nxt || '') !== n) return fin(base, false, `Um baralho por vez em ${sub.label}. O da vez é ${(nxt || '—').replace(/^.*? - /, '')}.`);
      const d = dailyInfo().find(x => x.subject === sub);
      if (d.remaining > 0) return fin(Object.assign(base, { current: true, dailyRemaining: d.remaining }), true);
      return fin(base, false, `${sub.label} de hoje feito (${d.done}/${DAILY_TARGET}). Amanhã libera mais ${DAILY_TARGET}.`);
    }
    const curKey = currentDeckKey();
    if (curKey && norm(curKey) === n) {
      if (!dailyAllOk()) {
        const pend = dailyInfo().filter(x => !x.ok).map(x => `${x.subject.label} ${x.done}/${x.target}`).join(' e ');
        return fin(Object.assign(base, { current: true, waitDaily: true }), false,
          `Primeiro as obrigatórias do dia: ${pend}. Depois este baralho abre.`);
      }
      return fin(Object.assign(base, { current: true }), true);
    }
    const cur = currentSubject();
    return fin(base, false, cur === sub
      ? `Um baralho por vez em ${sub.label}. O da vez é: ${curKey.replace(/^.*? - /, '')}.`
      : `Baralho da vez: ${cur ? cur.label + ' — ' + curKey.replace(/^.*? - /, '') : '—'}. As matérias se revezam a cada baralho terminado (as de menor % primeiro, e as abaixo de ${WEAK_PCT}% duas vezes por volta).`);
  }

  function explain(deckKey) {
    const st = status(deckKey);
    if (st.access === 'none') alert(`🔒 Baralho bloqueado\n\n${st.reason}\n\nAs revisões da agenda continuam liberadas.`);
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

  // % por matéria idêntica à da Análise TPS (flattenQuestions + buildSubjectQsMap em
  // analise-tps.html): erros pela matéria da questão (reclassificada pelo texto quando
  // falta o código), acertos pelo subjects_breakdown, sessões antigas rateadas.
  // Espanhol aparece nas sessões como LING (rótulo "Espanhol/FR") ou ESP.
  const PCT_CODES = { ESP: ['LING', 'ESP'] };
  function subjectPctFrom(sessions, classify) {
    const acc = {};
    const add = (code, hit) => { acc[code] = acc[code] || { total: 0, correct: 0 }; acc[code].total++; if (hit) acc[code].correct++; };
    const subjOf = (w, s) => w.subjectCode || (w.q && classify ? classify(w.q).subjectCode : null) || s.subject || 'PI';
    sessions.forEach(s => {
      const wrongs = s.wrong_items || [];
      wrongs.forEach(w => add(subjOf(w, s), false));
      const bd = s.subjects_breakdown;
      if (bd && Object.keys(bd).length > 0) {
        Object.entries(bd).forEach(([code, v]) => {
          const c = (v && v.correct) || 0;
          for (let i = 0; i < c; i++) add(code, true);
        });
      } else {
        const freq = {};
        wrongs.forEach(w => { const sc = subjOf(w, s); freq[sc] = (freq[sc] || 0) + 1; });
        const fe = Object.entries(freq);
        if (fe.length > 1) {
          const tot = Object.values(freq).reduce((a, v) => a + v, 0);
          let remaining = s.correct || 0;
          fe.forEach(([subj, cnt], i) => {
            const share = i < fe.length - 1 ? Math.round((cnt / tot) * (s.correct || 0)) : remaining;
            for (let j = 0; j < share; j++) add(subj, true);
            remaining -= share;
          });
        } else {
          for (let i = 0; i < (s.correct || 0); i++) add(s.subject || 'PI', true);
        }
      }
      const missing = Math.max(0, (s.wrong || 0) - wrongs.length);
      for (let i = 0; i < missing; i++) add(s.subject || 'PI', false);
    });
    const out = {};
    SUBJECTS.forEach(sub => {
      const codes = PCT_CODES[sub.code] || [sub.code];
      const t = codes.reduce((a, c) => a + ((acc[c] && acc[c].total) || 0), 0);
      const c = codes.reduce((a, k) => a + ((acc[k] && acc[k].correct) || 0), 0);
      if (t) out[sub.code] = { total: t, pct: Math.round(c / t * 100) };
    });
    return out;
  }
  async function loadSessions() {
    const user = await DB.getUser();
    if (!user) return null;
    return DB.getSessions(user.id);
  }
  function todayCounts(sessions) {
    const d = today(), t = { date: d, main: 0, hobby: 0, daily: {} };
    sessions.filter(x => x.date === d).forEach(x => {
      if (isHobbyName(x.deck || '')) t.hobby += x.total || 0; else t.main += x.total || 0;
      const e = x.type === 'simulado' ? SUBJECT_OF.get(norm(realKey(x.deck || ''))) : null;
      if (e && e.subject.daily) t.daily[e.subject.code] = (t.daily[e.subject.code] || 0) + (x.total || 0);
    });
    return t;
  }

  async function refresh() {
    const [trophies, ckpts, sessions] = await Promise.all([
      DB.getDeckTrophies().catch(() => null),
      DB.getAllCheckpoints().catch(() => null),
      loadSessions().catch(() => null),
    ]);
    const classify = typeof window.classifyQuestion === 'function' ? window.classifyQuestion : null;
    const pct = sessions ? subjectPctFrom(sessions.filter(x => x.type === 'simulado'), classify) : null;
    if (sessions) S.today = todayCounts(sessions);
    if (!trophies && !ckpts) return false;
    const done = new Set();
    const started = new Set();
    const passes = {};
    const best = (k, pct, date) => { const p = passes[k]; if (!p || pct > p.pct) passes[k] = { pct, date }; };
    Object.entries(trophies || {}).forEach(([date, arr]) => (arr || []).forEach(d => {
      done.add(norm(d.deck));
      if (TPS_POS.has(norm(d.deck))) best(norm(d.deck), d.pct || 0, date);
    }));
    let state = null;
    (ckpts || []).forEach(c => {
      if (c.deck_name === STATE_DECK) { state = c.answers; return; }
      if (c.current_index > 0) started.add(norm(c.deck_name));
      if (c.total_questions && c.current_index >= c.total_questions) done.add(norm(c.deck_name));
      const p = c.answers && c.answers.pass;
      if (p && p.complete && TPS_POS.has(norm(c.deck_name))) best(norm(c.deck_name), p.pct, p.date);
    });
    _done = done;
    _started = started;
    S.passes = passes;
    if (pct) S.pct = pct;
    // Estado salvo no servidor manda (cross-device); versões antigas são descartadas
    if (state && state.v === STATE_VERSION) S.queue = state;
    else if (!S.queue || S.queue.v !== STATE_VERSION) S.queue = null;
    _loaded = true;
    ensureQueue();
    saveCache();
    fire();
    return true;
  }

  window.DeckLocks = {
    PASS_PCT, SUBJECTS, TPS, norm, subjectPctFrom,
    status, explain, markDone, notePass, refresh, tpsNeedsRetake,
    currentSubject, currentDeckKey, upcoming, tpsCurrent, tpsDoneToday, pctOf, hobbyInfo,
    hobbySubjects: () => SUBJECTS.filter(x => x.hobby).map(x => ({ subject: x, key: nextDeckOf(x) })),
    isHobby: key => { const e = SUBJECT_OF.get(norm(key)); return !!(e && e.subject.hobby); },
    dailyInfo, dailyAllOk,
    // Quantas questões novas a sessão deste baralho pode ter hoje (null = sem limite)
    sessionCap: key => {
      const e = SUBJECT_OF.get(norm(key));
      if (!e) return null;
      if (e.subject.hobby) { const h = hobbyInfo(); return { remaining: h.remaining, label: 'Hobby',
        empty: `Cota de hobby esgotada por hoje (${h.hobby}/${h.budget}). Faça mais ${h.toNext} questões das outras matérias para liberar +${h.grant}.` }; }
      if (e.subject.daily) { const d = dailyInfo().find(x => x.subject === e.subject); return { remaining: d.remaining, label: e.subject.label,
        empty: `${e.subject.label} de hoje já feito (${d.done}/${d.target}). Amanhã libera mais ${d.target}.` }; }
      return null;
    },
    isTps: key => TPS_POS.has(norm(key)),
  };
})();
