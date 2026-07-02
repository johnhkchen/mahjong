// The agreement suite: legalActions (the offered half of the contract) cross-checked
// against foldRecord's step (the folding half). The two are independent statements of
// the turn cycle — these tests are the lock that keeps them agreeing: every offered
// action folds, everything outside the offered set throws, an ended hand offers
// nothing. This ticket's ground: claim offers (pon/daiminkan/chi on the open window,
// every physical copy combination its own offer) and active-turn kans (ankan/
// shouminkan), locked two-sidedly through documented candidate spaces — a candidate
// folds if and only if its normalized key is offered. Expectations are never read
// back from the enumeration under test: they are fold-derived (folds/throws) or
// frozen literals from capture-time scratchpad scans. Importing from './index' is
// itself the AC's barrel-export check.

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
  type TableState,
  type TileId,
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

/** The frozen 14-tile dead wall for a seed, same upstream derivation. */
function dealtDead(seed: number): number[] {
  return partitionWall(buildWall(seed)).dead
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
 * Every no-dangle point with turns ≥ 1 ends on a fresh discard, so this generator
 * reaches claim-window states for free.
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

/**
 * Membership key for the offered set — the action encoding, serialized. `uses` are
 * serialized SORTED, so membership is insensitive to copy order: the fold accepts
 * any `uses` order, offers canonicalize theirs, and the candidate spaces below list
 * each combination once — the sorted key is the common coordinate. Mirrored into
 * dynamics.test.ts.
 */
function keyOf(action: HandAction): string {
  const uses = 'uses' in action ? `:${[...action.uses].sort((a, b) => a - b).join(',')}` : ''
  const tile = 'tile' in action ? `:${action.tile}` : ''
  return `${action.type}:${action.seat}${tile}${uses}`
}

// ————————————————————————————————————————————————————————————————————————————
// Frozen anchors, mirrored from record.test.ts or captured by this ticket's
// scratchpad scans; each derivation cross-checked against the frozen wall/deal
// contracts at capture time. Never regenerate.
//
// Seed 1 — East tsumogiris 100 (8s): South (the only chi seat) holds 98 (7s) and
// 106 (9s) — one chi, no pon anywhere. East's tedashi of 82 (3s) instead: South's
// 81/83 pair pons it, no chi material.
// Seed 3 — after four tsumogiri turns North discards 42 (2p): South pons with the
// 43/41 pair; East (chi seat) holds 37 (1p) and TWO 3p copies 47 (hand index 5)
// and 44 (index 7) — one run shape, two copy-variant chis, [37,47] before [37,44].
// Seed 67 — East tedashis 91 (5s): North holds copies 90/88/89 (hand order) — three
// pon pairs [90,88],[90,89],[88,89] then the daiminkan [90,88,89]; no chi (South
// holds no 3s/4s/6s/7s neighbors). After PON67 keeps 89, the claim discard of 87
// and one tsumogiri go-around, North draws 14 (4m) holding the loose 89 → the
// shouminkan window.
// Seed 161 — after one tsumogiri turn South draws 117, the fourth 3z; hand copies
// sit at 118, 116, 119 (hand order) → ankan uses [118,116,119,117], drawn last.
// Seed 280 — after three tsumogiri turns North draws 134 (7z), NOT part of its
// dealt 1m quad at hand order [0,3,2,1] → ankan uses [0,3,2,1], no drawn tile.
// Seed 85 — after six tsumogiri turns South discards 89 (5s): West (chi seat)
// holds 82 (3s), 86 (4s), 93/94 (6s), 99 (7s) — all three run shapes, five chis:
// [82,86], [86,93], [86,94], [93,99], [94,99].
// Seed 5 — after seven tsumogiri turns West discards 94 (6s): East pons with its
// 93/95 pair; North (chi seat) holds 88 (5s), 97/99 (7s), 103 (8s) — two shapes,
// four chis: [88,97], [88,99], [97,103], [99,103].
// Seed 1004 — South's dealt hand holds the 5p quad at hand order [55,52,53,54];
// tsumogiri never disturbs hands, so at the haitei draw (the 70th, South's, live
// emptied) the quad is concealed but no rinshan replacement remains.
// Seed 101033 — the four-kan chain (record.test.ts geometry: four daiminkans with
// distinct kinds); afterwards West still holds three 4z copies 120/121/123 (hand
// order) and the fourth, tile 122, sits at live index 55 — tsumogiri continuation
// reaches it as East's fresh discard while the hand is still playing: a window
// where three pons are offered and the daiminkan is suppressed (four kans made).
// ————————————————————————————————————————————————————————————————————————————

const chiWindowPrefix1: readonly HandAction[] = tsumogiriRecord(1, 1).actions
const CHI1: HandAction = { type: 'chi', seat: 1, tile: 100, uses: [98, 106] }
const ponWindowPrefix1: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 82 }, // tedashi: the 3s leaves, drawn 100 joins the hand
]
const racePrefix3: readonly HandAction[] = [28, 128, 25, 42].flatMap(
  (tile, i): HandAction[] => [
    { type: 'draw', seat: i as Seat },
    { type: 'discard', seat: i as Seat, tile },
  ],
)
const kanPrefix67: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 91 }, // tedashi: the fourth 5s leaves, drawn 100 joins the hand
]
const PON67: HandAction = { type: 'pon', seat: 3, tile: 91, uses: [90, 88] }
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
const ankanPrefix161: readonly HandAction[] = [
  ...tsumogiriRecord(161, 1).actions, // East draws 95 and tsumogiris it
  { type: 'draw', seat: 1 }, // South draws 117, the fourth 3z
]
const ankanPrefix280: readonly HandAction[] = [
  ...tsumogiriRecord(280, 3).actions, // three tsumogiri turns
  { type: 'draw', seat: 3 }, // North draws 134 (7z) — NOT part of the quad
]
const ANKAN280: HandAction = { type: 'ankan', seat: 3, uses: [0, 1, 2, 3] }
const chiShapesPrefix85: readonly HandAction[] = tsumogiriRecord(85, 6).actions
const ponChiPrefix5: readonly HandAction[] = tsumogiriRecord(5, 7).actions
const mustDiscardPrefix1: readonly HandAction[] = [...chiWindowPrefix1, CHI1]
const haiteiPrefix1004: readonly HandAction[] = tsumogiriRecord(1004, 70).actions.slice(0, -1)

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
 * The four-kan chain for seed 101033 (mirrored from record.test.ts): for each
 * geometry, tsumogiri turns route play to the source seat, the source tedashis the
 * fourth copy, the holder daiminkans it and tsumogiris the rinshan tile (dead[k] by
 * the frozen draw order). Constructed from the frozen wall contracts only.
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
 * The fifth-kan window: the four-kan chain (which consumed live[0..10]), then pure
 * tsumogiri until tile 122 — the fourth 4z, at live index 55 — lands as a fresh
 * discard. West still holds 4z copies 120/121/123, so pon offers exist while the
 * daiminkan is barred by the kan ceiling. Wall-derived and deterministic.
 */
