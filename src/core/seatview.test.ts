// The fair-play AC made executable: seatView(state, seat) exposes exactly the public
// zones plus the seat's own concealed tiles — own hand and drawn verbatim, all ponds,
// all melds, flipped indicators, and ONLY a number for the wall. Expectations derive
// from the frozen upstream contracts (wall build → partition → deal) and from folded
// states record.test.ts already pins, never from the projection under test. The
// hidden-permutation equivalence property is T-006-01-02's; these tests pin the
// public/hidden partition of a single real state.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  buildWall,
  dealHands,
  foldRecord,
  partitionWall,
  seatView,
  type HandAction,
  type HandRecord,
  type Seat,
  type SeatView,
  type TableState,
  type TileId,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Any of the four observing seats. */
const seatArb = fc.integer({ min: 0, max: SEAT_COUNT - 1 }).map((s) => s as Seat)

/** Complete draw+discard turns in a full hand: one per live-wall tile after the deal. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE // 70

/** Turn counts worth folding: 0 (dealt), mid-hand, and the full 70. */
const turnsArb = fc.integer({ min: 0, max: FULL_TURNS })

/**
 * The post-deal live wall for a seed, derived from the frozen upstream contracts
 * (wall build → partition → deal) — never from the fold or the projection under test.
 */
function dealtLive(seed: number): number[] {
  return dealHands(partitionWall(buildWall(seed)).live).live
}

/**
 * A tsumogiri-only record: `turns` complete draw+discard turns cycling E→S→W→N — the
 * record.test.ts pattern, fully predictable from the deal.
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

/**
 * A tsumogiri prefix optionally ending in a dangling draw, so states where a seat
 * HOLDS a drawn tile are covered alongside between-turns states.
 */
function foldedState(seed: number, turns: number, dangleDraw: boolean): TableState {
  const record = tsumogiriRecord(seed, turns)
  if (dangleDraw && turns < FULL_TURNS) {
    record.actions = [...record.actions, { type: 'draw', seat: (turns % SEAT_COUNT) as Seat }]
  }
  return foldRecord(record)
}

/**
 * THE collector: every tile id a SeatView can carry, by explicit field — hand, drawn,
 * ponds, melds' own and claimed, flipped indicators, the claimable tile, the win tile.
 * Explicit rather than a recursive number scan because wallCount/turn/seat are numbers
 * that may collide with tile-id values (70 is both a wall count and a valid TileId).
 */
function exposedTileIds(view: SeatView): TileId[] {
  return [
    ...view.hand,
    ...(view.drawn === null ? [] : [view.drawn]),
    ...view.ponds.flat(),
    ...view.melds.flat().flatMap((meld) => [...meld.own, ...('claimed' in meld ? [meld.claimed] : [])]),
    ...view.doraIndicators,
    ...(view.claimable === null ? [] : [view.claimable.tile]),
    ...(view.win === null ? [] : [view.win.tile]),
  ]
}

// Seed 67 — the record.test.ts daiminkan/shouminkan geometry, reused for a meld +
// claim-window state: East draws live[0] = 100 and tedashis its lone 5s (91); North
// holds the other three 5s copies and pons with [90, 88]. Never regenerate.
const PON_PREFIX_67: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 91 },
]
const PON_67: HandAction = { type: 'pon', seat: 3, tile: 91, uses: [90, 88] }

describe('own view', () => {
  it('carries the seat\'s own hand and held drawn tile verbatim (seed 1, seat 1 mid-draw)', () => {
    const state = foldedState(1, 5, true) // 5 turns, then South (seat 1) draws live[5]
    const view = seatView(state, 1)
    expect(state.drawn).not.toBeNull()
    expect(view.hand).toEqual(state.hands[1])
    expect(view.drawn).toBe(state.drawn)
  })

  it('hides another seat\'s drawn tile: every non-turn observer sees drawn null', () => {
    const state = foldedState(1, 5, true)
    expect(state.drawn).not.toBeNull()
    for (const seat of [0, 2, 3] as const) {
      expect(seatView(state, seat).drawn).toBeNull()
    }
  })

  it('hand is the seat\'s own, in draw order, at every seed/turn/seat', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, fc.boolean(), seatArb, (seed, turns, dangle, seat) => {
        const state = foldedState(seed, turns, dangle)
        const view = seatView(state, seat)
        expect(view.hand).toEqual(state.hands[seat])
        expect(view.drawn).toBe(state.turn === seat ? state.drawn : null)
      }),
    )
  })
})

