# Research: T-009-01-03 furiten-completion

## Ticket ask

Complete furiten per `legal.ts`'s own deferral (its header, line 24: "Temporary and
riichi furiten are the riichi ticket's extensions, not this rule"):

- **Temporary furiten**: a wait that passes unclaimed seals the seat's ron until its
  next draw (then unseals).
- **Riichi furiten**: the same pass while in riichi seals ron for the rest of the hand
  (never unseals).

Both are DERIVED from the record fold — the log records no `pass` action; "a winning
discard went by unclaimed" is reconstructed from the sequence of actions, not stored
directly. Both must extend `discardFuriten`'s gate in `ronOffers` without replacing it.

## Existing furiten: `discardFuriten` (basic/permanent, self-pond)

`legal.ts:107` — `discardFuriten(state, seat)`: true iff `waits(hand, melds)` (the
seat's CURRENT wait set) intersects `pondKinds` (kinds in the seat's OWN pond). This is
a **pure, on-the-fly recomputation** from `TableState` — no extra bookkeeping. It is
gated into `ronOffers` (`legal.ts:126`) as one of three gates, alongside `isAgari` and
`winYaku(...).length > 0`.

Crucially: **the fold (`applyRon` in `record.ts`) never checks furiten at all.** This is
"THE FURITEN DIVERGENCE" documented in `legal.ts`'s header (lines 17-24): legality
narrows the offered set, the fold accepts whatever the log names. `legal.win.test.ts`'s
"the furiten divergence" describe block (line 257) pins this both ways: not offered,
still folds. This asymmetry must be preserved for the two new furiten kinds too —
`applyRon` needs **no changes**.

## Why the two new kinds cannot be recomputed on the fly like `discardFuriten`

`discardFuriten` works statelessly because a seat's own pond IS the complete history of
its own discards, and the current wait is deterministic from the current (concealed)
hand. But:

- **Temporary furiten** depends on whether a *specific historical discard* (by anyone,
  own pond or not) completed the seat's hand *at the time it happened* — the seat's
  wait can shift turn to turn before it locks into riichi (tedashi changes hand shape).
  Reconstructing "was tile X, discarded 6 actions ago, in my wait THEN" from a final
  snapshot requires replaying — there is no shortcut through today's `ponds`.
- **Riichi furiten** is the same fact, but sticky forever once the seat is locked,
  regardless of what the seat's pond/hand look like now.

So both must be **carried forward as extra `TableState` fields, updated incrementally
during the fold** — the same pattern `riichi` and `pot` already use (a boolean/number
that `applyRiichi` mutates in place, not something recomputed from a snapshot).

## The fold's turn-cycle mechanics that bear on this (`record.ts`)

- `performDiscard` (line 830) is the SINGLE choke point every discard funnels through —
  ordinary discards, claim discards, and the riichi step's atomic
  declare-and-discard (`applyRiichi` calls it with `verb: 'riichi'`). It pushes the
  discarded tile to the discarder's pond, then either flips `phase` to `'ryuukyoku'`
  (wall empty) or advances `turn` and opens `state.claimable = { seat, tile }`.
  **This is the one place a "discard passed" fact is knowable** — every seat other
  than the discarder either had a legal ron on this exact tile or didn't, evaluated
  against their CURRENT hand/melds (i.e., the tile's completion truth at the moment it
  was discarded).
- `applyWinTail` (line 709) already has the completion+yaku derivation this needs,
  restated per-seat via `yakuOf(...)` wrapped in try/catch (non-completion throws;
  caught and treated as "not a win"). `record.ts` does NOT currently import `isAgari`
  directly — it leans on `yakuOf`'s own throw for "does this complete" (see
  `applyWinTail`'s comment). The furiten-seal check can reuse this exact idiom instead
  of importing `isAgari` fresh.
- `windKindOf` (line 673) and `ROUND_WIND` (line 694) are already module-local in
  `record.ts` — reusable for the same per-seat `yakuOf` call.
