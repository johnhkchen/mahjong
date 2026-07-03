# Design: T-009-01-03 furiten-completion

## Decision

Track two new Seat-indexed boolean tuples on `TableState`, mutated incrementally
during the fold (same idiom as `riichi`), and OR them into `legal.ts`'s existing
`discardFuriten` gate inside `ronOffers`. No change to `applyRon` (the divergence
persists unchanged), no change to `SeatView` (out of scope per research).

```ts
/** Sealed until the seat's own next draw (wall or rinshan) — a passed win. */
tempFuriten: readonly [boolean, boolean, boolean, boolean]
/** Sealed for the rest of the hand — a passed win while locked in riichi. */
riichiFuriten: readonly [boolean, boolean, boolean, boolean]
```

Both start `[false, false, false, false]` in `foldRecord`'s initial state.

### Setting: at the single discard choke point

Inside `performDiscard` (after the tile is pushed to the discarder's pond, before the
phase/turn tail — so both the open-window arm and the ryuukyoku-ending arm are
covered identically), loop the three non-discarding seats and check, against THEIR
CURRENT hand/melds, whether the just-discarded tile completes their hand with a yaku
(a `record.ts`-local restatement of `applyWinTail`'s `yakuOf`-try/catch idiom, source
`'discard'`, `lastTile: state.live.length === 0`). Any seat for whom this is true just
had a win pass unclaimed (the log's next action, whatever it is, is not that seat's
ron — if it WERE, `applyRon` would end the hand before this matters again): seal
`tempFuriten[thatSeat] = true` always, and additionally `riichiFuriten[thatSeat] =
true` iff `state.riichi[thatSeat]` is already true at this moment.

### Clearing: at the seat's own next draw

`tempFuriten[seat] = false` at the two draw sites: `applyAction`'s `'draw'` case
(right after `state.drawn = state.live.shift()!`) and `applyKanTail` (right after
`state.drawn = state.dead.shift()!`, using `state.turn`, which is always the
kan-performing seat at that point). `riichiFuriten` is never cleared anywhere —
permanent once set.

### Reading: `legal.ts`'s `ronOffers`

Replace `if (discardFuriten(state, seat)) continue` with a combined check —
`discardFuriten` stays exactly as it is (self-pond, on-the-fly), OR'd with the two
fold-tracked fields read straight off `state`. `ronOffers` is the single function both
the open-window and houtei/ryuukyoku arms of `legalActions` call, so one edit covers
both, matching how `discardFuriten` already does.

## Alternatives considered

**A. Recompute temp furiten on the fly from `ponds`, widened to ALL seats' ponds (not
just the seat's own).** Rejected: a seat's WAIT can change turn to turn before riichi
locks it (tedashi reshapes the hand), so "was tile X, discarded N turns ago, in my wait
at THAT time" cannot be answered from today's snapshot — it needs the wait as it stood
at the moment of the historical discard, which only a forward fold has. This is also
why `riichi`/`pot` are carried fields and not recomputed, and this ticket's two furiten
kinds are the same shape of fact.

**B. A single combined `furiten: readonly [boolean,x4]` field (temp ∪ riichi ∪ basic),
instead of two.** Rejected: the ACs require independently pinning three distinct
temporal behaviors (permanent/self-discard already exists; temp clears on next draw;
riichi never clears) — a single collapsed boolean can't be asserted against
independently in tests (you couldn't distinguish "cleared because temp expired" from
"never was riichi-sealed"). Keeping `tempFuriten`/`riichiFuriten` separate (with
`discardFuriten` staying a third, on-the-fly source) lets each test assert exactly the
fact the AC names, and lets `ronOffers` compose all three explicitly.

**C. Record "pass" as an explicit new HandAction (e.g. `{ type: 'pass', seat }`) so the
log states furiten-triggering events directly, instead of deriving them.** Rejected
outright by the ticket text itself ("the log records no passes; ... is
reconstructible") — this would also break the frozen `HandAction` contract's minimalism
(the vocabulary only ever grows for things a player DOES; declining is the default,
never logged, mirroring how `draw` records no tile and relies on wall-order authority).

**D. Compute temp/riichi furiten lazily in `legal.ts` by replaying the record from
scratch each call.** Rejected: `legalActions` runs at every fold step (per its own
doc-comment, "a 34-kind scan and legalActions runs at every fold step" — the existing
performance-consciousness precedent for why `discardFuriten` is only evaluated for a
seat already known to complete the discard). Replaying the whole log on every
`legalActions` call is the opposite of that discipline, and duplicates exactly the
bookkeeping the fold does for free as it goes. The fold already visits every action
once; tracking these two facts costs O(1) extra work per discard, already paid for.

**E. Seal furiten at the point the window CLOSES (next action processed) rather than
at the point of discard itself.** Considered, functionally equivalent for every
reachable case (a ron ends the hand immediately, so no future action ever observes a
"too early" seal), but strictly more code: it requires touching `applyAction`'s
`'draw'` case, `applyClaim`, `applyDaiminkan` to detect "the previous window is
closing without seat X's ron" — three sites instead of one. Sealing at discard time
(the moment we know precisely which discard is in question and can evaluate every
other seat's current hand against it) is equivalent and cheaper: if the passing seat
DOES ron next, the hand ends in `agari` and `tempFuriten`/`riichiFuriten` are never
consulted again regardless of their value. Chosen for the single choke point.

## Mining plan for tests (Plan phase detail, decided here since it drives Structure)

Three fixture needs, all "seed-mined, cross-checked, never regenerate" per the existing
`legal.win.test.ts`/`record.test.ts` convention:

1. **Riichi furiten, permanent** — reuse `RIICHI_SEED = 100` from `record.test.ts`
   (seat 0 riichis on turn 0, tenpai). Mine which kind seat 0 now waits on, then find
   (via `scriptedTurns` continuation) the first later discard of that kind by another
   seat; confirm no ron is taken (pure tsumogiri never rons), confirm
   `riichiFuriten[0]` is true from that point through seat 0's own next draw and
   beyond (never clears), and that `tempFuriten[0]` is ALSO true immediately after the
   pass but would be masked/irrelevant once riichi's own permanent seal holds.
2. **Temporary furiten, clears on next draw, riichi NOT involved** — needs a fresh
   seed: a dealt-tenpai seat whose wait is passed by ANOTHER seat's discard before that
   seat's own pond ever contains a matching tile (so `discardFuriten` stays false
   throughout, isolating the temp-furiten mechanism). Mine via a small scratch script
   scanning candidate seeds/turn windows with the real engine once implemented
   (`state.tempFuriten` itself is the ground truth to search for — this is the
   documented codebase mining pattern, not a new one).
3. **Tsumo never sealed** — no new seed needed: reuse an existing tsumo-offer anchor
   (e.g. `RINSHAN_SEED`/`RON_SEED` from `legal.win.test.ts`) and additionally force
   `tempFuriten`/`riichiFuriten` true for that seat via a riichi-furiten-style prefix,
   then assert the tsumo offer is still present — proving `tsumoOffer`'s total absence
   of a furiten gate continues to hold under the new fields.

`legal.win.test.ts`'s `ronGates` oracle gets a one-line addition: fold in
`state.tempFuriten[seat] || state.riichiFuriten[seat]` alongside its existing
independently-recomputed self-pond `furiten` line. This is not circular — the two new
facts have exactly one authority (the fold itself, since only a forward walk can
compute them; see research's rejection of on-the-fly recomputation), so the test's job
for these two is to confirm `legal.ts` reads and composes them correctly, while the
self-pond portion stays independently recomputed as before.
