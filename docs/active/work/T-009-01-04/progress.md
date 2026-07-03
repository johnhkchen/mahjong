# Progress: T-009-01-04 riichi-property-suite

## Step 1 — driver + corpus sizing (scratch validation, per plan.md's checkpoint)

Ran a throwaway `tsx` scratch script (never committed, deleted after use) implementing
`bestDiscardOf`/`playRiichiEager` exactly as design.md specifies, against seeds
`[0, 60)`, `[0, 30)`, `[0, 16)`, `[0, 12)`.

**One real bug found in the driver during scratch validation** (not in production
code): the initial own-turn arm was `tsumo ?? riichi ?? bestDiscardOf(...)`, which
throws (`nextInt bound ... got 0`) at the very first pre-draw, no-window state (fresh
deal, seat 0's first decision point) — that state's only legal action is `draw`, and
`bestDiscardOf` found zero discard-type offers to choose among. Fixed by adding
`?? legal.find((a) => a.type === 'draw')` ahead of the `bestDiscardOf` fallback — a
call point is either genuinely a claim window (handled by the `isCallPoint` arm) or a
plain "must draw" point, and the own-turn arm needs to handle the latter explicitly.
Design.md's driver sketch is corrected to match (see design.md's own note below) —
this is a documentation-vs-implementation gap in the design phase, not a deviation
from an already-implemented plan.

**Sizing results:**
- `[0, 30)` (dynamics.test.ts's planned range): 10/30 seeds riichi-bearing, 7 agari + 3
  ryuukyoku among them — both endings represented, matches design.md's non-vacuity
  bet. Kept as planned.
- `[0, 12)` (legal.test.ts's original plan): only 3/12 riichi-bearing, all agari — no
  ryuukyoku among them. Widened to `[0, 16)`: 5/16 riichi-bearing, 4 agari + 1
  ryuukyoku — both endings. `legal.test.ts`'s own new test doesn't assert on endings
  (it only walks prefixes for the offered-folds check), but the wider range costs
  nothing and gives slightly better prefix diversity. Structure.md's "12 contiguous
  seeds" is revised to 16 (a Structure deviation, documented here rather than
  editing structure.md after the fact).
- Directly validated (scratch, over `[0, 30)`) BOTH of the properties Step 2 will
  encode as real tests before writing them: the tsumogiri-lock invariant (32 discard
  checks against locked-seat prior states, zero violations) and the points+pot
  conservation formula (30 ended states, zero violations). No production bug found —
  `record.ts`/`settlement.ts`/`game.ts` behave exactly as T-009-01-01/02's own
  research documented. Plan.md's "STOP if this reveals a real defect" branch does not
  trigger.

Proceeding with `RIICHI_CORPUS_SEEDS = [0, 30)` in `dynamics.test.ts` and
`RIICHI_AGREEMENT_SEEDS = [0, 16)` in `legal.test.ts`, per the validated design.

## Step 1 (real) — `dynamics.test.ts` edits

Implemented exactly per structure.md/design.md (corrected per the scratch findings
above): three new imports (`kindOf`, `scoreBreakdownOf`, `shanten`), `bestDiscardOf` +
`playRiichiEager` + `riichiCorpus`/`RIICHI_CORPUS_SEEDS` inserted after `winCorpus`,
`anyGameArb` widened with a third `riichiCorpusGameArb` arm, a new `describe('riichi
over random play (T-009-01-04)', ...)` block (three `it`s: non-vacuity/termination,
tsumogiri lock, points+pot conservation), a new `'riichi retarget'` mutation operator
in `'mutated sequences throw'`, and a `{ type: 'riichi', ... }` entry added to both
the `'append after ryuukyoku'` menu (`fc.nat(6)` widened to `fc.nat(7)` to match) and
the win-corpus `'after a win nothing is offered'` menu.

`vitest run src/core/dynamics.test.ts`: 23/23 passing (19 pre-existing + 4 new).
`just check`: 0 errors, 0 warnings.

## A pre-existing, unrelated regression discovered while running the full suite

Running the FULL `just test` (not just this ticket's file) surfaced 6 failing tests
across 4 files this ticket never touches: `src/app/drive.test.ts`, `src/core/
game.dynamics.test.ts` (both properties), `src/core/selfplay.test.ts` (two mined
anchors, seeds 25 and 13), `src/core/settlement.property.test.ts` (§D's zero-sum
check). Confirmed via `git stash` (stashing only this ticket's `dynamics.test.ts`
edit) that these same 6 tests fail identically on a clean, unmodified checkout of
`HEAD` — **not caused by this ticket's diff**.

Root cause, traced via `git log`: a concurrent sibling ticket, **T-009-02-01
(`bot-riichi-policy`, story S-009-02, `phase: implement`, `status: open` — actively
mid-flight, not done)**, landed five commits to `src/core/policy.ts` wiring
`discardPolicy` to actually declare riichi when offered — visibly DURING this
session (a `grep riichi src/core/policy.ts` early in Research returned zero hits; the
same grep after Step 1 shows `policy.ts`'s new riichi-declare branch, added by commits
`90b34c5`/`5926715`/`64a77f6`/`c32c1aa`, all tagged `T-009-02-01` in their messages).
This is Lisa's documented concurrency model working as designed (multiple threads on
one branch, T-009-01-02/03's own review.md sections already precedent this exact
kind of interleaving) — not a defect in this ticket's own work, and not this ticket's
file to fix (`policy.ts`, `selfplay.test.ts`, `game.dynamics.test.ts`,
`settlement.property.test.ts`, `drive.test.ts` are all outside structure.md's planned
diff, and squarely T-009-02-01's own thread's responsibility to reconcile as it
continues past `phase: implement`).

This is also a live confirmation of research.md's own prediction: `settlement.
property.test.ts`'s §D "deltas sum to zero" check was flagged there as STALE and
"passes VACUOUSLY with respect to riichi" under the discardPolicy behavior observed
AT RESEARCH TIME — now that `discardPolicy` genuinely declares riichi, that same
check is failing for exactly the reason research.md named (a riichi stick sits in an
unclaimed pot at ryuukyoku, breaking the pre-riichi "deltas sum to zero" invariant).
Not fixed here (out of scope per research.md's own scope call); flagged prominently
in review.md for human attention, since it now affects real (not hypothetical) CI
health today, whichever thread lands next.
