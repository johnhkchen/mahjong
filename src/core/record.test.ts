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
  doraKindOf,
  foldRecord,
  kindOf,
  partitionWall,
  type HandAction,
  type HandRecord,
  type Seat,
  type TableState,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** A seed with the empty action log — folds to the freshly dealt table. */
function recordOf(seed: number): HandRecord {
  return { seed, actions: [] }
}

/** Complete draw+discard turns in a full hand: one per live-wall tile after the deal. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE // 70

/**
 * The post-deal live wall for a seed, derived from the frozen upstream contracts
 * (wall build → partition → deal) — never from the fold under test.
 */
function dealtLive(seed: number): number[] {
  return dealHands(partitionWall(buildWall(seed)).live).live
}

/**
 * A tsumogiri-only record: `turns` complete draw+discard turns cycling E→S→W→N. The
 * i-th turn's seat is i % 4 and its tile is the i-th post-deal live tile — a
 * tsumogiri log is fully predictable from the deal, so expectations in these tests
 * come from the wall, not from the step function they exercise.
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

/** The 140-action full hand: every live tile drawn and tsumogiri'd, ending in ryuukyoku. */
function maximalRecord(seed: number): HandRecord {
  return tsumogiriRecord(seed, FULL_TURNS)
}

/** Turn counts worth folding: 0 (dealt), mid-hand, and the full 70. */
const turnsArb = fc.integer({ min: 0, max: FULL_TURNS })

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
          ponds: [[], [], [], []],
          melds: [[], [], [], []],
          claimable: null,
          mustDiscard: false,
          turn: 0,
          drawn: null,
          phase: 'playing',
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
        expect(second.ponds).not.toBe(first.ponds)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          expect(second.hands[seat]).not.toBe(first.hands[seat])
          expect(second.ponds[seat]).not.toBe(first.ponds[seat])
        }
        expect(second.live).not.toBe(first.live)
        expect(second.dead).not.toBe(first.dead)
      }),
    )
  })

  it('does not mutate the record — empty or mid-hand (property)', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, (seed, turns) => {
        const record = tsumogiriRecord(seed, turns)
        const actionsSnapshot = structuredClone(record.actions)
        foldRecord(record)
        expect(record.seed).toBe(seed)
        expect(record.actions).toEqual(actionsSnapshot)
      }),
    )
  })

  it('conserves all 136 tiles across hands + ponds + drawn + live + dead at every fold (property)', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, fc.boolean(), (seed, turns, dangleDraw) => {
        // Optionally leave a draw dangling so the identity is checked mid-turn too.
        const record = tsumogiriRecord(seed, turns)
        const actions =
          dangleDraw && turns < FULL_TURNS
            ? [...record.actions, { type: 'draw', seat: (turns % SEAT_COUNT) as Seat } as const]
            : record.actions
        const state = foldRecord({ seed, actions })
        expect(state.hands.length).toBe(SEAT_COUNT)
        for (const hand of state.hands) expect(hand.length).toBe(STARTING_HAND_SIZE)
        const everything = [
          ...state.hands.flat(),
          ...state.ponds.flat(),
          ...(state.drawn === null ? [] : [state.drawn]),
          ...state.live,
          ...state.dead,
        ]
        expect(everything.length).toBe(TILE_COUNT)
        expect(new Set(everything).size).toBe(TILE_COUNT)
      }),
    )
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

