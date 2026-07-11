# Cloud Sync + Apple Watch Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FitCouple ([index.html](../../../index.html)) sync workout/weight/nutrition data live between Bright's and Drishti's separate phones via Firestore, and let each of them pull Apple Watch workout/weight data into the app with one Shortcut tap instead of retyping it.

**Architecture:** Add Firebase Firestore to the existing single-file static app via CDN ES-module imports (no bundler). A small `window.FCDB` bridge object exposes `subscribe()`/`update()` so the existing classic (non-module) script can keep using its current function shapes (`getLogs()`, `saveWorkout()`, etc.) while the actual storage moves from `localStorage` to a shared Firestore document. Two new plain-JS helper files (`handoff.js`, `firestore-sync.js`) hold pure, DOM-free logic for parsing Apple Watch handoff URLs and merging synced data, verified directly in a real browser via a local static server (no Node.js on this machine, so no npm-based test runner — Python's built-in `http.server` plus the Preview tool's `preview_eval` is the verification harness instead).

**Tech Stack:** Vanilla JS (no framework, no bundler), Firebase Firestore (modular Web SDK v10, loaded from `gstatic.com` CDN), GitHub Pages (static hosting), Python 3 `http.server` (local dev server for testing only, not shipped).

## Global Constraints

- No build step / bundler / npm dependency. The deployed app stays a set of static files (`index.html`, `firebase-config.js`, `handoff.js`, `firestore-sync.js`) servable as-is by GitHub Pages.
- No authentication/login. Firestore security rules restrict the document shape and path, not who can read/write — an accepted trade-off for a 2-person, low-sensitivity fitness app.
- Manual strength log data (sets/reps/weight per exercise) is never touched by the Apple Watch handoff — only `healthSync` fields (calories, duration, avg heart rate) and body weight come from Health.
- Shared Firestore document lives at path `fitcouple/shared` with exactly three top-level fields: `logs`, `weights`, `nutrition` — same shape as today's `fc_logs` / `fc_weights` / `fc_nutrition` localStorage objects (`{ bright: [...], drishti: [...] }`).
- Hosting: GitHub Pages at `https://brightjoesiby.github.io/gym/`, repo `github.com/brightjoesiby/gym`.
- Firebase web config values are not secret (Firebase's own design) — safe to commit to the repo; protection comes from Firestore security rules, not from hiding the config.
- This machine has no Node.js and no `gh` CLI, but does have Python 3.14 and `git`. Local testing uses `python -m http.server` via the Preview tool; GitHub/Firebase console work uses the connected Chrome browser (`Claude_in_Chrome` tools) since Bright chose browser-driven setup over manual click-through.

---

### Task 1: Local static dev server for testing

**Files:**
- Create: `.claude/launch.json` (already created during planning — verify it matches below)

**Interfaces:**
- Produces: a running local server on port 8000 serving the project root, reachable via `mcp__Claude_Preview__preview_start` (name `"static"`) for all later tasks' verification steps.

- [ ] **Step 1: Verify `.claude/launch.json` contents**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "static",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8000"],
      "port": 8000
    }
  ]
}
```

- [ ] **Step 2: Start the server**

Call `mcp__Claude_Preview__preview_start` with `name: "static"`. Note the returned `serverId` — reuse it for every `preview_eval` call in this plan (restart with the same call if it's ever stopped; `preview_start` reuses a still-running server).

- [ ] **Step 3: Verify it serves the app**

Call `mcp__Claude_Preview__preview_eval` with that `serverId` and `expression: "document.title"`.
Expected: `"FitCouple 💪"`

- [ ] **Step 4: Commit**

```bash
git add .claude/launch.json .gitignore
git commit -m "chore: add local static dev server config for preview testing"
```

---

### Task 2: `handoff.js` — parse Apple Watch handoff URL params

**Files:**
- Create: `handoff.js`

**Interfaces:**
- Produces: global function `parseHandoffParams(search, validUserIds)` — pure, no DOM/Firebase deps, loaded via a plain (non-module) `<script>` tag so it's a global in the browser and also usable as `expression` input directly in `preview_eval` once loaded on the page.
  - `search`: a URL query string, e.g. `"?wh_user=bright&wh_kcal=450"`.
  - `validUserIds`: array of known user ids, e.g. `['bright','drishti']`.
  - Returns one of:
    - `{ type: 'workout', user, kcal, duration, avgHR }`
    - `{ type: 'weight', user, weightKg }`
    - `null` (no recognized/valid handoff data present)

- [ ] **Step 1: Write `handoff.js`**

```js
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
```

- [ ] **Step 2: Load it in `index.html` for testing**

Add this line right before the existing `<script>` block that starts with `// ── DATA ──` in `index.html`:

