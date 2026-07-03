// The discard policy: the first bot-side consumer of the fair-play boundary. A pure,
// deterministic function (SeatView, offered legal actions) → chosen action, covering a
// seat's OWN-TURN decision points only — take an offered tsumo unconditionally, else
// pick the shanten-minimizing discard by the documented tie-break below, else take the
// offered draw. Typed against SeatView on purpose (seatview.ts's doctrine: bots take
// the view, never TableState — a policy that cannot express a peek), and it SELECTS
// from the offered set rather than constructing actions, so legality stays legal.ts's
// authority and "element of the offered set" holds by construction. No RNG, no ambient
// reads: same (view, offered) → the same element, reference-identical — the invariant
// the AI-vs-AI determinism harness (T-006-03-04) replays byte-identically.
//
// THE TIE-BREAK, frozen here: among the discards whose resulting hand reaches the
// minimal shanten, shed the tile FARTHEST FROM THE CENTER RANK — |rank − 5| for
// numbered kinds, honors counting 5, farther than any numbered tile — because middle
// tiles feed the most runs and an isolated honor feeds none; remaining ties (same
// kind's copies, symmetric kinds like 1m/9p) fall to the EARLIEST OFFERED, and the
// offered order is itself contractual (legal.ts: hand order, drawn last). Both keys
// are total functions of the inputs, so the tie always closes deterministically. The
// heuristic is deliberately teachable — the hint layer can say "West is an isolated
// honor; 5p still grows three ways" — and deliberately local: a stronger tie-break
// (ukeire) swaps in behind the same comparator without touching the arms.
//
// THE RIICHI STEP (T-009-02-01) rides the same tie-break rather than adding a second
// one: whenever the discard arm's own scoring lands on shanten 0 (tenpai), the tile it
// already chose is GUARANTEED to have a matching riichi offer (legal.ts's riichiOffers
// scans the identical candidate order under the identical shanten condition), so the
// step is a lookup, not a new scan. Declare it, unless doing so would lock in a DEAD
// WAIT — every kind that would complete the hand already exhausted by the seat's own
// hand and melds (waits.ts's own convention), so the declared hand could never win by
// ron or tsumo, ever. Furiten (the wait sitting in the seat's own pond) is deliberately
// NOT an exception: it still wins by tsumo and is a real, if conservative, choice —
// only a hand that can win by nothing is treated as the mistake.
//
// THE CALL BRANCH, callPolicy, is the module's second face: claim windows and houtei
// for one seat. Ron first, unconditionally — legality already gated completion,
// furiten, and the one-yaku win gate, so an offered ron is always a taken win. Claims
// (chi/pon/daiminkan) are accepted iff BOTH: the claim STRICTLY lowers shanten (the
// post-claim remainder plus the new meld, priced by the same min-of-three shanten —
// so a chiitoi/kokushi-shaped hand pays for losing its cheap forms by opening), AND a
// YAKU ANCHOR survives on the post-call hand — some meld is a triplet-class set of a
// value kind (dragons, seat wind, round wind), or the remainder keeps a value pair,
// or (kuitan) every meld tile is a simple and the remainder's non-simples fit within
// post-shanten + 1 sheds. The anchor is a documented HEURISTIC, not a reachability
// proof — deliberately two arms (yakuhai and open tanyao, the canonical open-hand
// plans, each one-sentence teachable), widenable extend-only by a strength ticket
// (more anchors mean more accepts, never reshaped arms). Declining returns the
// offered draw — the pass has no action of its own; folding the draw lets the window
// go stale (the drive.ts doctrine). Among accepted claims the FIRST OFFERED wins,
// the whole tie-break: an accepted chi/pon always cuts shanten by exactly one (its
// `uses` are always a countable proto-block at 13 concealed tiles — saturating four
// blocks plus a head takes 14), so a post-shanten key could never discriminate, and
// the offered order already encodes pon-over-chi precedence and low-ascending chi
// shapes. A theorem, pinned by test: a daiminkan NEVER passes the strict cut
// (melding a concealed triplet trades the set it already counted as for the meld
// discount, and can only lose the pairs forms), so the policy structurally never
// opens a kan.
//
// Extend-only, like the vocabulary it consumes: OWN-TURN kan offers (ankan and
// shouminkan) still pass through discardPolicy unchosen — shanten-neutral at best, a
// later strength ticket's call — and discardPolicy still takes the draw over an own
// pre-draw ron: the DRIVER (T-006-03-03) routes window states to callPolicy, which
// takes that ron, so discardPolicy's arms stay frozen. Consulted anywhere it does
// not govern, either policy throws — the shanten/waits posture: that is driver
// corruption, not a pass.

