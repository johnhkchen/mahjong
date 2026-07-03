# T-008-02-01 — game-record-and-continuation-fold — Progress

## Completed

- **Step 1-2 (scaffold + `foldGame`)**: `src/core/game.ts` written in full per structure.md
  — `Player`, `GameRecord`, `GameState` types; `STARTING_SCORE`/`GOLDEN_RATIO_32`
  constants; the private `playerOfSeat`/`seatOfPlayer`/`nextPlayer`/`windKindOf`/
  `seatWindsOf` helpers; the exported `handSeedOf` and `foldGame`. `just check` (tsc via
  `flox activate -- npm run check`) passes: 187 files, 0 errors.
- **Step 3 (seed mining)**: a throwaway `src/core/_mine.test.ts` (copying
  `selfplay.test.ts`'s bot-driven self-play shape, not imported) scanned `gameSeed`
  candidates `0..19999` and found, on the first pass:
  - `gameSeed = 0`: `handSeedOf(0, 0)` self-plays to a DEALER win (engine seat 0 rons
    seat 1, tile 100, `pinfu+tanyao+iipeikou`); `handSeedOf(0, 1)` (same game seed) also
    self-plays to a NON-DEALER win (engine seat 2 rons seat 0, tile 72, `pinfu`) — a
    single mined game seed covers both the standalone dealer-win case and the two-hand
    renchan-then-rotation composition case.
  - `gameSeed = 2`: `handSeedOf(2, 0)` self-plays to a NON-DEALER win (engine seat 2
    tsumo, tile 12, `yakuhai-hatsu`).
  - `gameSeed = 17`: `handSeedOf(17, 0)` self-plays to RYUUKYOKU.
  - Each hit's real `settlementOf` output was captured alongside (e.g.
    `[5800,-5800,0,0]` for the dealer-win case) as the ground truth `game.test.ts`'s
    score-accumulation assertions build on.
  - The throwaway file and its scratch JSON output were deleted after transcribing the
    mined action logs into `game.test.ts` as literals — no trace survives in the working
    tree (verified: `git status` shows no `_mine.test.ts`).
- **Step 4 (barrel export)**: `src/core/index.ts` gained one line, `export * from
  './game'`, appended last (after `settlement.ts`, matching the deepest-dependency-last
  convention).
- **Step 5 (`game.test.ts`)**: the full suite per structure.md §3 — `handSeedOf`
  determinism/spot-values/injectivity-sample/guard, single-hand base case + purity,
  dealer-win renchan, non-dealer-win rotation, ryuukyoku rotation, two-hand composition,
  and both guard-throw cases. **19/19 tests pass** (`npx vitest run
  src/core/game.test.ts`).
- **Step 6 (full-suite pass)**: `just check` is clean. `npx vitest run` surfaces exactly
  ONE unrelated failure — see "Deviation" below; every other file (including the new
  `game.test.ts`) passes: 782/783 tests green across 29/30 files.

## Deviation from the plan

**An unrelated, pre-existing test failure was found in `src/core/settlement.property.test.ts`
during the Step 6 full-suite pass — NOT caused by this ticket's changes, and left untouched.**
Investigation: `git status` shows `settlement.ts`, `settlement.property.test.ts`, and
`docs/active/work/T-008-01-04/` as modifications/untracked files that appeared DURING this
session, not authored by this ticket. `settlement.ts`'s diff adds a header comment naming
"T-008-01-04's grid suite" and exports three previously-private helpers
(`roundUp100`/`baseOf`/`ronDeltas`/`tsumoDeltas`) for that suite to call directly — this is
a sibling Lisa thread working concurrently on ticket T-008-01-04 (per rdspi-workflow.md's
Concurrency section: "Multiple threads work on the same branch"), not part of this
ticket's `depends_on: [T-008-01-03]` scope. Confirmed unrelated by reproducing the same
failure via `git stash` (which does not stash untracked files, so the sibling thread's
`settlement.property.test.ts` was still present and still failed identically with none of
this ticket's changes applied). No file this ticket touches (`game.ts`, `game.test.ts`,
`index.ts`'s one added line) is implicated. Left entirely alone — fixing another thread's
in-flight ticket is out of scope and would risk clobbering its uncommitted work.

## Remaining

None — all six plan steps are complete. Proceeding to Review.

## Commits

Scoped precisely to this ticket's own files (`git add` by explicit path, never `-A`), to
avoid capturing the concurrent T-008-01-04 thread's uncommitted `settlement.ts`/
`settlement.property.test.ts` changes or any ticket-frontmatter file Lisa manages:
1. `src/core/game.ts` — scaffold + `foldGame` (Steps 1-2).
2. `src/core/index.ts`, `src/core/game.test.ts` — barrel export + test suite (Steps 3-5).
