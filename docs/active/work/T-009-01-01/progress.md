# Progress — T-009-01-01 riichi-declaration-lock-and-stick

Tracking plan.md's 8 steps. Updated as each completes.

- [x] Step 1 — record.ts: extract performDiscard (no behavior change)
- [x] Step 2 — record.ts: RiichiContext/pot/riichi/scoresIn fields, defaulted foldRecord
- [x] Step 3 — record.ts: riichi HandAction + applyRiichi (plus an unplanned fold-time
  forced-tsumogiri guard on the ordinary `discard` case — see structure.md's amendment)
- [x] Step 4 — legal.ts: riichiOffers + claim/kan suppression. Also required fixing
  two test-local `isCall` helpers (dynamics.test.ts, seatview.fairplay.test.ts) that
  misclassified `riichi` as a call, and re-mining WIN_CARRIER_SEEDS/two pinned
  `legal.win.test.ts`/`drive.test.ts` offered-index assertions — riichi offers shift
  every index after them, an explicitly documented, expected consequence (legal.ts's
  own doc-comment), not a regression. See progress notes below.
- [x] Step 5 — settlement.ts: riichi-stick deltas + pot payout. This commit also
  necessarily finalizes an unrelated in-flight thread's T-008-03-01 work
  (`ScoreBreakdown`/`scoreBreakdownOf`, already fully implemented, tested, and
  passing, just uncommitted) — see progress notes below for why.
- [x] Step 6 — game.ts: thread scoresIn/potIn/pot
- [x] Step 7 — seatview.ts: expose riichi/pot (also required widening
  policy.test.ts's hand-built `viewOf` SeatView fixture helper)
- [ ] Step 8 — full-suite confirmation pass

## Deviations from plan.md

- **Step 3** added a fold-time forced-tsumogiri guard on the ordinary `discard` case
  in `record.ts` that neither design.md nor structure.md's first pass named —
  design.md's Decision 4 only covered `legalActions` suppressing the OFFER; without
  a fold-time guard too, `record.ts` alone would have silently accepted a locked
  seat's tedashi discard if handed one directly, bypassing legality. Documented as
  an amendment in structure.md.
- **Step 4** surfaced index-shift fallout across four test files, exactly as
  legal.ts's own doc-comment anticipates ("riichi tickets grow this enumeration...
  shifts indices"), not scope creep:
  - `dynamics.test.ts` and `seatview.fairplay.test.ts` each have a test-local
    `isCall(action)` helper (`action.type !== 'draw' && ... !== 'ron'`) that
    misclassified a `riichi` offer as a call — fixed by excluding `'riichi'`
    explicitly in both (riichi is a discard-form action, not a call).
  - `WIN_CARRIER_SEEDS` (duplicated verbatim across those same two files) named 8
    seeds whose win-eager random driver reaches agari; seeds 100 and 731 no longer
    do under the new offer set (the RNG stream now samples riichi offers at points
    it previously didn't, diverting those two trajectories to ryuukyoku). Re-mined
    by the same scratchpad-scan convention the header names; replaced with two
    freshly-mined carriers (1072, 1268), rest kept, both files updated identically.
  - Two pinned offered-index assertions (`legal.win.test.ts`'s two tsumo-offer
    tests, `drive.test.ts`'s `winChoice` test) hardcoded "tsumo is the (N+1)th
    offer, right after the N discards" — now riichi offers for that same mined
    hand shape happen to qualify on EVERY one of the 14 discard candidates,
    pushing tsumo's index from 14/11 to 28/22. Re-verified against `legalActions`
    directly, not hand-derived; updated in place with the new indices documented.
- **Step 5**: `settlement.ts`/`settlement.test.ts` already carried a substantial
  uncommitted diff from a different, still-in-progress thread (T-008-03-01's
  `ScoreBreakdown`/`scoreBreakdownOf` score-breakdown screen — visible in `git
  status` since before this session started; the RDSPI concurrency model runs
  multiple threads on one branch, file-locked at commit time, per
  rdspi-workflow.md). This ticket's design (research.md §7, design.md Decision 6)
  requires `scoreBreakdownOf` to apply the exact same riichi-stick/pot overlay
  `settlementOf` does, so the two edits are not just adjacent but INTERLEAVED —
  new lines inside their newly-added `bestReadingOf`/`scoreBreakdownOf`/
  `ScoreBreakdown` code, not a separable hunk. `git diff` confirms this (checked
  before committing): every hunk mixes their additions with mine at the line
  level. Earlier steps (2, 4) touched these same two files for unrelated reasons
  and were cleanly separable via `git add -p`, leaving their WIP untouched; this
  step's changes are not, so this commit finalizes their T-008-03-01 work
  alongside T-009-01-01's own — both fully tested (`just test`/`just check`
  green), nothing lost, but a human reviewer should know the commit's diff spans
  two tickets' worth of change for this reason.
