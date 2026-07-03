# T-007-03-01 — draw-and-discard-to-pond-motion — Plan

## Step sequence

The change is one CSS section in one file; the plan's weight is in
verification, matching the AC's clauses one-for-one.

### Step 1 — Baseline gate run

Run `just test` and `just check` before touching anything, so any failure seen
later is attributable to this diff (the working tree currently carries
unrelated in-flight edits to `src/core/shanten*` from other tickets — record
their pass/fail state now).

- **Verify**: note the baseline result; proceed regardless (this ticket touches
  neither core nor tests), but the review must not claim credit or blame for
  pre-existing state.

### Step 2 — Add the gated motion CSS to `Table.svelte`

Append the motion section from structure.md to the end of the `<style>` block:
one `@media (prefers-reduced-motion: no-preference)` block, `.pond li` and
`.drawn` each getting `transition: opacity 180ms ease-out, transform 180ms
ease-out` plus their `@starting-style` pre-insertion states (pond: fade +
`translateY(-0.4rem)` drop-in; drawn: fade + `translateY(0.35rem)` rise-in).

- **Verify**: `git diff src/app/Table.svelte` shows changes only between
  `<style>` and `</style>`; `git status` shows no other `src/` file touched.

### Step 3 — Static gates (the AC's testable clauses)

- `just check` — svelte-check + tsc pass (AC: "svelte-check passes").
- `just test` — full vitest suite; `app.ssr.test.ts` and `drive.test.ts` stay
  green (AC: SSR assertions unaffected).
- `just build` — single-file gate passes; grep `dist/index.html` for
  `@starting-style` and `prefers-reduced-motion` to confirm the rules survived
  the Vite/esbuild CSS pipeline un-mangled and inside the media gate.

### Step 4 — Empirical motion verification

vitest has no layout/animation engine, so this is eyes-on by construction
(same posture as T-007-02-01/-02's geometry checks):

- Headless-Chrome harness against the built `dist/index.html` (the proven
  scratchpad pattern: iframe at 360×780 + auto-player), or `just dev`:
  - a bot discard landing in a pond shows the ~180ms drop-and-fade settle;
  - the player's draw shows the rise-and-fade into the drawn slot;
  - pacing: each settle completes before the next 250ms drive tick.
  - If full visual capture is impractical headlessly, the fallback empirical
    check is a DOM probe: `getComputedStyle` on a freshly inserted pond `li`
    reporting a live `transition` and mid-flight `opacity < 1` on the
    insertion frame.
- Reduced-motion pass: re-run with `prefers-reduced-motion: reduce` emulated
  (CDP `Emulation.setEmulatedMedia` or DevTools rendering toggle) — computed
  `transition` on `.pond li` must be the initial none/0s value; tiles appear
  instantly.

### Step 5 — Update progress.md, commit

Single atomic commit: the `Table.svelte` style section + the RDSPI artifacts
for this ticket.

- Message shape (house style, cf. `git log`):
  `T-007-03-01: draw + discard-to-pond settle — @starting-style transitions`
- **Care**: other lisa threads share this branch; commit only this ticket's
  files (`src/app/Table.svelte`, `docs/active/work/T-007-03-01/`), never the
  unrelated modified tickets/core files in the tree.

### Step 6 — Review artifact

Write `review.md`: what changed, gate results verbatim, coverage assessment,
open concerns (tedashi pop, `.claimed` transition prepayment, browser floor).

## Testing strategy

| Concern | How verified | New tests? |
|---|---|---|
| SSR output unchanged in every asserted respect | existing `app.ssr.test.ts` (36 assertions over labels/tokens/order) | none — CSS cannot reach the asserted surface |
| Tap→discard mapping | existing `drive.test.ts`; deep guard is T-007-03-03's deliverable | none here |
| svelte-check + tsc | `just check` | n/a |
| Rules survive build + size gate | `just build` + grep dist | n/a (script gate exists) |
| Motion looks right / reduced-motion is a no-op | empirical (Step 4) | not automatable in this harness |

No new unit tests: the diff is unreachable from the jsdom/SSR test surface, and
inventing a CSS-string-matching test would pin implementation, not behavior —
the epic's correctness risk (tap mapping) already has a dedicated ticket.

## Rollback / adjustment points

- Any static gate failure at Step 3 → the diff is 15 lines in one block;
  investigate compiler output first (the Research spike says it compiles), then
  minifier output. Worst case: fall back is *not* option B (keyframes — AC
  letter) but shrinking to opacity-only transitions.
- Motion reads wrong at Step 4 (too subtle / too springy) → tune the two
  literals (duration within 150–250ms, displacement ≤0.5rem); re-run Step 3.

## Definition of done (AC ↔ evidence)

- Draw + discard animate ~150–250ms → 180ms transitions, Step 4 observation.
- CSS transitions only, no library/dependency → diff inspection: style-only,
  lockfile untouched.
- Disabled under prefers-reduced-motion → media-gated opt-in + Step 4 emulation.
- SSR unchanged, svelte-check passes → Steps 3's `just test` + `just check`.
