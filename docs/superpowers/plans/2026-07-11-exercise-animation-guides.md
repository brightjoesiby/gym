# Animated Exercise Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small animated illustration of correct form for every exercise in FitCouple's Plan and Log tabs, using original CSS/SVG movement-pattern animations — no external assets, no build step.

**Architecture:** A shared "stick-figure" SVG rig (head, torso, two arms, two legs, each its own SVG `<g>`) is built once by a pure JS function and reused for every exercise. Which body parts move, and how, is controlled entirely by CSS `@keyframes` selected via a `pattern` class on the SVG root — the JS never has per-exercise animation logic, only a name→pattern lookup table. 17 patterns cover every exercise currently in the program; anything unmapped falls back to a generic pulse so nothing ever renders broken.

**Tech Stack:** Vanilla JS, inline SVG, CSS `@keyframes` (no JS-driven animation), same zero-build-step static-file architecture as the rest of the app.

## Global Constraints

- No build step / bundler / npm dependency — stays static files servable as-is by GitHub Pages.
- `exercise-guides.js` must be pure (no DOM reads beyond returning a string, no Firebase, no side effects) — same convention as `handoff.js` and `firestore-sync.js`.
- Animate only `transform` (CSS `@keyframes`, not JS `requestAnimationFrame`) — these are fixed, predetermined looping sequences.
- Every pattern's motion must be wrapped so it's disabled under `prefers-reduced-motion: reduce` (renders a static pose, not nothing).
- A single shared `IntersectionObserver` must pause any animation currently scrolled off-screen.
- SVG size: `viewBox="0 0 120 90"`, rendered at `width:120px; height:90px`, on a `var(--surface2)` rounded card background.
- Animation renders inline where an exercise is already expanded — Plan tab (day-level expand, all exercises in that day show tips + now animations together) and Log tab (per-exercise expand).
- Any exercise name not in the `EXERCISE_PATTERN` map falls back to a `generic` pulse animation — never a broken/missing render.

---

### Task 1: `exercise-guides.js` — pattern lookup + SVG rig builder

**Files:**
- Create: `exercise-guides.js`
- Modify: `index.html` (add script tag)

**Interfaces:**
- Produces: global function `exerciseAnimationSVG(exerciseName, color)` — pure, no DOM/Firebase deps, loaded via a plain `<script>` tag (global, usable directly in `preview_eval`).
  - `exerciseName`: exact string as used in `PROGRAM[].ex[].n` (Plan) / `logState` entries' `.name` (Log).
  - `color`: a CSS color string (hex), e.g. `'#6c63ff'`.
  - Returns: an SVG markup string, root element has classes `ex-anim ex-anim-{pattern}` where `{pattern}` is one of the 17 pattern keys below, or `generic` if `exerciseName` isn't in the map.

- [ ] **Step 1: Write `exercise-guides.js`**

