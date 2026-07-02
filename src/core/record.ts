// The keystone made code: a hand IS its record — a seed plus an ordered action log —
// and table state is always derived by folding the pure engine over it. Nothing else is
// authoritative. This module is the contract layer every later epic reads through:
// replay, undo, and post-hand review are folds over log prefixes; the AI, hints, and
// the app are all consumers of the folded state.

import { kindOf, rankOf, suitOf, type TileId, type TileKind } from './tiles'
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
 * - `chi`/`pon` record the claimed `tile` AND the two hand tiles exposed (`uses`, as
 *   physical ids in recorded order). The claimed tile is derivable from the fold's
 *   claim window, so recording it is the seat-tag redundancy again: a claim naming a
 *   tile other than the fresh discard is corruption and throws. `uses` are the
 *   caller's private choice of copies — no wall-order authority exists for them, so
 *   the log is where they are stated.
 */
export type HandAction =
  | { readonly type: 'draw'; readonly seat: Seat }
  | { readonly type: 'discard'; readonly seat: Seat; readonly tile: TileId }
  | {
      readonly type: 'chi'
      readonly seat: Seat
      readonly tile: TileId
      readonly uses: readonly [TileId, TileId]
    }
  | {
      readonly type: 'pon'
      readonly seat: Seat
      readonly tile: TileId
      readonly uses: readonly [TileId, TileId]
    }

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
 * One exposed meld in the derived view. The claimed tile stays COUNTED in the
 * discarder's pond (ponds keep the complete discard history — furiten and defense
 * reads treat a claimed-away tile as still discarded); `(from, claimed)` is the mark
 * identifying it there. Only `own` — the tiles spliced out of the caller's hand —
 * joins the conservation partition as the melds zone. Part of the derived view, not
 * the record contract: the kan ticket may widen this shape (ankan has no claimed
 * tile) without invalidating any stored hand.
 */
export interface Meld {
  readonly type: 'chi' | 'pon'
  /** The claimed discard — displayed in the meld, counted in ponds[from]. */
  readonly claimed: TileId
  /** The seat it was claimed from. */
  readonly from: Seat
  /** The caller's tiles exposed from hand, in the order the log recorded them. */
  readonly own: readonly [TileId, TileId]
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
   * Four per-seat lists of exposed melds in claim order. Fresh arrays per fold.
   * The conservation zone a meld contributes is its `own` pair — the claimed tile
   * stays the pond's (see Meld).
   */
  melds: readonly [Meld[], Meld[], Meld[], Meld[]]
  /**
   * The fresh discard currently open to claims, or null. Set by every discard that
   * leaves the hand playing; cleared by the next draw (a stale discard can no longer
   * be claimed) or by the claim that takes it. An ended hand never holds a window.
   */
  claimable: { readonly seat: Seat; readonly tile: TileId } | null
  /**
   * True exactly from a claim until the caller's ensuing discard: the turn seat owes
   * a discard with no drawn tile (a caller never draws). The post-draw discard
   * obligation is expressed by `drawn`, not this flag.
   */
  mustDiscard: boolean
  /**
   * The tile the turn seat has drawn and not yet discarded — held apart from the
   * 13-tile hand, null between turns. Every tile id lives in exactly one of
   * hands / melds' own / ponds / drawn / live / dead at all times.
   */
  drawn: TileId | null
  /**
   * 'playing' until the discard that follows the draw emptying the live wall lands;
   * then 'ryuukyoku' (exhaustive draw) — i.e. an ended phase exactly when live is
   * empty. A widenable literal union: agari tickets add winning endings.
   */
  phase: 'playing' | 'ryuukyoku'
}

/** True when the three kinds form a run: one numbered suit, three consecutive ranks. */
function isRun(a: TileKind, b: TileKind, c: TileKind): boolean {
  if (suitOf(a) === 'z' || suitOf(a) !== suitOf(b) || suitOf(a) !== suitOf(c)) return false
  const ranks = [rankOf(a)!, rankOf(b)!, rankOf(c)!].sort((x, y) => x - y)
  return ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1
}

/**
 * The shared chi/pon step: validate a claim against the open claim window and fold it.
 * Guard order is fixed — window, seat, tile, uses distinct, uses held, meld shape —
 * so every illegal claim is named by exactly one message. On success the caller's
 * `uses` leave the hand for the meld, the turn JUMPS to the caller (seats between the
 * discarder and the caller never act — their draws simply never happen), the window
 * closes, and the caller owes a discard (mustDiscard; a caller never draws). The
 * claimed tile stays counted in the discarder's pond — (from, claimed) on the meld is
 * its mark there (see Meld).
 */
