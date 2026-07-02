// The agreement suite: legalActions (the offered half of the contract) cross-checked
// against foldRecord's step (the folding half). The two are independent statements of
// the turn cycle — these tests are the lock that keeps them agreeing: every offered
// action folds, everything outside the offered set throws, an ended hand offers
// nothing. Importing from './index' is itself the AC's barrel-export check.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  buildWall,
  dealHands,
  foldRecord,
  legalActions,
  partitionWall,
  type HandAction,
  type HandRecord,
  type Seat,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Complete draw+discard turns in a full hand: one per live-wall tile after the deal. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE // 70

/**
 * The post-deal live wall for a seed, derived from the frozen upstream contracts
 * (wall build → partition → deal) — never from the code under test.
 */
function dealtLive(seed: number): number[] {
  return dealHands(partitionWall(buildWall(seed)).live).live
}

/**
 * A tsumogiri-only record: `turns` complete draw+discard turns cycling E→S→W→N, the
 * i-th turn's tile being the i-th post-deal live tile — fully predictable from the
 * deal (the record.test.ts helper, mirrored per-file per house convention).
 */
function tsumogiriRecord(seed: number, turns: number): HandRecord {
  const live = dealtLive(seed)
  const actions: HandAction[] = []
  for (let i = 0; i < turns; i++) {
    const seat = (i % SEAT_COUNT) as Seat
    actions.push({ type: 'draw', seat }, { type: 'discard', seat, tile: live[i] })
  }
  return { seed, actions }
}

/** The 140-action full hand: every live tile drawn and tsumogiri'd → ryuukyoku. */
function maximalRecord(seed: number): HandRecord {
  return tsumogiriRecord(seed, FULL_TURNS)
}

/**
 * An arbitrary mid-hand action point: `turns` complete turns, optionally plus a
 * dangling draw — even action counts land pre-draw (drawn === null), the dangle
 * lands post-draw. The dangle is only reachable while the hand is still playing.
 */
const prefixArb = fc
  .record({
    seed: seedArb,
    turns: fc.integer({ min: 0, max: FULL_TURNS }),
    dangle: fc.boolean(),
  })
  .map(({ seed, turns, dangle }) => {
    const record = tsumogiriRecord(seed, turns)
    const actions =
      dangle && turns < FULL_TURNS
        ? [...record.actions, { type: 'draw', seat: (turns % SEAT_COUNT) as Seat } as const]
        : record.actions
    return { seed, actions }
  })

describe('the set is the closed form', () => {
  it('pre-draw: exactly the turn seat’s single draw (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: FULL_TURNS - 1 }), (seed, turns) => {
        const state = foldRecord(tsumogiriRecord(seed, turns))
        expect(legalActions(state)).toEqual([{ type: 'draw', seat: state.turn }])
      }),
    )
  })

  it('post-draw: exactly the 14 discards — hand tiles in hand order, drawn last, all by the turn seat (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: FULL_TURNS - 1 }), (seed, turns) => {
        const { actions } = tsumogiriRecord(seed, turns)
        const seat = (turns % SEAT_COUNT) as Seat
        const state = foldRecord({ seed, actions: [...actions, { type: 'draw', seat }] })
        const expected = [
          ...state.hands[state.turn].map((tile) => ({ type: 'discard', seat: state.turn, tile })),
          { type: 'discard', seat: state.turn, tile: state.drawn },
        ]
        expect(legalActions(state)).toEqual(expected)
        expect(new Set(expected.map((a) => a.tile)).size).toBe(expected.length)
      }),
    )
  })
})

describe('ended hand offers nothing', () => {
  it('a ryuukyoku fold returns no legal actions (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const state = foldRecord(maximalRecord(seed))
        expect(state.phase).toBe('ryuukyoku')
        expect(legalActions(state)).toEqual([])
      }),
    )
  })
})

describe('offered actions fold', () => {
  it('every action legalActions returns is accepted by the step function (property)', () => {
    fc.assert(
      fc.property(prefixArb, ({ seed, actions }) => {
        const state = foldRecord({ seed, actions })
        for (const action of legalActions(state)) {
          expect(() => foldRecord({ seed, actions: [...actions, action] })).not.toThrow()
        }
      }),
    )
  })
})