```js
// exercise-guides.js — pure functions for building the animated exercise-guide SVG.
// No DOM or Firebase dependencies. Which body parts move is controlled entirely by
// CSS classes (ex-anim-{pattern}) and @keyframes defined in index.html's <style> block —
// this file only knows the name→pattern lookup and the shared SVG rig markup.

const EXERCISE_PATTERN = {
  'Goblet Squat':'squat', 'Sumo Goblet Squat':'squat', 'Leg Press Machine':'squat',
  'Dumbbell Deadlift':'hinge', 'Dumbbell Romanian Deadlift':'hinge',
  'Stationary Reverse Lunge':'lunge-step', 'Bench Step-Up':'lunge-step',
  'Dumbbell Chest Press (flat bench)':'horizontal-press', 'Incline Dumbbell Press':'horizontal-press', 'Pec Deck Machine (chest fly)':'horizontal-press',
  'Seated Dumbbell Shoulder Press':'overhead-press', 'Dumbbell Thrusters':'overhead-press',
  'Lat Pulldown (close grip)':'vertical-pull', 'Lat Pulldown Machine':'vertical-pull',
  'Seated Row Machine':'horizontal-row', 'Seated Row Machine (wide grip)':'horizontal-row', 'Cable Face Pull':'horizontal-row',
  'Dumbbell Bicep Curl':'curl', 'Dumbbell Hammer Curl':'curl',
  'Cable Tricep Pushdown':'triceps-extension', 'Seated Overhead Dumbbell Tricep':'triceps-extension',
  'Floor Glute Bridge':'hip-bridge', 'Glute Bridge':'hip-bridge',
  'Leg Curl Machine (seated)':'leg-curl',
  'Seated Calf Raise (machine)':'calf-raise', 'Standing Calf Raise (machine)':'calf-raise',
  'Hip Abduction Machine':'hip-abduction',
  'Dead Bug':'core-floor', 'Bird Dog':'core-floor', 'Modified Crunch':'core-floor',
  'Treadmill Walk':'cardio-walk-jog', 'Treadmill Walk/Light Jog':'cardio-walk-jog', 'Light Walk (outdoors)':'cardio-walk-jog', 'Jump Rope or March in Place':'cardio-walk-jog',
  'Rowing Machine':'rowing',
  'Full Body Stretch':'stretch-recovery', 'Foam Rolling':'stretch-recovery'
};

function exerciseAnimationSVG(exerciseName, color) {
  const pattern = EXERCISE_PATTERN[exerciseName] || 'generic';
  return `<svg viewBox="0 0 120 90" width="120" height="90" class="ex-anim ex-anim-${pattern}" aria-hidden="true">
    <g class="ex-fig" stroke="${color}" stroke-width="6" stroke-linecap="round" fill="none">
      <circle class="ex-head" cx="60" cy="16" r="7" fill="${color}" stroke="none"/>
      <g class="ex-torso-g" style="transform-origin:60px 52px"><line class="ex-torso" x1="60" y1="23" x2="60" y2="52"/></g>
      <g class="ex-arm-l" style="transform-origin:60px 27px"><line x1="60" y1="27" x2="42" y2="45"/></g>
      <g class="ex-arm-r" style="transform-origin:60px 27px"><line x1="60" y1="27" x2="78" y2="45"/></g>
      <g class="ex-leg-l" style="transform-origin:60px 52px"><line x1="60" y1="52" x2="46" y2="80"/></g>
      <g class="ex-leg-r" style="transform-origin:60px 52px"><line x1="60" y1="52" x2="74" y2="80"/></g>
    </g>
  </svg>`;
}
```

- [ ] **Step 2: Load it in `index.html`**

Find (in `index.html`):
```html
<script src="handoff.js"></script>
<script src="firestore-sync.js"></script>
```

Replace with:
```html
<script src="handoff.js"></script>
<script src="firestore-sync.js"></script>
<script src="exercise-guides.js"></script>
```

- [ ] **Step 3: Verify via the local preview server**

Call `mcp__Claude_Preview__preview_start` (name `"static"`), then `mcp__Claude_Preview__preview_eval` with:

```
(() => {
  const svg1 = exerciseAnimationSVG('Goblet Squat', '#6c63ff');
  const svg2 = exerciseAnimationSVG('Some Unmapped Exercise', '#6c63ff');
  return {
    squatHasCorrectClass: svg1.includes('ex-anim-squat'),
    unmappedFallsBackToGeneric: svg2.includes('ex-anim-generic'),
    hasAllSixParts: svg1.includes('ex-head') && svg1.includes('ex-torso') && svg1.includes('ex-arm-l') && svg1.includes('ex-arm-r') && svg1.includes('ex-leg-l') && svg1.includes('ex-leg-r')
  };
})()
```
Expected: `{"squatHasCorrectClass":true,"unmappedFallsBackToGeneric":true,"hasAllSixParts":true}`

- [ ] **Step 4: Commit**

```bash
git add exercise-guides.js index.html
git commit -m "feat: add exercise-guides.js pattern lookup and SVG rig builder"
```

---

### Task 2: Shared structural CSS — container, pause state, reduced motion, floor orientation

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing from Task 1 (pure CSS, independent of the JS).
- Produces: `.ex-anim` container styling, `.ex-anim-paused` pause mechanism, `prefers-reduced-motion` guard, and `.ex-anim-hip-bridge`/`.ex-anim-core-floor` static floor-orientation rotation — all consumed by Task 3's per-pattern keyframes and Tasks 4/5's rendering.