- A seat's own "next draw" happens at exactly two code sites: `applyAction`'s `'draw'`
  case (line 987, `state.drawn = state.live.shift()!`) and `applyKanTail` (line 476,
  `state.drawn = state.dead.shift()!`, the shared rinshan-draw tail called by
  `applyDaiminkan`/`applyAnkan`/`applyShouminkan`). In every kan-tail call site
  `state.turn` already equals the kan-performing seat (ankan/shouminkan require
  `seat === state.turn`; daiminkan sets `state.turn = seat` before calling the tail).
  So "the seat's next draw" is fully covered by these two sites.
- `state.riichi[seat]` (line 322) is the existing lock flag `applyRiichi` sets — the
  gate for whether a pass should ALSO seal riichi furiten (permanent), on top of
  sealing temp furiten (always, regardless of riichi status).

## `legal.ts`'s consumption point

`ronOffers` (`legal.ts:126`) is the single function both the open-claim-window arm and
the ryuukyoku/houtei arm of `legalActions` (`legal.ts:351`) call — so gating it once
covers both arms, matching how `discardFuriten` already covers both without
duplication. The gate composition is currently:

```
if (discardFuriten(state, seat)) continue
```

This needs to become an OR over three independent facts: basic (self-pond, recomputed),
temp (fold-tracked), riichi (fold-tracked) — extend-only, not a replacement.

## Test infrastructure already in place

- `legal.win.test.ts` is the win-offer agreement suite (T-005-02-02) — its `ronGates`
  oracle (line 58) independently recomputes `completes`/`furiten`/`yakuless` and its
  "two-sided win partition" test (line 335) asserts `isOffered === completes &&
  !furiten && !yakuless` over a fixed set of frozen seed anchors, all built from
  `scriptedTurns` (pure tsumogiri, zero calls, zero riichi). `ronGates`'s `furiten`
  line currently only checks the self-pond form. Once temp/riichi furiten track real
  state, this oracle must fold in `state.tempFuriten[seat]`/`state.riichiFuriten[seat]`
  or the partition test's expectations will drift out of sync with the new gate.
- `record.test.ts`'s `'riichi declaration folds'` block (line 597) already has a mined,
  documented fixture: `RIICHI_SEED = 100`, seat 0 draws `69` (9p) on turn 0 and
  declares riichi discarding `55` (5p), locking seat 0 and leaving its hand tenpai.
  This is reusable as the base for a riichi-furiten fixture (need to mine which tile
  kind seat 0 now waits on, and find/insert a discard of that kind afterward that
  isn't ronned).
- No seed is yet mined for a clean **temporary-furiten-without-self-pond-furiten**
  case (`FURITEN_SEED = 23798`'s seat 1 becomes furiten via its OWN tsumogiri'd
  discard, which is permanent/basic furiten and would mask any temp-furiten-clears
  assertion). A fresh mining pass (small scratch script against `scriptedTurns`,
  scanning for a dealt-tenpai seat whose wait tile is discarded by ANOTHER seat before
  the seat's own pond ever contains it) is needed for this ticket's ACs.

## Constraints / conventions to honor

- Extend-only: existing `TableState`/`SeatView` fields keep their meaning; add new
  fields, don't repurpose old ones.
- Every module restates small predicates independently rather than importing across
  the `legal.ts`/`record.ts` boundary (both files' headers say so explicitly) — the
  new "did this discard complete seat X with yaku" check belongs in `record.ts` in its
  own words, not imported from `legal.ts`'s `winYaku`.
- Fresh-array-copy mutation pattern for Seat-indexed tuples (`applyRiichi`'s
  `const locked = [...state.riichi] as [...]; locked[seat] = true; state.riichi =
  locked`) — the new fields should follow the same idiom, not in-place index mutation
  on a shared reference.
- No SeatView change is required by the ACs (they only mention `legalActions`/agreement
  suite/derivation purity) — SeatView exposure (if wanted for hints/UI later) is a
  separate concern deferred to whichever ticket wires teaching hints, out of scope here.