import type { Seat } from './deal'
import type { HandAction, Meld } from './record'
import type { SeatView } from './seatview'
import { isSimple, kindOf, rankOf, type TileId, type TileKind } from './tiles'
import { shanten } from './shanten'
import { waits } from './waits'
import type { WindKind } from './yaku'

/** The rank the tie-break measures distance from — the middle of a 1-9 suit. */
const CENTER_RANK = 5

/** Honors sit farther out than any numbered tile: max numbered distance is 4 (1 or 9). */
const HONOR_DISTANCE = 5

/** The tie-break key: |rank − 5| for numbered kinds, 5 for honors. */
function centerDistance(tile: TileId): number {
  const rank = rankOf(kindOf(tile))
  return rank === null ? HONOR_DISTANCE : Math.abs(rank - CENTER_RANK)
}

/**
 * Shanten of the hand once `tile` leaves `tiles` (the seat's concealed tiles, drawn
 * included when held). Tile ids are unique physical tiles, so the filter removes
 * exactly one; arity validation stays shanten's own (both discard-offering state
 * classes land on the waiting arity — post-draw 13 − 3·melds + drawn − 1, claim
 * discard 14 − 3·melds − 1 — so a mismatch here is upstream corruption and surfaces
 * as shanten's RangeError, never a silent bad discard).
 */
function shantenAfterDiscard(
  tiles: readonly TileId[],
  melds: SeatView['melds'][number],
  tile: TileId,
): number {
  return shanten(
    tiles.filter((t) => t !== tile).map(kindOf),
    melds,
  )
}

/**
 * True when discarding `tile` from `pool` would leave a wait that can never complete —
 * every kind the resulting 13-tile hand could win on is already fully visible to the hand
 * itself (its own concealed tiles plus its own melds), so ron and tsumo are both
 * structurally impossible (waits.ts's own exhaustion convention — a direct call, not a
 * re-derivation). Distinct from furiten (a wait sitting in the seat's own pond): furiten
 * still wins by tsumo and is a real, if conservative, strategic choice; a dead wait wins
 * by nothing, ever.
 */
function isDeadWait(
  pool: readonly TileId[],
  melds: SeatView['melds'][number],
  tile: TileId,
): boolean {
  const remainder = pool.filter((t) => t !== tile).map(kindOf)
  return waits(remainder, melds).length === 0
}

/**
 * The own-turn policy — the module's face. `offered` is legalActions' enumeration for
 * the state `view` was projected from (the driver holds the state and supplies both;
 * their consistency is trusted, per the TileId/seed precedent). Three arms, in order:
 *
 * 1. an offered tsumo for `view.seat` is returned unconditionally — a won hand beats
 *    any discard, full stop;
 * 2. offered discards for `view.seat` (post-draw's 14, or a claim discard's hand-only
 *    set — the policy never branches on which: the candidate pool is hand ∪ drawn
 *    either way) are scored by resulting shanten and the winner returned per the
 *    header's tie-break. Because the drawn tile is always among the offers, the
 *    minimum can never exceed the pre-draw shanten — "does not raise" falls out of
 *    minimality with no separate mechanism;
 * 3. the offered draw for `view.seat` is returned — the pre-draw default continuation.
 *
 * Anything else throws RangeError: the discard policy decides own-turn points only.
 * Pure read: inputs never mutated; the result is an ELEMENT of `offered`, the same
 * one on every call with the same arguments.
 */
