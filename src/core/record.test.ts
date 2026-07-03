import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAD_WALL_SIZE,
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
  type TileId,
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

/** The frozen dead wall for a seed, from the upstream contracts — never from the fold. */
function dealtDead(seed: number): number[] {
  return partitionWall(buildWall(seed)).dead
}

/** The zones of the widened conservation partition — melds contribute `own` only. */
function allZonesWithMelds(state: TableState): number[] {
  return [
    ...state.hands.flat(),
    ...state.melds.flat().flatMap((meld) => meld.own),
    ...state.ponds.flat(),
    ...(state.drawn === null ? [] : [state.drawn]),
    ...state.live,
    ...state.dead,
  ]
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
          doraIndicators: [partition.doraIndicator],
          doras: [doraKindOf(kindOf(partition.doraIndicator))],
          ponds: [[], [], [], []],
          melds: [[], [], [], []],
          claimable: null,
          mustDiscard: false,
          turn: 0,
          drawn: null,
          drawnFrom: null,
          phase: 'playing',
          win: null,
          riichi: [false, false, false, false],
          pot: 0,
          scoresIn: [25000, 25000, 25000, 25000],
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
    expect(state.doraIndicators).toEqual([24])
    expect(state.doras).toEqual(['8m'])
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

describe('chi/pon claims fold', () => {
  // Frozen seed-1 facts (from the goldens above): East's hand holds 82 (3s) and
  // draws live[0] = 100 (8s); South's hand is [98, 42, 120, 91, 2, 106, 28, 26,
  // 81, 83, 7, 79, 38] with 98 = 7s, 106 = 9s (a chi around 8s) and 81/83 the 3s
  // pair (a pon of 82). Derived from the frozen wall/deal contracts and
  // cross-checked against a scratchpad scan at capture time. Never regenerate.
  const CHI: HandAction = { type: 'chi', seat: 1, tile: 100, uses: [98, 106] }
  const chiPrefix = tsumogiriRecord(1, 1).actions // East draws 100 (8s), tsumogiris it
  const PON: HandAction = { type: 'pon', seat: 1, tile: 82, uses: [81, 83] }
  const ponPrefix: readonly HandAction[] = [
    { type: 'draw', seat: 0 },
    { type: 'discard', seat: 0, tile: 82 }, // tedashi: the 3s leaves, drawn 100 joins the hand
  ]

  // Frozen seed-3 facts (scratchpad scan over tsumogiri prefixes; hand-checked by
  // kind arithmetic, kind = TILE_KINDS[floor(id/4)]). Deal: South's hand is
  // [90, 74, 13, 103, 43, 78, 100, 93, 105, 10, 24, 36, 41] with 43/41 the 2p
  // pair; East's holds 47 (3p) and 37 (1p); live[0..3] = [28, 128, 25, 42], so
  // the fourth tsumogiri turn has North discard 42 (2p) — claimable by BOTH
  // East's chi (1p2p3p) and South's pon. Never regenerate.
  const RACE_SEED = 3
  const racePrefix = (() => {
    const live = [28, 128, 25, 42]
    return live.flatMap((tile, i): HandAction[] => [
      { type: 'draw', seat: i as Seat },
      { type: 'discard', seat: i as Seat, tile },
    ])
  })()
  const RACE_CHI: HandAction = { type: 'chi', seat: 0, tile: 42, uses: [47, 37] }
  const RACE_PON: HandAction = { type: 'pon', seat: 1, tile: 42, uses: [43, 41] }

  it('chi exposes the meld, shrinks the hand by the used pair, and hands the caller the turn', () => {
    const state = foldRecord({ seed: 1, actions: [...chiPrefix, CHI] })
    expect(state.melds[1]).toEqual([{ type: 'chi', claimed: 100, from: 0, own: [98, 106] }])
    expect(state.hands[1]).toEqual([42, 120, 91, 2, 28, 26, 81, 83, 7, 79, 38])
    expect(state.melds[0]).toEqual([])
    expect(state.hands[0].length).toBe(STARTING_HAND_SIZE)
    expect(state.turn).toBe(1)
    expect(state.mustDiscard).toBe(true)
    expect(state.drawn).toBeNull()
    expect(state.claimable).toBeNull()
  })

  it('the claimed tile stays marked in its discarder’s pond: present there, identified by the meld’s (from, claimed)', () => {
    const state = foldRecord({ seed: 1, actions: [...chiPrefix, CHI] })
    expect(state.ponds[0]).toEqual([100]) // the discard history keeps the claimed tile
    const meld = state.melds[1][0]
    if (meld.type === 'ankan') throw new Error('unreachable: the folded meld is a chi')
    expect(state.ponds[meld.from]).toContain(meld.claimed) // the mark is the join
  })

  it('pon folds identically through the shared claim path', () => {
    const state = foldRecord({ seed: 1, actions: [...ponPrefix, PON] })
    expect(state.melds[1]).toEqual([{ type: 'pon', claimed: 82, from: 0, own: [81, 83] }])
    expect(state.ponds[0]).toEqual([82])
    expect(state.hands[1]).toEqual([98, 42, 120, 91, 2, 106, 28, 26, 7, 79, 38])
    expect(state.turn).toBe(1)
    expect(state.mustDiscard).toBe(true)
  })

  it('the caller then discards from the hand: no draw happened, and the discard opens a fresh claim window', () => {
    const discard: HandAction = { type: 'discard', seat: 1, tile: 38 }
    const state = foldRecord({ seed: 1, actions: [...chiPrefix, CHI, discard] })
    expect(state.mustDiscard).toBe(false)
    expect(state.ponds[1]).toEqual([38])
    expect(state.hands[1]).toEqual([42, 120, 91, 2, 28, 26, 81, 83, 7, 79])
    expect(state.turn).toBe(2)
    expect(state.claimable).toEqual({ seat: 1, tile: 38 })
    // The live wall never moved for the claim turn: only East's one draw happened.
    expect(state.live).toEqual(dealtLive(1).slice(1))
  })

  it('pon by a non-adjacent seat jumps the turn: the skipped seat never draws', () => {
    // North discarded; South pons. East — the rotation seat — is skipped entirely.
    const state = foldRecord({ seed: RACE_SEED, actions: [...racePrefix, RACE_PON] })
    expect(state.melds[1]).toEqual([{ type: 'pon', claimed: 42, from: 3, own: [43, 41] }])
    expect(state.turn).toBe(1)
    expect(state.mustDiscard).toBe(true)
    // East's hand untouched at 13 and the live wall exactly four draws in: East's
    // would-be draw never happened.
    expect(state.hands[0].length).toBe(STARTING_HAND_SIZE)
    expect(state.live.length).toBe(LIVE_WALL_SIZE - DEAL_SIZE - 4)
    expect(state.ponds[3]).toEqual([42])
  })

  it('pon-over-chi is deterministic from the record: each logged resolution folds repeatably, to distinct states', () => {
    // The same fresh discard (42, 2p) is chi-able by East AND pon-able by South —
    // precedence was resolved when the record was written; the fold replays it.
    const chiRecord: HandRecord = { seed: RACE_SEED, actions: [...racePrefix, RACE_CHI] }
    const ponRecord: HandRecord = { seed: RACE_SEED, actions: [...racePrefix, RACE_PON] }
    const chiState = foldRecord(chiRecord)
    const ponState = foldRecord(ponRecord)
    expect(foldRecord(chiRecord)).toEqual(chiState)
    expect(foldRecord(ponRecord)).toEqual(ponState)
    expect(chiState.melds[0]).toEqual([{ type: 'chi', claimed: 42, from: 3, own: [47, 37] }])
    expect(chiState.turn).toBe(0)
    expect(ponState.melds[0]).toEqual([])
    expect(ponState.turn).toBe(1)
  })

  it('conserves all 136 tiles across hands + melds + ponds + drawn + live + dead at every claim-bearing prefix', () => {
    const anchors: HandRecord[] = [
      { seed: 1, actions: [...chiPrefix, CHI, { type: 'discard', seat: 1, tile: 38 }] },
      { seed: 1, actions: [...ponPrefix, PON] },
      { seed: RACE_SEED, actions: [...racePrefix, RACE_CHI] },
      { seed: RACE_SEED, actions: [...racePrefix, RACE_PON] },
    ]
    for (const { seed, actions } of anchors) {
      for (let len = 0; len <= actions.length; len++) {
        const everything = allZonesWithMelds(foldRecord({ seed, actions: actions.slice(0, len) }))
        expect(everything.length).toBe(TILE_COUNT)
        expect(new Set(everything).size).toBe(TILE_COUNT)
      }
    }
  })

  it('does not mutate a claim-bearing record, and repeated folds agree in fresh arrays', () => {
    const record: HandRecord = { seed: RACE_SEED, actions: [...racePrefix, RACE_PON] }
    const snapshot = structuredClone(record)
    const first = foldRecord(record)
    const second = foldRecord(record)
    expect(record).toEqual(snapshot)
    expect(second).toEqual(first)
    expect(second.melds).not.toBe(first.melds)
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      expect(second.melds[seat]).not.toBe(first.melds[seat])
    }
  })
})

