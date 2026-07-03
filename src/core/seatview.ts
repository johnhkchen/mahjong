// The fair-play boundary made a type: SeatView is the read-only projection of a folded
// TableState down to what one seat may legitimately see. Fair play is structural, not
// policed — the interface has no field that can hold hidden information (no other
// hands, no wall arrays, no other seat's drawn tile), so a consumer typed against
// SeatView cannot express a peek. Bots, hints, defense reads, and attract mode are all
// meant to take THIS, never TableState; legality stays a full-state concern
// (legalActions enumerates over concealed hands by necessity — the driver holds the
// state, the seat holds the view).
//
// Like TableState it is a DERIVED VIEW, not a frozen contract: widening it later
// (drawnFrom, a turn-holds-draw flag, ura indicators at showdown) is extend-only. The
// indexed-access aliases (phase/claimable/win) track TableState's unions on purpose —
// any ticket widening those must re-audit the fair-play property (T-006-01-02).

import type { Seat } from './deal'
import type { Meld, TableState } from './record'
import type { TileId, TileKind } from './tiles'

/**
 * One seat's legitimate view of the table. Arrays are fresh per projection (the fold
 * mutates its own arrays in place across actions; the view must not alias them).
 * Meld elements and the claimable/win records are shared by reference — they are
 * readonly-typed and the fold never mutates one after creation (the shouminkan step
 * REPLACES its pon; discards REPLACE the claimable record) — so sharing cannot alias
 * future engine mutation.
 */
export interface SeatView {
  /** Whose view this is — the projection's seat parameter, echoed so the value is self-describing. */
  readonly seat: Seat
  /** The seat's own concealed hand, in draw order — never sorted; sorting is presentation. */
  readonly hand: readonly TileId[]
  /**
   * The seat's own drawn-and-not-yet-discarded tile, or null. Null when this seat
   * holds no draw — deliberately indistinguishable from another seat holding one:
   * the identity of another seat's drawn tile is hidden information, so the view
   * carries drawn only when `turn` is this seat.
   */
  readonly drawn: TileId | null
  /** All four discard ponds indexed by Seat, each in discard order — fully public history. */
  readonly ponds: readonly [
    readonly TileId[],
    readonly TileId[],
    readonly TileId[],
    readonly TileId[],
  ]
  /** All four exposed-meld lists indexed by Seat, in claim order — every call, ankan included, is declared in the open. */
  readonly melds: readonly [readonly Meld[], readonly Meld[], readonly Meld[], readonly Meld[]]
  /** Every flipped dora indicator in flip order — the only dead-wall tiles that are public. */
  readonly doraIndicators: readonly TileId[]
  /** The mapped dora kind of each flipped indicator, same order; doras[0] is the initial dora. */
  readonly doras: readonly TileKind[]
  /**
   * Tiles remaining in the live wall — the ONLY wall fact in the view. The wall's
   * tile identities (live order, unflipped dead layout) are THE hidden information;
   * a number is all any seat may know.
   */
  readonly wallCount: number
  /** The seat whose action is expected next — public table fact. */
  readonly turn: Seat
  /** The hand's phase, verbatim from the fold. */
  readonly phase: TableState['phase']
  /** The fresh discard open to claims, or null — the most public tile on the table. */
  readonly claimable: TableState['claimable']
  /** True while a caller visibly owes its claim discard. */
  readonly mustDiscard: boolean
  /** The declared win once phase is 'agari' — winner, tile, and yaku are announced facts. */
  readonly win: TableState['win']
  /**
   * Per-seat riichi lock, Seat-indexed (T-009-01-01) — a fully public fact, like
   * `ponds`/`melds`: a riichi discard is turned sideways at the real table.
   */
  readonly riichi: TableState['riichi']
  /**
   * The riichi stick pot as it stands right now (T-009-01-01) — a fully public
   * fact, like `doraIndicators`: sticks sit visibly on the table.
   */
  readonly pot: number
}

/**
 * Project a folded TableState down to `seat`'s legitimate view. Pure and total: no
 * throws, no RNG, the state is never mutated, all arrays in the result are fresh.
 * Same state and seat → deep-equal view, always — the projection reads only public
 * zones plus the seat's own concealed tiles, which is what T-006-01-02's property
 * (hidden-tile permutations leave the view identical) quantifies over.
 */
export function seatView(state: TableState, seat: Seat): SeatView {
  return {
    seat,
    hand: [...state.hands[seat]],
    drawn: state.turn === seat ? state.drawn : null,
    ponds: [[...state.ponds[0]], [...state.ponds[1]], [...state.ponds[2]], [...state.ponds[3]]],
    melds: [[...state.melds[0]], [...state.melds[1]], [...state.melds[2]], [...state.melds[3]]],
    doraIndicators: [...state.doraIndicators],
    doras: [...state.doras],
    wallCount: state.live.length,
    turn: state.turn,
    phase: state.phase,
    claimable: state.claimable,
    mustDiscard: state.mustDiscard,
    win: state.win,
    riichi: state.riichi,
    pot: state.pot,
  }
}