- [ ] **Step 1: Add the CSS**

Find (in `index.html`'s `<style>` block):
```css
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
</style>
```

Replace with:
```css
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}

/* ── EXERCISE GUIDE ANIMATIONS ── */
.ex-anim{display:block;margin-bottom:6px;background:var(--surface2);border-radius:8px;padding:6px}
.ex-anim-paused .ex-fig,.ex-anim-paused .ex-torso-g,.ex-anim-paused .ex-arm-l,.ex-anim-paused .ex-arm-r,.ex-anim-paused .ex-leg-l,.ex-anim-paused .ex-leg-r{animation-play-state:paused!important}
@media (prefers-reduced-motion: reduce){
  .ex-anim .ex-fig,.ex-anim .ex-torso-g,.ex-anim .ex-arm-l,.ex-anim .ex-arm-r,.ex-anim .ex-leg-l,.ex-anim .ex-leg-r{animation:none!important}
}
.ex-anim-hip-bridge .ex-fig,.ex-anim-core-floor .ex-fig{transform:rotate(-90deg);transform-origin:60px 50px}
</style>
```

- [ ] **Step 2: Verify via preview**

```
(() => {
  const css = Array.from(document.styleSheets[0].cssRules).map(r=>r.cssText).join('\n');
  return {
    hasExAnimContainer: css.includes('.ex-anim{'),
    hasPausedRule: css.includes('.ex-anim-paused'),
    hasReducedMotionGuard: css.includes('prefers-reduced-motion'),
    hasFloorOrientation: css.includes('ex-anim-hip-bridge') && css.includes('ex-anim-core-floor')
  };
})()
```
Expected: all four `true`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add shared structural CSS for exercise guide animations"
```

---

### Task 3: All 17 pattern `@keyframes` + the generic fallback

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: the `.ex-anim`, `.ex-anim-paused`, and floor-orientation rules from Task 2 (this task adds the `@keyframes` and per-part `animation:` rules those interact with).
- Produces: CSS classes `ex-anim-squat`, `ex-anim-hinge`, `ex-anim-lunge-step`, `ex-anim-horizontal-press`, `ex-anim-overhead-press`, `ex-anim-vertical-pull`, `ex-anim-horizontal-row`, `ex-anim-curl`, `ex-anim-triceps-extension`, `ex-anim-hip-bridge`, `ex-anim-leg-curl`, `ex-anim-calf-raise`, `ex-anim-hip-abduction`, `ex-anim-core-floor`, `ex-anim-cardio-walk-jog`, `ex-anim-rowing`, `ex-anim-stretch-recovery`, `ex-anim-generic` — all consumed by Task 1's `exerciseAnimationSVG()` (already produces these class names) and rendered starting Task 4.

- [ ] **Step 1: Add all pattern keyframes and rules**

Find (in `index.html`'s `<style>` block, the block added in Task 2):
```css
.ex-anim-hip-bridge .ex-fig,.ex-anim-core-floor .ex-fig{transform:rotate(-90deg);transform-origin:60px 50px}
</style>
```

Replace with:
```css
.ex-anim-hip-bridge .ex-fig,.ex-anim-core-floor .ex-fig{transform:rotate(-90deg);transform-origin:60px 50px}

.ex-anim-squat .ex-fig{animation:ex-squat-fig 1.8s ease-in-out infinite}
.ex-anim-squat .ex-leg-l{animation:ex-squat-leg-l 1.8s ease-in-out infinite}
.ex-anim-squat .ex-leg-r{animation:ex-squat-leg-r 1.8s ease-in-out infinite}
@keyframes ex-squat-fig{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
@keyframes ex-squat-leg-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-10deg)}}
@keyframes ex-squat-leg-r{0%,100%{transform:rotate(0)}50%{transform:rotate(10deg)}}

.ex-anim-hinge .ex-torso-g{animation:ex-hinge-torso 1.8s ease-in-out infinite}
@keyframes ex-hinge-torso{0%,100%{transform:rotate(0)}50%{transform:rotate(-40deg)}}