```html
<script src="handoff.js"></script>
```

- [ ] **Step 3: Verify valid workout handoff via preview_eval**

Using the `serverId` from Task 1:

```
parseHandoffParams('?wh_user=bright&wh_kcal=450&wh_dur=52&wh_hr=132', ['bright','drishti'])
```
Expected: `{"type":"workout","user":"bright","kcal":450,"duration":52,"avgHR":132}`

- [ ] **Step 4: Verify valid weight handoff**

```
parseHandoffParams('?wt_user=drishti&wt_kg=59.8', ['bright','drishti'])
```
Expected: `{"type":"weight","user":"drishti","weightKg":59.8}`

- [ ] **Step 5: Verify unknown user is rejected**

```
parseHandoffParams('?wh_user=bob&wh_kcal=450&wh_dur=52&wh_hr=132', ['bright','drishti'])
```
Expected: `null`

- [ ] **Step 6: Verify missing/empty params return null**

```
parseHandoffParams('', ['bright','drishti'])
```
Expected: `null`

- [ ] **Step 7: Commit**

```bash
git add handoff.js index.html
git commit -m "feat: add handoff.js URL param parser for Apple Watch data"
```

---

### Task 3: `firestore-sync.js` — merge helpers for handoff data

**Files:**
- Create: `firestore-sync.js`

**Interfaces:**
- Consumes: nothing (pure functions, take plain data in).
- Produces: global functions `mergeHealthSync(existingLogs, user, dateKey, healthData)` and `mergeWeightEntry(existingWeights, user, dateKey, weightKg)`, both pure and DOM/Firebase-free.
  - `mergeHealthSync(existingLogs: {[user]: Array<{date,...}>}, user: string, dateKey: string, healthData: {kcal,duration,avgHR}) -> Array<{date,...}>` — returns the **updated array for that one user** (caller is responsible for writing it back under `logs.<user>`).
  - `mergeWeightEntry(existingWeights: {[user]: Array<{date,weight}>}, user: string, dateKey: string, weightKg: number) -> Array<{date,weight}>` — same shape, for weights.

- [ ] **Step 1: Write `firestore-sync.js`**

```js
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
```

- [ ] **Step 2: Load it in `index.html`**

Add right after the `handoff.js` script tag added in Task 2:

```html
<script src="firestore-sync.js"></script>
```

- [ ] **Step 3: Verify mergeHealthSync adds a new day's entry**

```
mergeHealthSync({bright:[]}, 'bright', 'Fri Jul 10 2026', {kcal:450,duration:52,avgHR:132})
```
Expected: an array with one object: `date: "Fri Jul 10 2026"`, `exercises: []`, `healthSync: {kcal:450,duration:52,avgHR:132,syncedAt: "<ISO timestamp>"}`.

- [ ] **Step 4: Verify mergeHealthSync updates an existing day's entry without dropping its exercises**

```
mergeHealthSync({bright:[{date:'Fri Jul 10 2026', exercises:[{name:'Squat'}]}]}, 'bright', 'Fri Jul 10 2026', {kcal:450,duration:52,avgHR:132})
```
Expected: one object, still `exercises: [{"name":"Squat"}]`, now with a `healthSync` field added.

- [ ] **Step 5: Verify mergeWeightEntry adds and updates correctly**

