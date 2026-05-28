---
name: web-animation-perf
description: Prevent layout/transition/reflow thrash in JS-driven CSS animations across the AIE conference sites. Use when building or debugging continuous motion (orbit, rotation, parallax, marquee, carousels, scroll-linked effects) and when symptoms appear like jank, stutter, lag, drifting elements, ghosting, "elements collapsing toward center", or when mixing `setInterval`/React state with CSS `transition`.
---

# Web Animation Performance (AIE Conference Sites)

The full guidance lives in the personal skill at `~/.cursor/skills/web-animation-perf/SKILL.md`. Read that first.

## In-repo case study: `OrbitalDiagram` (apps/main/src/pages/worldsfair/index.jsx)

Rotating orbital diagram with 11 role nodes. Original implementation hit all three cardinal anti-patterns:

1. Each node had `transition-all duration-700` while a `setInterval(50ms)` updated `left/top` on every tick. The CSS transition linearly interpolated between successive JS-set positions, cutting straight-line chords across the orbit. Visible symptom: under the post-release boost, nodes appeared to collapse inward toward the center logo instead of orbiting the ring.
2. `setInterval` instead of `requestAnimationFrame` → stutter and unsynced timing.
3. Animating `left`/`top` instead of `transform` → reflow on every tick.

The fix:

- Removed `transition-all duration-700` from the rotating wrapper (kept `transition-all duration-300` only on the inner circle for active-state scale/color, which is event-driven, not per-frame).
- Switched to `requestAnimationFrame` with delta-time integration (`degPerSec × dt`), so speed reads in degrees-per-second and motion stays correct under dropped frames.
- Added `willChange: 'left, top, opacity'`.
- Validated the fix by sampling node positions via Playwright (`getBoundingClientRect`) and checking that distance-from-center / expected orbit radius = 1.00 for every node across multiple frames.

## When making any continuous animation in this repo

- Confirm exactly one driver: either CSS `@keyframes` or JS `requestAnimationFrame`, never both on the same property.
- Prefer `transform` and `opacity`. Only fall back to `left/top/width/height` for the static layout pass, not the animated one.
- For verification on PRs that touch animation code, use Playwright to sample geometry over time and assert the expected invariant — don't rely on screenshots alone since the visual artifact may be subtle (e.g., chord-vs-arc) or only appear during boost/peak motion.
