function calcNextReviewDate(scorePct) {
  const days =
    scorePct >= 80 ? 14 :
    scorePct >= 60 ? 7  :
    scorePct >= 40 ? 3  : 1;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function upsertReviewSchedule(subject, topic, score, scorePct) {
  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    const { data: existing } = await window.supabaseClient
      .from('review_schedule')
      .select('review_count')
      .eq('user_id', user.id)
      .eq('subject', subject)
      .eq('topic', topic)
      .maybeSingle();

    const review_count = existing ? existing.review_count + 1 : 1;

    const { error } = await window.supabaseClient
      .from('review_schedule')
      .upsert(
        {
          user_id: user.id,
          subject,
          topic,
          last_score: score,
          last_score_pct: scorePct,
          next_review_date: calcNextReviewDate(scorePct),
          review_count,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,subject,topic' }
      );

    if (error) console.warn('review-schedule upsert:', error);
  } catch (e) {
    console.warn('review-schedule:', e);
  }
}

async function fetchPendingReviews(subject) {
  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return [];

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await window.supabaseClient
      .from('review_schedule')
      .select('topic, last_score_pct, next_review_date')
      .eq('user_id', user.id)
      .eq('subject', subject)
      .lte('next_review_date', today)
      .order('next_review_date', { ascending: true });

    if (error) { console.warn('review-schedule fetch:', error); return []; }
    return data || [];
  } catch (e) {
    console.warn('review-schedule fetch:', e);
    return [];
  }
}

window.ReviewSchedule = { calcNextReviewDate, upsertReviewSchedule, fetchPendingReviews };