describe('illegal claims throw instead of folding silently', () => {
  // Every case appends one bad action to a legally-reachable seed-1 prefix and
  // asserts a loud RangeError NAMING THE ACTION INDEX. Guard order is frozen
  // (window → seat → tile → uses distinct → uses held → shape), so several cases
  // deliberately carry otherwise-valid parts to prove which guard speaks first.
  // Frozen seed-1 facts as above: East tsumogiris 100 (8s) on turn one; South may
  // chi it with 98+106 (7s+9s); East's tedashi of 82 (3s) is pon-able by South's
  // 81/83 pair; West holds 97+104 (7s+9s) and the 73/74 1s pair.
  const SEED = 1

  /** Fold `prefix ++ [bad]`, assert RangeError naming both `fragment` and the index. */
  function expectClaimThrows(prefix: readonly HandAction[], bad: HandAction, fragment: string) {
    const fold = () => foldRecord({ seed: SEED, actions: [...prefix, bad] })
    expect(fold).toThrow(RangeError)
    expect(fold).toThrow(fragment)
    expect(fold).toThrow(`action ${prefix.length}`)
  }

  const oneTurn = tsumogiriRecord(SEED, 1).actions // East draws 100 and tsumogiris it
  const CHI: HandAction = { type: 'chi', seat: 1, tile: 100, uses: [98, 106] }
  const chiTaken: readonly HandAction[] = [...oneTurn, CHI]
  const ponPrefix: readonly HandAction[] = [
    { type: 'draw', seat: 0 },
    { type: 'discard', seat: 0, tile: 82 },
  ]

  it('claim before anything was discarded: no window exists at the deal', () => {
    expectClaimThrows([], { type: 'pon', seat: 1, tile: 100, uses: [81, 83] }, 'no claimable discard')
  })

  it('stale claim: the very chi that was legal goes stale once the next seat draws', () => {
    expectClaimThrows([...oneTurn, { type: 'draw', seat: 1 }], CHI, 'no claimable discard')
  })

  it('wrong-seat chi: West holds a valid run but is not the discarder’s next seat', () => {
    expectClaimThrows(
      oneTurn,
      { type: 'chi', seat: 2, tile: 100, uses: [97, 104] },
      "only seat 1 may chi seat 0's discard",
    )
  })

  it('pon by the discarder of its own tile', () => {
    expectClaimThrows(oneTurn, { type: 'pon', seat: 0, tile: 100, uses: [64, 53] }, 'its own discard')
  })

  it('wrong-tile claim: naming any tile but the fresh discard', () => {
    expectClaimThrows(
      oneTurn,
      { type: 'chi', seat: 1, tile: 60, uses: [98, 106] },
      'the claimable discard is tile 100',
    )
  })

  it('duplicate uses: one physical tile cannot be exposed twice', () => {
    expectClaimThrows(ponPrefix, { type: 'pon', seat: 1, tile: 82, uses: [81, 81] }, 'uses tile 81 twice')
  })

  it('unheld uses: a tile in another seat’s hand', () => {
    expectClaimThrows(
      ponPrefix,
      { type: 'pon', seat: 1, tile: 82, uses: [81, 104] },
      'uses tile 104, which seat 1 does not hold',
    )
  })

  it('unheld uses: the claimed tile itself cannot double as a used tile', () => {
    expectClaimThrows(
      oneTurn,
      { type: 'chi', seat: 1, tile: 100, uses: [98, 100] },
      'uses tile 100, which seat 1 does not hold',
    )
  })

  it('chi of kinds that form no run', () => {
    // 91 = 5s: 5s + 7s around a claimed 8s is not consecutive.
    expectClaimThrows(oneTurn, { type: 'chi', seat: 1, tile: 100, uses: [98, 91] }, 'do not form a run')
  })

  it('pon of kinds that form no triplet', () => {
    // West's genuine 1s pair against the claimed 3s.
    expectClaimThrows(ponPrefix, { type: 'pon', seat: 2, tile: 82, uses: [73, 74] }, 'do not form a triplet')
  })

  it('draw by the caller: a claim leaves a discard owed, never a draw', () => {
    expectClaimThrows(chiTaken, { type: 'draw', seat: 1 }, 'owes a discard for its claim')
  })

  it('claim discard of a tile the caller no longer holds — its own melded tile included', () => {
    expectClaimThrows(
      chiTaken,
      { type: 'discard', seat: 1, tile: 98 },
      'a claim discard comes from the hand',
    )
  })

  it('claim discard by anyone but the caller', () => {
    expectClaimThrows(chiTaken, { type: 'discard', seat: 2, tile: 0 }, "seat 1's turn")
  })

  it('claims after ryuukyoku: the ended hand accepts nothing, so the final discard is never claimable', () => {
    const done = maximalRecord(SEED).actions
    expectClaimThrows(done, CHI, 'already ended in ryuukyoku')
    expectClaimThrows(done, { type: 'pon', seat: 1, tile: 100, uses: [81, 83] }, 'already ended in ryuukyoku')
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
    // ('riichi' itself was this fixture's example until T-009-01-01 made it real —
    // 'kita' picks the next still-unimplemented mahjong mechanic instead.)
    const corrupt = { type: 'kita', seat: 0 } as unknown as HandAction
    expectThrows([], corrupt, 'unknown action type')
    expectThrows(oneTurn, corrupt, 'unknown action type')
  })
})