export function discardPolicy(view: SeatView, offered: readonly HandAction[]): HandAction {
  const seat = view.seat
  for (const action of offered) {
    if (action.type === 'tsumo' && action.seat === seat) return action
  }
  let best: HandAction | null = null
  let bestShanten = 0
  let bestDistance = 0
  let pool: TileId[] | null = null
  for (const action of offered) {
    if (action.type !== 'discard' || action.seat !== seat) continue
    pool ??= view.drawn === null ? [...view.hand] : [...view.hand, view.drawn]
    const after = shantenAfterDiscard(pool, view.melds[seat], action.tile)
    const distance = centerDistance(action.tile)
    if (
      best === null ||
      after < bestShanten ||
      (after === bestShanten && distance > bestDistance)
    ) {
      best = action
      bestShanten = after
      bestDistance = distance
    }
  }
  if (best !== null) {
    // T-009-02-01: declare whenever a matching riichi offer exists for the tile the
    // scoring loop above already chose — bestShanten === 0 is exactly the condition
    // legal.ts's riichiOffers uses per candidate tile, over the identical candidate
    // order, so a riichi offer for `best`'s tile is guaranteed present whenever the
    // seat is riichi-eligible at all; no independent riichi scan or tie-break is
    // needed. The one documented exception: a dead wait (isDeadWait) — every kind
    // that would complete the hand is already exhausted by the seat's own hand and
    // melds, so the declared hand could never win by ron or tsumo. Furiten (the wait
    // sitting in the seat's own pond) is deliberately NOT an exception: it still wins
    // by tsumo and is a real, if conservative, choice — only an unwinnable hand is
    // treated as a mistake worth avoiding.
    if (bestShanten === 0) {
      const bestTile = (best as Extract<HandAction, { type: 'discard' }>).tile
      for (const action of offered) {
        if (action.type === 'riichi' && action.seat === seat && action.tile === bestTile) {
          if (!isDeadWait(pool!, view.melds[seat], bestTile)) return action
          break
        }
      }
    }
    return best
  }
  for (const action of offered) {
    if (action.type === 'draw' && action.seat === seat) return action
  }
  throw new RangeError(
    `discardPolicy offered no draw, discard, or tsumo for seat ${seat} — own-turn points only; claim windows and houtei are callPolicy's`,
  )
}

/**
 * The round wind the yakuhai anchor reads — re-stated from the fold (record.ts's
 * ROUND_WIND, the legal.ts precedent: fold constants are re-stated, never imported).
 * Records are single hands; the match epic threads the true round wind in when it
 * exists.
 */
const ROUND_WIND: WindKind = '1z'

/**
 * The yakuhai kinds `seat`'s anchor scans: the three dragons, the seat's own wind
 * (`${seat + 1}z`, the deal.ts ordering), and the round wind. East's seat wind IS
 * the round wind — the duplicate is harmless in membership scans.
 */
function valueKindsOf(seat: Seat): readonly TileKind[] {
  return ['5z', '6z', '7z', `${seat + 1}z` as TileKind, ROUND_WIND]
}

/** The claim-window call forms — the offers callPolicy's claim arm scores. */
type ClaimOffer = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

function isClaimOffer(action: HandAction): action is ClaimOffer {
  return action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan'
}

/**
 * The Meld literal `offer` would fold to — what post-claim shanten reads for arity
 * and the anchor reads for tiles and type. `from` is the open window's seat; the
 * shape itself was legality's to validate and is not re-checked here.
 */
function claimMeldOf(offer: ClaimOffer, from: Seat): Meld {
  return offer.type === 'daiminkan'
    ? { type: 'daiminkan', claimed: offer.tile, from, own: offer.uses }
    : { type: offer.type, claimed: offer.tile, from, own: offer.uses }
}

/** True when the meld is a triplet-class set (everything but chi) of a value kind. */
function isValueTriplet(meld: Meld, valueKinds: readonly TileKind[]): boolean {
  return meld.type !== 'chi' && valueKinds.includes(kindOf(meld.own[0]))
}

/** Every physical tile a meld shows — claimed plus own; ankan claimed nothing. */
function meldTiles(meld: Meld): readonly TileId[] {
  return meld.type === 'ankan' ? meld.own : [meld.claimed, ...meld.own]
}

