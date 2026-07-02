import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  COPIES_PER_KIND,
  TILE_COUNT,
  TILE_KINDS,
  buildWall,
  kindOf,
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
