# FitCouple: Cloud Sync + Apple Watch Handoff

Date: 2026-07-10
Status: Approved

## Context

FitCouple ([index.html](../../../index.html)) is a single-file web app for Bright and Drishti's shared workout plan, logging, nutrition, and progress tracking at Anytime Fitness Squamish. It currently:

- Runs entirely client-side with `localStorage`, keyed by user (`bright` / `drishti`).
- Already has beginner-friendly exercise selection (machine/guided movements preferred over free-standing barbell lifts, 🔰 form tips on every exercise) — no changes needed here.
- Has an informational "Watch" tab explaining a manual Apple Health bridge via Shortcuts, but no actual data flows into the app.
- Is not deployed anywhere and not in a git repo.

Bright and Drishti each have their own iPhone + Apple Watch. Because the app is `localStorage`-only, data logged on one phone is invisible on the other — the "Couple Snapshot" feature on the Home tab doesn't actually work across devices today. This project fixes that and adds a low-friction way to pull Apple Watch workout/weight data into the app.

## Goals

1. Both partners can open the app on their own phone and see each other's logged workouts, weights, and nutrition, live.
2. After a gym session or a weigh-in, each partner can run one personal Shortcut to pull the relevant Apple Health data into the app without retyping it.
3. The app is reachable at a stable public URL (needed for both normal use and for Shortcuts to open it).
4. No build step, no server to run — stays a single deployable static file plus config, consistent with the current architecture.

## Non-goals

- A native iOS/watchOS app. Not buildable from this environment (Windows, no Xcode); Shortcuts + a web page is the ceiling for browser-based Health integration.
- Automating the strength-training log (sets/reps/weight per exercise). Apple Health has no concept of which exercise or how much weight was lifted — that stays manual in the Log tab.
- Authentication / login. Confirmed acceptable trade-off given this is two people's fitness data, not sensitive information — optimizing for zero-friction one-tap use over access control.

## Architecture

### Hosting

- New GitHub repo `brightjoesiby/gym`, deployed via GitHub Pages from the repo root (`main` branch).
- Live URL: `https://brightjoesiby.github.io/gym/`
- No build tooling — `index.html` is pushed as-is; GitHub Pages serves static files directly.

### Cloud sync (Firebase Firestore)

- Firebase project created under Bright's Google account (free Spark plan, sufficient for two users' fitness data).
- Firestore added to `index.html` via CDN `<script type="module">` imports (`firebase-app.js`, `firebase-firestore.js`) — no npm/bundler, matches the existing zero-build-step approach.
- Single Firestore document, e.g. `fitcouple/shared`, holding the same shape currently split across `fc_logs` / `fc_weights` / `fc_nutrition` in localStorage:
  ```
  {
    logs:       { bright: [...], drishti: [...] },
    weights:    { bright: [...], drishti: [...] },
    nutrition:  { bright: [...], drishti: [...] }
  }
  ```
- On load, the app attaches a real-time `onSnapshot` listener to this document. Any change — from either phone, or from a Watch handoff — re-renders the currently open tab.
- Writes use dot-path field updates (e.g. `logs.bright`, `weights.drishti`) so one partner's write can never clobber the other's concurrent write to a different field.
- Firestore's built-in offline persistence (IndexedDB) is enabled: writes made with no signal are queued locally and flushed automatically once the phone reconnects. This is standard SDK behavior, not custom code.
- `currentUser` (which profile toggle is active) and other pure UI state remain in `localStorage` as before — no need to sync which tab you last had open.
- Security rules restrict the collection to the expected document path and field shape (reject unexpected top-level keys or non-object values), without requiring auth. This blocks accidental/malformed writes but does not restrict who can read/write given the app's public config — an accepted trade-off (see Non-goals).

### Apple Watch → app handoff (Shortcuts)

Two categories of data move from Health into Firestore, each via a personal iOS Shortcut (one per partner, with their `user` id hardcoded into the Shortcut):

**"Log Gym Workout"**
1. Run after ending a workout on the Watch (from iPhone, via Siri, Watch face, or Shortcuts widget).
2. Shortcut finds the most recent Health workout (`Find Workouts`, sorted by end date, limit 1) and reads: duration, total active energy (kcal), average heart rate, workout type.
3. Opens URL: `https://brightjoesiby.github.io/gym/?wh_user=bright&wh_kcal=450&wh_dur=52&wh_hr=132`
4. App reads these query params on load, validates `wh_user` against known user ids, and merges a `healthSync: {kcal, duration, avgHR, syncedAt}` field into that day's log entry for that user in Firestore (alongside whatever manual sets are already there or logged later).
5. Shows a toast: "✅ Synced from Apple Watch: 450 kcal · 52 min".
6. Strips the query params from the URL via `history.replaceState` so a refresh or reshare doesn't re-trigger the sync.

**"Log My Weight"**
1. Reads the latest Body Mass sample from Health.
2. Opens URL: `https://brightjoesiby.github.io/gym/?wt_user=bright&wt_kg=79.4`
3. App validates and writes it into `weights.<user>` for today (same path the manual Progress-tab weight entry uses — if both fire the same day, the later write wins, matching existing manual behavior).
4. Toast: "✅ Weight logged: 79.4kg".
5. Params stripped from the URL.

**UI surfacing**: Today's workout card (Home) and workout history (Progress) show a small 🍎 badge with the synced calories/avg heart rate whenever `healthSync` is present on a log entry, next to the manually-entered sets.

## Data flow summary

```
Manual sets/reps/weight ──────────────┐
                                       ▼
Apple Watch ──(Shortcut: Log Gym Workout)──▶  Firestore doc  ◀── onSnapshot ──▶  Bright's phone
                                       ▲                                      ▶  Drishti's phone
Apple Health (Body Mass) ──(Shortcut: Log My Weight)──┘
```

## Error handling

- Missing/unknown `wh_user` or `wt_user` param → ignored, logged to console, no write attempted.
- Offline at write time → handled transparently by Firestore's offline persistence; UI shows a small "syncing…" indicator when `navigator.onLine` is false and a pending write exists.
- Malformed numeric params (NaN) → ignored, no partial write.

## Testing

- Manual two-device test: open the app on both phones (or two browser profiles) simultaneously; log a set on one, confirm the other reflects it within a few seconds.
- Airplane-mode test: log a set or trigger a Shortcut handoff with the phone offline, confirm the write appears once reconnected.
- Click through all six tabs (Home, Plan, Log, Progress, Nutrition, Watch) on an actual phone browser against the deployed GitHub Pages URL before calling the work done.
- Verify the Watch tab's setup instructions are updated to reflect the new one-tap Shortcuts (replacing the old fully-manual "Log Health Sample" instructions).

## Open items for implementation phase

- Bright creates the Firebase project and GitHub repo (needs his login) — implementation plan should call out exactly what to click, since this can't be automated from here.
- Exact Firestore security rule syntax to be finalized during implementation.
