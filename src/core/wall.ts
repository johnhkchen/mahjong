// The wall: a seeded permutation of all 136 tile ids. Nothing more — deal order, dead
// wall, and dora indicators are positions WITHIN this sequence, owned by later tickets.

import { createRng, shuffleInPlace } from './rng'
import { allTileIds, type TileId } from './tiles'

/**
 * Build the shuffled 136-tile wall for a seed. Same seed → identical wall order, forever:
 * a hand's record is its seed plus its action list, so this function is part of the
 * replay/log contract (see the freeze note in rng.ts). Returns a fresh mutable array per
 * call — callers may consume it destructively.
 */
export function buildWall(seed: number): TileId[] {
  return shuffleInPlace(createRng(seed), allTileIds())
}
