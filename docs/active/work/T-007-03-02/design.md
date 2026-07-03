# T-007-03-02 — Design: meld exposure & hand-end reveal motion

## Decision in one line

Pure-CSS `@keyframes` mount animations added to `Table.svelte`'s existing
selectors — zero markup change, zero script change, all motion gated behind
`@media (prefers-reduced-motion: no-preference)` — because research showed every
element to animate mounts exactly at its moment.

## Options considered

### A. Svelte `transition:`/`animate:` directives

`transition:fly`, `in:scale`, etc. on the meld li and hand-end blocks.

- **For**: idiomatic Svelte, handles outros too, per-element coordination.
- **Against**: runtime-JS-driven (the directive schedules and injects styles via
  the client runtime) — a poor fit for "CSS only", and the sibling ticket's
  phrasing ("no animation library") shows the epic's intent is cheap declarative
  motion. Directives also add markup diffs (SSR untouched, but the guarantee is
  weaker than byte-identical), pull `svelte/transition` into the bundle, and add
  intro/outro lifecycle that T-007-03-03 would then have to prove doesn't remap
  taps. No outros are needed: nothing in this ticket ever *leaves* (melds and
  hand-end blocks are terminal for the hand).
- **Rejected.**

### B. Class-toggle CSS transitions driven by state

Track "just claimed" / "just ended" in `App.svelte` or `Table.svelte` state,
toggle a class, `transition` to the end state.

- **For**: `transition` semantics; can re-fire on repeated events.
- **Against**: violates Table's design premise — it is a *stateless*
  presentational component ("the folded TableState in via one prop, markup
  out"); "recently changed" is derived-from-history state the fold does not
  carry, so the view would grow its own shadow clock. Extra `$state`/`$effect`
  machinery for something insertion timing already gives us for free.
- **Rejected.**

### C. Pure-CSS `@keyframes` on mount (chosen)

Declare keyframes in `Table.svelte`'s `<style>` and attach `animation:` to the
existing classes. A CSS animation runs when its element enters the DOM; research
established each target mounts exactly at its event:

| Event | Element that mounts | Animation |
|---|---|---|
| claim lands | new `li.meld` (unkeyed each appends) | settle-in: fade + slight scale |
| claim lands | `span.claimed-tile` inside it | rotate 0 → 90deg (the sideways turn) |
| claim lands | pond `li.claimed` ({#if} branch swap recreates it) | fade/tilt from full tile → the 0.45/8deg mark |
| ryuukyoku | `p.ended` (direct child of `.center`) | reveal: fade + small rise |
| agari | `div.win-summary` | reveal: fade + small rise |

- **For**: zero markup change → SSR output byte-identical → the meld and
  ryuukyoku SSR assertions *cannot* break; no script → nothing for the
  tap-mapping guard to worry about; no dependency; declarative end states
  already in place (`rotate(90deg)`, `opacity .45`) so reduced-motion is just
  "skip the keyframes"; ~15 lines of CSS.
- **Against / accepted costs**:
  1. *Animates on any mount, not just "the event".* Today the app always boots
     a fresh deal, so nothing false-fires. A future restored mid-hand record
     would replay its reveals once on load — cosmetic, and the persistence
     ticket can revisit. Documented as a known limitation.
  2. *Cannot re-fire without a remount.* Not needed: every animated element
     mounts exactly once per fact (melds never un-expose; hand ends are
     terminal).
  3. *Unkeyed meld each*: existing meld `<li>`s update in place by index, so a
     second claim animates only the appended li. Correct behavior, but it leans
     on the each staying unkeyed-append-only — noted in structure so a future
     keying change knows the contract.
- **Chosen.**

## Motion design

One shared vocabulary, two keyframe families, all inside a single
`@media (prefers-reduced-motion: no-preference)` block:

### `meld-settle` — the exposure

- `li.meld`: `opacity 0 → 1`, `transform scale(0.85) → none`, **200ms**
  ease-out. The meld "lands" on the felt.
- `span.claimed-tile`: `transform rotate(0) → rotate(90deg)`, **200ms**
  ease-out. Because the static rule already sets `rotate(90deg)`, the keyframe
  animates *into* the settled state; when the animation is skipped (reduced
  motion, or any older browser oddity) the tile simply sits sideways from the
  first frame. The `from` keyframe only needs `transform: rotate(0deg)` — the
  `to` state is the element's own computed style.
- pond `li.claimed`: `opacity 1 → 0.45`, `rotate 0 → 8deg`, **200ms** ease-out —
  the tile is visibly *taken* rather than blinking dim.

### `reveal-rise` — the hand-end

- `.win-summary` and `.center > .ended` (the ryuukyoku line — the child
  combinator excludes the winner sentence nested in `.win-summary`, avoiding a
  double animation): `opacity 0 → 1`, `translateY(0.35rem) → none`, **220ms**
  ease-out. Quiet rise, no scale — this is a status card, not a celebration
  (score presentation is later work).

### Timing rationale

All durations sit in the ticket's 150–250ms window and complete inside one
`BOT_DELAY_MS = 250` pacing tick, so a bot's next action never lands while a
reveal is still moving. `ease-out` throughout: motion decelerating into rest
reads as "arriving", which is the semantic in every case. No delays, no
stagger — at 200ms, choreography would read as lag.

### Reduced motion

The entire animation block lives under
`@media (prefers-reduced-motion: no-preference)`. Under `reduce`, no keyframes
apply and every element appears directly in its settled state — exactly today's
behavior. Nothing needs a `reduce`-side override because the animations are
purely additive on top of already-correct static styles.

## What this deliberately does not touch

- **Draw/discard motion** — sibling T-007-03-01's scope. No styles on `.hand`,
  `.drawn`, or pond *arrival*; only the pond tile's *claimed* branch swap.
- **Markup and script** — `Table.svelte`'s template and `<script>` are
  untouched; App, Tile, ClaimPrompt untouched.
- **Score/celebration presentation** — the win-summary content is as-is; this
  ticket only makes its arrival legible.
- **Kan variants** — an ankan meld li has no `.claimed-tile` span; it gets the
  settle-in only, which is correct (nothing was claimed, nothing turns).

## Verification approach

1. `just test` — the meld display, hand-end, and wall-exhausted SSR suites pass
   untouched (byte-identical markup makes this structural, but run it anyway).
2. `just check` — `svelte-check` gates selector validity: every animated
   selector matches template elements, so no `css-unused-selector` warnings.
3. `just build` + grep `dist/index.html` for the keyframe names and
   `prefers-reduced-motion` — proves the inlined single file actually ships the
   motion and the guard.
4. Visual: `just dev` walk-through is the honest check for feel; noted in
   review as done/not-done. The seed-3 chi window (four tsumogiri turns then the
   claim, per the SSR fixture) is the reproducible manual script.