describe('riichi declaration folds', () => {
  // Mined fixture (scratchpad scan over seed 100's tsumogiri prefixes, cross-checked
  // against shanten directly): East's freshly dealt 13-tile hand plus its first draw
  // (69, 9p) is [128,131,68,55,134,10,46,63,61,8,47,135,125,69] (kinds 6z,6z,9p,5p,
  // 7z,3m,3p,7p,7p,3m,3p,7z,5z,9p) — discarding either 55 (5p) or 125 (5z) leaves the
  // 13-tile hand at tenpai (shanten 0); every other tile leaves shanten 1. Never
  // regenerate.
  const RIICHI_SEED = 100
  const riichiPrefix: readonly HandAction[] = [{ type: 'draw', seat: 0 }]
  const RIICHI: HandAction = { type: 'riichi', seat: 0, tile: 55 }

  it('folds the discard, locks the seat, and moves the stick into the pot', () => {
    const state = foldRecord({ seed: RIICHI_SEED, actions: [...riichiPrefix, RIICHI] })
    expect(state.riichi).toEqual([true, false, false, false])
    expect(state.pot).toBe(1000)
    expect(state.ponds[0]).toEqual([55])
    expect(state.hands[0]).not.toContain(55)
    expect(state.hands[0]).toContain(69) // the drawn tile joined the hand (tedashi)
    expect(state.turn).toBe(1)
    expect(state.claimable).toEqual({ seat: 0, tile: 55 })
  })

  it('an incoming carried pot (RiichiContext.potIn) is preserved and added to', () => {
    const state = foldRecord(
      { seed: RIICHI_SEED, actions: [...riichiPrefix, RIICHI] },
      { scoresIn: [25000, 25000, 25000, 25000], potIn: 2000 },
    )
    expect(state.pot).toBe(3000)
  })

  it('context defaulting: an omitted context is 25000 each and an empty pot', () => {
    const state = foldRecord({ seed: RIICHI_SEED, actions: riichiPrefix })
    expect(state.scoresIn).toEqual([25000, 25000, 25000, 25000])
    expect(state.pot).toBe(0)
  })

  it('forced tsumogiri: a locked seat’s later tedashi throws; its drawn-tile discard folds', () => {
    const live = dealtLive(RIICHI_SEED)
    const actions: HandAction[] = [
      ...riichiPrefix,
      RIICHI,
      { type: 'draw', seat: 1 },
      { type: 'discard', seat: 1, tile: live[1] },
      { type: 'draw', seat: 2 },
      { type: 'discard', seat: 2, tile: live[2] },
      { type: 'draw', seat: 3 },
      { type: 'discard', seat: 3, tile: live[3] },
      { type: 'draw', seat: 0 },
    ]
    const state = foldRecord({ seed: RIICHI_SEED, actions })
    expect(state.drawn).toBe(live[4])
    const handTile = state.hands[0][0]
    expect(() =>
      foldRecord({
        seed: RIICHI_SEED,
        actions: [...actions, { type: 'discard', seat: 0, tile: handTile }],
      }),
    ).toThrow(/riichi and must discard its drawn tile/)
    const tsumogiri = foldRecord({
      seed: RIICHI_SEED,
      actions: [...actions, { type: 'discard', seat: 0, tile: live[4] }],
    })
    expect(tsumogiri.ponds[0]).toEqual([55, live[4]])
  })

  it('already-in-riichi: a second declaration for a locked seat throws', () => {
    const live = dealtLive(RIICHI_SEED)
    const actions: HandAction[] = [
      ...riichiPrefix,
      RIICHI,
      { type: 'draw', seat: 1 },
      { type: 'discard', seat: 1, tile: live[1] },
      { type: 'draw', seat: 2 },
      { type: 'discard', seat: 2, tile: live[2] },
      { type: 'draw', seat: 3 },
      { type: 'discard', seat: 3, tile: live[3] },
      { type: 'draw', seat: 0 },
    ]
    expect(() =>
      foldRecord({
        seed: RIICHI_SEED,
        actions: [...actions, { type: 'riichi', seat: 0, tile: live[4] }],
      }),
    ).toThrow(/already in riichi/)
  })

  it('open hand: riichi on a seat holding a non-ankan meld throws', () => {
    // Continues seed 1's chi fixture (chi/pon claims fold, below) to South's own
    // next draw, so the decision point is an ordinary own-turn discard, never a
    // claim discard — mined by folding the chi forward to South's next 'draw'.
    const chiActions: HandAction[] = [
      { type: 'draw', seat: 0 },
      { type: 'discard', seat: 0, tile: 100 },
      { type: 'chi', seat: 1, tile: 100, uses: [98, 106] },
      { type: 'discard', seat: 1, tile: 42 },
      { type: 'draw', seat: 2 },
      { type: 'discard', seat: 2, tile: 60 },
      { type: 'draw', seat: 3 },
      { type: 'discard', seat: 3, tile: 14 },
      { type: 'draw', seat: 0 },
      { type: 'discard', seat: 0, tile: 66 },
      { type: 'draw', seat: 1 },
    ]
    const state = foldRecord({ seed: 1, actions: chiActions })
    expect(state.turn).toBe(1)
    expect(state.drawn).toBe(20)
    expect(state.melds[1]).toEqual([{ type: 'chi', claimed: 100, from: 0, own: [98, 106] }])
    expect(() =>
      foldRecord({ seed: 1, actions: [...chiActions, { type: 'riichi', seat: 1, tile: 20 }] }),
    ).toThrow(/open hand/)
  })

  it('noten: declaring on a tile that does not leave the hand at tenpai throws', () => {
    expect(() =>
      foldRecord({
        seed: RIICHI_SEED,
        actions: [...riichiPrefix, { type: 'riichi', seat: 0, tile: 128 }],
      }),
    ).toThrow(/does not leave seat 0's hand at tenpai/)
  })

  it('fewer than 1000 points: the score gate throws', () => {
    expect(() =>
      foldRecord(
        { seed: RIICHI_SEED, actions: [...riichiPrefix, RIICHI] },
        { scoresIn: [500, 25000, 25000, 25000], potIn: 0 },
      ),
    ).toThrow(/fewer than the 1000-point stick/)
  })

  it('no draws left: a riichi attempt on the wall-emptying draw throws', () => {
    const record = tsumogiriRecord(RIICHI_SEED, FULL_TURNS - 1) // 69 turns, 1 live tile left
    const before = foldRecord(record)
    expect(before.live.length).toBe(1)
    const actions = [...record.actions, { type: 'draw', seat: before.turn } as HandAction]
    const dangling = foldRecord({ seed: RIICHI_SEED, actions })
    expect(dangling.live.length).toBe(0)
    expect(() =>
      foldRecord({
        seed: RIICHI_SEED,
        actions: [...actions, { type: 'riichi', seat: dangling.turn, tile: dangling.drawn! }],
      }),
    ).toThrow(/no draws remaining/)
  })
})

// ————————————————————————————————————————————————————————————————————————————
// Frozen kan-anchor facts (scratchpad scan over the frozen wall/deal contracts;
// kinds by id arithmetic, kind = TILE_KINDS[floor(id/4)]). Never regenerate.
//
// Seed 67 — daiminkan/shouminkan geometry. East's dealt hand holds 91 (5s, ids
// 88..91) and draws live[0] = 100 (8s); North's dealt hand
// [87, 129, 99, 90, 125, 17, 131, 101, 88, 89, 55, 61, 80] holds the other three
// 5s copies 90, 88, 89. live[1..4] = [23, 113, 132, 14]; live[69] = 72 (the tail
// tile the first kan moves over). dead =
// [135, 133, 50, 70, 81, 105, 108, 98, 43, 27, 67, 73, 64, 7]: rinshan draws
// 135, 133, 50, 70 in order; indicator layout 81 (3s → dora 4s) at [4], first
// kan flip 108 (1z → dora 2z) at [6].
//
// Seed 161 — ankan with the drawn tile among the four. South's dealt hand
// [21, 31, 96, 118, 26, 29, 35, 74, 134, 116, 119, 122, 12] holds the 3z trio
// 118, 116, 119 (3z ids 116..119); live[0] = 95 (East's tsumogiri), live[1] =
// 117 — South draws the fourth 3z. dead[0] = 56 (first rinshan); dead[4] = 98
// (7s → 8s); dead[6] = 62 (7p → 8p); live[69] = 16.
//
// Seed 280 — ankan of a dealt quad, drawn tile NOT among the four. North's dealt
// hand [115, 0, 82, 27, 30, 11, 76, 3, 106, 2, 59, 135, 1] holds all four 1m
// copies 0..3; live[0..3] = [19, 37, 77, 134] (three tsumogiri turns, then North
// draws 134, a 7z). dead[0] = 71 (first rinshan); dead[4] = 35 (9m → 1m);
// dead[6] = 91 (5s → 6s); live[68] = 54, live[69] = 9.
//
// Seed 56 — two daiminkan geometries in one hand. East's dealt hand holds the 3s
// trio [82, 83, 80] and North holds the fourth 3s = 81; South holds the 4m trio
// [14, 12, 15] and West the fourth 4m = 13. live[0..4] = [98, 108, 68, 129, 72];
// dead = [0, 127, 40, 46, 43, 30, 94, 133, 31, 41, 21, 20, 51, 10]: rinshan
// draws 0, 127, …; indicators 43 (2p → 3p) at [4], 94 (6s → 7s) at [6], 31
// (8m → 9m) at [8]; live[68] = 5, live[69] = 8 (the two tail tiles moved).
//
// Seed 101033 — four daiminkan geometries with distinct kinds, for the four-kan
// chain: holder 0 takes 6 (2m) from seat 2 with [7, 4, 5]; holder 0 takes 69
// (9p) from seat 1 with [68, 70, 71]; holder 1 takes 16 (5m) from seat 0 with
// [18, 17, 19]; holder 3 takes 130 (6z) from seat 0 with [129, 131, 128].
// ————————————————————————————————————————————————————————————————————————————

const DAIMINKAN67: HandAction = { type: 'daiminkan', seat: 3, tile: 91, uses: [90, 88, 89] }
const kanPrefix67: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 91 }, // tedashi: the fourth 5s leaves, drawn 100 joins the hand
]

