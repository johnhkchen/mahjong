# T-006-03-02 — call-policy — Structure

No new files. Two modifications, both in `src/core/`; the barrel (`index.ts`)
already re-exports `./policy` wholesale, so `callPolicy` becomes public with no
barrel edit. Nothing outside core is touched (drive.ts is T-006-03-03).

## 1. `src/core/policy.ts` — modified (grows, never reshapes)

### Header comment

- Extend the module header: the module now holds BOTH branches of the bot policy —
  the own-turn discard branch and the call branch. Document the call branch's
  frozen decision rule (ron unconditional; claim accepted iff strict shanten cut
  AND yaku anchor; decline = the offered draw) and the anchor predicate's two
  arms (yakuhai, tanyao/kuitan) with the explicit note that the tanyao bound
  (`offenders ≤ post-shanten + 1`) is a deliberate heuristic, not a reachability
  proof.
- Update the "extend-only" paragraph: kan offers at OWN-TURN points (ankan /
  shouminkan) still pass through unchosen; the claim-side kan (daiminkan) is now
  governed by callPolicy and structurally declined (the cut-rule theorem). The
  own-pre-draw-ron note becomes: discardPolicy still returns the draw — the
  DRIVER routes window decisions to callPolicy, which takes the ron.
- discardPolicy's final throw message currently ends "claim windows are the call
  branch (T-006-03-02)" — reword to name `callPolicy` (the branch now exists).
  The test pins only `RangeError` + `/own-turn/`, so the reword is safe.

### New private declarations (below the discard-branch helpers)

```
ROUND_WIND: WindKind = '1z'
```
Re-stated fold constant, the legal.ts precedent (re-stated, never imported from
record.ts). Import `type { WindKind }` from './yaku'.

```
valueKindsOf(seat: Seat): TileKind[]
```
The yakuhai kinds for a seat: haku/hatsu/chun ('5z','6z','7z'), the seat wind
`${seat + 1}z`, and ROUND_WIND. Small array, duplicates harmless (East's seat
wind IS the round wind; membership scans don't care).

```
type ClaimOffer = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>
```
The claim-window call forms (the drive.ts ClaimAction twin, core-side).

```
claimMeldOf(offer: ClaimOffer, from: Seat): Meld
```
The Meld literal the offer would fold to — `{ type, claimed: offer.tile, from,
own: offer.uses }`. Needed so post-claim shanten sees the right meld ARITY and
the anchor predicate sees the new meld's tiles/type uniformly with existing
melds. `from` is the open window's seat (`view.claimable`).

Post-claim shanten is computed inline in callPolicy's claim loop —
`shanten(kinds(hand ∖ offer.uses), [...melds, claimMeldOf(offer, from)])` —
because the remainder kinds and the widened meld list are shared with the
anchor call; a separate helper would just recompute them. For chi/pon the
remainder is 11 − 3m — the drawn arity for m+1 melds; for daiminkan 10 − 3m —
the waiting arity. Both legal; arity validation stays shanten's own (the
shantenAfterDiscard posture).

```
meldIsValueTriplet(meld: Meld, valueKinds: readonly TileKind[]): boolean
```
True when the meld is triplet-class (pon or any kan form — everything but chi)
of a value kind (kind read from `own[0]`, the yaku.ts meldSetOf convention).

```
yakuAnchor(remainder: readonly TileKind[], melds: readonly Meld[], seat: Seat,
           postShanten: number): boolean
```
The documented predicate over the post-call hand:
- yakuhai arm: some meld satisfies meldIsValueTriplet, OR some value kind has
  ≥ 2 copies in `remainder`;
- tanyao arm: every tile of every meld is a simple (chi/pon/daiminkan/shouminkan
  scan `claimed` + `own`; ankan scans `own` — the yaku.ts allKinds convention)
  AND the count of non-simple kinds (with multiplicity) in `remainder` is
  ≤ postShanten + 1.
Imports `isSimple` from './tiles'.

### New public export

```
callPolicy(view: SeatView, offered: readonly HandAction[]): HandAction
```
Three arms over `offered`, first match wins:
1. the first own `ron` (`type === 'ron' && seat === view.seat`) — returned
   unconditionally;
