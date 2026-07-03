# T-008-02-01 — game-record-and-continuation-fold — Plan

Ordered, independently-verifiable steps. Each is small enough to commit atomically.

## Step 1 — scaffold `src/core/game.ts`: types, constants, conversion helpers, `handSeedOf`

Write the module header, `Player`/`GameRecord`/`GameState` types, `STARTING_SCORE`/
`GOLDEN_RATIO_32` constants, the private `playerOfSeat`/`seatOfPlayer`/`nextPlayer`/
`windKindOf`/`seatWindsOf` helpers, and the exported `handSeedOf`. No `foldGame` yet.

**Verify:** `just check` (tsc) passes.

## Step 2 — `foldGame`

Implement the loop per structure.md §2/design.md Decision 4, including both guards
(empty `hands`, non-last unended hand). Barrel export not yet added.

**Verify:** `just check` passes.

## Step 3 — mine the seeds `game.test.ts` needs

Write a throwaway local script (a temporary `.test.ts` using `it.only` + `console.log`,
run via `npx vitest run`, per structure.md §4 — NOT committed) that:
1. Copies `selfplay.test.ts`'s `selfPlay(seed)` driver shape (own local copy in the
   throwaway file, not imported).
2. Scans small integer `gameSeed` candidates, computing `handSeedOf(gameSeed, 0)` (and, for
   the two-hand composition case, also `handSeedOf(gameSeed, 1)`), self-playing each
   derived seed, and reporting the first `gameSeed` whose hand-0 (and, where needed,
   hand-1) outcome matches each of: dealer win, non-dealer win, ryuukyoku, and (dealer win
   THEN non-dealer win) for the composition case.
3. For each hit, also print the actual `HandAction[]` array (`JSON.stringify`) so it can be
   pasted as a literal fixture, and the resulting `TableState.win`/`phase` for the
   hand-derived comment.

Delete the throwaway file once all four+ seeds are mined and pasted into notes for Step 5.

**Verify:** the throwaway script runs and prints hits; no repo file changes survive this
step (the mining script itself is never committed).

## Step 4 — barrel export

Add `export * from './game'` to `src/core/index.ts`, last line (deepest dependency chain
in the barrel — depends on both `record.ts` and `settlement.ts`).

**Verify:** `just check` passes (barrel re-export type-checks, no import cycle).

## Step 5 — `src/core/game.test.ts`

Write the full suite per structure.md §3, using the seeds/action logs mined in Step 3:
1. `handSeedOf` determinism, spot-value, injectivity-sample, and guard tests.
2. Single-hand base case + purity (`toEqual` on a double fold).
3. Dealer-win → renchan (mined case 3).
4. Non-dealer-win → rotation (mined case 4).
5. Ryuukyoku → rotation (mined case 5).
6. Two-hand composition, renchan then rotation (mined case 6).
7. Both guard-throw cases.

Every expected `scores`/`seatWinds` value is hand-computed in a comment BEFORE the
assertion, from `settlementOf`'s real (already-tested) output for the mined hand plus the
remap arithmetic — never reverse-engineered from `foldGame`'s own first-run output (the
`fu.test.ts`/`han.test.ts`/`settlement.test.ts` precedent, restated one layer up).

**Verify:** `npx vitest run src/core/game.test.ts` green in isolation first (fast
iteration on the mined fixtures), then the full suite (Step 6).

## Step 6 — full-suite verification pass

Re-run `just test` and `just check` from a clean state. Confirm:
- No `src/core/` file gained a DOM/Svelte import.
- `game.ts` exports exactly `Player`, `GameRecord`, `GameState`, `handSeedOf`, `foldGame`
  (spot check via a grep for `export` in `game.ts`) — the Player⇄Seat helpers and
  `seatWindsOf`/`STARTING_SCORE`/`GOLDEN_RATIO_32` stay module-private.
- No leftover throwaway mining file survives in the working tree.
- `record.ts`/`settlement.ts`/`deal.ts`/`yaku.ts` are byte-unchanged (`git diff --stat`
  shows only `game.ts`, `game.test.ts`, `index.ts`).

**Verify:** both commands exit 0; `git status`/`git diff --stat` confirm the file list.

## Testing strategy summary

- **Unit-only**, no DOM — matches every other `src/core/` suite.
- `handSeedOf` gets pure math coverage (determinism, spot arithmetic, injectivity sample,
  guard) with zero engine involvement — cheapest, highest-confidence layer.
- `foldGame` is tested through REAL bot-driven hands (a locally-duplicated self-play
  driver, per `selfplay.test.ts`'s own "don't share test statements" doctrine), with
  `gameSeed`s mined offline for the specific outcomes each scenario needs (the `win.test.ts`
  "fixtures were seed-mined" precedent) — this exercises the real `handSeedOf` → real
  `foldRecord` → real `settlementOf` chain end to end, not a lower-effort mock.
- Every numeric expectation (`scores`, `seatWinds`) is hand-derived in a comment from
  `settlementOf`'s real, already-tested output before the assertion.
- `just check` after Steps 1–2 (cheap, catches type drift early); `just test` is the Step
  5/6 gate.

## Commit boundaries

Target: (1) scaffold + `foldGame` (Steps 1–2, one commit — private surface, only jointly
verifiable once `game.test.ts` exists, matching `settlement.ts`'s own precedent of bundling
its scaffold-plus-logic commit), (2) barrel export + test suite green (Steps 3–5 folded
into one commit — the mining script itself produces no diff, so there is nothing to commit
separately for it), (3) Step 6's clean verification pass folded into commit 2 if nothing
surfaces (no separate empty commit, per the T-008-01-03 precedent).