const PON67: HandAction = { type: 'pon', seat: 3, tile: 91, uses: [90, 88] }
/** Pon keeping the third copy, claim discard, one full go-around, North draws again. */
const shouminkanPrefix67: readonly HandAction[] = [
  ...kanPrefix67,
  PON67,
  { type: 'discard', seat: 3, tile: 87 }, // the claim discard (tedashi, a 4s)
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 23 }, // live[1] tsumogiri
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 113 }, // live[2] tsumogiri
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 132 }, // live[3] tsumogiri
  { type: 'draw', seat: 3 }, // North draws live[4] = 14
]
const SHOUMINKAN67: HandAction = { type: 'shouminkan', seat: 3, tile: 89 }

const ANKAN161: HandAction = { type: 'ankan', seat: 1, uses: [118, 116, 119, 117] }
const ankanPrefix161: readonly HandAction[] = [
  ...tsumogiriRecord(161, 1).actions, // East draws 95 and tsumogiris it
  { type: 'draw', seat: 1 }, // South draws 117, the fourth 3z
]

const ANKAN280: HandAction = { type: 'ankan', seat: 3, uses: [0, 1, 2, 3] }
const ankanPrefix280: readonly HandAction[] = [
  ...tsumogiriRecord(280, 3).actions, // three tsumogiri turns
  { type: 'draw', seat: 3 }, // North draws 134 (7z) — NOT part of the quad
]

