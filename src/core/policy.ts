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
// Extend-only, like the vocabulary it consumes: kan offers pass through unchosen and
// an own ron at a pre-draw window loses to the draw — declaring calls and taking rons
// are the CALL branch (T-006-03-02), which grows this module without reshaping these
// arms. Consulted anywhere it does not govern (claim windows for another seat's
// discard, houtei, agari), the policy throws — the shanten/waits posture: that is
// driver corruption, not a pass.

import type { HandAction } from './record'
import type { SeatView } from './seatview'
import { kindOf, rankOf, type TileId } from './tiles'
import { shanten } from './shanten'

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
  if (best !== null) return best
  for (const action of offered) {
    if (action.type === 'draw' && action.seat === seat) return action
  }
  throw new RangeError(
    `discardPolicy offered no draw, discard, or tsumo for seat ${seat} — own-turn points only; claim windows are the call branch (T-006-03-02)`,
  )
}
