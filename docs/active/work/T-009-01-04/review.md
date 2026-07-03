# Review: T-009-01-04 riichi-property-suite

## Summary

Adds the dedicated riichi property pass over RANDOM-LEGAL trajectories the epic's own
prior review.md's named as the next ticket: "it can now exercise riichi/double-
riichi/ippatsu/ura-dora pricing over randomized play, which [T-009-01-02]'s fixtures
intentionally do not attempt (mined, directed scenarios only)." T-009-01-01/02/03
(declaration/lock/stick, yaku pricing, furiten) are all `phase: done`; this ticket adds
test coverage only — no production code in `src/core/{record,legal,settlement,game,
policy}.ts` was touched, and Implement found no real defect in any of them (the one
formula validated against real behavior — points+pot conservation — held on the first
scratch run, zero violations across 30 seeds).

Extends the two files the ticket text names ("dynamics/agreement suites... rather than
forking them") — no new test file, no shared test-utils module (matching this
codebase's own established no-shared-utils convention). A new MECHANICAL riichi-eager
driver (`playRiichiEager` + `bestDiscardOf`, a shanten-minimizing tie-break — NOT
`policy.ts`'s bots, which `dynamics.test.ts`'s own header explicitly puts out of scope
for its generators) is duplicated per file, trimmed to what each needs, following the
same "duplicate, don't import" precedent `keyOf`/`tsumogiriRecord` already set between
these two files.

## Files changed

Two test files only, both in `src/core/`:

- **`dynamics.test.ts`** (+189/-3): three new imports (`kindOf`, `scoreBreakdownOf`,
  `shanten`); `bestDiscardOf`/`playRiichiEager`/`RIICHI_CORPUS_SEEDS`/`riichiCorpus`
  inserted after the existing `winCorpus`; `anyGameArb` widened with a third
  `riichiCorpusGameArb` arm (strengthens every EXISTING mutation property, and the
  existing `'fold determinism over random play'` test, for riichi actions — no other
  edit needed for that); a new `describe('riichi over random play (T-009-01-04)', ...)`
  block (3 `it`s: non-vacuity+termination, tsumogiri-lock, points+pot conservation); a
  new `'riichi retarget'` mutation operator in `'mutated sequences throw'`; a
  `{ type: 'riichi', ... }` entry added to both the `'append after ryuukyoku'` menu
  (`fc.nat(6)` → `fc.nat(7)`) and the win-corpus `'after a win...'` menu.
- **`legal.test.ts`** (+98/-0): three new imports (`createRng`, `nextInt`, `shanten`);
  a trimmed duplicate of `bestDiscardOf`/`playRiichiEager` plus `RIICHI_AGREEMENT_
  SEEDS`/`riichiAgreementCorpus`, inserted after `ANCHORS`; one new test in the
  existing `describe('offered actions fold', ...)` block, walking every prefix of the
  new corpus.

`docs/active/work/T-009-01-04/` holds all six phase artifacts, including a corrected
driver sketch in design.md (a `?? draw` fallback the initial sketch omitted — found and
fixed during a scratch validation pass BEFORE any real test code was written; see
progress.md).

## Test coverage — mapped to the AC's five clauses

1. **Post-riichi discard = drawn tile**: `dynamics.test.ts`'s new "every locked seat's
   own discard..." property, walking every discard in the riichi corpus and reading
   the PRIOR fold's own `riichi`/`drawn` fields (never re-deriving `record.ts`'s own
   lock rule — there is no independent rule to restate, `state.riichi` IS the fact).
2. **Points + pot = 4×25000**: `dynamics.test.ts`'s new "scores plus the carried pot
   conserve..." property, restating `game.ts`'s own hand-to-hand carry rule
   (`pot = state.phase === 'agari' ? 0 : state.pot`) at the single-hand level against
   `scoreBreakdownOf`'s flat-25000 convention. A genuinely different, corrected claim
   from `settlement.property.test.ts`'s existing (and now, per §6 below, actually
   failing for an unrelated reason) "deltas sum to zero" check.
3. **Offered riichi folds / non-offered riichi throws**: split across both files —
   `legal.test.ts`'s new corpus-prefix-walking test (offered ⇒ folds, generalizing the
   file's own pre-existing tsumogiri-only-prefix version) and `dynamics.test.ts`'s new
   `'riichi retarget'` mutation operator (a discard rewritten as a same-tile riichi,
   `fc.pre`-filtered against the offered set, asserted absent + thrown — the
   `tile retarget`/`uses retarget` precedent applied to a type change). Also closed a
   real, pre-existing gap: neither "action after the hand ended" menu in
   `dynamics.test.ts` named `riichi` before this ticket (one didn't even name
   `tsumo`/`ron`) — both now do.
4. **Re-folds deeply equal**: FREE, as design.md predicted — widening `anyGameArb`
   automatically extends the existing `'fold determinism over random play'` property
   to riichi-bearing records; no new `it` was needed or added.
5. **Every game terminates**: the driver's own `ACTION_BOUND` throw-guard (the
   `playGreedy`/`playWinEager` precedent) converts non-termination into a loud failure;
   the new non-vacuity test additionally asserts every corpus record's ended `phase`
   is `'agari'` or `'ryuukyoku'`, alongside asserting BOTH endings occur among
   riichi-bearing records specifically (not just anywhere in the corpus).

**Corpus sizing** (empirically validated by a throwaway `tsx` scratch script, deleted
before any real test code was written — this codebase's own established mining
discipline): `dynamics.test.ts`'s 30-seed range carries 10 riichi-bearing seeds, 7
agari + 3 ryuukyoku; `legal.test.ts`'s 16-seed range (widened from an initial 12-seed
plan — see progress.md) carries 5, 4 agari + 1 ryuukyoku. Both non-vacuity assertions
pass; both are directly-checked facts, never fc statistics, matching this file's own
repeated "a zeroed tally must widen the corpus" discipline.

