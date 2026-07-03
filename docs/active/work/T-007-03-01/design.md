# T-007-03-01 — draw-and-discard-to-pond-motion — Design

## The problem in one line

Two insertion moments — the player's drawn tile appearing (`span.drawn`) and a
discard landing in a pond (`ul.pond > li`) — must gain ~150–250ms of motion with
CSS transitions only, gated on `prefers-reduced-motion`, with zero markup change
so the SSR surface is untouched.

## Options considered

### A. `transition` + `@starting-style`, gated by a reduced-motion media query — CHOSEN

Give `.pond li` and `.drawn` a `transition` on `opacity`/`transform` and a
nested `@starting-style` block holding the pre-insertion state. The browser
runs the transition *from* the starting style on the element's first render —
insertion motion with literally zero JavaScript and zero markup change.

- **Meets the AC's letter**: these are CSS *transitions* (the `@starting-style`
  rule exists in the CSS Transitions Level 2 spec precisely for this), no
  library, no dependency, client-only by nature — SSR emits the same markup
  byte-for-byte modulo the style-hash class Svelte already stamps.
- **Feasibility proven in Research**: the project's `svelte@5.56.4` compiles the
  nested block with correct scoping and zero warnings (spike run this session).
- **Degrades to the status quo**: pre-2024 browsers and reduced-motion users get
  instant appearance — exactly today's behavior, never a broken state.
- **Fits the drive rhythm**: motion completes inside the 250ms `BOT_DELAY_MS`
  tick, so each landing settles before the next action folds.

### B. CSS `@keyframes` animation on insertion — rejected

Animations do fire on insertion everywhere (no `@starting-style` needed), so
this is the wider-support variant. Rejected because the epic constraint is
verbatim "CSS transitions only, no animation library" and the AC repeats
"CSS transitions only" — an `animation:` property is defensible in spirit but
fails the stated letter, and the support delta (browsers older than mid-2024)
is not worth contradicting the written constraint for a decorative enhancement
whose fallback is today's exact behavior.

### C. Svelte `transition:`/`in:` directives — rejected

Built into the framework (no new dependency) and SSR-inert, but they are
JS-driven runtime animations: the runtime injects per-element inline styles and
dynamic keyframes each time. That is an animation engine, not a CSS transition —
outside the constraint — and it adds a runtime code path plus per-element work
where option A adds ~15 static CSS lines.

### D. JS class-toggle (two-frame rAF trick) — rejected

Reimplements `@starting-style` by hand in component code: an effect that adds a
class one frame after insertion. Same visual result as A with strictly more
moving parts, a new client-only code path in the view, and something T-007-03-03
would then have to reason about. No advantage over A in 2026 browsers.

## The chosen motion, concretely

All changes live in `Table.svelte`'s `<style>` block. One media query wraps
everything — reduced-motion users never even declare a `transition`:

```css
@media (prefers-reduced-motion: no-preference) {
  /* A discard settling onto the felt: drop + fade, done before the next
     250ms drive tick lands the next action. */
  .pond li {
    transition: opacity 180ms ease-out, transform 180ms ease-out;
    @starting-style {
      opacity: 0;
      transform: translateY(-0.4rem);
    }
  }

  /* The draw arriving from the wall: rise + fade into the drawn slot. */
  .drawn {
    transition: opacity 180ms ease-out, transform 180ms ease-out;
    @starting-style {
      opacity: 0;
      transform: translateY(0.35rem);
    }
  }
}
```

Design decisions inside that block:

- **180ms `ease-out`** — inside the ticket's 150–250ms band, comfortably under
  the 250ms action cadence, and ease-out reads as "landing/settling" (fast
  arrival, gentle stop), the parlor feel the epic names.
- **Opposed directions carry meaning**: a discard *drops onto* the pond
  (from above, −Y), the draw *rises into* the hand zone (from below, +Y — the
  drawn slot sits at the bottom of the thumb zone, so rising reads as arriving
  from the wall into the hand). Both displacements are small (≤0.4rem) so the
  motion is a settle, not a flight.
- **`opacity` + `transform` only** — compositor-friendly, no layout thrash, and
  cannot disturb the `.pond` `min-height` anti-jump reserve or wrap behavior.
- **Uniform across all four ponds** — the player's discard and the bots' land
  identically; legibility of *bot* discards is most of the value (the player
  already knows what they tapped).

## Interactions examined

- **`.pond .claimed` mark** (opacity 0.45 + rotate 8deg): the same `li` carries
  the transition, so when T-007-03-02's claim moment flips the class, the mark
  change animates for free. Incidental prepayment, no conflict — that ticket
  can tune or override without touching this rule's insertion behavior.
- **Initial mount**: the app boots on a fresh deal — ponds empty, `drawn` null —
  so nothing animates at load. (Were a mid-hand mount ever added, a one-time
  settle of existing pond tiles would be the worst case: harmless.)
- **Keyed-each moves don't re-trigger**: `@starting-style` applies only to an
  element's *first* render; Svelte's keyed reconciliation moves existing nodes
  without destroying them, so no spurious re-animation on unrelated folds.
- **Tedashi merge**: after a tedashi discard the former drawn tile re-keys into
  the sorted hand `ul` and *pops* in (a genuinely new node in that list).
  Deliberately out of scope: the AC names "drawing and discarding"; the drawn
  slot IS the draw's arrival, and animating `.hand li` insertion would also
  fire on the claim-shrunk hand and interact with T-007-03-03's reorder guard.
  Noted for the review handoff.
- **Exit motion (tile leaving the hand)**: unreachable with pure CSS (keyed
  removal destroys the node) and not required — the legible cue is the pond
  entrance, per the ticket's own framing ("discard travelling **to the pond**").

## What stays untouched

- Markup: zero element/attribute changes in any component — the SSR tests'
  `regionTokens` slices and label counts are structurally unreachable by this
  diff. `App.svelte`, `Tile.svelte`, `ClaimPrompt.svelte`, `drive.ts`: no edits.
- `src/core/`: byte-for-byte untouched.
- Dependencies, `index.html`, service worker, build config: untouched. The CSS
  delta is ~15 lines against a ~218KB headroom in the single-file gate.

## Verification shape (detailed in Plan)

`just test` + `just check` + `just build` must stay green — they exercise the
SSR-unchanged and svelte-check clauses of the AC. Motion itself is verified
empirically: build and eyeball the dev server or the proven headless-Chrome
iframe harness (360×780, auto-player) from T-007-02-01/-02, plus a forced
`prefers-reduced-motion: reduce` pass to confirm the gate.
