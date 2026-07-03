# Review — T-009-02-02 riichi-dynamics-suite

## Summary

One file changed: `src/core/game.dynamics.test.ts` (commit `751ed5c`, +39/-3 lines). No
production code changed — `game.ts`, `record.ts`, `settlement.ts`, and `policy.ts` were
already correct (confirmed by research; the single-hand riichi/pot suites in
`dynamics.test.ts` already covered them). This ticket's entire deliverable is test code,
per plan.md's own "Testing strategy" section.

## What changed, concretely

1. **Fixed a live regression** in `expectValidBoundary`'s conservation check. It asserted
   `scores.reduce(+) === 4 * STARTING_SCORE`, which stopped holding the moment
   T-009-02-01 wired `discardPolicy` to declare riichi automatically (a locked seat's
   1000-point stick now legitimately sits in `state.pot`, unclaimed, at hand boundaries).
   Verified failing before this change (`expected 99000 to be 100000`, 2 of 3 tests red)
   and reproduced independently via `git stash`. Now reads
   `scores.reduce(+) + state.pot === 4 * STARTING_SCORE` — the corrected law
   `settlement.ts`'s own module header already documents.

2. **Added a dedicated pot-carry assertion**, independent of the conservation sum (AC's
   "including pot carries" is its own clause, not just a byproduct of the total). New
   helper `realPotAfter(gameSeed, hands)` walks every hand in a prefix from a fresh pot of
   0, using only each hand's own action log (counting `'riichi'` actions × `RIICHI_STICK`)
   and its own ended `.phase` (agari resets to 0, else carries) — independently
   re-derived, never reading `foldGame`'s own carry branch.

3. **Added a riichi non-vacuity tally** (`riichiHands` counter) to the existing
   `'multi-hand dynamics: corpus'` test, asserting `> 0` — closes the AC clause that
   riichi declarations must actually occur in the sample, not merely be possible.

Byte-identical replay and no-stalling coverage were already present and unaffected.

## A design deviation worth flagging

The first implementation of the pot-carry helper (`expectedPotCarry`, reading `.pot` off
an existing `FRESH_CONTEXT`-folded `endedState`) passed the fixed 20-seed corpus but
**failed intermittently on the fast-check property test** (~1 in 3-4 runs, different
counterexample seed each time, error always "expected N, received N + 1000 or + 2000").
Root cause: `FRESH_CONTEXT`'s `potIn: 0` is only correct for a game's first hand — once an
earlier hand's ryuukyoku carries a pot forward, that fold silently undercounts it. Fixed
by replacing it with `realPotAfter`, which walks the whole prefix rather than trusting a
single context-free fold. Re-verified 10 consecutive green runs after the fix (across two
batches, including forcing a wrong expected value to confirm the assertion is actually
live). Full account in `progress.md`.

**This is worth a second pair of eyes**, not because the fix looks wrong (it's re-derived
from first principles off the action log, and 10/10 runs plus a live typecheck pass
back it up), but because it was found by nondeterministic fast-check sampling rather than
the deterministic corpus — a residual, currently-untriggered variant of the same class of
bug could in principle still exist in an untested code path. No further such failures
surfaced in 10 additional runs, and the design (walking every hand's own log) has no
remaining unaccounted state, but this class of bug (context-defaulted fold silently wrong
for a downstream-only field) is exactly the kind that hides until a property test happens
to sample it.

## Test coverage

`npx vitest run src/core/game.dynamics.test.ts`: 3/3 passing, confirmed stable across 10
runs (property test included, 8 random `uint32` seeds per run). `just check`
(svelte-check + tsc): 0 errors, 0 warnings.

## Open concerns — pre-existing, NOT fixed here, flagged for human attention

`npx vitest run` (full suite) currently fails in three areas **unrelated to this
ticket's change** (verified via `git stash` — all three fail identically with
`game.dynamics.test.ts` reverted to its pre-ticket committed state):

- **`src/core/settlement.property.test.ts`** — its own zero-sum-delta property test
  (`"every random seed folds to an ended TableState whose four deltas sum to zero"`)
  deterministically fails (`expected -1000 to be 0`). Same root-cause class as what this
  ticket fixed (riichi stick pot not accounted for), but in a different, single-hand
  invariant this ticket's design.md explicitly scoped out. Needs its own ticket.
- **`src/core/selfplay.test.ts`** — two "mined anchor" frozen-seed fixtures (seed 25, seed
  13) deterministically fail. Almost certainly stale since T-009-02-01 changed
  `discardPolicy`'s default choice (riichi-eager) out from under frozen expected action
  counts/outcomes. Needs re-mining or its own ticket.
- **`src/app/app.riichi.tap.svelte.test.ts`** and **`src/app/drive.test.ts`** — app-layer
  failures. `src/app/App.svelte`, `src/app/drive.ts`, and `src/app/RiichiPrompt.svelte`
  are present as uncommitted, in-progress changes in this working tree that predate this
  session (T-009-03-01's own work, per `git log`) — evidently a concurrent thread's WIP
  per the RDSPI workflow's stated multi-thread-same-branch model, not something to touch
  from this ticket.

None of these block T-009-02-02's own AC, which is scoped to the game-level dynamics
suite and is now fully green and verified stable. But `just test` is not currently green
end to end, and a human (or Lisa) should route the `settlement.property.test.ts` /
`selfplay.test.ts` regressions to a ticket, since they were both introduced by
T-009-02-01 landing riichi-eager bot behavior and neither has a tracking ticket yet as
far as this review can tell.

## No other TODOs or known limitations

The three code changes are complete and match the ticket's AC clauses one-to-one: replays
already byte-identical (pre-existing, verified), conservation now pot-aware, pot-carry
independently asserted, riichi non-vacuity asserted, no-stalling already covered
(pre-existing, verified).
