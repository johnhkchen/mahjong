# T-008-01-04 — scoring-property-grid — Progress

## Completed

**Step 1** — exported `baseOf`, `roundUp100`, `ronDeltas`, `tsumoDeltas` from
`src/core/settlement.ts` (four `export` keywords, one header sentence). Committed
separately: `2c5205d`. `just check`/`just test` green before proceeding.

**Steps 2-7** — `src/core/settlement.property.test.ts` created with all six sections
(§A han×fu grid, §B roundUp100 boundaries, §C payment-split grid, §D zero-sum
conservation, §E fu invariants, §F dora-gate monotonicity). Committed as one commit
(`8239d46`) rather than plan.md's six separate commits — see Deviations below.

## Deviations from plan.md

1. **Steps 2-7 landed as one commit, not six.** plan.md sequenced the file's six
   sections as independently committable steps. In practice the sections share enough
   local infrastructure (`h()`... actually unused, see below; `SET_CANDIDATES`,
   `buildTenpaiParts`, `PINFU_RUN_CANDIDATES`) and two of the sections needed rework
   after the FIRST full-file test run (see #2, #3 below) that splitting into six
   commits would have meant committing intermediate broken states or rewriting commits
   after the fact. One commit for the whole file, after every section passed together,
   was the more honest history.

2. **The general `h()` mpsz-sugar helper was planned (structure.md §"Shared local
   helpers") but never needed.** Every hand this file builds is assembled from kind
   indices via the trimmed `buildWinner`/`buildMelds`/`buildTenpaiParts` toolkit, not
   from mpsz string literals — no fixture in this file is hand-typed as a string, so
   the sugar function had no caller. Left out rather than added dead.

3. **The chiitoitsu and pinfu fu-invariant clauses needed dedicated generators, not
   the general `winContextParamsArb`.** First full run of §E surfaced two real gaps
   against plan.md's design:
   - Chiitoitsu shapes essentially never emerge by coincidence from the general
     triplet/run `buildTenpaiParts` construction (0 hits across 200 runs) — added a
     dedicated seven-distinct-pairs generator (a Fisher-Yates shuffle of all 34 kinds,
     take 7) instead.
   - Pinfu shapes are similarly rare by coincidence — added a dedicated all-runs
     generator with a designated ryanmen-completing run.

4. **The pinfu generator surfaced a genuine fu.ts edge case (THE WAIT-ATTRIBUTION
   TRAP), not a test bug**, and needed a scope decision beyond "make the test pass."
   See review.md's "Open concerns" section — this is the most substantive finding of
   the whole ticket and is flagged there for a human reviewer, not silently patched.

5. **§F's dora-gate property originally asserted `yakuOf(win).toContain('menzen-
   tsumo')`** as its anti-vacuity precondition, which is FALSE whenever a yakuman also
   fires (yakuOf's supersession rule discards the standard-yaku union, including
   menzen-tsumo, in favor of yakuman names only). Fixed to assert
   `yakuOf(win).length > 0` instead — the actually-true invariant for a closed
   self-draw (either menzen-tsumo fires via the standard-yaku union, or some yakuman
   fires and supersedes it; either way the list is non-empty). No change to
   settlement.ts or yakuman.ts — this was purely a wrong test assertion, corrected
   before the first commit (never landed broken).

None of these deviations touch production code beyond the four `export` keywords
Step 1 always planned. `fu.ts`, `han.ts`, `yaku.ts`, `yakuman.ts`, `agari.ts`,
`record.ts` are unmodified, as structure.md specified.

## Verification

`just check` — 0 errors, 0 warnings, 187 files (up from 184 before this ticket — the
new test file plus a concurrently-landed sibling ticket's `game.ts`/`game.test.ts`,
see below).

`just test` — 783 tests passed across 30 files (up from 659/28 before this ticket).
This ticket's own file contributes 105 tests (58 han×fu grid rows, 9 roundUp100 rows,
32 payment-split rows, 1 zero-sum property, 3 fu-invariant properties, 1 dora-gate
property, plus the property blocks' own internal `numRuns` iterations counted as
part of each `it()`, not as separate top-level tests).

## Concurrent work observed, not touched

Mid-implementation, a sibling thread landed commit `682538d` ("Add game.ts:
GameRecord/GameState fold with dealer rotation (T-008-02-01)"), adding
`src/core/game.ts`/`game.test.ts` and a `game` barrel-export line to `src/core/
index.ts` — the RDSPI workflow's documented concurrency model (multiple threads on
one branch, no coordination needed). This ticket's own commits touch only
`settlement.ts` and the new `settlement.property.test.ts`; `index.ts` was not
touched by this ticket (it already barrelled `settlement.ts`'s exports before this
ticket started, so the four newly-exported names needed no barrel change). The
ticket `.md` files under `docs/active/tickets/` show as modified in `git status` from
this concurrent activity (Lisa's own phase-tracking, per the workflow rules) — left
untouched, as instructed.

## Remaining

None — all six RDSPI phases for this ticket are complete. Review follows.
