import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  SEAT_COUNT,
  STARTING_HAND_SIZE,
  TILE_COUNT,
  buildWall,
  dealHands,
  doraKindOf,
  foldRecord,
  kindOf,
  partitionWall,
  type HandRecord,
  type TableState,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** The only well-typed record today: a seed with the empty action log. */
function recordOf(seed: number): HandRecord {
  return { seed, actions: [] }
}

describe('hand-record fold entrypoint', () => {
  it('folds an empty action log to the freshly dealt table — the explicit build → partition → deal → dora composition, for any seed (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const partition = partitionWall(buildWall(seed))
        const deal = dealHands(partition.live)
        const expected: TableState = {
          hands: deal.hands,
          live: deal.live,
          dead: partition.dead,
          doraIndicator: partition.doraIndicator,
          dora: doraKindOf(kindOf(partition.doraIndicator)),
        }
        expect(foldRecord(recordOf(seed))).toEqual(expected)
      }),
    )
  })

  it('same seed → identical deal (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const first = foldRecord(recordOf(seed))
        const second = foldRecord(recordOf(seed))
        expect(second.hands).toEqual(first.hands)
      }),
    )
  })

  it('same record → same folded state, deep-equal across repeated folds, as fresh arrays (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const record = recordOf(seed)
        const first = foldRecord(record)
        const second = foldRecord(record)
        expect(second).toEqual(first)
        expect(second.hands).not.toBe(first.hands)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          expect(second.hands[seat]).not.toBe(first.hands[seat])
        }
        expect(second.live).not.toBe(first.live)
        expect(second.dead).not.toBe(first.dead)
      }),
    )
  })

  it('does not mutate the record (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const record = recordOf(seed)
        const actionsSnapshot = [...record.actions]
        foldRecord(record)
        expect(record.seed).toBe(seed)
        expect([...record.actions]).toEqual(actionsSnapshot)
      }),
    )
  })

  it('conserves all 136 tiles across hands + live + dead through the fold (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const state = foldRecord(recordOf(seed))
        expect(state.hands.length).toBe(SEAT_COUNT)
        for (const hand of state.hands) expect(hand.length).toBe(STARTING_HAND_SIZE)
        const everything = [...state.hands.flat(), ...state.live, ...state.dead]
        expect(everything.length).toBe(TILE_COUNT)
        expect(new Set(everything).size).toBe(TILE_COUNT)
      }),
    )
  })

  it('rejects a record whose action log is non-empty — no action vocabulary exists yet', () => {
    // The cast deliberately defeats HandAction = never to simulate a corrupt (or
    // ahead-of-this-engine) record arriving from untyped JS or storage.
    const corrupt = { seed: 1, actions: [0] as unknown as HandRecord['actions'] }
    expect(() => foldRecord(corrupt)).toThrow(RangeError)
  })

  it('reproduces the frozen fold for seed 1 — a mismatch means the record contract moved and every stored hand replays wrong', () => {
    // Literals reused verbatim from the already-frozen goldens (hands + live prefix:
    // deal.test.ts / T-002-01-03 progress.md; dead wall + indicator: wall.test.ts /
    // T-002-01-02 progress.md). The mapped dora was derived by hand from the frozen
    // contracts (id 24 → kind index 6 → 7m → numbered cycle → 8m) and cross-checked
    // against a scratchpad fold run at capture time. Never regenerate.
    const state = foldRecord(recordOf(1))
    expect(state.hands).toEqual([
      [64, 53, 95, 45, 86, 118, 50, 8, 36, 46, 49, 11, 82],
      [98, 42, 120, 91, 2, 106, 28, 26, 81, 83, 7, 79, 38],
      [104, 0, 97, 110, 40, 73, 48, 44, 29, 10, 129, 22, 74],
      [132, 54, 37, 12, 89, 134, 113, 58, 61, 84, 32, 131, 4],
    ])
    expect(state.live.slice(0, 4)).toEqual([100, 60, 14, 66])
    expect(state.dead).toEqual([80, 41, 88, 6, 24, 128, 112, 124, 30, 99, 43, 101, 108, 75])
    expect(state.doraIndicator).toBe(24)
    expect(state.dora).toBe('8m')
  })
})
