// Repetição espaçada dos simulados: escada de intervalos para respostas certo/errado.
// Lógica pura, sem DOM nem rede. Datas são strings locais 'YYYY-MM-DD'.
(function (root) {
  const LADDER = [1, 3, 7, 16, 35, 90];
  const FIRST_CORRECT_STEP = 2;
  const GUESS_DAYS = 2;
  const LEECH_LAPSES = 4;

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

  // card = null quando a questão nunca foi respondida
  function nextState(card, { correct, guessed }, today, rng = Math.random) {
    const step = card ? card.step : null;
    const lapses = card ? card.lapses : 0;
    const reps = (card ? card.reps : 0) + 1;
    let nextStep, days;
    if (!correct) {
      nextStep = step === null ? 0 : Math.max(0, step - 2);
      days = LADDER[nextStep];
      return { step: nextStep, lapses: lapses + 1, reps, last_review: today, due_date: addDays(today, jitter(days, rng)) };
    }
    if (guessed) {
      return { step: step === null ? 0 : step, lapses, reps, last_review: today, due_date: addDays(today, GUESS_DAYS) };
    }
    nextStep = step === null ? FIRST_CORRECT_STEP : Math.min(step + 1, LADDER.length - 1);
    days = LADDER[nextStep];
    return { step: nextStep, lapses, reps, last_review: today, due_date: addDays(today, jitter(days, rng)) };
  }

  // Mais erradas primeiro, depois as mais atrasadas
  function buildDueQueue(cards, today, limit) {
    const due = cards
      .filter(c => c.due_date <= today)
      .sort((a, b) => (b.lapses - a.lapses) || a.due_date.localeCompare(b.due_date));
    return limit ? due.slice(0, limit) : due;
  }

  const SRS = { LADDER, FIRST_CORRECT_STEP, LEECH_LAPSES, addDays, daysBetween, nextState, buildDueQueue };
  if (typeof module !== 'undefined' && module.exports) module.exports = SRS;
  else root.SRS = SRS;
})(typeof window !== 'undefined' ? window : globalThis);
