// The record contract one level up: a GameRecord is a seed plus one action log per hand
// played so far, and every derived fact (scores, dealer, seat winds, the active hand's
// table) is a FOLD over it — fold-only authority, same discipline record.ts applies within
// one hand. No hand stores its own seed: handSeedOf(gameSeed, handIndex) always derives it,
// so there is never a second authority that could disagree with a stored value (the same
// reasoning record.ts's header applies to draw/tsumo tiles and ron winners).
//
// THE KEY FACT THIS MODULE LEANS ON: engine Seat is already dealer-relative, not
// player-absolute. dealHands always deals starting from live[0] to Seat 0 first, and
// every wind/yaku computation in record.ts/settlement.ts treats Seat 0 as "this hand's
// dealer" unconditionally (windKindOf(seat) = `${seat+1}z`). So within one hand's fold,
// "whoever plays engine seat 0" already gets East and deals first — nothing in
// record.ts/settlement.ts needs to change for seat-wind yakuhai to score correctly after a
// rotation. What's missing, and what this module adds, is purely the layer above: which
// PERSISTENT PLAYER occupies engine seat 0 for hand h, given hand h-1's outcome. Round wind
// stays East throughout this module's scope (no East/South round transition, no honba) —
// record.ts's frozen ROUND_WIND is untouched, per the ticket's own text.
//
// RENCHAN SCOPE: the dealer repeats only on a dealer win (state.win.winner === 0 in an
// 'agari' hand); every other ended hand — a non-dealer win, or ANY ryuukyoku regardless of
// who was tenpai — rotates the dealer by exactly one player. This is narrower than full
// real-rules renchan (which also carries on dealer-tenpai ryuukyoku), matching the ticket's
// own AC wording ("repeats on a dealer win... rotates otherwise") and settlement.ts's own
// existing scope cut (no honba exists to modify payouts on a repeat, so a finer-grained
// renchan model would have nothing to attach to yet).

import { foldRecord, type HandAction, type TableState } from './record'
import { SEAT_COUNT, type Seat } from './deal'
import type { WindKind } from './yaku'
import { settlementOf } from './settlement'

/**
 * A persistent identity across a whole game — distinct from Seat even though both share
 * the 0-3 domain. Seat means "this hand's engine-relative position, 0 = this hand's
 * dealer" (frozen by dealHands/windKindOf); Player means "the same person, stable while
 * the dealer identity rotates around them hand to hand."
 */
export type Player = 0 | 1 | 2 | 3

/**
 * A game is its seed plus one action log per hand played so far — including the active
 * hand as the last element, whose action log may still be a `'playing'`-phase prefix (or
 * even empty, for a freshly dealt hand with no actions logged yet). Every earlier hand must
 * already be ended (see foldGame's guard) — a GameRecord only grows a new trailing entry
 * once the previous one is over.
 */
export interface GameRecord {
  readonly seed: number
  readonly hands: readonly (readonly HandAction[])[]
}

/**
 * The game as it stands after folding a record — a DERIVED VIEW, like TableState: widening
 * it later (honba, round wind, a hand-index field) is extend-only.
 */
export interface GameState {
  /** Four seat scores indexed by Player, starting at STARTING_SCORE each. */
  readonly scores: readonly [number, number, number, number]
  /** The active (last) hand's dealer, as a persistent Player identity. */
  readonly dealer: Player
  /**
   * Each Player's current wind for the active hand, indexed by Player.
   * seatWinds[dealer] is always '1z' (East) — the dealer always sits East.
   */
  readonly seatWinds: readonly [WindKind, WindKind, WindKind, WindKind]
  /**
   * The active hand's folded TableState, exactly as foldRecord produced it —
   * engine-Seat-indexed (0 = this hand's dealer, per the module header's key fact). Map its
   * seats to Players via `dealer`: engine seat s is player (dealer + s) % SEAT_COUNT.
   */
  readonly table: TableState
}

/** Starting score for every seat — the standard riichi convention (25000 each). */
const STARTING_SCORE = 25000

/**
 * Odd mixing constant (the fixed-point golden ratio, the splitmix32 precedent) for
 * handSeedOf. Odd matters: multiplication by an odd number is a bijection on Z/2^32Z (odd
 * numbers are units in that ring), which is what makes the derivation provably
 * collision-free below.
 */
const GOLDEN_RATIO_32 = 0x9e3779b1

