import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  STARTING_HAND_SIZE,
  TILE_COUNT,
  buildWall,
  dealHands,
  partitionWall,
  type TileId,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** The full build → partition → deal chain for a seed, with the pieces tests assert on. */
function dealFor(seed: number) {
  const partition = partitionWall(buildWall(seed))
  return { partition, deal: dealHands(partition.live) }
}

describe('deal four starting hands', () => {
  it('conserves all 136 tiles across hands + remaining live wall + dead wall, 13 per hand, for any seed (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { partition, deal } = dealFor(seed)
        expect(deal.hands.length).toBe(SEAT_COUNT)
        for (const hand of deal.hands) expect(hand.length).toBe(STARTING_HAND_SIZE)
        expect(deal.live.length).toBe(LIVE_WALL_SIZE - DEAL_SIZE)
        const everything = [...deal.hands.flat(), ...deal.live, ...partition.dead]
        expect(everything.length).toBe(TILE_COUNT)
        expect(new Set(everything).size).toBe(TILE_COUNT)
      }),
    )
  })

  it('deals hands in E/S/W/N seat order by the frozen 4-4-4-1 procedure (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { partition, deal } = dealFor(seed)
        const live = partition.live
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          const expected: TileId[] = []
          for (let round = 0; round < 3; round++) {
            expected.push(...live.slice(16 * round + 4 * seat, 16 * round + 4 * seat + 4))
          }
          expected.push(live[48 + seat])
          expect(deal.hands[seat]).toEqual(expected)
        }
        expect(deal.live).toEqual(live.slice(DEAL_SIZE))
      }),
    )
  })

  it('produces an identical deal for the same seed, as fresh arrays (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const first = dealFor(seed).deal
        const second = dealFor(seed).deal
        expect(second).toEqual(first)
        expect(second.hands).not.toBe(first.hands)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          expect(second.hands[seat]).not.toBe(first.hands[seat])
        }
        expect(second.live).not.toBe(first.live)
      }),
    )
  })

  it('does not mutate the input live wall (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { live } = partitionWall(buildWall(seed))
        const snapshot = [...live]
        dealHands(live)
        expect(live).toEqual(snapshot)
      }),
    )
  })

  it('rejects live walls that are not exactly 122 tiles', () => {
    for (const length of [0, 52, 121, 123, 136]) {
      expect(() => dealHands(Array.from({ length }, (_, i) => i))).toThrow(RangeError)
    }
  })

  it("reproduces the frozen deal for seed 1 — a mismatch means the deal convention changed and every stored seed's hands are invalid", () => {
    // Captured once from the frozen wall and cross-checked against an independent
    // literal-index derivation of the 4-4-4-1 procedure (see T-002-01-03 progress.md);
    // East's first four tiles equal the frozen wall prefix and deal.live[0] equals
    // buildWall(1)[52]. Both derivations and both anchors agreed at capture time.
    // Never regenerate.
    const { deal } = dealFor(1)
    expect(deal.hands).toEqual([
      [64, 53, 95, 45, 86, 118, 50, 8, 36, 46, 49, 11, 82],
      [98, 42, 120, 91, 2, 106, 28, 26, 81, 83, 7, 79, 38],
      [104, 0, 97, 110, 40, 73, 48, 44, 29, 10, 129, 22, 74],
      [132, 54, 37, 12, 89, 134, 113, 58, 61, 84, 32, 131, 4],
    ])
    expect(deal.live.slice(0, 4)).toEqual([100, 60, 14, 66])
  })
})
