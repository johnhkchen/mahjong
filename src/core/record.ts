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
 * - The kan forms follow the same two rules. `daiminkan` mirrors pon with three
 *   `uses`; `ankan` records only its four `uses` (nothing is claimed; the drawn tile
 *   may be among them); `shouminkan` records only the added `tile` (the target pon is
 *   derivable — a seat can hold at most one pon of a kind). The rinshan tile a kan
 *   draws and the kan-dora indicator it flips are NEVER recorded: both are the
 *   seed's wall-order authority, like `draw`'s tile. The rinshan draw is implicit in
 *   the kan action itself — no separate `draw` is logged, because no other action
 *   can legally intervene between a kan and its replacement draw.
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
  | {
      readonly type: 'daiminkan'
      readonly seat: Seat
      readonly tile: TileId
      readonly uses: readonly [TileId, TileId, TileId]
    }
  | {
      readonly type: 'ankan'
      readonly seat: Seat
      readonly uses: readonly [TileId, TileId, TileId, TileId]
    }
  | { readonly type: 'shouminkan'; readonly seat: Seat; readonly tile: TileId }

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
 * One exposed meld in the derived view — a discriminated union over the call forms.
 * For every claiming form (chi/pon/daiminkan/shouminkan) the claimed tile stays
 * COUNTED in the discarder's pond (ponds keep the complete discard history — furiten
 * and defense reads treat a claimed-away tile as still discarded); `(from, claimed)`
 * is the mark identifying it there. Only `own` — the tiles that left the owner's
 * hand (and, for kans, the drawn slot) — joins the conservation partition as the
 * melds zone; ankan has no claimed tile at all, so all four of its tiles are `own`.
 * A shouminkan REPLACES the upgraded pon in place (same index in the seat's meld
 * list, `claimed`/`from` preserved, `own` = the pon's pair plus the added tile), so
 * meld order stays claim order and the pond mark survives the upgrade. Part of the
 * derived view, not the record contract — this union may widen again without
 * invalidating any stored hand.
 */
export type Meld =
  | {
      readonly type: 'chi' | 'pon'
      /** The claimed discard — displayed in the meld, counted in ponds[from]. */
      readonly claimed: TileId
      /** The seat it was claimed from. */
      readonly from: Seat
      /** The caller's tiles exposed from hand, in the order the log recorded them. */
      readonly own: readonly [TileId, TileId]
    }
  | {
      readonly type: 'daiminkan'
      readonly claimed: TileId
      readonly from: Seat
      readonly own: readonly [TileId, TileId, TileId]
    }
  | {
      readonly type: 'shouminkan'
      /** The pon's claimed discard, preserved through the upgrade. */
      readonly claimed: TileId
      readonly from: Seat
      /** The pon's pair in recorded order, then the added fourth copy. */
      readonly own: readonly [TileId, TileId, TileId]
    }
  | {
      readonly type: 'ankan'
      /** All four copies, in the order the log recorded them — nothing was claimed. */
      readonly own: readonly [TileId, TileId, TileId, TileId]
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
  /**
   * The 14-tile dead wall, initial layout per WallPartition.dead. Fresh per fold.
   * Kans mutate it while keeping it at exactly 14 tiles: each kan's rinshan draw
   * leaves the front (dead[0..3] in draw order) and the live wall's TAIL tile joins
   * the end as the replacement — so after k kans the array is the original layout's
   * tiles [k..13] followed by the k moved tail tiles.
   */
  dead: TileId[]
  /** The initially flipped indicator tile — dead[INITIAL_DORA_INDICATOR_INDEX]. */
  doraIndicator: TileId
  /** The mapped dora kind the initial indicator points at (doraKindOf over its kind). */
  dora: TileKind
  /**
   * Every flipped indicator tile in flip order: [0] is always `doraIndicator` (the
   * initial flip at dead[4]); each kan appends the next indicator, walking rightward
   * through the frozen layout (dead[6], dead[8], dead[10], dead[12] — original
   * indices). The flip is immediate, inside the kan step. Fresh array per fold.
   */
  doraIndicators: TileId[]
  /** The mapped dora kind of each flipped indicator, same order. Fresh per fold. */
  doras: TileKind[]
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
   * empty. Kans shorten the live wall (the tail tile replaces the rinshan draw), so
   * exhaustive draw arrives one discard earlier per kan — through this same
   * condition. A widenable literal union: agari tickets add winning endings.
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

/** The dead wall holds exactly four rinshan tiles (dead[0..3]) — the kan ceiling. */
const RINSHAN_TILE_COUNT = 4

/** Kans made so far across all seats — i.e. rinshan draws consumed, kan-dora flipped. */
function kansMade(state: TableState): number {
  let count = 0
  for (const melds of state.melds) {
    for (const meld of melds) {
      if (meld.type === 'daiminkan' || meld.type === 'ankan' || meld.type === 'shouminkan') {
        count++
      }
    }
  }
  return count
}

/** The first tile id appearing twice in `uses`, or null when all are distinct. */
function firstDuplicate(uses: readonly TileId[]): TileId | null {
  for (let i = 0; i < uses.length; i++) {
    for (let j = i + 1; j < uses.length; j++) {
      if (uses[i] === uses[j]) return uses[i]
    }
  }
  return null
}

/**
 * The wall guards every kan form runs after its window/turn guards: a fifth kan has
 * no rinshan tile left, and a kan on an empty live wall has no tile to move into the
 * dead wall as the replacement (the riichi rule: the haitei draw cannot be kanned).
 * The empty-live case is reachable only for ankan/shouminkan — an open claim window
 * implies a live wall, so daiminkan keeps the guard as a loud backstop.
 */
function guardRinshanAvailable(state: TableState, index: number, type: string, kans: number): void {
  if (kans >= RINSHAN_TILE_COUNT) {
    throw new RangeError(
      `action ${index}: ${type} with no rinshan tile remaining — four kans already made`,
    )
  }
  if (state.live.length === 0) {
    throw new RangeError(
      `action ${index}: ${type} on an empty live wall — no replacement tile remains`,
    )
  }
}

/**
 * The shared kan tail, after a form-specific step has exposed its meld: flip the next
 * kan-dora indicator, draw the rinshan replacement, and move the live wall's tail
 * tile into the dead wall. `kansBefore` is the kansMade count from BEFORE this kan's
 * meld was pushed, and the flip is computed FIRST, against the dead array as it
 * stands: after k rinshan draws left the front and k replacements joined the end,
 * the frozen layout's indicator at original index 4 + 2(k+1) sits at 6 + k. Then the
 * rinshan draw is the front of the dead array (original dead[k], the frozen draw
 * order) and lands in `drawn` — the ensuing discard is the ordinary discard step —
 * and the live TAIL moves over, keeping the dead wall at exactly 14 tiles and
 * bringing exhaustive draw one discard closer through the unchanged phase condition.
 */
function applyKanTail(state: TableState, kansBefore: number): void {
  const indicator = state.dead[6 + kansBefore]
  state.doraIndicators.push(indicator)
  state.doras.push(doraKindOf(kindOf(indicator)))
  state.drawn = state.dead.shift()!
  state.dead.push(state.live.pop()!)
}

/**
 * The daiminkan step: an open kan claiming the fresh discard with three held copies.
 * Window semantics are pon's (any non-discarder; the turn JUMPS to the caller and
 * skipped seats never draw); guard order is fixed — window, seat, tile, rinshan
 * availability, uses distinct, uses held, four-of-a-kind — so every illegal kan is
 * named by exactly one message. The claimed tile stays counted in the discarder's
 * pond, per the claim-forms rule on Meld. Unlike chi/pon the caller owes no bare
 * claim discard: the rinshan draw fills `drawn`, and the ordinary discard step
 * carries on from there.
 */
function applyDaiminkan(
  state: TableState,
  action: Extract<HandAction, { type: 'daiminkan' }>,
  index: number,
): void {
  const { seat, tile, uses } = action
  const window = state.claimable
  if (window === null) {
    throw new RangeError(
      `action ${index}: daiminkan by seat ${seat} with no claimable discard — nothing was discarded, or the discard went stale on the next draw`,
    )
  }
  if (seat === window.seat) {
    throw new RangeError(`action ${index}: daiminkan by seat ${seat} of its own discard`)
  }
  if (tile !== window.tile) {
    throw new RangeError(
      `action ${index}: daiminkan of tile ${tile}, but the claimable discard is tile ${window.tile}`,
    )
  }
  const kans = kansMade(state)
  guardRinshanAvailable(state, index, 'daiminkan', kans)
  const duplicate = firstDuplicate(uses)
  if (duplicate !== null) {
    throw new RangeError(`action ${index}: daiminkan uses tile ${duplicate} twice`)
  }
  const hand = state.hands[seat]
  for (const used of uses) {
    if (!hand.includes(used)) {
      throw new RangeError(
        `action ${index}: daiminkan uses tile ${used}, which seat ${seat} does not hold`,
      )
    }
  }
  if (uses.some((used) => kindOf(used) !== kindOf(tile))) {
    throw new RangeError(
      `action ${index}: daiminkan of tiles ${tile}+${uses.join('+')} (kinds ${kindOf(tile)}, ${uses.map(kindOf).join(', ')}) do not form four of a kind`,
    )
  }
  for (const used of uses) hand.splice(hand.indexOf(used), 1)
  state.melds[seat].push({ type: 'daiminkan', claimed: tile, from: window.seat, own: uses })
  state.turn = seat
  state.claimable = null
  applyKanTail(state, kans)
}

/**
 * The ankan step: on the turn seat's own draw, all four copies of one kind leave the
 * concealed tiles (hand plus, possibly, the drawn tile itself). Guard order — turn,
 * claim-discard owed, drawn present, rinshan availability, uses distinct, uses
 * held-or-drawn, four-of-a-kind. Nothing is claimed, so the meld carries `own` only.
 * When the drawn tile is NOT among the four, it is appended to the hand (the
 * tedashi-append rule) before the rinshan draw takes the `drawn` slot.
 */
function applyAnkan(
  state: TableState,
  action: Extract<HandAction, { type: 'ankan' }>,
  index: number,
): void {
  const { seat, uses } = action
  if (seat !== state.turn) {
    throw new RangeError(
      `action ${index}: ankan by seat ${seat}, but it is seat ${state.turn}'s turn`,
    )
  }
  if (state.mustDiscard) {
    throw new RangeError(
      `action ${index}: ankan out of sequence — seat ${seat} owes a discard for its claim`,
    )
  }
  if (state.drawn === null) {
    throw new RangeError(`action ${index}: ankan before seat ${seat} drew`)
  }
  const kans = kansMade(state)
  guardRinshanAvailable(state, index, 'ankan', kans)
  const duplicate = firstDuplicate(uses)
  if (duplicate !== null) {
    throw new RangeError(`action ${index}: ankan uses tile ${duplicate} twice`)
  }
  const hand = state.hands[seat]
  for (const used of uses) {
    if (!hand.includes(used) && used !== state.drawn) {
      throw new RangeError(
        `action ${index}: ankan uses tile ${used}, which seat ${seat} neither holds nor just drew`,
      )
    }
  }
  if (uses.some((used) => kindOf(used) !== kindOf(uses[0]))) {
    throw new RangeError(
      `action ${index}: ankan of tiles ${uses.join('+')} (kinds ${uses.map(kindOf).join(', ')}) do not form four of a kind`,
    )
  }
  let usedDrawn = false
  for (const used of uses) {
    if (used === state.drawn) {
      usedDrawn = true
    } else {
      hand.splice(hand.indexOf(used), 1)
    }
  }
  if (!usedDrawn) hand.push(state.drawn)
  state.drawn = null
  state.melds[seat].push({ type: 'ankan', own: uses })
  applyKanTail(state, kans)
}

/**
 * The shouminkan step: on the turn seat's own draw, the fourth copy (from hand or
 * the drawn tile) joins the seat's OWN pon of that kind, which is REPLACED in place
 * — same index in the meld list, `claimed`/`from` preserved, `own` grown by the
 * added tile — so meld order stays claim order and the pond mark survives. Guard
 * order — turn, claim-discard owed, drawn present, rinshan availability, tile
 * held-or-drawn, matching pon exists. (Chankan — robbing this kan — is an agari
 * epic's concern; no ron exists yet.)
 */
function applyShouminkan(
  state: TableState,
  action: Extract<HandAction, { type: 'shouminkan' }>,
  index: number,
): void {
  const { seat, tile } = action
  if (seat !== state.turn) {
    throw new RangeError(
      `action ${index}: shouminkan by seat ${seat}, but it is seat ${state.turn}'s turn`,
    )
  }
  if (state.mustDiscard) {
    throw new RangeError(
      `action ${index}: shouminkan out of sequence — seat ${seat} owes a discard for its claim`,
    )
  }
  if (state.drawn === null) {
    throw new RangeError(`action ${index}: shouminkan before seat ${seat} drew`)
  }
  const kans = kansMade(state)
  guardRinshanAvailable(state, index, 'shouminkan', kans)
  const hand = state.hands[seat]
  const fromDrawn = tile === state.drawn
  if (!fromDrawn && !hand.includes(tile)) {
    throw new RangeError(
      `action ${index}: shouminkan of tile ${tile}, which seat ${seat} neither holds nor just drew`,
    )
  }
  const melds = state.melds[seat]
  let at = -1
  for (let i = 0; i < melds.length; i++) {
    const meld = melds[i]
    if (meld.type === 'pon' && kindOf(meld.own[0]) === kindOf(tile)) {
      at = i
      break
    }
  }
  if (at === -1) {
    throw new RangeError(
      `action ${index}: shouminkan of tile ${tile} (kind ${kindOf(tile)}), but seat ${seat} has no pon of that kind`,
    )
  }
  const pon = melds[at] as Extract<Meld, { type: 'chi' | 'pon' }>
  if (fromDrawn) {
    state.drawn = null
  } else {
    hand.splice(hand.indexOf(tile), 1)
    hand.push(state.drawn)
    state.drawn = null
  }
  melds[at] = {
    type: 'shouminkan',
    claimed: pon.claimed,
    from: pon.from,
    own: [pon.own[0], pon.own[1], tile],
  }
  applyKanTail(state, kans)
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
 * - Kans interleave the cycle at two points: a daiminkan folds INSTEAD of a draw
 *   while the claim window is open (like pon, from any non-discarder — the turn
 *   jumps); an ankan or shouminkan folds while the turn seat holds its drawn tile,
 *   before the discard. Every kan form ends in the shared tail — kan-dora flip,
 *   rinshan draw into `drawn`, live tail into the dead wall — so the ordinary
 *   discard arm always plays the tile that follows a kan.
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
    case 'daiminkan': {
      applyDaiminkan(state, action, index)
      return
    }
    case 'ankan': {
      applyAnkan(state, action, index)
      return
    }
    case 'shouminkan': {
      applyShouminkan(state, action, index)
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
  const dora = doraKindOf(kindOf(doraIndicator))
  const state: TableState = {
    hands: deal.hands,
    live: deal.live,
    dead,
    doraIndicator,
    dora,
    doraIndicators: [doraIndicator],
    doras: [dora],
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
