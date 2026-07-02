import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  COPIES_PER_KIND,
  DEAD_WALL_SIZE,
  INITIAL_DORA_INDICATOR_INDEX,
  LIVE_WALL_SIZE,
  TILE_COUNT,
  TILE_KINDS,
  buildWall,
  kindOf,
  partitionWall,
  type TileKind,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

describe('wall build', () => {
  it('deals exactly 136 tiles with exactly 4 of each of the 34 kinds, for any seed (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const wall = buildWall(seed)
        expect(wall.length).toBe(TILE_COUNT)
        expect(new Set(wall).size).toBe(TILE_COUNT)
        for (const id of wall) {
          expect(Number.isInteger(id)).toBe(true)
          expect(id).toBeGreaterThanOrEqual(0)
          expect(id).toBeLessThan(TILE_COUNT)
        }
        const census = new Map<TileKind, number>()
        for (const id of wall) {
          const kind = kindOf(id)
          census.set(kind, (census.get(kind) ?? 0) + 1)
        }
        expect(census.size).toBe(TILE_KINDS.length)
        for (const kind of TILE_KINDS) expect(census.get(kind)).toBe(COPIES_PER_KIND)
      }),
    )
  })

  it('produces an identical wall order for the same seed, as fresh arrays (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const first = buildWall(seed)
        const second = buildWall(seed)
        expect(second).toEqual(first)
        expect(second).not.toBe(first)
      }),
    )
  })

  it('produces different walls for different seeds (property)', () => {
    // A collision between two distinct uint32 seeds on a 136-tile permutation is possible
    // in principle but vanishingly improbable (≪ 2^-100 per pair); if this ever fires it
    // has found a genuine seed collision worth knowing about.
    fc.assert(
      fc.property(
        fc.tuple(seedArb, seedArb).filter(([a, b]) => a !== b),
        ([a, b]) => {
          expect(buildWall(a)).not.toEqual(buildWall(b))
        },
      ),
    )
  })

  it('normalizes any JS number seed with >>> 0 (property)', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false, noDefaultInfinity: false }), (d) => {
        expect(buildWall(d)).toEqual(buildWall(d >>> 0))
      }),
    )
  })

  it('reproduces the frozen wall prefix for seed 1 — a mismatch here means the shuffle stream changed and every stored seed is invalid', () => {
    // Captured once from the frozen rng and cross-checked against an independent
    // reference implementation (see T-001-02-02 progress.md). Never regenerate.
    expect(buildWall(1).slice(0, 12)).toEqual([64, 53, 95, 45, 98, 42, 120, 91, 104, 0, 97, 110])
  })
})

describe('wall partition', () => {
  it('splits any seeded wall into a 122-tile live wall and 14-tile dead wall that concatenate back to the original order (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const wall = buildWall(seed)
        const { live, dead } = partitionWall(wall)
        expect(live.length).toBe(LIVE_WALL_SIZE)
        expect(dead.length).toBe(DEAD_WALL_SIZE)
        const reassembled = [...live, ...dead]
        expect(reassembled).toEqual(wall)
        expect(new Set(reassembled).size).toBe(TILE_COUNT)
      }),
    )
  })

  it('flips the dora indicator at the documented fixed position — dead[4], i.e. wall[126] (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const wall = buildWall(seed)
        const { dead, doraIndicator } = partitionWall(wall)
        expect(doraIndicator).toBe(dead[INITIAL_DORA_INDICATOR_INDEX])
        expect(doraIndicator).toBe(wall[LIVE_WALL_SIZE + INITIAL_DORA_INDICATOR_INDEX])
        expect(doraIndicator).toBe(wall[126])
      }),
    )
  })

  it('produces an identical partition for the same seed, as fresh arrays (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const first = partitionWall(buildWall(seed))
        const second = partitionWall(buildWall(seed))
        expect(second).toEqual(first)
        expect(second.live).not.toBe(first.live)
        expect(second.dead).not.toBe(first.dead)
      }),
    )
  })

  it('does not mutate the input wall (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const wall = buildWall(seed)
        const snapshot = [...wall]
        partitionWall(wall)
        expect(wall).toEqual(snapshot)
      }),
    )
  })

  it('rejects walls that are not exactly 136 tiles', () => {
    for (const length of [0, 135, 137]) {
      expect(() => partitionWall(Array.from({ length }, (_, i) => i))).toThrow(RangeError)
    }
  })

  it("reproduces the frozen partition for seed 1 — a mismatch means the partition convention changed and every stored hand's dora is invalid", () => {
    // Captured once from the frozen wall (see T-002-01-02 progress.md): the dead wall is
    // the last 14 of buildWall(1), the indicator is dead[4] === wall[126]. Both reads
    // agreed at capture time. Never regenerate.
    const { dead, doraIndicator } = partitionWall(buildWall(1))
    expect(dead).toEqual([80, 41, 88, 6, 24, 128, 112, 124, 30, 99, 43, 101, 108, 75])
    expect(doraIndicator).toBe(24)
  })
})