.ex-anim-lunge-step .ex-fig{animation:ex-lunge-fig 1.8s ease-in-out infinite}
.ex-anim-lunge-step .ex-leg-l{animation:ex-lunge-leg-l 1.8s ease-in-out infinite}
.ex-anim-lunge-step .ex-leg-r{animation:ex-lunge-leg-r 1.8s ease-in-out infinite}
@keyframes ex-lunge-fig{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
@keyframes ex-lunge-leg-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-30deg)}}
@keyframes ex-lunge-leg-r{0%,100%{transform:rotate(0)}50%{transform:rotate(20deg)}}

.ex-anim-horizontal-press .ex-arm-l{animation:ex-hpress-arm-l 1.6s ease-in-out infinite}
.ex-anim-horizontal-press .ex-arm-r{animation:ex-hpress-arm-r 1.6s ease-in-out infinite}
@keyframes ex-hpress-arm-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-75deg)}}
@keyframes ex-hpress-arm-r{0%,100%{transform:rotate(0)}50%{transform:rotate(75deg)}}

.ex-anim-overhead-press .ex-arm-l{animation:ex-opress-arm-l 1.6s ease-in-out infinite}
.ex-anim-overhead-press .ex-arm-r{animation:ex-opress-arm-r 1.6s ease-in-out infinite}
@keyframes ex-opress-arm-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-165deg)}}
@keyframes ex-opress-arm-r{0%,100%{transform:rotate(0)}50%{transform:rotate(165deg)}}

.ex-anim-vertical-pull .ex-arm-l{animation:ex-vpull-arm-l 1.8s ease-in-out infinite}
.ex-anim-vertical-pull .ex-arm-r{animation:ex-vpull-arm-r 1.8s ease-in-out infinite}
@keyframes ex-vpull-arm-l{0%,100%{transform:rotate(-165deg)}50%{transform:rotate(0deg)}}
@keyframes ex-vpull-arm-r{0%,100%{transform:rotate(165deg)}50%{transform:rotate(0deg)}}

.ex-anim-horizontal-row .ex-arm-l{animation:ex-row-arm-l 1.6s ease-in-out infinite}
.ex-anim-horizontal-row .ex-arm-r{animation:ex-row-arm-r 1.6s ease-in-out infinite}
@keyframes ex-row-arm-l{0%,100%{transform:rotate(-75deg)}50%{transform:rotate(0deg)}}
@keyframes ex-row-arm-r{0%,100%{transform:rotate(75deg)}50%{transform:rotate(0deg)}}

.ex-anim-curl .ex-arm-l{animation:ex-curl-arm-l 1.4s ease-in-out infinite}
.ex-anim-curl .ex-arm-r{animation:ex-curl-arm-r 1.4s ease-in-out infinite}
@keyframes ex-curl-arm-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-110deg)}}
@keyframes ex-curl-arm-r{0%,100%{transform:rotate(0)}50%{transform:rotate(110deg)}}

.ex-anim-triceps-extension .ex-arm-l{animation:ex-tricep-arm-l 1.4s ease-in-out infinite}
.ex-anim-triceps-extension .ex-arm-r{animation:ex-tricep-arm-r 1.4s ease-in-out infinite}
@keyframes ex-tricep-arm-l{0%,100%{transform:rotate(-165deg)}50%{transform:rotate(-100deg)}}
@keyframes ex-tricep-arm-r{0%,100%{transform:rotate(165deg)}50%{transform:rotate(100deg)}}

.ex-anim-hip-bridge .ex-torso-g{animation:ex-bridge-torso 1.8s ease-in-out infinite}
@keyframes ex-bridge-torso{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,0)}}

.ex-anim-leg-curl .ex-leg-l{animation:ex-legcurl-leg-l 1.6s ease-in-out infinite}
.ex-anim-leg-curl .ex-leg-r{animation:ex-legcurl-leg-r 1.6s ease-in-out infinite}
@keyframes ex-legcurl-leg-l{0%,100%{transform:rotate(0)}50%{transform:rotate(25deg)}}
@keyframes ex-legcurl-leg-r{0%,100%{transform:rotate(0)}50%{transform:rotate(25deg)}}

