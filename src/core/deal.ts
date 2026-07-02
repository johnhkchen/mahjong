// The deal: the first consumer of the live wall. Four 13-tile starting hands are taken
// from the head of the live wall by the physical riichi procedure (three rounds of 4
// tiles per seat, East first, then 1 tile each), leaving the 70-tile remainder for
// draws. Pure derivation of the wall order — no RNG access, ever; the seed already
// encodes the entire deal.

import type { TileId } from './tiles'
import { LIVE_WALL_SIZE } from './wall'

/**
 * Seat index in E/S/W/N dealer order: 0 = East (the dealer), 1 = South, 2 = West,
 * 3 = North — the same ordering the honor kinds 1z-4z anchor in tiles.ts. Winds rotate
 * across hands in later tickets; within one hand a seat is fixed.
 */
export type Seat = 0 | 1 | 2 | 3

export const SEAT_COUNT = 4

/** A starting hand is 13 tiles; the dealer's 14th is the first draw of play, not deal. */
export const STARTING_HAND_SIZE = 13

/** Tiles the deal consumes from the live wall — 52, leaving 70 for draws. */
export const DEAL_SIZE = SEAT_COUNT * STARTING_HAND_SIZE

export interface Deal {
  /**
   * Four 13-tile hands indexed by Seat (E, S, W, N). Each hand is in draw order —
   * never sorted; sorting is presentation, and the record keeps the true sequence.
   * Fresh arrays per call.
   */
  hands: readonly [TileId[], TileId[], TileId[], TileId[]]
  /**
   * The 70 live-wall tiles remaining after the deal, still in draw order — live[0] is
   * the dealer's first draw. Fresh array per call.
   */
  live: TileId[]
}

/**
 * Deal four starting hands from a full 122-tile live wall. Pure derivation: no RNG
 * draws, input untouched, fresh arrays out.
 *
 * CONTRACT FREEZE — the deal convention is part of the replay format, like the rng
 * stream and the wall orientation: the physical 4-4-4-1 procedure linearized. For
 * round r in {0, 1, 2} and seat s, hands[s] takes live[16r + 4s .. 16r + 4s + 3]; then
 * each seat takes the single live[48 + s]; the remainder is live.slice(52). Moving any
 * of this silently changes the hands of every stored seed.
 *
 * Wall length is guarded loudly (a deal happens only from a full pre-deal live wall;
 * anything else is engine corruption, per the nextInt precedent); tile id VALUES are
 * not validated here — ids entering from outside the program are validated at the
 * log-parser boundary, per the TileId rule in tiles.ts.
 */
export function dealHands(live: readonly TileId[]): Deal {
  if (live.length !== LIVE_WALL_SIZE) {
    throw new RangeError(`dealHands requires exactly ${LIVE_WALL_SIZE} tiles, got ${live.length}`)
  }
  const hands: [TileId[], TileId[], TileId[], TileId[]] = [[], [], [], []]
  for (let round = 0; round < 3; round++) {
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      const start = 16 * round + 4 * seat
      hands[seat].push(live[start], live[start + 1], live[start + 2], live[start + 3])
    }
  }
  for (let seat = 0; seat < SEAT_COUNT; seat++) {
    hands[seat].push(live[48 + seat])
  }
  return { hands, live: live.slice(DEAL_SIZE) }
}
