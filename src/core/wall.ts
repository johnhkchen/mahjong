// The wall: a seeded permutation of all 136 tile ids, plus its partition into the
// 122-tile live wall and 14-tile dead wall with the initial dora indicator flipped.
// Deal order and calls remain positions/consumers within this sequence, owned by later
// tickets.

import { createRng, shuffleInPlace } from './rng'
import { TILE_COUNT, allTileIds, type TileId } from './tiles'

/**
 * Build the shuffled 136-tile wall for a seed. Same seed → identical wall order, forever:
 * a hand's record is its seed plus its action list, so this function is part of the
 * replay/log contract (see the freeze note in rng.ts). Returns a fresh mutable array per
 * call — callers may consume it destructively.
 */
export function buildWall(seed: number): TileId[] {
  return shuffleInPlace(createRng(seed), allTileIds())
}

/** The dead wall is always exactly 14 tiles: 4 rinshan draws + 5 dora + 5 ura indicators. */
export const DEAD_WALL_SIZE = 14

/** Live wall (deal + draws): everything that is not the dead wall — 122 tiles. */
export const LIVE_WALL_SIZE = TILE_COUNT - DEAD_WALL_SIZE

/**
 * Index of the initially flipped dora indicator WITHIN the dead wall. CONTRACT FREEZE:
 * this convention is part of the replay format — moving it silently changes the dora of
 * every stored hand.
 */
export const INITIAL_DORA_INDICATOR_INDEX = 4

export interface WallPartition {
  /** 122 tiles in draw order — live[0] is the first tile dealt. Fresh array per call. */
  live: TileId[]
  /**
   * 14 tiles. Layout convention (frozen, see partitionWall): [0..3] rinshan draws in
   * draw order; [4, 6, 8, 10, 12] dora indicators, initial flip at 4, kan flips walking
   * rightward; [5, 7, 9, 11, 13] ura-dora indicators, each paired directly after its
   * dora indicator. Fresh array per call.
   */
  dead: TileId[]
  /** The initially flipped indicator — always dead[INITIAL_DORA_INDICATOR_INDEX]. */
  doraIndicator: TileId
}

/**
 * Partition a built wall into live wall + dead wall and flip the initial dora
 * indicator. Pure derivation: no RNG draws, input untouched, fresh slices out.
 *
 * CONTRACT FREEZE — the linearization convention is part of the replay format, like the
 * rng stream: the dead wall is the LAST 14 tiles of the sequence, the live wall is drawn
 * front-to-back starting at index 0, and the dead wall's internal layout is the table on
 * WallPartition.dead. Only the initial indicator is exposed here; kan/rinshan/ura
 * tickets consume the rest of the documented map.
 *
 * Wall length is guarded loudly (a short/long wall is engine corruption, per the nextInt
 * precedent); tile id VALUES are not validated here — ids entering from outside the
 * program are validated at the log-parser boundary, per the TileId rule in tiles.ts.
 */
export function partitionWall(wall: readonly TileId[]): WallPartition {
  if (wall.length !== TILE_COUNT) {
    throw new RangeError(`partitionWall requires exactly ${TILE_COUNT} tiles, got ${wall.length}`)
  }
  const live = wall.slice(0, LIVE_WALL_SIZE)
  const dead = wall.slice(LIVE_WALL_SIZE)
  return { live, dead, doraIndicator: dead[INITIAL_DORA_INDICATOR_INDEX] }
}
