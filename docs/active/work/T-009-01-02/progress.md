# Progress — T-009-01-02 riichi-yaku-family-and-ippatsu-and-uradora

## Commit 1 — DONE (`cb2a73a`)

The yaku family (riichi/double-riichi/ippatsu) added to `yaku.ts`/`yakuman.ts`/
`han.ts`, catalog-complete and priced, but unreachable from any real fold yet
(three production `Win` assembly sites — `record.ts`'s `applyWinTail`, `legal.ts`'s
`winYaku`, `settlement.ts`'s `winOf` — carry inert `riichi: 'none', ippatsu: false`
placeholders). Every hand-built `WinContext`/`Win` fixture across the test suite
updated to default the same way (no behavior change to existing tests).
`settlement.ts`'s `pricedReadingCandidatesOf` wired for real (spreads `win.riichi`/
`win.ippatsu` — becomes live automatically once `winOf` stops being a placeholder
in commit 4). `just test`/`just check` green (two property-test timeouts under
full-parallel-suite load were confirmed environmental — both pass cleanly
re-run in isolation with a longer timeout).

**Deviation from plan.md, documented live:** `record.ts` is being edited
concurrently, uncommitted, by another live session's T-009-01-03 (furiten) work
(`completesWithYaku`, `sealPassedWins`, `tempFuriten`/`riichiFuriten` fields — none
of it this ticket's own scope). My commit-1 placeholder edits landed INSIDE their
new `completesWithYaku` function body (it independently restates a `Win`
assembly, per this codebase's duplication convention) — not separable by hunk, so
commit 1 necessarily bundles both threads' work for that one file, mirroring
T-009-01-01's own review.md precedent for `settlement.ts`/T-008-03-01. Nothing
untested: my own added lines are placeholders with no behavior (both branches
already covered by the unmodified pre-existing suite).

## Commit 2 — DONE (`c591c47`)

`TableState.doubleRiichi`/`ippatsu`/`uraDoraIndicators`/`uradora` added;
fold-time mutation wired at every point design.md Decision 4 named (`applyRiichi`,
`applyClaim`, the shared `applyKanTail`, the locked-seat arm of the `discard`
case). `applyWinTail` and (the concurrent thread's) `completesWithYaku` both read
real values now via a new shared `riichiStatusOf` helper — riichi/double-riichi/
ippatsu are reachable from a real fold for the first time. `record.test.ts` gained
nine new fixtures, all real mined seeds (a throwaway `tsx` scratchpad script, never
committed) verified end to end before being written into the suite.

**Deviations from plan.md, documented live:**
- The "double riichi negative: a call already folded" fixture (seed 63) could not
  be isolated to a single variable within a reasonable mining budget (~10k
  seed-attempts across several search strategies) — every seed found also failed
  the pond-emptiness condition simultaneously. The test comment says so explicitly
  and the pond-emptiness condition IS isolated cleanly by the separate seed-18
  fixture. Not a coverage gap in effect (both conditions are independently read
  in `applyRiichi`'s `double = isFirstDiscard && noCallsYet` expression, and
  `isFirstDiscard` alone is proven false-blocking by seed 18), but flagged per
  plan.md's own fallback allowance rather than silently accepted.
- The "ippatsu ron" scenario turned out, on reflection during mining, to only
  meaningfully mean "the DECLARING seat wins by ron" (real ippatsu is keyed to
  the declarer's own win, not a bystander's) — plan.md's phrasing ("a third seat
  winning") was imprecise; the design itself (WinContext.riichi/ippatsu keyed to
  the winner) was already correct. The mined seed-100 fixture proves exactly this
  (seat 0 declares, then rons seat 2's discard) and additionally happens to prove
  double-riichi + ippatsu stacking together in one real win, which plan.md had
  scoped as two separate fixtures — kept as one, since it is strictly stronger
  evidence, not less.

## Commit 3 — DONE (`2b7f06b`)

`legal.ts`'s `winYaku` wired for real via its own `riichiStatusOf` restatement.
Added a targeted confirmation test proving the offer/fold agreement holds at a
real riichi win (the mined double-riichi + ippatsu ron anchor).

## Commit 4 — DONE (`de1dd64`)

`settlement.ts`'s `winOf` wired for real. `PricedReading`/`ScoreBreakdown` gained
a separate `uraDoraHan` field (never merged into `doraHan` — design.md Decision 8:
a teaching-first game wants the two distinguishable). New fixtures in
`settlement.test.ts` pin the AC directly (plain riichi, double riichi, riichi+
ippatsu stacking, ura-dora gated on riichi and priced independently of ordinary
dora, and a pot-inclusive zero-sum-plus-pot regression).

**Deviation, documented live:** one PRE-EXISTING T-009-01-01 fixture
(`'riichi sticks and the pot' > ron: the winner recovers...`) broke — its winner
happened to also be `riichi[winner] = true`, and that seat's win now correctly
gains the `'riichi'` yaku it always should have (the fixture predates this
ticket, when riichi carried no pricing effect at all). Recomputed by hand
(4han/30fu/7700 → 5han/mangan/8000, the flat `han===5` tier) and updated in
place, with the derivation left in the test's own comment — not a coverage gap,
a genuine and expected consequence of wiring this ticket's pricing in.

This commit deliberately excludes the concurrent T-009-01-03 (furiten) thread's
still-uncommitted `record.test.ts` additions — left in the working tree,
untouched, for that thread's own commit. (Its `legal.win.test.ts` reorganization
WAS bundled in, unavoidably — same file, same interleaving already documented
in commit 1/2.)

## Commit 5 — DONE (confirmation pass, no production changes)

Ran the full suite three consecutive times after the concurrent T-009-01-03
thread committed its own furiten work (`4c74292`) — 863/863 passing all three
runs, no flakes, no regressions. No fix commit was needed. All five planned
commits are complete; see review.md for the handoff.