function fifthKanWindowRecord(): readonly HandAction[] {
  const live = dealtLive(FOUR_KAN_SEED)
  const actions = fourKanChain()
  let turn: Seat = 0 // the last holder was North; play resumes at East
  let liveAt = 11
  for (;;) {
    const tile = live[liveAt++]
    actions.push({ type: 'draw', seat: turn }, { type: 'discard', seat: turn, tile })
    if (tile === 122) return actions
    turn = ((turn + 1) % SEAT_COUNT) as Seat
  }
}
const fifthKanWindowPrefix = fifthKanWindowRecord()

/**
 * A full seed-280 hand with one ankan (mirrored from record.test.ts): the kan moved
 * live[69] to the dead wall, so only live[4..68] remain as normal draws — ryuukyoku
 * through a kan-shortened wall.
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

/** Every frozen anchor state, for the fold / purity / freshness sweeps. */
const ANCHORS: ReadonlyArray<{ label: string; seed: number; actions: readonly HandAction[] }> = [
  { label: 'seed-1 chi window', seed: 1, actions: chiWindowPrefix1 },
  { label: 'seed-1 pon window', seed: 1, actions: ponWindowPrefix1 },
  { label: 'seed-3 race window', seed: 3, actions: racePrefix3 },
  { label: 'seed-67 kan window', seed: 67, actions: kanPrefix67 },
  { label: 'seed-85 three-shape chi window', seed: 85, actions: chiShapesPrefix85 },
  { label: 'seed-5 pon+chi window', seed: 5, actions: ponChiPrefix5 },
  { label: 'seed-101033 fifth-kan window', seed: FOUR_KAN_SEED, actions: fifthKanWindowPrefix },
  { label: 'seed-67 shouminkan post-draw', seed: 67, actions: shouminkanPrefix67 },
  { label: 'seed-161 ankan post-draw', seed: 161, actions: ankanPrefix161 },
  { label: 'seed-280 ankan post-draw', seed: 280, actions: ankanPrefix280 },
  { label: 'seed-1004 haitei post-draw', seed: 1004, actions: haiteiPrefix1004 },
  { label: 'seed-1 mustDiscard', seed: 1, actions: mustDiscardPrefix1 },
  { label: 'seed-67 mustDiscard', seed: 67, actions: [...kanPrefix67, PON67] },
]