/** Membership key for the offered set — the action encoding, serialized. */
function keyOf(action: HandAction): string {
  return action.type === 'draw' ? `draw:${action.seat}` : `discard:${action.seat}:${action.tile}`
}

describe('outside actions throw', () => {
  it('sampled negatives: wrong seats, out-of-sequence draws/discards, unheld tiles — all absent from the set and all thrown by the fold (property)', () => {
    fc.assert(
      fc.property(prefixArb, ({ seed, actions }) => {
        const state = foldRecord({ seed, actions })
        const offered = new Set(legalActions(state).map(keyOf))
        const other = ((state.turn + 1) % SEAT_COUNT) as Seat
        // Negatives one rule outside legality at THIS action point. Tiles are drawn
        // from places the turn seat cannot legally discard from: another seat's
        // hand, the walls, its own pond.
        const bads: HandAction[] = [
          { type: 'draw', seat: other },
          { type: 'discard', seat: other, tile: state.hands[other][0] },
          { type: 'discard', seat: state.turn, tile: state.hands[other][0] },
          { type: 'discard', seat: state.turn, tile: state.dead[0] },
        ]
        if (state.drawn === null) {
          // Pre-draw (or ended): any discard by the turn seat is out of sequence.
          bads.push({ type: 'discard', seat: state.turn, tile: state.hands[state.turn][0] })
        } else {
          // Post-draw: a second draw is out of sequence.
          bads.push({ type: 'draw', seat: state.turn })
        }
        if (state.live.length > 0) {
          bads.push({ type: 'discard', seat: state.turn, tile: state.live[0] })
        }
        if (state.ponds[state.turn].length > 0) {
          bads.push({ type: 'discard', seat: state.turn, tile: state.ponds[state.turn][0] })
        }
        for (const bad of bads) {
          expect(offered.has(keyOf(bad))).toBe(false)
          expect(() => foldRecord({ seed, actions: [...actions, bad] })).toThrow(RangeError)
        }
      }),
    )
  })

  it('exhaustive partition at seed 1: all 548 encodable candidates split into offered ⇒ folds, outside ⇒ throws', () => {
    // Every draw/discard the encoding can express: 4 draws + 4 seats × 136 tiles.
    const candidates: HandAction[] = []
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      candidates.push({ type: 'draw', seat: seat as Seat })
      for (let tile = 0; tile < 136; tile++) {
        candidates.push({ type: 'discard', seat: seat as Seat, tile })
      }
    }
    expect(candidates.length).toBe(548)

    const oneTurn = tsumogiriRecord(1, 1).actions
    const anchors: { label: string; actions: readonly HandAction[]; offered: number }[] = [
      { label: 'pre-draw', actions: oneTurn, offered: 1 },
      { label: 'post-draw', actions: [...oneTurn, { type: 'draw', seat: 1 }], offered: 14 },
      { label: 'ended', actions: maximalRecord(1).actions, offered: 0 },
    ]
    for (const anchor of anchors) {
      const state = foldRecord({ seed: 1, actions: anchor.actions })
      const offered = new Set(legalActions(state).map(keyOf))
      expect(offered.size).toBe(anchor.offered)
      for (const candidate of candidates) {
        const fold = () => foldRecord({ seed: 1, actions: [...anchor.actions, candidate] })
        if (offered.has(keyOf(candidate))) {
          expect(fold, `${anchor.label}: offered ${keyOf(candidate)}`).not.toThrow()
        } else {
          expect(fold, `${anchor.label}: outside ${keyOf(candidate)}`).toThrow(RangeError)
        }
      }
    }
  })
})

describe('purity and freshness', () => {
  it('reads without mutating: the state deep-equals its pre-call snapshot (property)', () => {
    fc.assert(
      fc.property(prefixArb, ({ seed, actions }) => {
        const state = foldRecord({ seed, actions })
        const snapshot = structuredClone(state)
        legalActions(state)
        expect(state).toEqual(snapshot)
      }),
    )
  })

  it('repeated calls return equal but fresh arrays and action objects (property)', () => {
    fc.assert(
      fc.property(prefixArb, ({ seed, actions }) => {
        const state = foldRecord({ seed, actions })
        const first = legalActions(state)
        const second = legalActions(state)
        expect(second).toEqual(first)
        expect(second).not.toBe(first)
        for (let i = 0; i < first.length; i++) {
          expect(second[i]).not.toBe(first[i])
        }
      }),
    )
  })
})