const DAIMINKAN56_FIRST: HandAction = { type: 'daiminkan', seat: 0, tile: 81, uses: [82, 83, 80] }
const DAIMINKAN56_SECOND: HandAction = { type: 'daiminkan', seat: 1, tile: 13, uses: [14, 12, 15] }
const twoKanActions56: readonly HandAction[] = [
  ...tsumogiriRecord(56, 3).actions, // E, S, W tsumogiri live[0..2]
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 81 }, // tedashi: North's lone 3s
  DAIMINKAN56_FIRST,
  { type: 'discard', seat: 0, tile: 0 }, // rinshan tsumogiri — dead[0] is tile id 0
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 72 }, // live[4] tsumogiri
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 13 }, // tedashi: West's lone 4m
  DAIMINKAN56_SECOND,
]

const FOUR_KAN_SEED = 101033
const FOUR_KAN_GEOMS: ReadonlyArray<{
  holder: Seat
  source: Seat
  fourth: TileId
  uses: readonly [TileId, TileId, TileId]
}> = [
  { holder: 0, source: 2, fourth: 6, uses: [7, 4, 5] },
  { holder: 0, source: 1, fourth: 69, uses: [68, 70, 71] },
  { holder: 1, source: 0, fourth: 16, uses: [18, 17, 19] },
  { holder: 3, source: 0, fourth: 130, uses: [129, 131, 128] },
]

/**
 * The four-kan chain for seed 101033: for each geometry, tsumogiri turns route
 * play to the source seat, the source tedashis the fourth copy, the holder
 * daiminkans it and tsumogiris the rinshan tile (dead[k] by the frozen draw
 * order). Constructed from the frozen wall contracts only — deterministic and
 * wall-derived like tsumogiriRecord.
 */
function fourKanChain(): HandAction[] {
  const live = dealtLive(FOUR_KAN_SEED)
  const dead = dealtDead(FOUR_KAN_SEED)
  const actions: HandAction[] = []
  let turn: Seat = 0
  let liveAt = 0
  FOUR_KAN_GEOMS.forEach((geom, kan) => {
    while (turn !== geom.source) {
      actions.push(
        { type: 'draw', seat: turn },
        { type: 'discard', seat: turn, tile: live[liveAt++] },
      )
      turn = ((turn + 1) % SEAT_COUNT) as Seat
    }
    actions.push(
      { type: 'draw', seat: geom.source },
      { type: 'discard', seat: geom.source, tile: geom.fourth },
      { type: 'daiminkan', seat: geom.holder, tile: geom.fourth, uses: geom.uses },
      { type: 'discard', seat: geom.holder, tile: dead[kan] }, // rinshan tsumogiri
    )
    liveAt++
    turn = ((geom.holder + 1) % SEAT_COUNT) as Seat
  })
  return actions
}

/**
 * A full seed-280 hand with one ankan: three tsumogiri turns, North's quad ankan
 * and rinshan tsumogiri, then pure tsumogiri until the wall runs dry. The kan
 * moved live[69] to the dead wall, so only live[4..68] remain as normal draws —
 * 69 draws in total, one fewer than a kanless hand.
 */
function kanMaximalRecord280(): HandRecord {
  const live = dealtLive(280)
  const actions: HandAction[] = [
    ...ankanPrefix280,
    ANKAN280,
    { type: 'discard', seat: 3, tile: 71 }, // rinshan tsumogiri — dead[0]
  ]
  for (let i = 4; i <= 68; i++) {
    const seat = ((i - 4) % SEAT_COUNT) as Seat
    actions.push({ type: 'draw', seat }, { type: 'discard', seat, tile: live[i] })
  }
  return { seed: 280, actions }
}

