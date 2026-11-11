// Repetição espaçada dos simulados: só volta o que ainda não está fixado.
// Lógica pura, sem DOM nem rede. Datas são strings locais 'YYYY-MM-DD'.
//
// Avaliações: 'errou' | 'chutei' (acertou com dúvida) | 'sabia' (acertou com segurança)
// Status: 'learning' (aprendendo) → 'review' (checagem, degrau ≥ MASTER_STEP) → 'mastered' (dominada)
(function (root) {
  const LADDER = [1, 3, 7, 16, 35, 75];
  const MASTER_STEP = 4;           // "Sabia" a partir deste degrau → dominada
  const GUESS_STEP = 1;            // chute volta em LADDER[1] = 3 dias
  const LEECH_LAPSES = 3;          // difícil: precisa de 2 "Sabia" seguidos no degrau ≥ MASTER_STEP
  const NEW_SABIA_DAYS = [45, 90]; // questão nova com "Sabia": uma checagem nessa janela
  const EXAM_MARGIN = 14;          // nada não dominado agendado para depois de prova − 14 dias
  const MASTERED_DATE = '2999-12-31';
  const GRADES = ['errou', 'chutei', 'sabia'];

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(fromStr, toStr) {
    return Math.round((Date.parse(toStr + 'T00:00:00Z') - Date.parse(fromStr + 'T00:00:00Z')) / 86400000);
  }

  // ±10% para que questões respondidas juntas não vençam todas no mesmo dia
  function jitter(days, rng) {
    const spread = Math.round(days * 0.1);
    return days + Math.round((rng() * 2 - 1) * spread);
  }

  function randBetween(min, max, rng) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  // card = null quando a questão nunca foi respondida
  function nextState(card, grade, today, opts = {}) {
    if (!GRADES.includes(grade)) throw new Error('avaliação inválida: ' + grade);
    const rng = opts.rng || Math.random;
    const isNew = !card;
    const step = isNew ? 0 : (card.step || 0);
    const lapses = isNew ? 0 : (card.lapses || 0);
    const reps = (isNew ? 0 : (card.reps || 0)) + 1;
    const streak = isNew ? 0 : (card.streak || 0);
    const base = { reps, last_review: today, last_grade: grade };

    let next, days;
    if (grade === 'errou') {
      next = { step: 0, lapses: lapses + 1, streak: 0, status: 'learning' };
      days = LADDER[0];
    } else if (grade === 'chutei') {
      next = { step: GUESS_STEP, lapses, streak: 0, status: 'learning' };
      days = LADDER[GUESS_STEP];
    } else if (isNew) {
      next = { step: MASTER_STEP, lapses, streak: 0, status: 'review' };
      days = randBetween(NEW_SABIA_DAYS[0], NEW_SABIA_DAYS[1], rng);
    } else if (step >= MASTER_STEP) {
      const s = streak + 1;
      if (lapses < LEECH_LAPSES || s >= 2) {
        return { ...base, step, lapses, streak: s, status: 'mastered', due_date: MASTERED_DATE };
      }
      const ns = Math.min(step + 1, LADDER.length - 1);
      next = { step: ns, lapses, streak: s, status: 'review' };
      days = jitter(LADDER[ns], rng);
    } else {
      const ns = Math.min(step + 2, LADDER.length - 1);
      next = { step: ns, lapses, streak: 0, status: ns >= MASTER_STEP ? 'review' : 'learning' };
      days = jitter(LADDER[ns], rng);
    }

    let due = addDays(today, Math.max(1, days));
    if (opts.examDate) {
      const cap = addDays(opts.examDate, -EXAM_MARGIN);
      if (due > cap) due = cap > today ? cap : addDays(today, 1);
    }
    return { ...base, ...next, due_date: due };
  }

  function isMastered(card) {
    return card.status === 'mastered' || card.due_date >= MASTERED_DATE;
  }

  // Mais erradas primeiro, depois as mais atrasadas
  function buildDueQueue(cards, today, limit) {
    const due = cards
      .filter(c => !isMastered(c) && c.due_date <= today)
      .sort((a, b) => (b.lapses - a.lapses) || a.due_date.localeCompare(b.due_date));
    return limit ? due.slice(0, limit) : due;
  }

  // Texto curto do efeito da avaliação: "volta em 3 dias" / "✓ dominada"
  function describe(state, today) {
    if (state.status === 'mastered') return '✓ dominada';
    const d = daysBetween(today, state.due_date);
    return `volta em ${d} dia${d === 1 ? '' : 's'}`;
  }

  const SRS = {
    LADDER, MASTER_STEP, GUESS_STEP, LEECH_LAPSES, NEW_SABIA_DAYS, EXAM_MARGIN, MASTERED_DATE, GRADES,
    addDays, daysBetween, randBetween, nextState, isMastered, buildDueQueue, describe
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SRS;
  else root.SRS = SRS;
})(typeof window !== 'undefined' ? window : globalThis);