.ex-anim-calf-raise .ex-fig{animation:ex-calf-fig 1.2s ease-in-out infinite}
@keyframes ex-calf-fig{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

.ex-anim-hip-abduction .ex-leg-l{animation:ex-abduct-leg-l 1.6s ease-in-out infinite}
.ex-anim-hip-abduction .ex-leg-r{animation:ex-abduct-leg-r 1.6s ease-in-out infinite}
@keyframes ex-abduct-leg-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-20deg)}}
@keyframes ex-abduct-leg-r{0%,100%{transform:rotate(0)}50%{transform:rotate(20deg)}}

.ex-anim-core-floor .ex-arm-l{animation:ex-core-arm-l 1.8s ease-in-out infinite}
.ex-anim-core-floor .ex-leg-r{animation:ex-core-leg-r 1.8s ease-in-out infinite}
@keyframes ex-core-arm-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-30deg)}}
@keyframes ex-core-leg-r{0%,100%{transform:rotate(0)}50%{transform:rotate(30deg)}}

.ex-anim-cardio-walk-jog .ex-leg-l{animation:ex-walk-leg-l 1.2s ease-in-out infinite}
.ex-anim-cardio-walk-jog .ex-leg-r{animation:ex-walk-leg-r 1.2s ease-in-out infinite}
.ex-anim-cardio-walk-jog .ex-arm-l{animation:ex-walk-arm-l 1.2s ease-in-out infinite}
.ex-anim-cardio-walk-jog .ex-arm-r{animation:ex-walk-arm-r 1.2s ease-in-out infinite}
@keyframes ex-walk-leg-l{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}}
@keyframes ex-walk-leg-r{0%,100%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}}
@keyframes ex-walk-arm-l{0%,100%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}}
@keyframes ex-walk-arm-r{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}}

.ex-anim-rowing .ex-torso-g{animation:ex-row2-torso 1.6s ease-in-out infinite}
.ex-anim-rowing .ex-arm-l{animation:ex-row2-arm-l 1.6s ease-in-out infinite}
.ex-anim-rowing .ex-arm-r{animation:ex-row2-arm-r 1.6s ease-in-out infinite}
@keyframes ex-row2-torso{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(10deg)}}
@keyframes ex-row2-arm-l{0%,100%{transform:rotate(-50deg)}50%{transform:rotate(10deg)}}
@keyframes ex-row2-arm-r{0%,100%{transform:rotate(50deg)}50%{transform:rotate(-10deg)}}

.ex-anim-stretch-recovery .ex-torso-g{animation:ex-stretch-torso 2.4s ease-in-out infinite}
@keyframes ex-stretch-torso{0%,100%{transform:rotate(0)}50%{transform:rotate(-15deg)}}

.ex-anim-generic .ex-fig{animation:ex-generic-fig 1.6s ease-in-out infinite}
@keyframes ex-generic-fig{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.04)}}
</style>
```

- [ ] **Step 2: Verify every pattern resolves to a real animation**

```
(() => {
  const patterns = ['squat','hinge','lunge-step','horizontal-press','overhead-press','vertical-pull','horizontal-row','curl','triceps-extension','hip-bridge','leg-curl','calf-raise','hip-abduction','core-floor','cardio-walk-jog','rowing','stretch-recovery','generic'];
  const css = Array.from(document.styleSheets[0].cssRules).map(r=>r.cssText).join('\n');
  const missing = patterns.filter(p => !css.includes('ex-anim-'+p+' '));
  return { allPatternsPresent: missing.length===0, missing };
})()
```
Expected: `{"allPatternsPresent":true,"missing":[]}`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add all 17 exercise animation patterns plus generic fallback"
```

---

### Task 4: Wire the shared IntersectionObserver + integrate into `renderPlan()`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `exerciseAnimationSVG(exerciseName, color)` from Task 1; `.ex-anim`/`.ex-anim-paused` from Task 2.
- Produces: global function `observeExerciseAnimations()` — queries all `.ex-anim` elements currently in the DOM and (re)observes them with a shared `IntersectionObserver`, toggling `.ex-anim-paused` based on visibility. Consumed by Task 5's `renderLog()` integration (reused, not redefined).

