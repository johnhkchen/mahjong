# Review — T-009-01-01 riichi-declaration-lock-and-stick

## 1. Summary

Implements the riichi declaration mechanic end to end in the engine (`src/core/`
only — no `src/app/` changes, per S-009-01/S-009-03's split): a new atomic
`riichi` `HandAction` (declare + discard in one motion), the seat lock it
produces (forced tsumogiri, no calls except ron, no kan), the 1000-point stick
and table pot it moves, the pot's payout to the next winner, and its carry
through a ryuukyoku via `game.ts`'s `foldGame`. **Explicitly out of scope**
(separate, dependent tickets): the riichi/double-riichi/ippatsu yaku family and
ura-dora (T-009-01-02), temporary/riichi furiten completion (T-009-01-03), and
the riichi property suite (T-009-01-04) — this ticket's tests are example-based/
mined, matching this codebase's established per-mechanic-ticket convention.

Eight commits, each independently green (`just test` + `just check`):

1. `e3b29e3` — extract `performDiscard` from `record.ts`'s `discard` case (pure
   refactor, no behavior change), so riichi's own discard tail can share it.
2. `5acc892` — `RiichiContext`/`RIICHI_STICK`, and `TableState`'s new `riichi`/
   `pot`/`scoresIn` fields, defaulted so every existing `foldRecord(record)`
   call site keeps compiling and folding unchanged.
3. `6f5271c` — the `riichi` `HandAction` and `applyRiichi`'s nine-guard fold,
   plus a fold-time forced-tsumogiri guard on the ordinary `discard` case
   (found necessary during implementation, not anticipated in Design/Structure
   — see §3).
4. `cb966ab` — `legalActions` offers riichi and withdraws a locked seat's
   claim/kan offers (ron excepted); fixes two test-local `isCall` helpers and
   re-mines trajectory-shift fallout (see §3).
5. `f0fd12e` — `settlementOf`/`scoreBreakdownOf` apply the stick/pot overlay
   (also finalizes an unrelated concurrent thread's uncommitted T-008-03-01
   work it was inseparably interleaved with — see §3).
6. `e5cd6ec` — `game.ts` threads `scoresIn`/`potIn` per hand and exposes
   `GameState.pot`.
7. `1591400` — `SeatView` exposes `riichi`/`pot` as public facts.
8. `8ab6e1b` — fixes one property test the Step 8 confirmation pass caught
   (see §3).
9. `ad6e8c2` — fixes a second Step 8 finding: `dynamics.test.ts`'s end-of-game
   action-count identities didn't account for a riichi action performing a
   discard (see §3).

## 2. Files changed

Core (all in `src/core/`, no `src/app/` touched by this ticket's own work):
`record.ts`, `legal.ts`, `settlement.ts`, `game.ts`, `seatview.ts` — the
five-file surface `structure.md` planned, unchanged in shape. Test files
widened: `record.test.ts`, `legal.test.ts`, `legal.win.test.ts`,
`settlement.test.ts`, `settlement.property.test.ts`, `game.test.ts`,
`seatview.test.ts`, `seatview.fairplay.test.ts`, `dynamics.test.ts`,
`policy.test.ts`, and (one assertion) `src/app/drive.test.ts`. No new files.

`docs/active/work/T-009-01-01/` holds all six phase artifacts.

## 3. Notable deviations from Design/Structure (all documented live in
progress.md; summarized here for the handoff)

- **A fold-time forced-tsumogiri guard record.ts needed that Design's Decision
  4 didn't name.** Design only covered `legalActions` withholding the OFFER;
  without an independent fold-time check, `record.ts` alone would silently
  accept an illegal post-lock tedashi discard handed to it directly, bypassing
  legality entirely — inconsistent with every other rule in this fold, all of
  which are enforced at the fold, not just the offer.
- **Riichi offers shift every enumeration index after them — expected, but it
  broke four hardcoded positional test assertions and two pinned mined-seed
  corpora.** `legal.ts`'s own doc-comment names this exact consequence in
  advance ("riichi tickets grow this enumeration... shifts indices"). Fixed:
  two `isCall` test helpers that misclassified `riichi` as a call (it's a
  discard-form action); `WIN_CARRIER_SEEDS` re-mined (2 of 8 carriers now land
  in ryuukyoku under the new offer set — replaced, not just widened); two
  `offered[N]` assertions in `legal.win.test.ts`/`drive.test.ts` updated to
  their new, re-verified indices. All changes are re-derivations against the
  real engine, never hand-guessed.
- **Two genuine test-assertion gaps surfaced only on Step 8's un-seeded
  re-runs**, both places a bug could have shipped silently if the confirmation
  pass had been skipped — validates the RDSPI phase rule's rationale for
  always running it:
  1. `legal.test.ts`'s tail-ordering property ("tsumo, then kans") didn't
     account for a leading riichi block.
  2. `dynamics.test.ts`'s `expectEndIdentities` (draws/discards/melds
     arithmetic over a randomly-sampled legal game) didn't count a riichi
     action as performing a discard, undercounting whenever `playRecord`'s
     uniform sampling happened to pick one.
  Both fixed; re-run isolated 8+ times and the full suite repeatedly with no
  recurrence.
