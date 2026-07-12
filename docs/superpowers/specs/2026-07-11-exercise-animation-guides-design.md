# FitCouple: Animated Exercise Guides

Date: 2026-07-11
Status: Approved

## Context

FitCouple's Plan and Log tabs already let you tap an exercise to expand it and see a one-line 🔰 safety tip. Bright and Drishti are training without a coach and asked for a visual demonstration of correct form for each exercise, alongside the existing text tip — not just more text. This is the first of two related follow-up features; a separate "swap exercise for an alternative" feature is planned next as its own spec.

## Goals

1. Every exercise in the weekly program shows an animated illustration of the correct movement when expanded, in both the Plan and Log tabs.
2. Fully self-contained — no external image/video assets, no API calls, no licensing risk, no new build tooling. Matches the existing zero-build-step, single-file-plus-small-helpers architecture.
3. Respects `prefers-reduced-motion` and doesn't hurt scroll/render performance when several exercises are expanded at once.

## Non-goals

- A full-screen dedicated "How To" view — animations render inline where exercises already expand (confirmed with Bright).
- Photorealistic or video-based demonstrations — original simple SVG silhouette illustrations, not third-party GIFs/videos.
- The exercise-swap/alternative-suggestion feature — separate spec, built after this one ships.

## Architecture

### Movement-pattern library, not per-exercise animations

The ~30 unique exercises across the program reduce to 17 real movement patterns — many exercises (e.g. Goblet Squat, Sumo Goblet Squat, Leg Press Machine) share the same fundamental motion. Building 17 original animations instead of 30+ is both less work and more consistent.

**Exercise → pattern mapping** (exact `ex.n` strings from `index.html`'s `PROGRAM`, as they exist after the equipment-swap fix):

| Pattern key | Exercises |
|---|---|
| `squat` | Goblet Squat, Sumo Goblet Squat, Leg Press Machine |
| `hinge` | Dumbbell Deadlift, Dumbbell Romanian Deadlift |
| `lunge-step` | Stationary Reverse Lunge, Bench Step-Up |
| `horizontal-press` | Dumbbell Chest Press (flat bench), Incline Dumbbell Press, Pec Deck Machine (chest fly) |
| `overhead-press` | Seated Dumbbell Shoulder Press, Dumbbell Thrusters |
| `vertical-pull` | Lat Pulldown (close grip), Lat Pulldown Machine |
| `horizontal-row` | Seated Row Machine, Seated Row Machine (wide grip), Cable Face Pull |
| `curl` | Dumbbell Bicep Curl, Dumbbell Hammer Curl |
| `triceps-extension` | Cable Tricep Pushdown, Seated Overhead Dumbbell Tricep |
| `hip-bridge` | Floor Glute Bridge, Glute Bridge |
| `leg-curl` | Leg Curl Machine (seated) |
| `calf-raise` | Seated Calf Raise (machine), Standing Calf Raise (machine) |
| `hip-abduction` | Hip Abduction Machine |
| `core-floor` | Dead Bug, Bird Dog, Modified Crunch |
| `cardio-walk-jog` | Treadmill Walk, Treadmill Walk/Light Jog, Light Walk (outdoors), Jump Rope or March in Place |
| `rowing` | Rowing Machine |
| `stretch-recovery` | Full Body Stretch, Foam Rolling |

Any exercise name not present in this map (e.g. one added later) falls back to a generic pulse animation rather than breaking.

### Files

- **New: `exercise-guides.js`** — plain, DOM/Firebase-free script (same convention as `handoff.js`/`firestore-sync.js`): the `EXERCISE_PATTERN` lookup table above, plus `exerciseAnimationSVG(patternKey, color)` returning an inline SVG string sized for the tip box, built from simple grouped shapes (circle head, rounded-rect torso/limbs) colored with the current user's accent color, with each moving part in its own `<g class="ex-anim-{part}">`.
- **Modified: `index.html`** — one `@keyframes` block per pattern added to the existing `<style>` tag (no new CSS file, matching current convention); `renderPlan()` and `renderLog()` call `exerciseAnimationSVG(...)` and insert the result above the tip text when an exercise row is expanded; boot sequence sets up one shared `IntersectionObserver`.

### Visual sizing

Each pattern's SVG uses `viewBox="0 0 120 90"` and renders at a fixed `width:120px; height:90px` inline in the expanded exercise card, left-aligned above the 🔰 tip text, on a subtle rounded card background (`var(--surface2)`) matching the app's existing card styling.

### Animation technique

- CSS `@keyframes` (not JS `requestAnimationFrame`) — these are fixed, predetermined looping sequences, which is exactly what keyframes are for.
- Only `transform` is animated on the grouped SVG parts (`transform-box: fill-box; transform-origin: center` set on each animated `<g>`), for compositor-only performance — no layout properties.
- ~1.6–2s per loop, `ease-in-out`, `infinite` — a natural human tempo, not a mechanical linear loop.
- All pattern keyframes are wrapped in `@media (prefers-reduced-motion: no-preference)`; under reduced motion, the SVG still renders (a static end-pose) but does not move.
- A single shared `IntersectionObserver` toggles an `.ex-anim-paused` class (`animation-play-state: paused`) on animation containers as they scroll off/on screen, since the Log tab can have several exercises expanded simultaneously.

## Data flow

Purely presentational. No new app state, no Firestore reads/writes, no user data involved — `EXERCISE_PATTERN` is a static lookup keyed by exercise name string.

## Error handling

- Unmapped exercise name → generic fallback pulse animation, never a broken render.
- No `IntersectionObserver` support (unlikely on any real target device) → animations simply always play; no crash, since the observer is optional progressive enhancement, not required for the animation to render.

## Testing

- Manual verification via the local preview server (`preview_eval`): expand every exercise across all six training days in both Plan and Log tabs, confirm each resolves to a real (non-fallback) pattern and renders an SVG with no console errors.
- Emulate `prefers-reduced-motion: reduce` and confirm animations render statically (no motion) rather than disappearing.
- Confirm animation containers scrolled out of view get `animation-play-state: paused` via the shared `IntersectionObserver`.
- Deploy to GitHub Pages and spot-check on the live URL before calling it done, consistent with prior tasks' verification approach.