/**
 * The per-hand seed a game's hand at `handIndex` deals from. CONTRACT FREEZE, the
 * rng.ts/wall.ts/deal.ts precedent: this exact formula is part of the replay format,
 * because a GameRecord's replay depends on rederiving the identical wall for every hand.
 *
 * PROVABLY COLLISION-FREE, not just empirically unlikely: for a FIXED gameSeed, the map
 * `handIndex ↦ Math.imul(handIndex + 1, GOLDEN_RATIO_32) mod 2^32` is a bijection on
 * Z/2^32Z (GOLDEN_RATIO_32 is odd, hence a unit in that ring — multiplication by a unit is
 * invertible, hence injective on the whole domain); XORing by the fixed gameSeed is a
 * bijection too (XOR by a constant is its own inverse). The composition of two bijections
 * is a bijection, so `handIndex ↦ handSeedOf(gameSeed, handIndex)` is injective for every
 * handIndex in [0, 2^32) — no two hand indices in the same game can ever derive the same
 * seed, for any game seed whatsoever.
 */
export function handSeedOf(gameSeed: number, handIndex: number): number {
  if (!Number.isInteger(handIndex) || handIndex < 0) {
    throw new RangeError(`handSeedOf requires a non-negative integer handIndex, got ${handIndex}`)
  }
  return ((gameSeed >>> 0) ^ Math.imul(handIndex + 1, GOLDEN_RATIO_32)) >>> 0
}

/** The player occupying `seat` in a hand dealt by `dealer` (seat 0 is always `dealer`). */
function playerOfSeat(dealer: Player, seat: Seat): Player {
  return ((dealer + seat) % SEAT_COUNT) as Player
}

/** The engine seat `player` occupies in a hand dealt by `dealer` — playerOfSeat's inverse. */
function seatOfPlayer(dealer: Player, player: Player): Seat {
  return ((player - dealer + SEAT_COUNT) % SEAT_COUNT) as Seat
}

/** The next dealer in rotation order — one seat over, wrapping East←North. */
function nextPlayer(player: Player): Player {
  return ((player + 1) % SEAT_COUNT) as Player
}

/** A seat's own wind kind: Seat 0-3 anchors 1z-4z — record.ts's windKindOf, duplicated. */
function windKindOf(seat: Seat): WindKind {
  return `${seat + 1}z` as WindKind
}

/** Every player's current wind, given the active hand's dealer — indexed by Player. */
function seatWindsOf(dealer: Player): readonly [WindKind, WindKind, WindKind, WindKind] {
  return [0, 1, 2, 3].map((player) =>
    windKindOf(seatOfPlayer(dealer, player as Player)),
  ) as [WindKind, WindKind, WindKind, WindKind]
}

/**
 * The fold entrypoint: record in, game state out. Walks hands left to right, threading the
 * dealer identity through renchan/rotation decisions (module header) and accumulating
 * settlementOf's per-seat deltas — remapped from engine Seat to persistent Player via
 * whichever dealer was current for THAT hand — into running scores. The loop stops at the
 * first hand still `'playing'` (the active hand, which must be the last element — see the
 * guard below) without a rotation decision or a score update for it; if every hand is
 * ended, it stops after the last one the same way, so `dealer`/`seatWinds`/`table` always
 * describe the ACTIVE (last) hand, never a prediction of the hand after it.
 *
 * A record whose hands list is empty, or whose non-last hand is still `'playing'`, is
 * corruption (there is no way to have legitimately started a later hand while an earlier
 * one never finished) and throws RangeError — the record.ts "throw loudly instead of
 * folding silently" convention, generalized one level.
 */
export function foldGame(record: GameRecord): GameState {
  if (record.hands.length === 0) {
    throw new RangeError('foldGame requires at least one hand')
  }
  let dealer: Player = 0
  const scores: [number, number, number, number] = [
    STARTING_SCORE,
    STARTING_SCORE,
    STARTING_SCORE,
    STARTING_SCORE,
  ]
  let table: TableState | undefined
  for (let index = 0; index < record.hands.length; index++) {
    const isLast = index === record.hands.length - 1
    const state = foldRecord({ seed: handSeedOf(record.seed, index), actions: record.hands[index] })
    if (state.phase === 'playing') {
      if (!isLast) {
        throw new RangeError(
          `foldGame: hand ${index} is still 'playing' but is followed by another hand`,
        )
      }
      table = state
      break
    }
    const deltas = settlementOf(state)
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      scores[playerOfSeat(dealer, seat as Seat)] += deltas[seat]
    }
    table = state
    if (isLast) break
    const dealerWon = state.phase === 'agari' && state.win!.winner === 0
    dealer = dealerWon ? dealer : nextPlayer(dealer)
  }
  return { scores, dealer, seatWinds: seatWindsOf(dealer), table: table! }
}