**Regression**: `vitest run src/core/dynamics.test.ts` — 23/23 (19 pre-existing + 4
new). `vitest run src/core/legal.test.ts` — 31/31 (30 pre-existing + 1 new). `just
check` — 0 errors, 0 warnings, 191 files. `just test` (full suite) — see §6 below for
the one caveat; every test in either of THIS ticket's two files passes.

## Notable deviations from Design/Structure (documented live in progress.md)

- **The driver's initial own-turn arm (`tsumo ?? riichi ?? bestDiscardOf`) threw on
  the very first pre-draw decision point** (a fresh deal's only legal action is
  `draw`, and `bestDiscardOf` found zero discard offers to choose among — `nextInt`
  bound 0). Found and fixed during scratch validation, BEFORE any test file was
  edited: added `?? legal.find((a) => a.type === 'draw')` ahead of the
  shanten-minimizing fallback. design.md's driver sketch was corrected in place to
  match (a design-phase documentation gap, not an implementation-phase deviation from
  an already-correct plan).
- **`legal.test.ts`'s corpus range widened from a planned 12 seeds to 16`** — the
  12-seed range carried only 3 riichi-bearing seeds, all ending in agari (no
  ryuukyoku); 16 seeds gives 5, both endings. structure.md's text was updated in place
  to match, per plan.md's own deviation protocol ("document whichever path was taken,
  and why, in progress.md as it happens").
- No other deviation from structure.md/plan.md — both files' edits landed exactly at
  the planned insertion points, in the planned order, as two independently-green
  units.

## Open concerns / known gaps

- **`bestDiscardOf`/`playRiichiEager` are duplicated verbatim between the two files**,
  per this codebase's own no-shared-test-utils convention (research.md/design.md's
  Decision B) — a future engine change to the driver's shape (e.g. a new own-turn
  offer type) needs editing in both places, the same maintenance cost every other
  cross-file duplicate here already carries (`keyOf`, `tsumogiriRecord`/`dealtLive`/
  `dealtDead`, the `selfPlay` family across three files).
- **The riichi corpus is call-sparse relative to `greedyCorpus`** (the call-point
  fallback is plain rng-uniform, not greedy) — open-hand riichi-ineligibility is
  exercised only incidentally, not guaranteed non-vacuous the way the two direct
  properties are. Not an AC gap (no clause asks for it specifically, and T-009-01-01's
  own fixtures already directly pin the "open hand cannot riichi" guard) — noted for a
  future ticket that might want it guaranteed.

## Critical issue for human attention — a pre-existing, concurrent-thread regression

Running the FULL `just test` (not just this ticket's two files) shows, consistently
across repeated runs, **6 failing tests across 4 files this ticket never touches**:
`src/app/drive.test.ts` (1), `src/core/game.dynamics.test.ts` (2), `src/core/
selfplay.test.ts` (2 mined anchors, seeds 25 and 13), `src/core/settlement.property.
test.ts` (§D's zero-sum check) — one repeat run additionally tripped a 7th, unseeded
`fc`-sampled failure elsewhere before reverting to the same stable 6 on the next run,
consistent with the SAME root cause below surfacing non-deterministically depending on
which random seed `fc.assert` happens to pick that run, not a second distinct defect.
**Confirmed, via `git stash` isolating only this ticket's diff, that the stable 6
fail identically on an unmodified checkout — not caused by this ticket.**

Root cause, traced via `git log`: **T-009-02-01 (`bot-riichi-policy`, story S-009-02,
currently `phase: implement` / `status: open` — actively mid-flight, not done)**, a
concurrent sibling thread under Lisa's documented concurrency model, landed five
commits to `src/core/policy.ts` DURING this session wiring `discardPolicy` to declare
riichi when offered (a `grep riichi src/core/policy.ts` early in this ticket's
Research phase returned zero hits; the identical grep now shows the new branch, added
by commits tagged `T-009-02-01` in their own messages). That change shifted real bot
trajectories enough to break two frozen mined `selfplay.test.ts` anchors and the two
`game.dynamics.test.ts`/`drive.test.ts` properties that drive real bot-vs-bot games —
and, notably, **confirms research.md's own prediction about `settlement.property.
test.ts`'s §D check**: research.md flagged it as stale and "passes VACUOUSLY with
respect to riichi" under the `discardPolicy` behavior observed at research time
(policy.ts had zero riichi references then); now that `discardPolicy` genuinely
declares riichi, that same check fails for exactly the reason research.md named (a
riichi stick sits in an unclaimed pot at ryuukyoku, breaking the pre-riichi "deltas
sum to zero" invariant this ticket's own new "points + pot" property states
correctly).

**Nothing here is this ticket's file to fix** — `policy.ts`, `selfplay.test.ts`,
`game.dynamics.test.ts`, `settlement.property.test.ts`, and `drive.test.ts` are all
outside structure.md's planned diff, and squarely T-009-02-01's own thread's
responsibility as it continues past `phase: implement`. Flagged here so a human
reviewer isn't confused by a red `just test` that has nothing to do with this diff,
and so `settlement.property.test.ts`'s own now-broken §D check gets picked up by
whichever thread reconciles it next (this ticket's own research.md already named the
CORRECT replacement formula, restated properly in `dynamics.test.ts`'s new "points +
pot" property, if that's useful groundwork for T-009-02-01 or a follow-up).