```
(function(){
  const step1 = mergeWeightEntry({}, 'drishti', 'Fri Jul 10 2026', 59.8);
  const step2 = mergeWeightEntry({drishti: step1}, 'drishti', 'Fri Jul 10 2026', 59.5);
  return step2;
})()
```
Expected: a single-element array `[{"date":"Fri Jul 10 2026","weight":59.5}]` (the second call overwrote the same day, didn't append a duplicate).

- [ ] **Step 6: Commit**

```bash
git add firestore-sync.js index.html
git commit -m "feat: add firestore-sync.js merge helpers for handoff data"
```

---

### Task 4: Create Firebase project, Firestore database, security rules, and web config

**Files:**
- Create: `firebase-config.js`

**Interfaces:**
- Produces: global `window.FC_FIREBASE_CONFIG` object consumed by Task 5's Firebase init code.

This task is browser-driven (Bright chose this over manual click-through) using the `Claude_in_Chrome` tools against his logged-in Google/Firebase session.

- [ ] **Step 1: Select the browser**

Call `mcp__Claude_in_Chrome__list_connected_browsers`, then ask Bright (via `AskUserQuestion`, listing every connected browser plus the "open confirmation screen" option, per that tool's required flow) which one to drive. Call `select_browser` or `switch_browser` accordingly.

- [ ] **Step 2: Create the Firebase project**

Navigate to `https://console.firebase.google.com/`. Click "Add project". Name it `fitcouple` (or the next available variant if taken). Disable Google Analytics for the project (not needed). Wait for project creation to finish.

- [ ] **Step 3: Create the Firestore database**

In the project console, go to Build → Firestore Database → Create database. Choose "Start in production mode" (we'll set explicit rules in Step 5). Pick a location close to Squamish, BC (e.g. `us-west1` / `nam5`).

- [ ] **Step 4: Register a Web app to get the config object**

Project Overview → click the Web icon (`</>`) → nickname it `fitcouple-web` → do **not** check "Firebase Hosting" (using GitHub Pages instead) → Register app. Firebase shows a `firebaseConfig` object like:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "fitcouple-xxxx.firebaseapp.com",
  projectId: "fitcouple-xxxx",
  storageBucket: "fitcouple-xxxx.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

Copy these exact values for Step 6.

- [ ] **Step 5: Set Firestore security rules**

In Firestore Database → Rules tab, replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fitcouple/shared {
      allow read: if true;
      allow write: if request.resource.data.keys().hasOnly(['logs', 'weights', 'nutrition']);
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Click "Publish".

- [ ] **Step 6: Write `firebase-config.js`**

Using the real values copied in Step 4:

```js
// firebase-config.js — public Firebase Web SDK config (safe to commit; see
// docs/superpowers/specs/2026-07-10-cloud-sync-apple-watch-design.md for why).
window.FC_FIREBASE_CONFIG = {
  apiKey: "REPLACE_WITH_REAL_VALUE",
  authDomain: "REPLACE_WITH_REAL_VALUE",
  projectId: "REPLACE_WITH_REAL_VALUE",
  storageBucket: "REPLACE_WITH_REAL_VALUE",
  messagingSenderId: "REPLACE_WITH_REAL_VALUE",
  appId: "REPLACE_WITH_REAL_VALUE"
};
```

Replace every `REPLACE_WITH_REAL_VALUE` with the actual value from Step 4 before committing — this file must contain real values, not placeholders, when this task is marked done.

- [ ] **Step 7: Commit**

```bash
git add firebase-config.js
git commit -m "chore: add Firebase project web config"
```

---

### Task 5: Wire Firestore read path into `index.html`

**Files:**
- Modify: `index.html` (add a Firebase module script block; replace `getLogs()`/`getWeights()`/`getNutrition()` and the boot sequence)

**Interfaces:**
- Consumes: `window.FC_FIREBASE_CONFIG` from Task 4.
- Produces: `window.FCDB.subscribe(callback)` and `window.FCDB.update(fieldPath, value)`, consumed by Task 6 and Task 7. `callback` receives `{ logs: {}, weights: {}, nutrition: {} }` every time the shared Firestore document changes (including right after the app's own writes).

- [ ] **Step 1: Add the Firebase module script**

Add this block in `index.html`, immediately before the `<script src="handoff.js"></script>` tag added in Task 2 (so it loads first):

```html
<script src="firebase-config.js"></script>
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

  const app = initializeApp(window.FC_FIREBASE_CONFIG);
  const db = getFirestore(app);
  const docRef = doc(db, 'fitcouple', 'shared');

  window.FCDB = {
    subscribe(callback) {
      onSnapshot(docRef, snap => {
        const data = snap.exists() ? snap.data() : {};
        callback({
          logs: data.logs || {},
          weights: data.weights || {},
          nutrition: data.nutrition || {}
        });
      });
    },
    update(fieldPath, value) {
      return setDoc(docRef, { [fieldPath]: value }, { merge: true });
    }
  };
</script>
```

- [ ] **Step 2: Replace the local-storage getters**

In the existing script, find:

```js
function getLogs(){ return ls('fc_logs') || {} }
function getWeights(){ return ls('fc_weights') || {} }
function getNutrition(){ return ls('fc_nutrition') || {} }
```

Replace with:

```js
let cloudState = { logs:{}, weights:{}, nutrition:{} };
function getLogs(){ return cloudState.logs }
function getWeights(){ return cloudState.weights }
function getNutrition(){ return cloudState.nutrition }
```

- [ ] **Step 3: Replace the boot sequence**

Find, at the bottom of the script:

```js
// ── BOOT ──────────────────────────────────────────────────────────────────────
switchUser(currentUser);
goTab('home');
```

Replace with:

```js
// ── BOOT ──────────────────────────────────────────────────────────────────────
switchUser(currentUser);
goTab('home');
window.FCDB.subscribe(data => {
  cloudState = data;
  renderTab(currentTab);
});
```

(First render happens immediately with empty `cloudState` — the existing UI already handles zero-data states like "No workouts yet", so this is a brief, harmless flash before Firestore's first snapshot arrives, typically under a second.)

- [ ] **Step 4: Verify the app boots against the real Firestore project**

Restart the preview server if needed (`preview_start`, name `"static"`), then via `preview_eval` with the returned `serverId`:

```
(async () => { await new Promise(r => setTimeout(r, 1500)); return typeof window.FCDB; })()
```
Expected: `"object"`

```
document.getElementById('page-home').innerHTML.includes('No workouts yet') || document.getElementById('page-home').innerHTML.includes('Workouts')
```
Expected: `true` (page rendered without throwing).

- [ ] **Step 5: Verify no console errors**

Use `mcp__Claude_Preview__preview_console_logs` (or equivalent) against the running server and confirm there are no Firebase initialization errors (e.g. invalid API key, permission-denied). Fix `firebase-config.js` values from Task 4 if any appear.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: wire Firestore read path (onSnapshot) into index.html"
```

---

### Task 6: Wire Firestore write path — saveWorkout, logWeight, addNutritionEntry

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `window.FCDB.update(fieldPath, value)` from Task 5.

- [ ] **Step 1: Update `saveWorkout()`**

Find:

```js
function saveWorkout(){
  const key='fc_logstate_'+currentUser+'_'+today();
  const exs=logState[key];
  const logs=getLogs();
  const entry={date:today(),programIdx:todayPlanIdx(),exercises:exs,savedAt:new Date().toISOString()};
  const userLogs=(logs[currentUser]||[]).filter(l=>l.date!==today());
  logs[currentUser]=[...userLogs,entry];
  ss('fc_logs',logs);
  ss('fc_wlog_'+currentUser+'_'+today(),true);
  renderLog();
}
```

Replace with:

```js
function saveWorkout(){
  const key='fc_logstate_'+currentUser+'_'+today();
  const exs=logState[key];
  const logs=getLogs();
  const existing=(logs[currentUser]||[]).find(l=>l.date===today());
  const entry={date:today(),programIdx:todayPlanIdx(),exercises:exs,savedAt:new Date().toISOString(),
    ...(existing?.healthSync?{healthSync:existing.healthSync}:{})};
  const userLogs=(logs[currentUser]||[]).filter(l=>l.date!==today());
  const updated=[...userLogs,entry];
  cloudState.logs={...cloudState.logs,[currentUser]:updated};
  window.FCDB.update('logs.'+currentUser, updated);
  renderLog();
}
```

(This preserves a `healthSync` field that may already be on today's entry from an earlier Watch handoff, instead of wiping it when you save your manual sets. `cloudState.logs` is updated optimistically so the UI reflects the save instantly, ahead of the Firestore round-trip.)

- [ ] **Step 2: Replace the "already saved today" check in `renderLog()`**

Find:

```js
  <button class="btn bp" style="background:${u.color}" onclick="saveWorkout()">
    ${ls('fc_wlog_'+currentUser+'_'+today())?'✓ Workout Saved — Update':'Save Workout 💾'}
  </button>`;
```

Replace with:

```js
  <button class="btn bp" style="background:${u.color}" onclick="saveWorkout()">
    ${(getLogs()[currentUser]||[]).find(l=>l.date===today())?'✓ Workout Saved — Update':'Save Workout 💾'}
  </button>`;
```

(Derives the "already saved" state from the same cloud-synced data everything else uses, instead of a separate local-only flag that could drift out of sync.)

- [ ] **Step 3: Update `logWeight()`**

Find:

```js
function logWeight(){
  const inp=el('wt-inp');
  const w=parseFloat(inp.value);
  if(!w||w<30||w>250){inp.style.borderColor='var(--pink)';return}
  inp.style.borderColor='';
  const weights=getWeights();
  const entry={date:today(),weight:w};
  const userW=weights[currentUser]||[];
  const idx=userW.findIndex(l=>l.date===today());
  if(idx>=0) userW[idx]=entry; else userW.push(entry);
  weights[currentUser]=userW;
  ss('fc_weights',weights);
  inp.value='';
  renderProgress();
}
```

Replace with:

```js
function logWeight(){
  const inp=el('wt-inp');
  const w=parseFloat(inp.value);
  if(!w||w<30||w>250){inp.style.borderColor='var(--pink)';return}
  inp.style.borderColor='';
  const updated=mergeWeightEntry(getWeights(), currentUser, today(), w);
  cloudState.weights={...cloudState.weights,[currentUser]:updated};
  window.FCDB.update('weights.'+currentUser, updated);
  inp.value='';
  renderProgress();
}
```

(Reuses `mergeWeightEntry` from `firestore-sync.js` — Task 3 — instead of duplicating the same update-or-append logic.)

- [ ] **Step 4: Update `addNutritionEntry()`**

Find:

```js
function addNutritionEntry(meal){
  const nutr=getNutrition();
  const userN=nutr[currentUser]||[];
  const idx=userN.findIndex(n=>n.date===today());
  if(idx>=0){
    userN[idx]={...userN[idx],
      kcal:(userN[idx].kcal||0)+meal.kcal,
      protein:(userN[idx].protein||0)+meal.p,
      carbs:(userN[idx].carbs||0)+meal.c,
      fat:(userN[idx].fat||0)+meal.f,
      meals:[...(userN[idx].meals||[]),meal]
    };
  } else {
    userN.push({date:today(),kcal:meal.kcal,protein:meal.p,carbs:meal.c,fat:meal.f,meals:[meal]});
  }
  nutr[currentUser]=userN;
  ss('fc_nutrition',nutr);
  renderNutrition();
  if(currentTab==='home') renderHome();
}
```

Replace with:

```js
function addNutritionEntry(meal){
  const nutr=getNutrition();
  const userN=(nutr[currentUser]||[]).slice();
  const idx=userN.findIndex(n=>n.date===today());
  if(idx>=0){
    userN[idx]={...userN[idx],
      kcal:(userN[idx].kcal||0)+meal.kcal,
      protein:(userN[idx].protein||0)+meal.p,
      carbs:(userN[idx].carbs||0)+meal.c,
      fat:(userN[idx].fat||0)+meal.f,
      meals:[...(userN[idx].meals||[]),meal]
    };
  } else {
    userN.push({date:today(),kcal:meal.kcal,protein:meal.p,carbs:meal.c,fat:meal.f,meals:[meal]});
  }
  cloudState.nutrition={...cloudState.nutrition,[currentUser]:userN};
  window.FCDB.update('nutrition.'+currentUser, userN);
  renderNutrition();
  if(currentTab==='home') renderHome();
}
```

- [ ] **Step 5: Verify a write round-trips through Firestore**

Via `preview_eval` against the running server (real Firebase project from Task 4):

```
(async () => {
  switchUser('bright');
  el('wt-inp') ? null : goTab('progress');
  el('wt-inp').value = '79.4';
  logWeight();
  await new Promise(r => setTimeout(r, 1500));
  return cloudState.weights.bright;
})()
```
Expected: an array whose last entry is `{"date":"<today's date string>","weight":79.4}`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: wire Firestore write path for workouts, weight, and nutrition"
```

---

### Task 7: Apple Watch URL handoff processing + toast UI

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `parseHandoffParams` (Task 2), `mergeHealthSync`/`mergeWeightEntry` (Task 3), `window.FCDB.update` (Task 5).

- [ ] **Step 1: Add toast CSS**

Add to the `<style>` block, near the other component styles (e.g. right after the `.qb:hover{...}` rule):

```css
#toast{position:fixed;bottom:78px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface2);border:1px solid var(--green);color:var(--text);padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;opacity:0;pointer-events:none;transition:all .3s;z-index:100;max-width:90%;text-align:center}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
```

- [ ] **Step 2: Add the toast element**

Add right before the closing `</div>` of `#app` (after the `<nav id="nav">...</nav>` block):

```html
  <div id="toast"></div>
```

- [ ] **Step 3: Add `showToast()` and `handleIncomingHandoff()`**

Add these functions right after the `esc()` function definition in the script:

```js
function showToast(msg){
  const t=el('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer=setTimeout(()=>t.classList.remove('show'),3500);
}

let handoffProcessed=false;
function handleIncomingHandoff(){
  if(handoffProcessed) return;
  const result=parseHandoffParams(location.search, Object.keys(USERS));
  if(!result) return;
  handoffProcessed=true;
  if(result.type==='workout'){
    const updated=mergeHealthSync(cloudState.logs, result.user, today(), {kcal:result.kcal,duration:result.duration,avgHR:result.avgHR});
    cloudState.logs={...cloudState.logs,[result.user]:updated};
    window.FCDB.update('logs.'+result.user, updated);
    showToast(`✅ Synced from Apple Watch: ${result.kcal} kcal · ${result.duration} min`);
  } else if(result.type==='weight'){
    const updated=mergeWeightEntry(cloudState.weights, result.user, today(), result.weightKg);
    cloudState.weights={...cloudState.weights,[result.user]:updated};
    window.FCDB.update('weights.'+result.user, updated);
    showToast(`✅ Weight logged: ${result.weightKg}kg`);
  }
  history.replaceState({}, '', location.pathname);
  renderTab(currentTab);
}
```

- [ ] **Step 4: Call it from the Firestore subscription**

In the boot sequence updated in Task 5, find:

```js
window.FCDB.subscribe(data => {
  cloudState = data;
  renderTab(currentTab);
});
```

Replace with:

```js
window.FCDB.subscribe(data => {
  cloudState = data;
  handleIncomingHandoff();
  renderTab(currentTab);
});
```

(`handleIncomingHandoff` only needs to run once — its own `handoffProcessed` flag prevents it from re-applying on later snapshots — but it must wait until at least the first snapshot so `cloudState.logs`/`cloudState.weights` have real data to merge into.)

- [ ] **Step 5: Verify workout handoff end-to-end**

Restart the preview server pointed at a URL with handoff params — since `preview_eval` runs in the already-loaded page, instead navigate the page first. If the Preview tool exposes a navigate/reload action, reload to `http://localhost:8000/?wh_user=bright&wh_kcal=450&wh_dur=52&wh_hr=132`. Otherwise, simulate via `preview_eval`:

```
(async () => {
  history.pushState({}, '', '/?wh_user=bright&wh_kcal=450&wh_dur=52&wh_hr=132');
  handoffProcessed = false;
  handleIncomingHandoff();
  await new Promise(r => setTimeout(r, 1500));
  return { toast: document.getElementById('toast').textContent, url: location.search, logs: cloudState.logs.bright };
})()
```
Expected: `toast` contains `"450 kcal"` and `"52 min"`, `url` is `""` (params stripped), and `logs` includes today's entry with a `healthSync` object matching `{kcal:450,duration:52,avgHR:132}`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: process Apple Watch handoff URL params into Firestore"
```

---

### Task 8: Sync badges in Home and Progress tabs

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add today's-log lookup and badge in `renderHome()`**

Find, in `renderHome()`:

```js
  const plan=PROGRAM[todayPlanIdx()];
```

Add right after it:

```js
  const todayLog=(getLogs()[currentUser]||[]).find(l=>l.date===today());
```

Then find the closing of the "Today's Workout" card body:

```js
    <div style="margin-top:12px;font-size:13px;color:var(--muted)">
      ${plan.ex.slice(0,3).map(e=>`<div style="margin-bottom:2px">• ${e.n} — ${e.s}×${e.r}</div>`).join('')}
      ${plan.ex.length>3?`<div>+ ${plan.ex.length-3} more exercises</div>`:''}
    </div>
  </div>
```

Replace with:

```js
    <div style="margin-top:12px;font-size:13px;color:var(--muted)">
      ${plan.ex.slice(0,3).map(e=>`<div style="margin-bottom:2px">• ${e.n} — ${e.s}×${e.r}</div>`).join('')}
      ${plan.ex.length>3?`<div>+ ${plan.ex.length-3} more exercises</div>`:''}
    </div>
    ${todayLog?.healthSync?`<div style="margin-top:8px"><span class="tag tg">🍎 ${todayLog.healthSync.kcal} kcal · ${todayLog.healthSync.duration} min · ${todayLog.healthSync.avgHR} bpm avg</span></div>`:''}
  </div>
```

- [ ] **Step 2: Add badge in `renderProgress()` workout history**

Find:

```js
    ${(logs[currentUser]||[]).slice().reverse().slice(0,8).map(log=>{
      const plan=PROGRAM[log.programIdx]||{icon:'💪',type:'Workout'};
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:24px">${plan.icon}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:14px">${plan.type}</div><div class="muted" style="font-size:12px">${log.date}</div></div>
        <span class="tag tg">Done ✓</span>
      </div>`;
    }).join('')}
```

Replace with:

```js
    ${(logs[currentUser]||[]).slice().reverse().slice(0,8).map(log=>{
      const plan=PROGRAM[log.programIdx]||{icon:'💪',type:'Workout'};
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:24px">${plan.icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${plan.type}</div>
          <div class="muted" style="font-size:12px">${log.date}</div>
          ${log.healthSync?`<div style="font-size:11px;color:var(--green);margin-top:2px">🍎 ${log.healthSync.kcal} kcal · ${log.healthSync.duration} min</div>`:''}
        </div>
        <span class="tag tg">Done ✓</span>
      </div>`;
    }).join('')}
```

- [ ] **Step 3: Verify badge renders**

Via `preview_eval` (continuing from Task 7's state, which already has a `healthSync` entry for `bright` today):

```
(async () => {
  switchUser('bright');
  goTab('home');
  return document.getElementById('page-home').innerHTML.includes('🍎') && document.getElementById('page-home').innerHTML.includes('450 kcal');
})()
```
Expected: `true`

```
(async () => {
  goTab('progress');
  return document.getElementById('page-progress').innerHTML.includes('🍎');
})()
```
Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: show Apple Watch sync badges on Home and Progress tabs"
```

---

### Task 9: Update Watch tab instructions for the new one-tap Shortcuts

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace "Step 2" and "Step 3" cards in `renderApple()`**

Find the two cards starting with `<!-- Step 2: Log Workout Shortcut -->` and ending right before `<!-- Daily routine -->` (this spans the "Log Workout Shortcut" card and the "Log My Weight Shortcut" card). Replace that whole region with:

```js
  <!-- Step 2: One-tap Log Workout Shortcut -->
  <div class="card cg">
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">Step 2 — Build your "Log Gym Workout" Shortcut</div>
    <div class="muted" style="font-size:12px;margin-bottom:12px">One-time setup · ~5 minutes · Pulls calories/duration/heart rate from Health straight into this app</div>

    ${[
      {n:'Open Shortcuts app on iPhone → tap + for a new shortcut', d:'This opens the shortcut builder'},
      {n:'Add Action → "Find Workouts"', d:'Set it to sort by End Date, Descending, with a limit of 1 — this grabs your just-finished workout'},
      {n:'Add Action → "Text"', d:`Build this exact text, tapping each bracket to insert the matching detail from Find Workouts: ?wh_user=${currentUser}&wh_kcal=[Active Energy Burned]&wh_dur=[Duration]&wh_hr=[Average Heart Rate]`},
      {n:'Add Action → "URL"', d:'Combine https://brightjoesiby.github.io/gym/ with the Text output from the previous step'},
      {n:'Add Action → "Open URLs"', d:'Pass in the URL variable — this opens the app and it auto-saves the synced data'},
      {n:'Name the shortcut "Log Gym Workout"', d:'Tap the shortcut name at top to rename'},
      {n:'Add to Watch: Settings → Siri & Search → toggle the shortcut', d:'Then it appears on your Watch\'s Siri watch face — run it right after ending your workout'},
    ].map((s,i)=>`
    <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
      <div style="width:24px;height:24px;border-radius:50%;background:var(--green);color:#000;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
      <div>
        <div style="font-weight:600;font-size:13px">${s.n}</div>
        <div class="muted" style="font-size:11px">${esc(s.d)}</div>
      </div>
    </div>`).join('')}
  </div>

  <!-- Step 3: One-tap Log Weight Shortcut -->
  <div class="card cp">
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">Step 3 — Build your "Log My Weight" Shortcut</div>
    <div class="muted" style="font-size:12px;margin-bottom:12px">Reads your latest Body Mass entry from Health and logs it here in one tap</div>

    ${[
      {n:'Create a new Shortcut', d:'Tap + in the Shortcuts app'},
      {n:'Add Action → "Find Health Samples"', d:'Type = Body Mass, sort by most recent, limit 1'},
      {n:'Add Action → "Text"', d:`Build: ?wt_user=${currentUser}&wt_kg=[Body Mass value from the sample]`},
      {n:'Add Action → "URL"', d:'Combine https://brightjoesiby.github.io/gym/ with the Text output'},
      {n:'Add Action → "Open URLs"', d:'Pass in the URL variable'},
      {n:'Name it "Log My Weight"', d:'Add to Watch via Settings → Siri, same as the workout shortcut'},
    ].map((s,i)=>`
    <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
      <div style="width:24px;height:24px;border-radius:50%;background:var(--pink);color:#fff;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
      <div>
        <div style="font-weight:600;font-size:13px">${s.n}</div>
        <div class="muted" style="font-size:11px">${esc(s.d)}</div>
      </div>
    </div>`).join('')}
  </div>
```

- [ ] **Step 2: Update the Daily Routine text to reflect one-tap sync**

Find, inside the `Daily Routine` card's data array:

```js
      {time:'Morning', icon:'🌅', steps:['Weigh yourself → run "Log My Weight" shortcut','Open this app → check today\'s workout plan','Eat breakfast (check Nutrition tab for targets)']},
      {time:'At Gym', icon:'🏋️', steps:['Apple Watch → Workout app → start session','Open this app → Log tab → log your sets & reps','Watch tracks heart rate & calories automatically']},
      {time:'After Gym', icon:'✅', steps:['End workout on Apple Watch (double-side-button)','Run "Log Gym Workout" shortcut → enter duration + calories','Tap "Save Workout" in this app\'s Log tab']},
```

Replace with:

```js
      {time:'Morning', icon:'🌅', steps:['Weigh yourself → run "Log My Weight" shortcut (auto-fills into the app)','Open this app → check today\'s workout plan','Eat breakfast (check Nutrition tab for targets)']},
      {time:'At Gym', icon:'🏋️', steps:['Apple Watch → Workout app → start session','Open this app → Log tab → log your sets & reps','Watch tracks heart rate & calories automatically']},
      {time:'After Gym', icon:'✅', steps:['End workout on Apple Watch (double-side-button)','Run "Log Gym Workout" shortcut — calories, duration & heart rate sync automatically, no typing','Tap "Save Workout" in this app\'s Log tab to record your sets & reps']},
```

- [ ] **Step 3: Verify the Watch tab renders without errors**

```
(async () => {
  switchUser('bright');
  goTab('apple');
  return document.getElementById('page-apple').innerHTML.includes('Log Gym Workout') && document.getElementById('page-apple').innerHTML.includes('Open URLs');
})()
```
Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "docs: update Watch tab instructions for one-tap Shortcuts handoff"
```

---

### Task 10: GitHub repo + Pages hosting

**Files:** none (infrastructure only)

This task is browser-driven, using the browser selected in Task 4.

- [ ] **Step 1: Create the empty GitHub repo**

Navigate to `https://github.com/new`. Owner: `brightjoesiby`. Repository name: `gym`. Visibility: Public (required for free GitHub Pages, unless Bright has a paid plan — confirm with him if he wants Private instead). Do **not** initialize with a README, `.gitignore`, or license (the local repo already has content). Click "Create repository".

- [ ] **Step 2: Push the local repo**

```bash
git remote add origin https://github.com/brightjoesiby/gym.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Enable GitHub Pages**

In the repo on github.com: Settings → Pages → under "Build and deployment", Source: "Deploy from a branch" → Branch: `main` / `/ (root)` → Save.

- [ ] **Step 4: Verify the live URL**

Wait ~1 minute for the first deploy, then confirm `https://brightjoesiby.github.io/gym/` loads (use `WebFetch` or navigate via `Claude_in_Chrome` and check the page title is "FitCouple 💪").

---

### Task 11: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Two-browser live sync test**

Using the two connected Chrome browsers (standing in for Bright's and Drishti's phones): open `https://brightjoesiby.github.io/gym/` in both. In browser 1, switch to Bright, log a weight entry. In browser 2 (already on the same page), confirm the Home tab's Couple Snapshot for Bright updates within a few seconds without manually refreshing.

- [ ] **Step 2: Full tab click-through**

On the live URL, click through all six tabs (Home, Plan, Log, Progress, Nutrition, Watch) for both users and confirm no console errors (`preview_console_logs` or Chrome DevTools) and no visibly broken layout.

- [ ] **Step 3: Real-device Shortcuts test (Bright performs this)**

Ask Bright to build both Shortcuts per the Watch tab's updated instructions on his own phone, do a short real workout, end it on his Watch, and run "Log Gym Workout." Confirm with him that: the app opens, a toast appears, and the 🍎 badge shows up on his Home tab. Repeat for "Log My Weight" after a weigh-in.

- [ ] **Step 4: Airplane-mode offline test (Bright performs this)**

Ask Bright to put his phone in airplane mode, log a set in the app, confirm the UI still updates (optimistic local state), then disable airplane mode and confirm — a few seconds later — that Drishti's phone (or the second browser) also picks up the change.

- [ ] **Step 5: Final commit if any fixes were needed during verification**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```
(Only run this if Steps 1–4 surfaced something to fix — otherwise skip.)

## Self-Review Notes

- **Spec coverage:** Hosting (Task 10), Firestore sync (Tasks 4–6), Watch handoff (Tasks 2, 3, 7), UI surfacing (Task 8), updated Watch tab copy (Task 9), error handling for unknown/malformed params (Task 2's `parseHandoffParams` returns `null`, `handleIncomingHandoff` no-ops on `null`), offline handling (Firestore SDK default behavior, exercised in Task 11 Step 4), manual multi-device + airplane-mode testing (Task 11) are all covered.
- **No placeholders:** `firebase-config.js` starts with placeholder-looking values only because the real ones don't exist until Task 4 runs live against Bright's browser session — Task 4 Step 6 explicitly requires replacing them with real values as part of that same task, not deferring it.
- **Type/name consistency checked:** `parseHandoffParams` (Task 2) return shape matches what `handleIncomingHandoff` (Task 7) destructures (`type`, `user`, `kcal`, `duration`, `avgHR`, `weightKg`). `mergeHealthSync`/`mergeWeightEntry` (Task 3) signatures match their call sites in Task 6 and Task 7. `window.FCDB.subscribe`/`update` (Task 5) match their call sites in Tasks 6 and 7.
