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
    const corrupt = { type: 'riichi', seat: 0 } as unknown as HandAction
    expectThrows([], corrupt, 'unknown action type')
    expectThrows(oneTurn, corrupt, 'unknown action type')
  })
})
