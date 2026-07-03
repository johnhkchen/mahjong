# Structure — T-011-02-03: window-legibility-regression-suite

## Files touched

### Prep commit (T-011-02-01 catch-up, not this ticket's own scope but landed first)

- `src/app/WindowNotice.svelte` (new, already written)
- `src/app/drive.ts` (modified, already written: `CallType`, `WindowOutcome`,
  `windowOutcome`)
- `src/app/dictionary.svelte.ts` (modified, already written: `callTerm`)
- `src/app/ClaimPrompt.svelte` (modified, already written: refactor to `callTerm`)
- `src/app/App.svelte` (modified, already written: `notice` state, cascade tier)
- `src/app/drive.test.ts` (modified, already written: `windowOutcome` unit tests)
- `src/app/app.terminology.coverage.ssr.test.ts` (modified, already written: outcome
  notice SSR cases)
- `src/app/claim-window-race.tap.svelte.test.ts` (modified, already written: first
  `// DEFECT:` flip)
- `src/app/window-outcome-notice.tap.svelte.test.ts` (new, already written)

No further edits to any of the above in this prep commit — it lands byte-identical
to the current working tree, split out only so history attributes it correctly
(design.md Decision 1).

### This ticket's own changes

1. **`src/app/drive.test.ts`** — modified. Two new `it`s inside the existing
   `describe('windowOutcome', ...)` block (no new `describe`, no restructuring):
   - `ron` outranking a player's `pon` — reuses the SAME two `HandAction` values the
     new interactive fixture (below) actually produces (`{type:'ron',seat:1,
     tile:82}` vs `{type:'pon',seat:0,tile:82,uses:[83,80]}`), so the unit test and
     the interactive proof are cross-checked against each other, not independently
     invented.
   - `ron` outranking another player's `ron` (atamahane) — one fully synthetic pair
     (design.md Decision 5), commented as such.

2. **`src/app/app.terminology.coverage.ssr.test.ts`** — modified. The existing
   `describe('outcome notice', ...)` block (currently 2 `it`s) gains 2 more, using
   the same hand-built-`WindowOutcome`-literal shape already established:
   - `{ winner: 1, winnerType: 'ron', playerType: 'pon' }` (cross-checked against the
     same mined fixture as `drive.test.ts`'s new case — a comment says so, same
     convention the file's existing pon/chi case already uses: "Matches
     drive.test.ts's own seed-3 race fixture").
   - `{ winner: 2, winnerType: 'ron', playerType: 'ron' }` (the atamahane case,
     synthetic, same one `drive.test.ts` uses).
   No structural change to the file's `for (const terminology of TERMINOLOGIES)`
   loop or its `EXPECTED`/`t` lookup table — these two `it`s live inside the existing
   loop body exactly like their two siblings.

3. **`src/app/window-outcome-notice.tap.svelte.test.ts`** — modified, the larger
   change:
   - Add `TERMINOLOGIES`/`EXPECTED`-style constants (mirroring
     `app.terminology.coverage.ssr.test.ts`'s own shape, duplicated locally per this
     repo's per-file convention — research.md's constraints) naming just the terms
     this file's assertions actually need: `pon`, `ron`, `west` no — **south**, not
     west (fixture correction: the new window's winner is seat 1 = South, not West;
     the file's existing fixtures use West/seed-344 language — the new describe
     block names its own seat correctly).
   - Wrap the file's existing top-level `it`s (the pass-case, the win-case) AND the
     new pon/ron describe block in `for (const terminology of TERMINOLOGIES) { ... }`
     — each generates its own `describe(`${terminology} terminology`, ...)`
     top-level block, following `app.terminology.coverage.ssr.test.ts`'s exact loop
     shape. `afterEach(() => setTerminology('romaji'))` added once, top-level (the
     file currently has no terminology dependency at all, so this is new).
   - New `describe` block: `the pon/ron window ends the hand mid-notice (seed 85,
     game seed 2654435812)` with one `it`: drives the generic decline-driver
     (a duplicated `step()`/`driveUntil()` pair, matching this file's own existing
     `step()` — design.md Decision 3 accepts this as a fourth near-identical copy)
     to the 78-action mark, taps the pon, asserts:
     - the notice's three labeled spans read South/ron/pon in the active
       terminology (via `windTerm(1)`/`callTerm('ron')`/`callTerm('pon')`, computed
       in-test, not hardcoded English — this is what makes the case terminology-
       parametrized rather than a romaji-only addition).
     - `table.phase` reaches `'agari'` — checked indirectly via the hand-end screen
       (`.hand-end` or the existing `nextHandButton`-style selector,
       `houtei-dismissal.tap.svelte.test.ts`'s own convention) being present
       alongside the still-live notice (both render simultaneously — App.svelte's
       console cascade and Table's HandEnd are structurally independent, research.md
       §App.svelte).
     - clicking "next hand" clears the notice (`noticeEl(target)` is null
       afterward) — the T-011-02-01 review.md gap this ticket closes (design.md
       Decision 4).

4. **`src/app/claim-window-race.tap.svelte.test.ts`** — modified. The file's single
   `it` (seed 344, chi race) is wrapped the same way: a `TERMINOLOGIES` loop around
   the existing `describe('the mixed claim-window race (seed 344)', ...)` block
   (renamed per-terminology, same pattern), assertions for the notice's three spans
   and the reopened prompt's aria-label switched from hardcoded English literals to
   `windTerm`/`callTerm`-derived expected strings computed at the top of each
   iteration. The DOM-structural assertions (`isConnected`, `!==`/`.className`
   equality) are terminology-independent and unchanged. `afterEach(() =>
   setTerminology('romaji'))` added.

## What does NOT change

- `src/core/` — untouched (design.md non-goals).
- `App.svelte`, `WindowNotice.svelte`, `ClaimPrompt.svelte`, `drive.ts`,
  `dictionary.svelte.ts` — no production code changes in this ticket; it is entirely
  new/parameterized test coverage over already-shipped behavior (matches
  T-011-01-01's own "characterization only" framing, inverted: this is the epic's
  closing regression pass, not a new feature).
- No shared test-helper module extracted (design.md Decision 3, research.md
  constraints).

## Ordering

Prep commit first (T-011-02-01, verbatim working-tree state) → `drive.test.ts` →
`app.terminology.coverage.ssr.test.ts` → `window-outcome-notice.tap.svelte.test.ts`
→ `claim-window-race.tap.svelte.test.ts`. Each step runnable/verifiable
independently (`npx vitest run <file>`), matching plan.md's own step boundaries.