function applyClaim(
  state: TableState,
  action: Extract<HandAction, { type: 'chi' | 'pon' }>,
  index: number,
): void {
  const { type, seat, tile, uses } = action
  const window = state.claimable
  if (window === null) {
    throw new RangeError(
      `action ${index}: ${type} by seat ${seat} with no claimable discard — nothing was discarded, or the discard went stale on the next draw`,
    )
  }
  if (type === 'chi') {
    const chiSeat = ((window.seat + 1) % SEAT_COUNT) as Seat
    if (seat !== chiSeat) {
      throw new RangeError(
        `action ${index}: chi by seat ${seat}, but only seat ${chiSeat} may chi seat ${window.seat}'s discard`,
      )
    }
  } else if (seat === window.seat) {
    throw new RangeError(`action ${index}: pon by seat ${seat} of its own discard`)
  }
  if (tile !== window.tile) {
    throw new RangeError(
      `action ${index}: ${type} of tile ${tile}, but the claimable discard is tile ${window.tile}`,
    )
  }
  if (uses[0] === uses[1]) {
    throw new RangeError(`action ${index}: ${type} uses tile ${uses[0]} twice`)
  }
  const hand = state.hands[seat]
  for (const used of uses) {
    if (!hand.includes(used)) {
      throw new RangeError(
        `action ${index}: ${type} uses tile ${used}, which seat ${seat} does not hold`,
      )
    }
  }
  if (type === 'chi') {
    if (!isRun(kindOf(tile), kindOf(uses[0]), kindOf(uses[1]))) {
      throw new RangeError(
        `action ${index}: chi of tiles ${tile}+${uses[0]}+${uses[1]} (kinds ${kindOf(tile)}, ${kindOf(uses[0])}, ${kindOf(uses[1])}) do not form a run`,
      )
    }
  } else if (kindOf(uses[0]) !== kindOf(tile) || kindOf(uses[1]) !== kindOf(tile)) {
    throw new RangeError(
      `action ${index}: pon of tiles ${tile}+${uses[0]}+${uses[1]} (kinds ${kindOf(tile)}, ${kindOf(uses[0])}, ${kindOf(uses[1])}) do not form a triplet`,
    )
  }
  hand.splice(hand.indexOf(uses[0]), 1)
  hand.splice(hand.indexOf(uses[1]), 1)
  state.melds[seat].push({ type, claimed: tile, from: window.seat, own: uses })
  state.turn = seat
  state.claimable = null
  state.mustDiscard = true
}

/**
 * The per-action step: advance the fold-local state by one logged action, mutating it
 * in place (every array in `state` is fresh to this fold, so the mutation is invisible
 * outside foldRecord). The turn cycle it enforces:
 *
 * - drawn === null, mustDiscard false → the turn seat must draw; the drawn tile is
 *   live[0], by the frozen wall order — the action itself records no tile. While the
 *   claim window is open (claimable !== null, always the case here mid-hand) a chi by
 *   the discarder's next seat or a pon by any other seat may fold INSTEAD, jumping
 *   the turn to the caller; the draw closes the window (staleness).
 * - drawn !== null → the turn seat must discard: the drawn tile itself (tsumogiri,
 *   hand untouched) or a hand tile (tedashi — the hand tile leaves, the drawn tile is
 *   APPENDED to the hand, preserving "hands are in draw order, never sorted").
 * - mustDiscard → the caller owes a claim discard: from the hand only, there is no
 *   drawn tile.
 * - After a discard, if the live wall is empty the hand ends in ryuukyoku (so the
 *   fold is in an ended phase exactly when live is empty — and the final discard is
 *   never claimable); otherwise the turn advances E→S→W→N and the discard opens the
 *   claim window.
 *
 * Anything else — an action after the end, an unknown type from untyped JS, a wrong
 * seat, a draw out of sequence, a discard of a tile not held, an illegal claim — is
 * log corruption and throws RangeError with the action's index (the nextInt
 * precedent: an action the engine cannot interpret must never fold silently into a
 * wrong state).
 */