- [ ] **Step 1: Add `observeExerciseAnimations()`**

Find (in `index.html`'s main script, right after `esc()`'s definition):
```js
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
```

Replace with:
```js
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

let exAnimObserver=null;
function observeExerciseAnimations(){
  if(!exAnimObserver){
    exAnimObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        entry.target.classList.toggle('ex-anim-paused', !entry.isIntersecting);
      });
    }, {threshold:0});
  }
  document.querySelectorAll('.ex-anim').forEach(el=>exAnimObserver.observe(el));
}
```

- [ ] **Step 2: Integrate into `renderPlan()`**

Find:
```js
            <div style="font-weight:600;font-size:14px">${esc(ex.n)}</div>
            <div class="muted" style="font-size:12px">${ex.s} sets × ${ex.r} · ${ex.m}</div>
            <div style="font-size:11px;color:var(--green);margin-top:2px">💡 ${esc(ex.tip)}</div>
          </div>
        </div>`).join('')}
        ${plan.cardio?`<div style="margin-top:8px;padding:8px 12px;background:rgba(0,212,170,.1);border-radius:8px;font-size:12px">🏃 <b>Cardio Finisher:</b> ${plan.cardio}</div>`:''}
      </div>
    </div>`;
  }).join('')}`;
}
```

Replace with:
```js
            <div style="font-weight:600;font-size:14px">${esc(ex.n)}</div>
            <div class="muted" style="font-size:12px">${ex.s} sets × ${ex.r} · ${ex.m}</div>
            <div style="margin-top:4px">${exerciseAnimationSVG(ex.n,u.color)}</div>
            <div style="font-size:11px;color:var(--green);margin-top:2px">💡 ${esc(ex.tip)}</div>
          </div>
        </div>`).join('')}
        ${plan.cardio?`<div style="margin-top:8px;padding:8px 12px;background:rgba(0,212,170,.1);border-radius:8px;font-size:12px">🏃 <b>Cardio Finisher:</b> ${plan.cardio}</div>`:''}
      </div>
    </div>`;
  }).join('')}`;
  observeExerciseAnimations();
}
```

- [ ] **Step 3: Verify via preview**

```
(async () => {
  switchUser('bright');
  goTab('plan');
  togglePlanDay(0);
  await new Promise(r=>setTimeout(r,200));
  const html = document.getElementById('page-plan').innerHTML;
  return {
    hasAnimSvg: html.includes('class="ex-anim'),
    observerAttachedAtLeastOne: document.querySelectorAll('.ex-anim').length > 0
  };
})()
```
Expected: `{"hasAnimSvg":true,"observerAttachedAtLeastOne":true}`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: wire IntersectionObserver and show exercise animations in Plan tab"
```

---

### Task 5: Integrate into `renderLog()`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `exerciseAnimationSVG(exerciseName, color)` (Task 1), `observeExerciseAnimations()` (Task 4 — reused as-is, not redefined).

- [ ] **Step 1: Integrate into `renderLog()`**

Find:
```js
    ${ex.open?`
    <div style="margin-top:12px">
      <div class="tipbox">💡 ${esc(ex.tip)}</div>
      <table class="set-tbl">
```

Replace with:
```js
    ${ex.open?`
    <div style="margin-top:12px">
      ${exerciseAnimationSVG(ex.name,u.color)}
      <div class="tipbox">💡 ${esc(ex.tip)}</div>
      <table class="set-tbl">
```

Find:
```js
  <button class="btn bp" style="background:${u.color}" onclick="saveWorkout()">
    ${(getLogs()[currentUser]||[]).find(l=>l.date===today())?'✓ Workout Saved — Update':'Save Workout 💾'}
  </button>`;
}
```

Replace with:
```js
  <button class="btn bp" style="background:${u.color}" onclick="saveWorkout()">
    ${(getLogs()[currentUser]||[]).find(l=>l.date===today())?'✓ Workout Saved — Update':'Save Workout 💾'}
  </button>`;
  observeExerciseAnimations();
}
```

- [ ] **Step 2: Verify via preview**

```
(async () => {
  switchUser('bright');
  goTab('log');
  toggleLogEx(0);
  await new Promise(r=>setTimeout(r,200));
  const html = document.getElementById('page-log').innerHTML;
  return { hasAnimSvg: html.includes('class="ex-anim') };
})()
```
Expected: `{"hasAnimSvg":true}`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: show exercise animations in Log tab"
```