- **A third, independent thread (T-009-01-03, temporary/riichi furiten,
  `depends_on: [T-009-01-01]`) began actively editing `record.ts`/`legal.ts`/
  `yaku.ts` in this same working directory partway through Step 8**, per
  Lisa's documented multi-thread-one-branch concurrency model — apparently
  triggered once this ticket's own artifacts reached "implement" phase, ahead
  of this ticket's final commits landing. This caused several `just test` runs
  against the shared working tree to fail transiently: their in-progress
  furiten work changes which rons legality offers, which shifts trajectories
  in `WIN_CARRIER_SEEDS` and the greedy/win-eager corpora this ticket mined —
  THEIR re-mining to do (their own dependent ticket), not a defect here.
  Verified this ticket's work is unaffected: checked out commit `8ab6e1b`
  (this ticket's final state) into an isolated `git worktree` (untouched by
  the concurrent thread) and ran the full suite there — **830/830 pass
  cleanly**. No `git reset`/`stash` was left applied to the shared working
  tree; the worktree was removed after verification. A human reviewer should
  expect the shared working tree to look unsettled until T-009-01-03's own
  thread finishes and commits — that instability is not this review's to
  resolve.
- **`settlement.ts`/`settlement.test.ts` commit (5) is NOT scoped to this
  ticket alone.** Those two files already carried a separate, still-in-progress
  thread's uncommitted T-008-03-01 work (`ScoreBreakdown`/`scoreBreakdownOf`)
  before this session started (multiple Lisa threads share one branch, per
  rdspi-workflow.md's concurrency model). This ticket's own design requires
  `scoreBreakdownOf` to apply the identical stick/pot overlay `settlementOf`
  does, so the new code landed INSIDE their newly-added functions — checked via
  `git diff` before committing, and confirmed not separable by hunk. That
  commit therefore finalizes both tickets' work together; every other commit
  in this series was checked the same way and left any adjacent WIP untouched
  (`git add -p` where separable).

## 4. Test coverage

- **record.ts** (`record.test.ts`, new `describe('riichi declaration folds')`):
  the happy-path lock/pot/discard-tail mutation, context defaulting and
  potIn-carry-through, forced-tsumogiri enforcement, and all five named illegal
  cases (already-locked, open hand, noten, <1000 points, no draws left) — each
  against a real mined seed (100) or a real chi fixture (seed 1), never a
  hand-built `TableState`.
- **legal.ts** (`legal.test.ts`, new `describe('riichi offers')`): riichi
  offers alongside unchanged discards; a locked seat's reduced offer set
  (drawn-tile discard + tsumo only); claim suppression at a mined witness where
  the locked seat provably holds a pon-qualifying pair yet nothing is offered
  beyond `ron`/`draw`. The existing generic "every offered action folds"
  property automatically exercises `riichi` with no new property code.
- **settlement.ts**: hand-authored fixtures pinning exact numbers for a riichi
  ron winner recovering its stick plus a multi-seat pot, a no-riichi control
  (pre-ticket behavior unchanged, still zero-sum), a riichi ryuukyoku (stick
  deducted, pot untouched), and an equality check that `scoreBreakdownOf` and
  `settlementOf` never diverge.
- **game.ts**: a two-hand fixture (real mined seed, riichi declared, hand ends
  in ryuukyoku) proving `GameState.pot` carries and `scoresIn` remaps correctly
  into hand 2's `TableState`; a fresh-game control confirming zero pot / default
  scores when no riichi ever folds.
- **seatview.ts**: the existing generic public-facts property extended with
  `riichi`/`pot`; the fairplay hidden-tile-permutation suite re-run unmodified
  (neither field carries tile identity) and confirmed still green.
- **Regression**: `selfplay.test.ts`, `dynamics.test.ts`,
  `game.dynamics.test.ts`, `policy.test.ts`, `purity.test.ts` all pass
  unmodified in behavior (only the two `isCall` fixes and the one
  tail-ordering property fix touched these files, all mechanical). Confirmed
  by running the full suite multiple times (property tests are unseeded).

## 5. Open concerns / known gaps (for a human reviewer, and for the
dependent tickets already scoped to close them)

- **No dedicated property suite for riichi itself** — by design, deferred to
  T-009-01-04, which needs the yaku/furiten tickets landed first to test
  meaningfully (its own AC covers pricing and furiten interaction this ticket
  doesn't touch).
- **`legal.win.test.ts` has no NEW ron-still-offered-under-lock test** — the
  suppression is proven negatively (claims/kans absent) at the mined witness in
  `legal.test.ts`, and `ronOffers` itself is code-unchanged by this ticket, but
  there's no fixture positively confirming a locked seat's ron still folds. Low
  risk (the code path is literally untouched), flagged rather than silently
  skipped.
- **`RiichiContext`/`scoresIn` is new fold-input surface** — a standalone,
  stored `HandRecord` (outside its `GameRecord`) can no longer fully determine
  riichi legality in isolation once a game has non-starting scores; replaying
  one hand alone defaults to a fresh game's scores. This matches how a lone
  `HandRecord` already couldn't reproduce dealer/score history before this
  ticket either (that's `GameRecord`'s job) — noted in design.md as a
  considered tradeoff, not a regression.
- **The settlement.ts commit's scope note (§3)** is worth a maintainer's eye:
  it bundles a second ticket's (T-008-03-01) finished-but-uncommitted work.
  Nothing is untested or unreviewed-in-effect (both tickets' code is fully
  covered by the suite), but the commit boundary doesn't match ticket
  boundaries for that one file pair.