function applyAction(state: TableState, action: HandAction, index: number): void {
  if (state.phase !== 'playing') {
    throw new RangeError(
      `action ${index}: the hand already ended in ${state.phase} — no further action can fold`,
    )
  }
  switch (action.type) {
    case 'draw': {
      if (action.seat !== state.turn) {
        throw new RangeError(
          `action ${index}: draw by seat ${action.seat}, but it is seat ${state.turn}'s turn`,
        )
      }
      if (state.mustDiscard) {
        throw new RangeError(
          `action ${index}: draw out of sequence — seat ${state.turn} owes a discard for its claim`,
        )
      }
      if (state.drawn !== null) {
        throw new RangeError(
          `action ${index}: draw out of sequence — seat ${state.turn} already holds drawn tile ${state.drawn}`,
        )
      }
      if (state.live.length === 0) {
        // Unreachable through a legal fold (the phase ends with the last discard),
        // kept as a loud guard against a corrupt or hand-built state.
        throw new RangeError(`action ${index}: draw from an empty live wall`)
      }
      state.drawn = state.live.shift()!
      // The draw closes the claim window: the previous discard is now stale.
      state.claimable = null
      return
    }
    case 'discard': {
      if (action.seat !== state.turn) {
        throw new RangeError(
          `action ${index}: discard by seat ${action.seat}, but it is seat ${state.turn}'s turn`,
        )
      }
      if (state.mustDiscard) {
        // The claim discard: there is no drawn tile — the tile must come from the hand.
        const hand = state.hands[state.turn]
        const at = hand.indexOf(action.tile)
        if (at === -1) {
          throw new RangeError(
            `action ${index}: discard of tile ${action.tile}, which seat ${state.turn} does not hold — a claim discard comes from the hand`,
          )
        }
        hand.splice(at, 1)
        state.ponds[state.turn].push(action.tile)
        state.mustDiscard = false
      } else if (state.drawn === null) {
        throw new RangeError(
          `action ${index}: discard of tile ${action.tile} before seat ${state.turn} drew`,
        )
      } else if (action.tile === state.drawn) {
        state.ponds[state.turn].push(action.tile)
        state.drawn = null
      } else {
        const hand = state.hands[state.turn]
        const at = hand.indexOf(action.tile)
        if (at === -1) {
          throw new RangeError(
            `action ${index}: discard of tile ${action.tile}, which seat ${state.turn} neither holds nor just drew`,
          )
        }
        hand.splice(at, 1)
        hand.push(state.drawn)
        state.ponds[state.turn].push(action.tile)
        state.drawn = null
      }
      if (state.live.length === 0) {
        state.phase = 'ryuukyoku'
      } else {
        state.turn = ((state.turn + 1) % SEAT_COUNT) as Seat
        // The discard just made is fresh: open the claim window on it. An ended
        // hand keeps no window (the last discard is never chi/pon-able).
        state.claimable = { seat: action.seat, tile: action.tile }
      }
      return
    }
    case 'chi':
    case 'pon': {
      applyClaim(state, action, index)
      return
    }
    default: {
      // `action` is `never` here for well-typed logs; untyped JS (storage, a corrupt
      // log) can still reach it, and must fail loudly rather than fold silently.
      throw new RangeError(
        `action ${index}: unknown action type ${JSON.stringify((action as { type?: unknown }).type)}`,
      )
    }
  }
}

/**
 * The fold entrypoint: record in, table state out. Folding an EMPTY action log yields
 * the freshly dealt table — the deal is the seed's own derivation, not an action;
 * each logged action then advances the state through applyAction's turn cycle.
 * Pure: no RNG beyond the seed's wall build, the record is never mutated, all output
 * arrays are fresh. Same record → same folded state, forever: this composes only the
 * frozen conventions (rng stream, wall orientation, deal map, dora position, action
 * encoding). Replay, undo, and review are folds over log prefixes of this function.
 * An illegal or uninterpretable action throws RangeError naming its log index.
 */
export function foldRecord(record: HandRecord): TableState {
  const { live, dead, doraIndicator } = partitionWall(buildWall(record.seed))
  const deal = dealHands(live)
  const state: TableState = {
    hands: deal.hands,
    live: deal.live,
    dead,
    doraIndicator,
    dora: doraKindOf(kindOf(doraIndicator)),
    ponds: [[], [], [], []],
    melds: [[], [], [], []],
    claimable: null,
    mustDiscard: false,
    turn: 0,
    drawn: null,
    phase: 'playing',
  }
  record.actions.forEach((action, index) => applyAction(state, action, index))
  return state
}