/**
 * The yaku anchor — the header's documented heuristic deciding "a yaku stays
 * reachable" for the post-call hand (`remainder` is the concealed kinds after the
 * uses leave; `melds` includes the new claim). Two arms, either suffices:
 *
 * - YAKUHAI: some meld is already a triplet-class set of a value kind, or the
 *   remainder keeps ≥ 2 copies of one — a pair that can still pon or draw into the
 *   triplet.
 * - TANYAO (kuitan, the catalog's convention): every meld tile is a simple AND the
 *   remainder holds at most `postShanten + 1` non-simples — the claim discard plus
 *   one shed per remaining exchange can clear the offenders without stalling the
 *   hand. A deliberate bound, not a reachability proof: an offender sitting inside
 *   a needed set can beat it.
 */
function yakuAnchor(
  remainder: readonly TileKind[],
  melds: readonly Meld[],
  seat: Seat,
  postShanten: number,
): boolean {
  const valueKinds = valueKindsOf(seat)
  if (melds.some((meld) => isValueTriplet(meld, valueKinds))) return true
  for (const value of valueKinds) {
    let copies = 0
    for (const kind of remainder) {
      if (kind === value) copies += 1
    }
    if (copies >= 2) return true
  }
  if (!melds.every((meld) => meldTiles(meld).every((tile) => isSimple(kindOf(tile))))) {
    return false
  }
  let offenders = 0
  for (const kind of remainder) {
    if (!isSimple(kind)) offenders += 1
  }
  return offenders <= postShanten + 1
}

/**
 * The call policy — the module's second face, governing exactly the decision points
 * discardPolicy refuses: an open claim window and the houtei rons of ryuukyoku, for
 * ONE seat (`view.seat`; arbitrating ACROSS seats is the driver's — fold the
 * earliest non-draw answer in offered order, which is ron-before-claims, atamahane
 * rotation among rons, and pon-before-chi among claims, all frozen by legal.ts).
 * Three arms, in order:
 *
 * 1. an offered ron for `view.seat` is returned unconditionally — legality already
 *    gated completion, basic furiten, and the one-yaku win gate, so an offered ron
 *    is always a legal, yaku-bearing win and "always take a legal ron" is pure
 *    selection (at most one ron offer per seat exists per window);
 * 2. the seat's claim offers are scored by the header's accept rule — strict
 *    shanten cut AND yaku anchor — and the FIRST accepted offer is returned; when
 *    every claim is declined, the offered draw is returned instead: the pass,
 *    whoever's draw it is (folding it lets the window go stale — the drive.ts
 *    decline doctrine);
 * 3. nothing above matched → RangeError: no call decision exists here for this
 *    seat (own-turn points are discardPolicy's; a houtei set without this seat's
 *    ron is the driver consulting the wrong seat).
 *
 * Pure read, the discardPolicy contract verbatim: no RNG, inputs never mutated, the
 * result is an ELEMENT of `offered` — the same one on every call with the same
 * arguments.
 */
export function callPolicy(view: SeatView, offered: readonly HandAction[]): HandAction {
  const seat = view.seat
  for (const action of offered) {
    if (action.type === 'ron' && action.seat === seat) return action
  }
  let sawClaim = false
  let pre = 0
  for (const action of offered) {
    if (!isClaimOffer(action) || action.seat !== seat) continue
    if (!sawClaim) {
      sawClaim = true
      pre = shanten(view.hand.map(kindOf), view.melds[seat])
    }
    // Claim offers exist only at an open window (legal.ts enumerates them nowhere
    // else); a null window alongside one is driver corruption — the legal.ts
    // `state.claimable!` posture.
    const from = view.claimable!.seat
    const remainder = view.hand.filter((tile) => !action.uses.includes(tile)).map(kindOf)
    const melds = [...view.melds[seat], claimMeldOf(action, from)]
    const post = shanten(remainder, melds)
    if (post < pre && yakuAnchor(remainder, melds, seat, post)) return action
  }
  if (sawClaim) {
    for (const action of offered) {
      if (action.type === 'draw') return action
    }
  }
  throw new RangeError(
    `callPolicy offered no ron or claim decision for seat ${seat} — claim windows and houtei only; own-turn points are discardPolicy's`,
  )
}
