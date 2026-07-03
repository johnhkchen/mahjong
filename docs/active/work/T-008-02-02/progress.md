# T-008-02-02 — multi-hand-dynamics-suite — Progress

## Done

Implemented `src/core/game.dynamics.test.ts` in one pass (plan.md's Steps 1-8 folded
together rather than committed incrementally — the file has no natural scaffold/logic split
that would make a partial version independently valuable, per plan.md's own commit-boundary
note), then verified against `just check`/`just test` (Step 9).

- `selfPlayHand` — the per-hand bot driver, ported from `selfplay.test.ts`'s `selfPlay`
  (trimmed to return only `HandRecord`).
- `playGame` — chains `HANDS_PER_GAME` (6) bot-driven hands from `handSeedOf(gameSeed, i)`.
- `nextExpectedDealer`/`expectedSeatWinds` — the independent restatement of `game.ts`'s own
  renchan/rotation rule and seat-wind arithmetic.
- `expectValidBoundary`/`walkGame` — the per-prefix boundary checker (conservation, fold
  purity, dealer/wind consistency) and its full-game walker.
- Three suites: a 20-seed deterministic corpus (with `renchanCount`/`rotationCount`/final-
  phase non-vacuity tallies), a byte-identical double-build replay check over the same
  corpus, and an `fc.integer` full-domain property (`numRuns: 8`).

## Deviation from plan.md

Plan.md's Steps 2-5 describe building `selfPlayHand`/`playGame`/the dealer restatement/
`expectValidBoundary` incrementally with throwaway smoke assertions between each, specifically
to isolate a plumbing bug to one seed before it's buried under fast-check shrinking. In
execution, the full file was written in one pass instead (each piece was straightforward
enough — direct ports of already-tested precedent shapes — that the incremental smoke-test
scaffolding was judged unnecessary overhead) and verified directly against the three real
suites, which passed on the first `vitest run` after fixing one type error (see below). No
correctness risk materialized from skipping the incremental step; flagged here per the
RDSPI workflow's "document the deviation and rationale before proceeding."

## One fix during verification

`just check` (Step 9, but caught immediately) flagged `playGame`'s local `hands` array as
`HandAction[][]` (mutable), which cannot receive `HandRecord['actions']` (`readonly
HandAction[]`) via `.push`. Retyped to `(readonly HandAction[])[]`. No other type errors.

## Verification results

- `npx vitest run src/core/game.dynamics.test.ts`: 3/3 passed, ~9s wall time (corpus 2.7s,
  byte-identical replay 5.3s, property 1.1s) — comfortably under each suite's explicit 60s
  timeout.
- `just check`: 188 files, 0 errors, 0 warnings.
- `just test` (full suite): 31 files, 786 tests, all passed (783 pre-existing + 3 new).
- `git status`/`git diff --stat`: only `src/core/game.dynamics.test.ts` is new; no other
  `src/` file touched. No leftover `console.log`/`.only`/`.skip` in the new file (grepped).

## Commit

One commit, `src/core/game.dynamics.test.ts` only (explicit path add, never `-A`) — the
`docs/active/tickets/*.md` frontmatter and `docs/active/work/*` directories touched by
sibling/prior Lisa threads in this working tree are left untouched, matching every prior
ticket's own precedent (`git log` shows no `docs/active/work/` path ever committed by an
implementing thread; only the `(T-ticket-id)`-suffixed code commit).

## Open items for review.md

None outstanding — proceeding to Review.
