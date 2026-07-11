// handoff.js — pure functions for parsing Apple Watch handoff URL params.
// No DOM or Firebase dependencies so it can be verified directly in a browser console.
function parseHandoffParams(search, validUserIds) {
  const p = new URLSearchParams(search);
  const whUser = p.get('wh_user');
  const wtUser = p.get('wt_user');

  if (whUser && validUserIds.includes(whUser)) {
    const kcal = Number(p.get('wh_kcal'));
    const duration = Number(p.get('wh_dur'));
    const avgHR = Number(p.get('wh_hr'));
    if (Number.isFinite(kcal) && Number.isFinite(duration) && Number.isFinite(avgHR)) {
      return { type: 'workout', user: whUser, kcal, duration, avgHR };
    }
    return null;
  }

  if (wtUser && validUserIds.includes(wtUser)) {
    const weightKg = Number(p.get('wt_kg'));
    if (Number.isFinite(weightKg) && weightKg > 0) {
      return { type: 'weight', user: wtUser, weightKg };
    }
    return null;
  }

  return null;
}
