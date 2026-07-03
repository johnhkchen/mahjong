# T-007-03-01 — draw-and-discard-to-pond-motion — Review

## What changed

One file, one commit (`d7b5c50`):

- **`src/app/Table.svelte`** — 31 lines appended to the `<style>` block; zero
  markup/script changes. A self-contained
  `@media (prefers-reduced-motion: no-preference)` section giving:
  - `.pond li` — `transition: opacity 180ms ease-out, transform 180ms
    ease-out` with `@starting-style { opacity: 0; transform:
    translateY(-0.4rem) }`: every discard (player's and bots', all four ponds)
    drops and fades onto the felt as its `li` is inserted by the keyed each.
  - `.drawn` — same transition with `@starting-style { opacity: 0; transform:
    translateY(0.35rem) }`: the player's draw rises and fades into the drawn
    slot when the `{#if}` mounts it.

Nothing else: no dependency, no `src/core/` byte, no other component, no build
config. Artifacts for this ticket live in `docs/active/work/T-007-03-01/`
(research → review, committed separately per house pattern).

## Acceptance criteria ↔ evidence

- **~150–250ms via CSS transitions only, no library/dependency** — 180ms CSS
  `transition` properties (the `@starting-style` rule is CSS Transitions L2,
  the spec's own mechanism for insertion transitions); lockfile untouched;
  diff is style-only.
- **Disabled under prefers-reduced-motion** — the entire section is inside the
  `no-preference` media query (opt-in, so reduced-motion *and*
  pre-@starting-style browsers share the no-op path). Empirically confirmed:
  under `--force-prefers-reduced-motion`, computed `transition` is `0s` and
  every inserted tile is at opacity 1 on the +50ms sample — instant
  appearance, the exact pre-ticket behavior.
- **SSR output unchanged** — transitions are client-only CSS; no element,
  attribute, or label changed. `just test`: 568/568 green including all
  `app.ssr.test.ts` assertions.
- **svelte-check passes** — `just check`: 177 files, 0 errors, 0 warnings.
- Additionally: `just build` green, dist 83,176 bytes (gate: 300,000), both
  rules verified present and correctly scoped in the minified dist.

## Test coverage assessment

- **Existing suites** are the AC's whole demand and stay green (SSR content/
  label assertions structurally cannot see a style-block diff; drive tests are
  pure TS). **No new unit tests** — vitest has no layout/animation engine, so
  a test could only string-match CSS, pinning implementation rather than
  behavior.
- **Empirical coverage** (headless-Chrome probe, real-time, auto-played game
  over the built single file): 35/35 sampled insertions (28 pond, 7 drawn)
  mid-transition at +50ms and settled by +400ms; reduced-motion pass a
  verified no-op. Probe design note for reuse: `--virtual-time-budget` mounts
  the transitions but never advances them — motion probing must run wall-clock.
- **Gap, owned elsewhere**: the tap→tile-id mapping under the animated path is
  sibling T-007-03-03's dedicated test deliverable (it depends on this ticket).

## Concurrency event (worth a human glance)

Sibling **T-007-03-02** (claim/hand-end motion) implemented and committed into
the same `Table.svelte` style block while this ticket was mid-flight — the DAG
let both run because neither depends on the other, which the workflow doc
calls a missing dependency edge. No harm done here (adjacent style sections,
sequential commits, both suites green on the combined file), but future motion
tickets touching one file concurrently may not collide this gently.

## Interactions & known limitations

1. **Claimed-li recreation double-trigger (benign, by spec)**: when a discard
   is claimed, Table's `{#if}` branch swap recreates the pond `li`, firing
   *both* this ticket's entrance transition and T-007-03-02's `claim-taken`
   animation. Running animations own the shared properties, so the sibling's
   intended dim-and-turn is what renders; a code comment records this.
2. **Tedashi merge pops** (deliberate scope cut, documented in design.md): the
   former drawn tile re-keys into the sorted hand with no motion — animating
   `.hand li` insertion would fire on claim-shrunk hands and belongs, if
   anywhere, with T-007-03-03's reorder-guard conversation.
3. **Exit motion is unreachable** with pure CSS (keyed removal destroys the
   node); the pond entrance is the legible cue, matching the ticket's framing.
4. **Browser floor**: `@starting-style` needs Chrome 117+/Safari 17.5+/
   Firefox 129+ (2023–24). Older browsers get instant appearance — a graceful,
   never-broken degradation.
5. **Bot draws don't render by design** (concealed information) — "each draw
   arriving" is the player's drawn tile plus the wall counter tick; no motion
   surface exists for opponents' draws.

## Open concerns for a human

- None critical. The one judgment call worth ratifying: reading "CSS
  transitions only" strictly (hence `@starting-style`) while the sibling
  ticket's "CSS only" AC used `@keyframes` — the two mechanisms coexist in
  the same media gate and the strict reading cost nothing, but if the owner
  prefers one idiom for the whole motion layer, T-007-03-02's keyframes and
  these transitions are each trivially convertible to the other.