describe('kan forms fold', () => {
  it('daiminkan exposes the meld, jumps the turn past the skipped seats, and draws the rinshan tile', () => {
    const state = foldRecord({ seed: 67, actions: [...kanPrefix67, DAIMINKAN67] })
    expect(state.melds[3]).toEqual([{ type: 'daiminkan', claimed: 91, from: 0, own: [90, 88, 89] }])
    // North's dealt hand minus the three exposed 5s copies.
    expect(state.hands[3]).toEqual([87, 129, 99, 125, 17, 131, 101, 55, 61, 80])
    expect(state.turn).toBe(3) // seats 1 and 2 never act
    expect(state.hands[1].length).toBe(STARTING_HAND_SIZE)
    expect(state.hands[2].length).toBe(STARTING_HAND_SIZE)
    // The rinshan draw replaces the claim-discard obligation: drawn, not mustDiscard.
    expect(state.mustDiscard).toBe(false)
    expect(state.drawn).toBe(135) // original dead[0], the first rinshan tile
    expect(state.claimable).toBeNull()
    expect(state.ponds[0]).toEqual([91]) // the claimed tile stays marked in the discarder's pond
  })

  it('a kan flips the next indicator, keeps the dead wall at 14, and shortens the live wall', () => {
    const state = foldRecord({ seed: 67, actions: [...kanPrefix67, DAIMINKAN67] })
    expect(state.doraIndicators).toEqual([81, 108]) // initial dead[4], kan flip dead[6]
    expect(state.doras).toEqual(['4s', '2z']) // 3s → 4s, 1z → 2z by the frozen dora cycles
    expect(state.doraIndicator).toBe(81) // the singular fields keep meaning "the initial flip"
    expect(state.dora).toBe('4s')
    // dead lost its front (the rinshan 135) and gained the live tail 72 at the end.
    expect(state.dead).toEqual([133, 50, 70, 81, 105, 108, 98, 43, 27, 67, 73, 64, 7, 72])
    expect(state.dead.length).toBe(DEAD_WALL_SIZE)
    expect(state.live).toEqual(dealtLive(67).slice(1, -1)) // one draw off the front, one tail tile gone
  })

  it('the rinshan discard folds through the ordinary discard step and reopens the claim window', () => {
    const state = foldRecord({
      seed: 67,
      actions: [...kanPrefix67, DAIMINKAN67, { type: 'discard', seat: 3, tile: 135 }],
    })
    expect(state.ponds[3]).toEqual([135])
    expect(state.drawn).toBeNull()
    expect(state.turn).toBe(0)
    expect(state.claimable).toEqual({ seat: 3, tile: 135 })
  })

  it('ankan with the drawn tile among the four: nothing was claimed, the meld is all own', () => {
    const state = foldRecord({ seed: 161, actions: [...ankanPrefix161, ANKAN161] })
    expect(state.melds[1]).toEqual([{ type: 'ankan', own: [118, 116, 119, 117] }])
    // South's dealt hand minus the trio; the drawn 117 went straight into the meld.
    expect(state.hands[1]).toEqual([21, 31, 96, 26, 29, 35, 74, 134, 122, 12])
    expect(state.turn).toBe(1) // an ankan keeps the turn
    expect(state.drawn).toBe(56) // original dead[0]
    expect(state.doraIndicators).toEqual([98, 62])
    expect(state.doras).toEqual(['8s', '8p'])
    expect(state.ponds[1]).toEqual([]) // nothing of South's was ever discarded
  })

  it('ankan of a dealt quad: the surviving drawn tile is appended to the hand end', () => {
    const state = foldRecord({ seed: 280, actions: [...ankanPrefix280, ANKAN280] })
    expect(state.melds[3]).toEqual([{ type: 'ankan', own: [0, 1, 2, 3] }])
    // North's dealt hand minus the quad, with the untouched draw 134 appended last.
    expect(state.hands[3]).toEqual([115, 82, 27, 30, 11, 76, 106, 59, 135, 134])
    expect(state.drawn).toBe(71) // original dead[0] — the rinshan, not the kept draw
    expect(state.doraIndicators).toEqual([35, 91])
    expect(state.doras).toEqual(['1m', '6s'])
  })

  it('shouminkan upgrades the pon in place: claimed and from survive, own grows by the added copy', () => {
    const before = foldRecord({ seed: 67, actions: shouminkanPrefix67 })
    expect(before.melds[3]).toEqual([{ type: 'pon', claimed: 91, from: 0, own: [90, 88] }])
    const state = foldRecord({ seed: 67, actions: [...shouminkanPrefix67, SHOUMINKAN67] })
    expect(state.melds[3]).toEqual([
      { type: 'shouminkan', claimed: 91, from: 0, own: [90, 88, 89] },
    ])
    // 89 left the hand for the meld; the drawn 14 was appended in its stead.
    expect(state.hands[3]).toEqual([129, 99, 125, 17, 131, 101, 55, 61, 80, 14])
    expect(state.drawn).toBe(135) // dead[0] — the hand's first rinshan
    expect(state.turn).toBe(3)
    expect(state.ponds[0]).toEqual([91, 23]) // the pond mark survives the upgrade (23 = East's later tsumogiri)
    expect(state.doraIndicators).toEqual([81, 108])
  })
})

