# Progress — T-009-01-01 riichi-declaration-lock-and-stick

Tracking plan.md's 8 steps. Updated as each completes.

- [x] Step 1 — record.ts: extract performDiscard (no behavior change)
- [x] Step 2 — record.ts: RiichiContext/pot/riichi/scoresIn fields, defaulted foldRecord
- [x] Step 3 — record.ts: riichi HandAction + applyRiichi (plus an unplanned fold-time
  forced-tsumogiri guard on the ordinary `discard` case — see structure.md's amendment)
- [ ] Step 4 — legal.ts: riichiOffers + claim/kan suppression
- [ ] Step 5 — settlement.ts: riichi-stick deltas + pot payout
- [ ] Step 6 — game.ts: thread scoresIn/potIn/pot
- [ ] Step 7 — seatview.ts: expose riichi/pot
- [ ] Step 8 — full-suite confirmation pass
