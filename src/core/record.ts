// The keystone made code: a hand IS its record — a seed plus an ordered action log —
// and table state is always derived by folding the pure engine over it. Nothing else is
// authoritative. This module is the contract layer every later epic reads through:
// replay, undo, and post-hand review are folds over log prefixes; the AI, hints, and
// the app are all consumers of the folded state.

import { kindOf, type TileId, type TileKind } from './tiles'
import { buildWall, partitionWall } from './wall'
import { doraKindOf } from './dora'
import { dealHands } from './deal'

/**
 * The element type of the ordered action log — the engine's action vocabulary.
 * Currently EMPTY: no draw, discard, or call exists in this slice, so the only
 * well-typed log is the empty array. Draw/discard/call tickets widen this union; the
 * name is the extension point, deliberately not stubbed with shapes — the action
 * encoding, once defined, becomes part of the replay contract and must be designed by
 * the tickets that own it.
 */
export type HandAction = never

/**
 * A hand is this pair and nothing else. The seed determines the wall order (frozen rng
 * stream), the actions determine everything that happened on it; table state is always
 * derived by folding — replay is a fold over a prefix, undo is dropping the last
 * action and re-deriving.
 */
export interface HandRecord {
  /**
   * Canonical domain: integers in [0, 2^32); any JS number is normalized with an
   * unsigned shift by the rng (see createRng). Seeds arriving from outside the program
   * are validated at the future log-parser boundary, per the TileId precedent.
   */
  seed: number
  /** The ordered action log — today, necessarily empty (see HandAction). */
  actions: readonly HandAction[]
}

/**
 * The table as it stands after folding a record. A DERIVED VIEW, not a frozen
 * contract: the record and the frozen derivation conventions (rng stream, wall
 * orientation, deal map, dora position) are the replay format — this shape may grow
 * fields (discard piles, melds, turn) in later tickets without invalidating any
 * stored hand.
 */
export interface TableState {
  /**
   * Four hands indexed by Seat (0 = East the dealer, 1 = South, 2 = West, 3 = North),
   * each in draw order — never sorted; sorting is presentation. Fresh arrays per fold.
   */
  hands: readonly [TileId[], TileId[], TileId[], TileId[]]
  /**
   * The live wall remaining after the deal, in draw order — live[0] is the dealer's
   * first draw. Fresh array per fold.
   */
  live: TileId[]
  /** The 14-tile dead wall, frozen layout per WallPartition.dead. Fresh per fold. */
  dead: TileId[]
  /** The flipped physical indicator tile — dead[INITIAL_DORA_INDICATOR_INDEX]. */
  doraIndicator: TileId
  /** The mapped dora kind the indicator points at (doraKindOf over its kind). */
  dora: TileKind
}

/**
 * The fold entrypoint: record in, table state out. Folding an EMPTY action log yields
 * the freshly dealt table — the deal is the seed's own derivation, not an action.
 * Pure: no RNG beyond the seed's wall build, the record is never mutated, all output
 * arrays are fresh. Same record → same folded state, forever: this composes only the
 * frozen conventions (rng stream, wall orientation, deal map, dora position).
 *
 * The non-empty-log guard IS the step function for an empty action vocabulary: an
 * action the engine cannot interpret must never fold silently into a wrong state
 * (the nextInt precedent — corruption fails loudly). Action tickets replace it with
 * the real per-action step.
 */
export function foldRecord(record: HandRecord): TableState {
  if (record.actions.length > 0) {
    throw new RangeError(
      `foldRecord cannot interpret actions — the action vocabulary is empty in this engine slice, got ${record.actions.length}`,
    )
  }
  const { live, dead, doraIndicator } = partitionWall(buildWall(record.seed))
  const deal = dealHands(live)
  return {
    hands: deal.hands,
    live: deal.live,
    dead,
    doraIndicator,
    dora: doraKindOf(kindOf(doraIndicator)),
  }
}