describe('kan wall accounting', () => {
  it('two kans in one hand: rinshan tiles leave dead[0..] in draw order, indicators walk rightward', () => {
    const state = foldRecord({ seed: 56, actions: [...twoKanActions56] })
    expect(state.melds[0]).toEqual([{ type: 'daiminkan', claimed: 81, from: 3, own: [82, 83, 80] }])
    expect(state.melds[1]).toEqual([{ type: 'daiminkan', claimed: 13, from: 2, own: [14, 12, 15] }])
    expect(state.drawn).toBe(127) // the SECOND rinshan — original dead[1]
    expect(state.doraIndicators).toEqual([43, 94, 31]) // dead[4], then kan flips dead[6], dead[8]
    expect(state.doras).toEqual(['3p', '7s', '9m'])
    // dead lost its two rinshan tiles from the front and gained the two live tail
    // tiles (live[69] = 8 first, then live[68] = 5) at the end.
    expect(state.dead).toEqual([40, 46, 43, 30, 94, 133, 31, 41, 21, 20, 51, 10, 8, 5])
    expect(state.dead.length).toBe(DEAD_WALL_SIZE)
    expect(state.live).toEqual(dealtLive(56).slice(6, -2)) // six draws, two tail tiles gone
    expect(state.turn).toBe(1)
  })

  it('a kan brings exhaustive draw one discard earlier: 69 draws, 69 discards, same phase flip', () => {
    const record = kanMaximalRecord280()
    expect(record.actions.filter((a) => a.type === 'draw').length).toBe(FULL_TURNS - 1)
    const state = foldRecord(record)
    expect(state.phase).toBe('ryuukyoku')
    expect(state.live).toEqual([])
    expect(state.drawn).toBeNull()
    expect(state.ponds.flat().length).toBe(FULL_TURNS - 1) // a kanless hand discards 70 times
    expect(state.dead.length).toBe(DEAD_WALL_SIZE)
    // Still playing through the last draw: live is already empty, the discard ends it.
    const beforeLast = foldRecord({ seed: 280, actions: record.actions.slice(0, -1) })
    expect(beforeLast.phase).toBe('playing')
    expect(beforeLast.live).toEqual([])
    expect(beforeLast.drawn).toBe(54) // live[68] — the last live draw once the kan ate live[69]
  })

  it('conserves all 136 tiles across hands + melds + ponds + drawn + live + dead at every kan-bearing prefix', () => {
    const anchors: HandRecord[] = [
      { seed: 67, actions: [...kanPrefix67, DAIMINKAN67, { type: 'discard', seat: 3, tile: 135 }] },
      { seed: 161, actions: [...ankanPrefix161, ANKAN161] },
      { seed: 280, actions: [...ankanPrefix280, ANKAN280] },
      { seed: 67, actions: [...shouminkanPrefix67, SHOUMINKAN67] },
      { seed: 56, actions: [...twoKanActions56] },
      { seed: FOUR_KAN_SEED, actions: fourKanChain() },
      kanMaximalRecord280(),
    ]
    for (const { seed, actions } of anchors) {
      for (let len = 0; len <= actions.length; len++) {
        const everything = allZonesWithMelds(foldRecord({ seed, actions: actions.slice(0, len) }))
        expect(everything.length).toBe(TILE_COUNT)
        expect(new Set(everything).size).toBe(TILE_COUNT)
      }
    }
  })

  it('four kans exhaust the rinshan zone: all five indicators flipped, wall shortened by four', () => {
    const state = foldRecord({ seed: FOUR_KAN_SEED, actions: fourKanChain() })
    const dead = dealtDead(FOUR_KAN_SEED)
    expect(state.doraIndicators).toEqual([dead[4], dead[6], dead[8], dead[10], dead[12]])
    expect(state.doras).toEqual(state.doraIndicators.map((id) => doraKindOf(kindOf(id))))
    expect(state.dead.length).toBe(DEAD_WALL_SIZE)
    expect(state.melds.flat().length).toBe(4)
    // 11 routed draws happened (see fourKanChain), and four tail tiles moved over.
    expect(state.live.length).toBe(FULL_TURNS - 11 - 4)
  })

  it('does not mutate a kan-bearing record, and repeated folds agree in fresh arrays', () => {
    const record: HandRecord = { seed: 56, actions: [...twoKanActions56] }
    const snapshot = structuredClone(record)
    const first = foldRecord(record)
    const second = foldRecord(record)
    expect(record).toEqual(snapshot)
    expect(second).toEqual(first)
    expect(second.doraIndicators).not.toBe(first.doraIndicators)
    expect(second.doras).not.toBe(first.doras)
    expect(second.dead).not.toBe(first.dead)
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      expect(second.melds[seat]).not.toBe(first.melds[seat])
    }
  })
})

