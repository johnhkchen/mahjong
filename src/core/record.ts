// The keystone made code: a hand IS its record — a seed plus an ordered action log —
// and table state is always derived by folding the pure engine over it. Nothing else is
// authoritative. This module is the contract layer every later epic reads through:
// replay, undo, and post-hand review are folds over log prefixes; the AI, hints, and
// the app are all consumers of the folded state.

import { kindOf, type TileId, type TileKind } from './tiles'
import { buildWall, partitionWall } from './wall'
import { doraKindOf } from './dora'
import { dealHands, SEAT_COUNT, type Seat } from './deal'

/**
 * The element type of the ordered action log — the engine's action vocabulary.
 *
 * CONTRACT FREEZE: this encoding is part of the replay format, like the rng stream
 * and the wall orientation — extend-only (calls, riichi, and agari tickets add
 * members; existing members never change shape). Conventions frozen here:
 *
 * - Every action carries the acting `seat`. The seat is derivable from the fold's
 *   turn pointer, so the tag is deliberate redundancy: a wrong-seat action in a log
 *   is corruption, and the fold throws loudly instead of folding silently.
 * - `draw` records NO tile. The seed's wall order is the single authority for what
 *   is drawn (a hand is its record); recording the tile would create a second
 *   authority that could disagree with the first.
 * - `discard.tile` is the physical TileId — tsumogiri is not encoded, it is derived
 *   at fold time (the discarded tile equals the one just drawn). Id RANGE validation
 *   stays at the future log-parser boundary (the TileId rule in tiles.ts); the fold
 *   validates semantics — the tile must be in the acting seat's hand or just drawn.
 */
export type HandAction =
  | { readonly type: 'draw'; readonly seat: Seat }
  | { readonly type: 'discard'; readonly seat: Seat; readonly tile: TileId }

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
  /** The ordered action log — the draw/discard sequence of the hand (see HandAction). */
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
  /**
   * Four discard ponds indexed by Seat, each in discard order — the order IS the
   * pond's meaning (future defense reads depend on it). Fresh arrays per fold.
   */
  ponds: readonly [TileId[], TileId[], TileId[], TileId[]]
  /**
   * The seat whose action is expected next, advancing East→South→West→North per
   * completed turn. Once the hand ends it stays at the last discarder.
   */
  turn: Seat
  /**
   * The tile the turn seat has drawn and not yet discarded — held apart from the
   * 13-tile hand, null between turns. Every tile id lives in exactly one of
   * hands / ponds / drawn / live / dead at all times.
   */
  drawn: TileId | null
  /**
   * 'playing' until the discard that follows the draw emptying the live wall lands;
   * then 'ryuukyoku' (exhaustive draw) — i.e. an ended phase exactly when live is
   * empty. A widenable literal union: agari tickets add winning endings.
   */
  phase: 'playing' | 'ryuukyoku'
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
    ponds: [[], [], [], []],
    turn: 0,
    drawn: null,
    phase: 'playing',
  }
}