describe('draw/discard step', () => {
  it('folds interleaved tsumogiri turns to the wall-derived ponds, turn pointer, and untouched hands (property)', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, (seed, turns) => {
        const state = foldRecord(tsumogiriRecord(seed, turns))
        const live = dealtLive(seed)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          const expectedPond = live.slice(0, turns).filter((_, i) => i % SEAT_COUNT === seat)
          expect(state.ponds[seat]).toEqual(expectedPond)
        }
        // Tsumogiri never touches a hand; the live wall just shrinks from the front.
        expect(state.hands).toEqual(foldRecord(recordOf(seed)).hands)
        expect(state.live).toEqual(live.slice(turns))
        expect(state.drawn).toBeNull()
        if (turns < FULL_TURNS) {
          expect(state.phase).toBe('playing')
          expect(state.turn).toBe(turns % SEAT_COUNT)
        }
      }),
    )
  })

  it('holds a dangling draw apart from the hand: drawn is the exact next live tile, hand stays 13 (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: FULL_TURNS - 1 }), (seed, turns) => {
        const record = tsumogiriRecord(seed, turns)
        const seat = (turns % SEAT_COUNT) as Seat
        const state = foldRecord({ seed, actions: [...record.actions, { type: 'draw', seat }] })
        expect(state.drawn).toBe(dealtLive(seed)[turns])
        expect(state.hands[seat].length).toBe(STARTING_HAND_SIZE)
        expect(state.turn).toBe(seat)
        expect(state.phase).toBe('playing')
      }),
    )
  })

  it('tedashi: the hand tile goes to the pond and the drawn tile is appended to the hand end', () => {
    // Frozen seed-1 facts: hands[0][0] = 64, first live tile (East's draw) = 100.
    const state = foldRecord({
      seed: 1,
      actions: [
        { type: 'draw', seat: 0 },
        { type: 'discard', seat: 0, tile: 64 },
      ],
    })
    expect(state.ponds[0]).toEqual([64])
    expect(state.hands[0]).toEqual([53, 95, 45, 86, 118, 50, 8, 36, 46, 49, 11, 82, 100])
    expect(state.drawn).toBeNull()
    expect(state.turn).toBe(1)
  })

  it('drains the wall into ryuukyoku: 70 turns, empty live, ponds partition the draws, South discards last (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const state = foldRecord(maximalRecord(seed))
        expect(state.phase).toBe('ryuukyoku')
        expect(state.live).toEqual([])
        expect(state.drawn).toBeNull()
        expect(state.ponds.flat().length).toBe(FULL_TURNS)
        // 70 draws cycle E,S,W,N: 18/18/17/17; the 70th (last) discarder is South.
        expect(state.ponds.map((p) => p.length)).toEqual([18, 18, 17, 17])
        expect(state.turn).toBe(1)
      }),
    )
  })

  it('ends exactly when live is empty: still playing through the 70th draw, ryuukyoku on its discard (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { actions } = maximalRecord(seed)
        const throughLastDraw = foldRecord({ seed, actions: actions.slice(0, -1) })
        expect(throughLastDraw.live).toEqual([])
        expect(throughLastDraw.phase).toBe('playing')
        expect(throughLastDraw.drawn).not.toBeNull()
        expect(foldRecord({ seed, actions }).phase).toBe('ryuukyoku')
      }),
    )
  })

  it('same non-empty record → same folded state, as fresh arrays (property)', () => {
    fc.assert(
      fc.property(seedArb, turnsArb, (seed, turns) => {
        const record = tsumogiriRecord(seed, turns)
        const first = foldRecord(record)
        const second = foldRecord(record)
        expect(second).toEqual(first)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          expect(second.ponds[seat]).not.toBe(first.ponds[seat])
          expect(second.hands[seat]).not.toBe(first.hands[seat])
        }
      }),
    )
  })
})

describe('illegal actions throw instead of folding silently', () => {
  // Every case appends one bad action to a legally-reachable prefix and asserts a
  // loud RangeError. Concrete tiles come from the frozen seed-1 fold: East's hand
  // starts [64, ...], South's [98, ...], and East's first draw is live tile 100.
  const SEED = 1

  /** Fold `prefix ++ [bad]` and assert it throws a RangeError mentioning `fragment`. */
  function expectThrows(prefix: readonly HandAction[], bad: HandAction, fragment: string) {
    const actions = [...prefix, bad]
    expect(() => foldRecord({ seed: SEED, actions })).toThrow(RangeError)
    expect(() => foldRecord({ seed: SEED, actions })).toThrow(fragment)
  }

  const eastDraw: HandAction = { type: 'draw', seat: 0 }
  const oneTurn = tsumogiriRecord(SEED, 1).actions // East draws 100 and tsumogiris it

  it('wrong-seat draw: South cannot take East’s first turn', () => {
    expectThrows([], { type: 'draw', seat: 1 }, "seat 0's turn")
  })

  it('wrong-seat discard: South cannot discard on East’s turn', () => {
    expectThrows([eastDraw], { type: 'discard', seat: 1, tile: 98 }, "seat 0's turn")
  })

  it('draw out of sequence: a second draw before discarding', () => {
    expectThrows([eastDraw], eastDraw, 'out of sequence')
  })

  it('discard before drawing, even of a tile genuinely in hand', () => {
    expectThrows([], { type: 'discard', seat: 0, tile: 64 }, 'before seat 0 drew')
  })

  it('discard of a tile in another seat’s hand', () => {
    expectThrows([eastDraw], { type: 'discard', seat: 0, tile: 98 }, 'neither holds nor just drew')
  })

  it('discard of a tile still buried in the live wall', () => {
    // live[1] = 60 is South's upcoming draw, not East's to discard.
    expectThrows([eastDraw], { type: 'discard', seat: 0, tile: 60 }, 'neither holds nor just drew')
  })

  it('discard of a tile already in the pond', () => {
    expectThrows(oneTurn, { type: 'discard', seat: 1, tile: 100 }, 'before seat 1 drew')
  })

  it('any action after ryuukyoku: the ended hand accepts nothing', () => {
    const done = maximalRecord(SEED).actions
    expectThrows(done, { type: 'draw', seat: 1 }, 'already ended in ryuukyoku')
    expectThrows(done, { type: 'discard', seat: 1, tile: 64 }, 'already ended in ryuukyoku')
  })

  it('unknown action type from untyped JS folds loudly, never silently', () => {
    // The cast simulates a corrupt (or ahead-of-this-engine) record arriving from
    // storage — the old empty-vocabulary guard's spirit, kept under the real step.
    const corrupt = { type: 'riichi', seat: 0 } as unknown as HandAction
    expectThrows([], corrupt, 'unknown action type')
    expectThrows(oneTurn, corrupt, 'unknown action type')
  })
})