describe('illegal kans throw instead of folding silently', () => {
  // Every case appends one bad action to a legally-reachable anchor prefix and
  // asserts a loud RangeError NAMING THE ACTION INDEX. Guard orders are frozen
  // (see the step): daiminkan window → seat → tile → rinshan → distinct → held →
  // shape; ankan/shouminkan turn → claim-owed → drawn → rinshan → tiles. Several
  // cases deliberately carry otherwise-valid (or deliberately garbage) later
  // parts to prove which guard speaks first.

  /** Fold `prefix ++ [bad]`, assert RangeError naming both `fragment` and the index. */
  function expectKanThrows(
    seed: number,
    prefix: readonly HandAction[],
    bad: HandAction,
    fragment: string,
  ) {
    const fold = () => foldRecord({ seed, actions: [...prefix, bad] })
    expect(fold).toThrow(RangeError)
    expect(fold).toThrow(fragment)
    expect(fold).toThrow(`action ${prefix.length}`)
  }

  it('daiminkan before anything was discarded: no window exists at the deal', () => {
    expectKanThrows(67, [], DAIMINKAN67, 'no claimable discard')
  })

  it('stale daiminkan: the legal kan goes stale once the next seat draws', () => {
    expectKanThrows(67, [...kanPrefix67, { type: 'draw', seat: 1 }], DAIMINKAN67, 'no claimable discard')
  })

  it('daiminkan by the discarder of its own tile', () => {
    expectKanThrows(
      67,
      kanPrefix67,
      { type: 'daiminkan', seat: 0, tile: 91, uses: [96, 6, 78] },
      'its own discard',
    )
  })

  it('wrong-tile daiminkan: naming any tile but the fresh discard', () => {
    expectKanThrows(
      67,
      kanPrefix67,
      { type: 'daiminkan', seat: 3, tile: 90, uses: [90, 88, 89] },
      'the claimable discard is tile 91',
    )
  })

  it('duplicate daiminkan uses: one physical tile cannot be exposed twice', () => {
    expectKanThrows(
      67,
      kanPrefix67,
      { type: 'daiminkan', seat: 3, tile: 91, uses: [90, 90, 88] },
      'uses tile 90 twice',
    )
  })

  it('unheld daiminkan uses: the claimed tile itself cannot double as a used tile', () => {
    expectKanThrows(
      67,
      kanPrefix67,
      { type: 'daiminkan', seat: 3, tile: 91, uses: [90, 88, 91] },
      'uses tile 91, which seat 3 does not hold',
    )
  })

  it('daiminkan of kinds that form no quad', () => {
    // 87 = 4s, genuinely in North's hand, against the claimed 5s.
    expectKanThrows(
      67,
      kanPrefix67,
      { type: 'daiminkan', seat: 3, tile: 91, uses: [90, 88, 87] },
      'do not form four of a kind',
    )
  })

  it('wrong-seat ankan: only the turn seat may kan', () => {
    expectKanThrows(
      161,
      ankanPrefix161,
      { type: 'ankan', seat: 2, uses: [118, 116, 119, 117] },
      "it is seat 1's turn",
    )
  })

  it('ankan before drawing', () => {
    expectKanThrows(
      161,
      tsumogiriRecord(161, 1).actions,
      { type: 'ankan', seat: 1, uses: [118, 116, 119, 117] },
      'ankan before seat 1 drew',
    )
  })

  it('ankan while a claim discard is owed: a chi caller cannot kan', () => {
    // Seed-1 chi anchor (see the chi/pon suites): South chis East's 100 with 98+106.
    const chiTaken: readonly HandAction[] = [
      ...tsumogiriRecord(1, 1).actions,
      { type: 'chi', seat: 1, tile: 100, uses: [98, 106] },
    ]
    expectKanThrows(
      1,
      chiTaken,
      { type: 'ankan', seat: 1, uses: [81, 83, 7, 79] },
      'owes a discard for its claim',
    )
  })

  it('duplicate ankan uses', () => {
    expectKanThrows(
      161,
      ankanPrefix161,
      { type: 'ankan', seat: 1, uses: [118, 118, 116, 119] },
      'uses tile 118 twice',
    )
  })

  it('ankan uses a tile neither held nor just drawn', () => {
    // 115 (2z) belongs to another hand entirely; 117 is the genuine draw.
    expectKanThrows(
      161,
      ankanPrefix161,
      { type: 'ankan', seat: 1, uses: [118, 116, 119, 115] },
      'neither holds nor just drew',
    )
  })

  it('ankan of kinds that form no quad', () => {
    // 12 = 4m, genuinely in South's hand, against the three 3z.
    expectKanThrows(
      161,
      ankanPrefix161,
      { type: 'ankan', seat: 1, uses: [118, 116, 119, 12] },
      'do not form four of a kind',
    )
  })

  it('shouminkan while the pon claim discard is still owed', () => {
    expectKanThrows(
      67,
      [...kanPrefix67, PON67],
      SHOUMINKAN67,
      'owes a discard for its claim',
    )
  })

  it('shouminkan before drawing', () => {
    // After North's claim discard the turn is East's, who has not drawn.
    expectKanThrows(
      67,
      [...kanPrefix67, PON67, { type: 'discard', seat: 3, tile: 87 }],
      { type: 'shouminkan', seat: 0, tile: 96 },
      'shouminkan before seat 0 drew',
    )
  })

  it('shouminkan of a tile neither held nor just drawn — the pon’s claimed tile included', () => {
    expectKanThrows(
      67,
      shouminkanPrefix67,
      { type: 'shouminkan', seat: 3, tile: 91 },
      'neither holds nor just drew',
    )
  })

  it('shouminkan with no pon of that kind', () => {
    // 129 (6z) is genuinely in North's hand, but North's only meld is the 5s pon.
    expectKanThrows(
      67,
      shouminkanPrefix67,
      { type: 'shouminkan', seat: 3, tile: 129 },
      'has no pon of that kind',
    )
  })

  it('a chi never qualifies as the pon a shouminkan extends', () => {
    // Seed 1: South chis 100 (7s8s9s), discards 38, play goes around, South draws
    // live[4] = 20 (6m) — and cannot shouminkan it into the chi-only meld list.
    const prefix: readonly HandAction[] = [
      ...tsumogiriRecord(1, 1).actions,
      { type: 'chi', seat: 1, tile: 100, uses: [98, 106] },
      { type: 'discard', seat: 1, tile: 38 },
      { type: 'draw', seat: 2 },
      { type: 'discard', seat: 2, tile: 60 }, // live[1] tsumogiri
      { type: 'draw', seat: 3 },
      { type: 'discard', seat: 3, tile: 14 }, // live[2] tsumogiri
      { type: 'draw', seat: 0 },
      { type: 'discard', seat: 0, tile: 66 }, // live[3] tsumogiri
      { type: 'draw', seat: 1 },
    ]
    expectKanThrows(1, prefix, { type: 'shouminkan', seat: 1, tile: 20 }, 'has no pon of that kind')
  })

  it('kan on the haitei draw: the empty live wall leaves no replacement tile', () => {
    // The 70th draw empties the live wall while the hand is still playing — the
    // wall guard speaks before any tile validation (guard-order exhibit).
    const prefix = maximalRecord(1).actions.slice(0, -1)
    expectKanThrows(
      1,
      prefix,
      { type: 'ankan', seat: 1, uses: [81, 83, 7, 79] },
      'on an empty live wall',
    )
  })

  it('a fifth kan finds no rinshan tile: four kans is the ceiling', () => {
    // After the four-kan chain the turn seat draws normally, then attempts a
    // fifth kan. The rinshan guard speaks before any uses validation, so the
    // uses here are deliberate garbage (guard-order exhibit).
    const prefix: readonly HandAction[] = [...fourKanChain(), { type: 'draw', seat: 0 }]
    expectKanThrows(
      FOUR_KAN_SEED,
      prefix,
      { type: 'ankan', seat: 0, uses: [0, 1, 2, 3] },
      'no rinshan tile remaining — four kans already made',
    )
  })

  it('kans after ryuukyoku: the ended hand accepts nothing', () => {
    const done = maximalRecord(1).actions
    expectKanThrows(1, done, DAIMINKAN67, 'already ended in ryuukyoku')
    expectKanThrows(1, done, { type: 'ankan', seat: 1, uses: [81, 83, 7, 79] }, 'already ended in ryuukyoku')
    expectKanThrows(1, done, { type: 'shouminkan', seat: 1, tile: 81 }, 'already ended in ryuukyoku')
  })
})
