// firestore-sync.js — pure helpers for merging Apple Watch handoff data into
// the existing per-user logs/weights arrays. No Firebase SDK calls in here —
// callers write the returned array to Firestore themselves.

function mergeHealthSync(existingLogs, user, dateKey, healthData) {
  const userLogs = (existingLogs[user] || []).slice();
  const idx = userLogs.findIndex(l => l.date === dateKey);
  const syncedAt = new Date().toISOString();
  const healthSync = { kcal: healthData.kcal, duration: healthData.duration, avgHR: healthData.avgHR, syncedAt };
  if (idx >= 0) {
    userLogs[idx] = { ...userLogs[idx], healthSync };
  } else {
    userLogs.push({ date: dateKey, exercises: [], healthSync });
  }
  return userLogs;
}

function mergeWeightEntry(existingWeights, user, dateKey, weightKg) {
  const userW = (existingWeights[user] || []).slice();
  const idx = userW.findIndex(w => w.date === dateKey);
  const entry = { date: dateKey, weight: weightKg };
  if (idx >= 0) {
    userW[idx] = entry;
  } else {
    userW.push(entry);
  }
  return userW;
}