describe('the set is the closed form', () => {
  it('pre-draw: the turn seat’s draw leads; every further offer claims the open window (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: FULL_TURNS - 1 }), (seed, turns) => {
        const state = foldRecord(tsumogiriRecord(seed, turns))
        const offered = legalActions(state)
        expect(offered[0]).toEqual({ type: 'draw', seat: state.turn })
        expect(new Set(offered.map(keyOf)).size).toBe(offered.length)
        const window = state.claimable
        if (window === null) {
          expect(offered).toHaveLength(1) // fresh deal: nothing to claim yet
          return
        }
        for (const action of offered.slice(1)) {
          // Claims only: they name the window's tile, never the discarder's seat,
          // and a chi comes only from the seat whose left neighbor discarded.
          expect(['pon', 'daiminkan', 'chi']).toContain(action.type)
          if (action.type !== 'pon' && action.type !== 'daiminkan' && action.type !== 'chi') return
          expect(action.tile).toBe(window.tile)
          expect(action.seat).not.toBe(window.seat)
          if (action.type === 'chi') {
            expect(action.seat).toBe((window.seat + 1) % SEAT_COUNT)
          }
        }
      }),
    )
  })

  it('pon and daiminkan offers all precede every chi offer (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: FULL_TURNS - 1 }), (seed, turns) => {
        const offered = legalActions(foldRecord(tsumogiriRecord(seed, turns)))
        const firstChi = offered.findIndex((a) => a.type === 'chi')
        if (firstChi === -1) return
        for (let i = firstChi; i < offered.length; i++) {
          expect(offered[i].type).toBe('chi')
        }
        // The pon block precedes the daiminkan block inside the pon/kan prefix.
        const types = offered.slice(1, firstChi).map((a) => a.type)
        expect(types).toEqual([...types].sort((a, b) => (a === b ? 0 : a === 'pon' ? -1 : 1)))
      }),
    )
  })

  it('post-draw: the 14 discards lead — hand order, drawn last; any tail is the turn seat’s kans (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: FULL_TURNS - 1 }), (seed, turns) => {
        const { actions } = tsumogiriRecord(seed, turns)
        const seat = (turns % SEAT_COUNT) as Seat
        const state = foldRecord({ seed, actions: [...actions, { type: 'draw', seat }] })
        const offered = legalActions(state)
        const discards = [
          ...state.hands[state.turn].map((tile) => ({ type: 'discard', seat: state.turn, tile })),
          { type: 'discard', seat: state.turn, tile: state.drawn },
        ]
        expect(offered.slice(0, discards.length)).toEqual(discards)
        expect(new Set(offered.map(keyOf)).size).toBe(offered.length)
        for (const action of offered.slice(discards.length)) {
          expect(['ankan', 'shouminkan']).toContain(action.type)
          expect(action.seat).toBe(state.turn)
        }
      }),
    )
  })

  it('a claim discard offers exactly the caller’s hand, in hand order — no draw, no kans', () => {
    for (const anchor of [
      { seed: 1, actions: mustDiscardPrefix1 },
      { seed: 67, actions: [...kanPrefix67, PON67] },
    ]) {
      const state = foldRecord(anchor)
      expect(state.mustDiscard).toBe(true)
      expect(legalActions(state)).toEqual(
        state.hands[state.turn].map((tile) => ({ type: 'discard', seat: state.turn, tile })),
      )
    }
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

  it('a kan-shortened ryuukyoku offers nothing either', () => {
    const state = foldRecord(kanMaximalRecord280())
    expect(state.phase).toBe('ryuukyoku')
    expect(legalActions(state)).toEqual([])
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

  it('every offered action folds at each frozen claim/kan anchor', () => {
    for (const { label, seed, actions } of ANCHORS) {
      const state = foldRecord({ seed, actions })
      const offered = legalActions(state)
      expect(offered.length, label).toBeGreaterThan(0)
      for (const action of offered) {
        expect(
          () => foldRecord({ seed, actions: [...actions, action] }),
          `${label}: offered ${keyOf(action)}`,
        ).not.toThrow()
      }
    }
  })
})

describe('outside actions throw', () => {
  it('sampled negatives: wrong seats, out-of-sequence draws/discards, unheld tiles, illegal claims — all absent from the set and all thrown by the fold (property)', () => {
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
        const window = state.claimable
        if (window !== null) {
          // Claims one rule outside the window's legality: a chi from a non-left
          // seat, a pon of one's own discard, a claim naming a tile that is not
          // the fresh discard.
          const wrongChi = ((window.seat + 2) % SEAT_COUNT) as Seat
          const ponSeat = ((window.seat + 1) % SEAT_COUNT) as Seat
          bads.push(
            {
              type: 'chi',
              seat: wrongChi,
              tile: window.tile,
              uses: [state.hands[wrongChi][0], state.hands[wrongChi][1]],
            },
            {
              type: 'pon',
              seat: window.seat,
              tile: window.tile,
              uses: [state.hands[window.seat][0], state.hands[window.seat][1]],
            },
            {
              type: 'pon',
              seat: ponSeat,
              tile: state.dead[0], // a decoy tile: not the fresh discard
              uses: [state.hands[ponSeat][0], state.hands[ponSeat][1]],
            },
          )
        } else {
          // No window (post-draw, fresh deal, or ended): every claim is baseless.
          bads.push({
            type: 'pon',
            seat: other,
            tile: state.hands[state.turn][0] ?? 0,
            uses: [state.hands[other][0], state.hands[other][1]],
          })
        }
        for (const bad of bads) {
          expect(offered.has(keyOf(bad))).toBe(false)
          expect(() => foldRecord({ seed, actions: [...actions, bad] })).toThrow(RangeError)
        }
      }),
    )
  })

  it('sampled claim candidates agree with the fold: offered ⇔ folds, otherwise throws (property)', () => {
    // The property form of the two-sided lock: a random claim built from a random
    // seat's hand positions (duplicates included — those are negatives too) either
    // matches an offered key and folds, or matches nothing and throws.
    fc.assert(
      fc.property(
        prefixArb,
        fc.nat(2),
        fc.nat(3),
        fc.tuple(fc.nat(200), fc.nat(200), fc.nat(200)),
        fc.boolean(),
        ({ seed, actions }, typeAt, seatAt, [a, b, c], decoy) => {
          const state = foldRecord({ seed, actions })
          if (state.phase !== 'playing') return
          const seat = (seatAt % SEAT_COUNT) as Seat
          const hand = state.hands[seat]
          const tile = !decoy && state.claimable !== null ? state.claimable.tile : state.dead[0]
          const type = (['chi', 'pon', 'daiminkan'] as const)[typeAt % 3]
          const candidate: HandAction =
            type === 'daiminkan'
              ? { type, seat, tile, uses: [hand[a % hand.length], hand[b % hand.length], hand[c % hand.length]] }
              : { type, seat, tile, uses: [hand[a % hand.length], hand[b % hand.length]] }
          const offered = new Set(legalActions(state).map(keyOf))
          if (offered.has(keyOf(candidate))) {
            expect(() => foldRecord({ seed, actions: [...actions, candidate] })).not.toThrow()
          } else {
            expect(() => foldRecord({ seed, actions: [...actions, candidate] })).toThrow(RangeError)
          }
        },
      ),
    )
  })

  it('exhaustive partition at seed 1: all 548 encodable draw/discard candidates split into offered ⇒ folds, outside ⇒ throws', () => {
    // Every draw/discard the encoding can express: 4 draws + 4 seats × 136 tiles.
    // (Claim candidates get their own exhaustive spaces below.)
    const candidates: HandAction[] = []
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      candidates.push({ type: 'draw', seat: seat as Seat })
      for (let tile = 0; tile < 136; tile++) {
        candidates.push({ type: 'discard', seat: seat as Seat, tile })
      }
    }
    expect(candidates.length).toBe(548)

    const oneTurn = tsumogiriRecord(1, 1).actions
    // The pre-draw anchor's window carries South's one chi (the frozen seed-1 fact),
    // so the offered set is 2: the draw plus a claim no draw/discard candidate hits.
    const anchors: { label: string; actions: readonly HandAction[]; offered: number }[] = [
      { label: 'pre-draw', actions: oneTurn, offered: 2 },
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

  /**
   * The documented claim-candidate space at a window state: every claim type, every
   * seat, the window's tile, and every combination of that seat's hand positions
   * (pairs for chi/pon, triples for daiminkan) — each combination listed once, in
   * hand order, matched to offers through the sorted-uses key. Space constructor
   * only: no legality judgment lives here.
   */
  function claimCandidatesAt(state: TableState): HandAction[] {
    const window = state.claimable!
    const candidates: HandAction[] = []
    for (let s = 0; s < SEAT_COUNT; s++) {
      const seat = s as Seat
      const hand = state.hands[seat]
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          candidates.push({ type: 'chi', seat, tile: window.tile, uses: [hand[i], hand[j]] })
          candidates.push({ type: 'pon', seat, tile: window.tile, uses: [hand[i], hand[j]] })
          for (let k = j + 1; k < hand.length; k++) {
            candidates.push({
              type: 'daiminkan',
              seat,
              tile: window.tile,
              uses: [hand[i], hand[j], hand[k]],
            })
          }
        }
      }
    }
    return candidates
  }

  /**
   * The documented kan-candidate space at a post-draw state: every seat's ankan
   * 4-subsets (the turn seat's pool includes the drawn tile) and every seat ×
   * all 136 tile ids as shouminkan targets.
   */
  function kanCandidatesAt(state: TableState): HandAction[] {
    const candidates: HandAction[] = []
    for (let s = 0; s < SEAT_COUNT; s++) {
      const seat = s as Seat
      const pool =
        seat === state.turn && state.drawn !== null
          ? [...state.hands[seat], state.drawn]
          : [...state.hands[seat]]
      for (let i = 0; i < pool.length; i++)
        for (let j = i + 1; j < pool.length; j++)
          for (let k = j + 1; k < pool.length; k++)
            for (let l = k + 1; l < pool.length; l++)
              candidates.push({ type: 'ankan', seat, uses: [pool[i], pool[j], pool[k], pool[l]] })
      for (let tile = 0; tile < 136; tile++) {
        candidates.push({ type: 'shouminkan', seat, tile })
      }
    }
    return candidates
  }

  /** The two-sided lock at one anchor: candidate folds ⇔ its key is offered. */
  function expectPartition(
    label: string,
    seed: number,
    actions: readonly HandAction[],
    candidates: HandAction[],
    offeredTypes: ReadonlyArray<HandAction['type']>,
  ): void {
    const state = foldRecord({ seed, actions })
    const offered = new Set(legalActions(state).map(keyOf))
    let hits = 0
    for (const candidate of candidates) {
      const fold = () => foldRecord({ seed, actions: [...actions, candidate] })
      if (offered.has(keyOf(candidate))) {
        hits++
        expect(fold, `${label}: offered ${keyOf(candidate)}`).not.toThrow()
      } else {
        expect(fold, `${label}: outside ${keyOf(candidate)}`).toThrow(RangeError)
      }
    }
    // Completeness: every offer of the space's types was hit by exactly one
    // candidate — nothing is offered that the exhaustive space cannot reach.
    const inSpace = legalActions(state).filter((a) => offeredTypes.includes(a.type))
    expect(hits, `${label}: every offered claim lives in the candidate space`).toBe(inSpace.length)
  }

  it('exhaustive claim partition at every window anchor: candidate folds ⇔ offered', () => {
    const windows = [
      { label: 'seed-1 chi window', seed: 1, actions: chiWindowPrefix1 },
      { label: 'seed-1 pon window', seed: 1, actions: ponWindowPrefix1 },
      { label: 'seed-3 race window', seed: 3, actions: racePrefix3 },
      { label: 'seed-67 kan window', seed: 67, actions: kanPrefix67 },
      { label: 'seed-85 three-shape chi window', seed: 85, actions: chiShapesPrefix85 },
      { label: 'seed-5 pon+chi window', seed: 5, actions: ponChiPrefix5 },
      { label: 'seed-101033 fifth-kan window', seed: FOUR_KAN_SEED, actions: fifthKanWindowPrefix },
    ] as const
    for (const { label, seed, actions } of windows) {
      const state = foldRecord({ seed, actions })
      expectPartition(label, seed, actions, claimCandidatesAt(state), [
        'chi',
        'pon',
        'daiminkan',
      ])
    }
  })

  it('exhaustive kan partition at every post-draw anchor: candidate folds ⇔ offered', () => {
    const postDraws = [
      { label: 'seed-67 shouminkan post-draw', seed: 67, actions: shouminkanPrefix67 },
      { label: 'seed-161 ankan post-draw', seed: 161, actions: ankanPrefix161 },
      { label: 'seed-280 ankan post-draw', seed: 280, actions: ankanPrefix280 },
      { label: 'seed-1004 haitei post-draw', seed: 1004, actions: haiteiPrefix1004 },
      {
        label: 'seed-101033 post-chain post-draw',
        seed: FOUR_KAN_SEED,
        actions: [...fourKanChain(), { type: 'draw', seat: 0 } as const],
      },
    ] as const
    for (const { label, seed, actions } of postDraws) {
      const state = foldRecord({ seed, actions })
      expectPartition(label, seed, actions, kanCandidatesAt(state), ['ankan', 'shouminkan'])
    }
  })

  it('the kan ceiling suppresses the offer the fold rejects: pons stay, the daiminkan goes', () => {
    // Four kans made; West's three 4z copies would daiminkan the fresh 122 — the
    // offer must be absent for the same reason the fold throws.
    const state = foldRecord({ seed: FOUR_KAN_SEED, actions: fifthKanWindowPrefix })
    expect(state.doraIndicators.length - 1).toBe(4)
    const offered = legalActions(state)
    expect(offered.some((a) => a.type === 'daiminkan')).toBe(false)
    expect(offered.filter((a) => a.type === 'pon')).toHaveLength(3)
    expect(() =>
      foldRecord({
        seed: FOUR_KAN_SEED,
        actions: [
          ...fifthKanWindowPrefix,
          { type: 'daiminkan', seat: 2, tile: 122, uses: [120, 121, 123] },
        ],
      }),
    ).toThrow('no rinshan tile remaining')
  })

  it('the haitei draw suppresses the kan the fold rejects: a concealed quad, no ankan offer', () => {
    // South drew the last live tile holding all four 5p — no replacement remains.
    const state = foldRecord({ seed: 1004, actions: haiteiPrefix1004 })
    expect(state.live).toHaveLength(0)
    expect(state.phase).toBe('playing')
    const offered = legalActions(state)
    expect(offered.every((a) => a.type === 'discard')).toBe(true)
    expect(() =>
      foldRecord({
        seed: 1004,
        actions: [...haiteiPrefix1004, { type: 'ankan', seat: 1, uses: [55, 52, 53, 54] }],
      }),
    ).toThrow('on an empty live wall')
  })

  it('a stale window offers no claims and folds none', () => {
    // Seat 1's draw closes seed-67's kan window; the daiminkan that was offered a
    // moment ago is gone from the set and thrown by the fold.
    const staled: readonly HandAction[] = [...kanPrefix67, { type: 'draw', seat: 1 }]
    const state = foldRecord({ seed: 67, actions: staled })
    expect(state.claimable).toBeNull()
    const offered = legalActions(state)
    expect(offered.every((a) => a.type === 'discard')).toBe(true)
    expect(() =>
      foldRecord({
        seed: 67,
        actions: [...staled, { type: 'daiminkan', seat: 3, tile: 91, uses: [90, 88, 89] }],
      }),
    ).toThrow('no claimable discard')
  })

  it('a claim discard owed bars the draw and every kan', () => {
    const state = foldRecord({ seed: 1, actions: mustDiscardPrefix1 })
    const offered = new Set(legalActions(state).map(keyOf))
    const draw: HandAction = { type: 'draw', seat: 1 }
    const ankan: HandAction = { type: 'ankan', seat: 1, uses: [81, 83, 7, 79] }
    for (const bad of [draw, ankan]) {
      expect(offered.has(keyOf(bad))).toBe(false)
      expect(() => foldRecord({ seed: 1, actions: [...mustDiscardPrefix1, bad] })).toThrow(
        'owes a discard',
      )
    }
  })
})