describe('nothing hidden', () => {
  it('exposes no other seat\'s hand tiles and no live-wall tile ids', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, fc.boolean(), seatArb, (seed, turns, dangle, seat) => {
        const state = foldedState(seed, turns, dangle)
        const exposed = new Set(exposedTileIds(seatView(state, seat)))
        for (let other = 0; other < SEAT_COUNT; other++) {
          if (other === seat) continue
          for (const id of state.hands[other]) expect(exposed.has(id)).toBe(false)
        }
        for (const id of state.live) expect(exposed.has(id)).toBe(false)
      }),
    )
  })

  it('exposes no dead-wall tile ids beyond the flipped indicators', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, fc.boolean(), seatArb, (seed, turns, dangle, seat) => {
        const state = foldedState(seed, turns, dangle)
        const exposed = new Set(exposedTileIds(seatView(state, seat)))
        const flipped = new Set(state.doraIndicators)
        for (const id of state.dead) {
          if (!flipped.has(id)) expect(exposed.has(id)).toBe(false)
        }
      }),
    )
  })

  it('the view object has no hands/live/dead slots at all', () => {
    const view = seatView(foldedState(1, 5, true), 0)
    expect('hands' in view).toBe(false)
    expect('live' in view).toBe(false)
    expect('dead' in view).toBe(false)
  })
})

describe('wall count', () => {
  it('is live.length — a number — at every seed and turn count', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, fc.boolean(), seatArb, (seed, turns, dangle, seat) => {
        const state = foldedState(seed, turns, dangle)
        const view = seatView(state, seat)
        expect(typeof view.wallCount).toBe('number')
        expect(view.wallCount).toBe(state.live.length)
      }),
    )
  })

  it('spans the endpoints: 70 dealt, 0 after the full hand', () => {
    expect(seatView(foldRecord(tsumogiriRecord(1, 0)), 0).wallCount).toBe(FULL_TURNS)
    expect(seatView(foldRecord(tsumogiriRecord(1, FULL_TURNS)), 0).wallCount).toBe(0)
  })
})

describe('public facts pass through', () => {
  it('ponds, indicators, doras, turn, phase, mustDiscard, claimable, win, seat', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, fc.boolean(), seatArb, (seed, turns, dangle, seat) => {
        const state = foldedState(seed, turns, dangle)
        const view = seatView(state, seat)
        expect(view.seat).toBe(seat)
        expect(view.ponds).toEqual(state.ponds)
        expect(view.doraIndicators).toEqual(state.doraIndicators)
        expect(view.doras).toEqual(state.doras)
        expect(view.turn).toBe(state.turn)
        expect(view.phase).toBe(state.phase)
        expect(view.mustDiscard).toBe(state.mustDiscard)
        expect(view.claimable).toBe(state.claimable)
        expect(view.win).toBe(state.win)
      }),
    )
  })

  it('every observer sees the open claim window (seed 67, pre-pon)', () => {
    const state = foldRecord({ seed: 67, actions: [...PON_PREFIX_67] })
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      const view = seatView(state, seat as Seat)
      expect(view.claimable).toEqual({ seat: 0, tile: 91 })
      const exposed = new Set(exposedTileIds(view))
      for (const id of state.live) expect(exposed.has(id)).toBe(false)
    }
  })

  it('every observer sees the exposed pon and the owed claim discard (seed 67)', () => {
    const state = foldRecord({ seed: 67, actions: [...PON_PREFIX_67, PON_67] })
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      const view = seatView(state, seat as Seat)
      expect(view.melds[3]).toEqual([{ type: 'pon', claimed: 91, from: 0, own: [90, 88] }])
      expect(view.mustDiscard).toBe(true)
      const exposed = new Set(exposedTileIds(view))
      for (let other = 0; other < SEAT_COUNT; other++) {
        if (other === seat) continue
        for (const id of state.hands[other]) expect(exposed.has(id)).toBe(false)
      }
    }
  })
})

describe('freshness', () => {
  it('mutating the state after projection leaves the view unchanged', () => {
    const state = foldedState(1, 5, true)
    const view = seatView(state, 1)
    const hand = [...view.hand]
    const pond = [...view.ponds[0]]
    const indicators = [...view.doraIndicators]
    state.hands[1].push(999)
    state.ponds[0].push(999)
    state.doraIndicators.push(999)
    state.melds[3].push({ type: 'ankan', own: [0, 1, 2, 3] })
    expect(view.hand).toEqual(hand)
    expect(view.ponds[0]).toEqual(pond)
    expect(view.doraIndicators).toEqual(indicators)
    expect(view.melds[3]).toEqual([])
  })

  it('mutating the view\'s arrays leaves the state unchanged', () => {
    const state = foldedState(1, 5, true)
    const hand = [...state.hands[1]]
    const pond = [...state.ponds[0]]
    const view = seatView(state, 1)
    ;(view.hand as TileId[]).push(999)
    ;(view.ponds[0] as TileId[]).push(999)
    ;(view.doras as string[]).push('9z')
    expect(state.hands[1]).toEqual(hand)
    expect(state.ponds[0]).toEqual(pond)
  })

  it('hands out fresh arrays, never the state\'s own', () => {
    const state = foldRecord({ seed: 67, actions: [...PON_PREFIX_67, PON_67] })
    const view = seatView(state, 3)
    expect(view.hand).not.toBe(state.hands[3])
    expect(view.ponds[0]).not.toBe(state.ponds[0])
    expect(view.melds[3]).not.toBe(state.melds[3])
    expect(view.doraIndicators).not.toBe(state.doraIndicators)
    expect(view.doras).not.toBe(state.doras)
  })
})