---

### Task 6: End-to-end verification and deploy

**Files:** none (verification + deploy only)

- [ ] **Step 1: Full sweep across every day, both tabs**

Via `preview_eval`, for each of the 7 days in `PROGRAM`, expand the day in Plan and confirm every exercise's animation resolves to a real (non-`generic`) pattern:

```
(() => {
  const results = PROGRAM.map(day => ({
    day: day.day,
    exercises: day.ex.map(ex => ({
      name: ex.n,
      pattern: EXERCISE_PATTERN[ex.n] || 'generic (unmapped!)'
    }))
  }));
  const unmapped = results.flatMap(d => d.exercises.filter(e => e.pattern.includes('unmapped')));
  return { totalExercises: results.reduce((n,d)=>n+d.exercises.length,0), unmapped };
})()
```
Expected: `unmapped` is an empty array — every exercise currently in the program has an explicit pattern (the `generic` fallback exists only for exercises added later, not for anything shipping today).

- [ ] **Step 2: Reduced-motion check**

Emulate `prefers-reduced-motion: reduce` (via the Preview tool's emulation capability, or `preview_eval` checking `matchMedia`), reload, expand an exercise, and confirm the SVG still renders but `getComputedStyle()` on `.ex-fig` shows `animationName: 'none'` or `animationPlayState` has no effect (motion disabled, static pose visible).

- [ ] **Step 3: Off-screen pause check**

```
(async () => {
  switchUser('bright');
  goTab('log');
  toggleLogEx(0);
  await new Promise(r=>setTimeout(r,300));
  const anim = document.querySelector('.ex-anim');
  anim.scrollIntoView({block:'end'});
  window.scrollTo(0,0);
  await new Promise(r=>setTimeout(r,300));
  return anim.classList.contains('ex-anim-paused');
})()
```
Expected: `true` once the element is confirmed out of the viewport (exact scroll behavior may need adjusting per the page's actual scroll container — the Log tab's page div, not `window` — adjust the scroll target in this check to `document.getElementById('page-log')` if `window.scrollTo` has no effect, since the app's pages scroll internally).

- [ ] **Step 4: Console error check**

Use `mcp__Claude_Preview__preview_console_logs` after all the above interactions — expect no errors.

- [ ] **Step 5: Deploy**

```bash
git push origin main
```

Wait ~1 minute, then fetch `https://brightjoesiby.github.io/gym/index.html` and confirm it contains `ex-anim-squat` (proves the deploy went out), and spot-check the live URL directly (expand a day in Plan, an exercise in Log) for both users.

## Self-Review Notes

- **Spec coverage:** movement-pattern library (Task 1), CSS-keyframe-only animation with `transform` (Task 3), reduced-motion guard and off-screen pause (Task 2 + 4 + verified in Task 6), inline placement in both Plan and Log (Tasks 4–5), generic fallback (Task 1, verified never triggered for current exercises in Task 6) — all covered.
- **No placeholders:** every keyframe, every CSS rule, every JS function is complete, real code — nothing deferred.
- **Type/name consistency:** `exerciseAnimationSVG(exerciseName, color)` signature is identical everywhere it's called (Task 4's `renderPlan()` passes `ex.n`; Task 5's `renderLog()` passes `ex.name` — this is correct, not a bug: Plan's `PROGRAM[].ex[]` objects use `.n` for the exercise name, while `renderLog()`'s `logState` entries use `.name`, per the existing pre-existing data shapes in the codebase — both resolve to the same exercise-name strings that `EXERCISE_PATTERN` is keyed on). `observeExerciseAnimations()` is defined once (Task 4) and called identically from both `renderPlan()` and `renderLog()` (Task 5).