describe('deterministic order', () => {
  // The D2/D3 order made concrete: full offered arrays as frozen literals, uses in
  // canonical order (hand order; chi [lower kind, higher kind]; ankan drawn last).
  // Derivations in the anchor block above; never regenerate.

  it('seed-67 kan window: draw, then the three pon pairs, then the daiminkan', () => {
    expect(legalActions(foldRecord({ seed: 67, actions: kanPrefix67 }))).toEqual([
      { type: 'draw', seat: 1 },
      { type: 'pon', seat: 3, tile: 91, uses: [90, 88] },
      { type: 'pon', seat: 3, tile: 91, uses: [90, 89] },
      { type: 'pon', seat: 3, tile: 91, uses: [88, 89] },
      { type: 'daiminkan', seat: 3, tile: 91, uses: [90, 88, 89] },
    ])
  })

  it('seed-3 race window: the pon precedes both copy-variant chis', () => {
    expect(legalActions(foldRecord({ seed: 3, actions: racePrefix3 }))).toEqual([
      { type: 'draw', seat: 0 },
      { type: 'pon', seat: 1, tile: 42, uses: [43, 41] },
      { type: 'chi', seat: 0, tile: 42, uses: [37, 47] },
      { type: 'chi', seat: 0, tile: 42, uses: [37, 44] },
    ])
  })

  it('seed-5 window: another seat’s pon before the chi seat’s four variants, shapes ascending', () => {
    expect(legalActions(foldRecord({ seed: 5, actions: ponChiPrefix5 }))).toEqual([
      { type: 'draw', seat: 3 },
      { type: 'pon', seat: 0, tile: 94, uses: [93, 95] },
      { type: 'chi', seat: 3, tile: 94, uses: [88, 97] },
      { type: 'chi', seat: 3, tile: 94, uses: [88, 99] },
      { type: 'chi', seat: 3, tile: 94, uses: [97, 103] },
      { type: 'chi', seat: 3, tile: 94, uses: [99, 103] },
    ])
  })

  it('seed-85 window: all three run shapes, low shape first, copies in hand order', () => {
    expect(legalActions(foldRecord({ seed: 85, actions: chiShapesPrefix85 }))).toEqual([
      { type: 'draw', seat: 2 },
      { type: 'chi', seat: 2, tile: 89, uses: [82, 86] }, // 3s4s — the low shape
      { type: 'chi', seat: 2, tile: 89, uses: [86, 93] }, // 4s6s, first 6s copy
      { type: 'chi', seat: 2, tile: 89, uses: [86, 94] }, // 4s6s, second 6s copy
      { type: 'chi', seat: 2, tile: 89, uses: [93, 99] }, // 6s7s, first 6s copy
      { type: 'chi', seat: 2, tile: 89, uses: [94, 99] }, // 6s7s, second 6s copy
    ])
  })

  it('seed-67 shouminkan post-draw: the eleven discards, then the upgrade', () => {
    const state = foldRecord({ seed: 67, actions: shouminkanPrefix67 })
    expect(legalActions(state)).toEqual([
      ...state.hands[3].map((tile) => ({ type: 'discard', seat: 3, tile })),
      { type: 'discard', seat: 3, tile: 14 },
      { type: 'shouminkan', seat: 3, tile: 89 },
    ])
  })

  it('seed-161 and seed-280 ankan post-draw: the fourteen discards, then the quad — uses in hand order, drawn last', () => {
    const with161 = legalActions(foldRecord({ seed: 161, actions: ankanPrefix161 }))
    expect(with161[with161.length - 1]).toEqual({
      type: 'ankan',
      seat: 1,
      uses: [118, 116, 119, 117], // three hand copies in hand order, the drawn 117 last
    })
    expect(with161).toHaveLength(15)
    const with280 = legalActions(foldRecord({ seed: 280, actions: ankanPrefix280 }))
    expect(with280[with280.length - 1]).toEqual({
      type: 'ankan',
      seat: 3,
      uses: [0, 3, 2, 1], // all four from the hand, in hand order — 134 stays drawn
    })
    expect(with280).toHaveLength(15)
  })

  it('same state → same array at every anchor', () => {
    for (const { label, seed, actions } of ANCHORS) {
      const state = foldRecord({ seed, actions })
      expect(legalActions(state), label).toEqual(legalActions(state))
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

  it('claim and kan offers are fresh to their bones: uses tuples are equal but never shared', () => {
    for (const { label, seed, actions } of ANCHORS) {
      const state = foldRecord({ seed, actions })
      const snapshot = structuredClone(state)
      const first = legalActions(state)
      const second = legalActions(state)
      expect(state, label).toEqual(snapshot)
      expect(second, label).toEqual(first)
      for (let i = 0; i < first.length; i++) {
        expect(second[i], label).not.toBe(first[i])
        const a = first[i]
        const b = second[i]
        if ('uses' in a && 'uses' in b) {
          expect(b.uses, label).not.toBe(a.uses)
        }
      }
    }
  })
})