2. own claim offers (`chi`/`pon`/`daiminkan`, `seat === view.seat`): compute
   `pre = shanten(kinds(view.hand), view.melds[seat])` once; score each offer by
   `post = postClaimShanten(...)` with `from = view.claimable.seat` (claim offers
   imply an open window; a null window with claim offers is driver corruption —
   non-null assertion with comment, the legal.ts `state.claimable!` precedent);
   accept iff `post < pre && yakuAnchor(remainder, [...melds, claimMeld], seat,
   post)`; the FIRST accepted offer in offered order wins (accepted offers
   always tie on post-shanten — design.md §4 — so earliest-offered is the whole
   tie-break). If an offer won, return it; otherwise return the first offered
   `draw` (any seat's — the pass; its absence while the seat held claim offers
   is corruption and falls through to the throw);
3. nothing matched → `RangeError` naming the contract ("no call decision for
   seat N — ron and claim windows only; own-turn points are discardPolicy's").

Purity identical to discardPolicy: no RNG, inputs never mutated, same arguments
→ the same element by reference.

### Explicitly unchanged

`discardPolicy`, `centerDistance`, `shantenAfterDiscard`, `CENTER_RANK`,
`HONOR_DISTANCE` — untouched. New imports appended to the existing import block
(`Seat` from './deal', `Meld` from './record', `isSimple` from './tiles',
`WindKind` from './yaku').

## 2. `src/core/policy.test.ts` — modified

### Fixture additions

- Reuse `tileSource`, `viewOf`, `discardsOf` as-is. `viewOf` gains an optional
  `claimable` field (defaulted null) so claim-window fixtures can name the
  window; one-line change, existing call sites unaffected.
- A small `claimWindowOf(view, discarder, tile)` helper is unnecessary —
  fixtures set `claimable` directly and build offered arrays by hand (the
  curated-offered-subset precedent from the tie-break tests).

### New describe blocks (fixture layer)

1. `callPolicy — ron arm`: window ron over an offered pon for the same seat;
   houtei ron from a ryuukyoku-phase view (offered = rons only); another seat's
   ron never taken.
2. `callPolicy — accepts`: yakuhai pon cutting shanten (anchor via the new
   meld); kuitan chi cutting shanten (anchor via all-simple melds + clean
   remainder); an already-open anchored hand accepting a second call.
3. `callPolicy — declines`: anchor failure (the AC's strand case — a cutting
   chi whose post-call hand is open with no value pair and a non-simple meld)
   returns the offered draw element by reference; cut failure (a pon that does
   not lower shanten) despite a held yakuhai pair; the daiminkan theorem (a
   cutting-adjacent daiminkan offer is never chosen — pon of the same kind may
   be).
4. `callPolicy — tie-break`: an accepted pon and an accepted chi at one window
   → the pon wins (earliest offered — claim precedence emergent from the frozen
   order); copy-variant chi offers deliberately reversed → earliest offered
   wins (the curated-subset mold).
5. `callPolicy — contract violations`: RangeError on a set holding nothing for
   the seat (a post-draw set, an empty set, a houtei set without this seat's
   ron).
6. `callPolicy — purity and determinism`: the discardPolicy purity block's twin
   (same reference on repeat, no input mutation, structural stability).

### Sweep changes

`playPolicy(seed)` grows call arbitration (the §5 driver rule, rehearsing
T-006-03-03): at a pre-draw open-window state, consult `callPolicy` once per
seat holding a window offer (ron or claim), in rotation order; collect answers;
fold the earliest non-draw answer in offered order, else the draw. At
ryuukyoku, consult ron-holding seats; fold the first offered ron if any seat
returned one (atamahane = offered order). Per-step oracle checks (plain throws,
one expect per game): every answer ∈ offered; a seat offered a ron returned it;
every folded claim strictly cuts shanten and satisfies a test-side re-derivation
of the anchor predicate. Existing own-turn oracle checks stay verbatim.
ACTION_BOUND is unchanged — calls replace draw+discard pairs and skip seats'
draws, so the bound still holds; the termination and byte-identical-replay
tests now exercise logs containing calls.

## 3. Ordering

1. policy.ts: helpers + callPolicy + header updates (compiles standalone).
2. policy.test.ts: fixture layer (blocks 1–6).
3. policy.test.ts: sweep extension + rerun of the full suite (`just test`,
   `just check`).

Each step is independently committable; the sweep lands last because it depends
on both the export and the fixture conventions.
