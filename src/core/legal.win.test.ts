// The win-offer agreement suite (T-005-02-02): tsumo and ron offers pinned against
// the derivation stack (isAgari/waits/yakuOf) on one side and the fold on the other.
// The premise everywhere else is offered ⇔ folds; here it holds with ONE documented
// asymmetry — THE FURITEN DIVERGENCE: a seat whose waits intersect its own pond is
// never offered a ron, but the fold accepts one (furiten is legality's business,
// never the step function's — see the legal.ts header). Fixtures are seed-mined
// (the win.test.ts precedent): under all-tsumogiri play a seat's 13-tile hand never
// changes, so dealt-tenpai seats give deterministic win windows — each constant
// names its seed and geometry, cross-checked at capture time against the derivation
// stack. Never regenerate. Importing from './index' is the barrel-export check.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  SEAT_COUNT,
  foldRecord,
  isAgari,
  kindOf,
  legalActions,
  waits,
  yakuOf,
  type HandAction,
  type Seat,
  type TableState,
  type TileId,
  type WindKind,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** The post-deal live wall (draw order) — the authority the scripts read. */
function dealtLive(seed: number): TileId[] {
  return foldRecord({ seed, actions: [] }).live
}

/** `turns` full tsumogiri turns (the win.test.ts helper, mirrored per house convention). */
function scriptedTurns(live: readonly TileId[], turns: number): HandAction[] {
  const actions: HandAction[] = []
  for (let t = 0; t < turns; t++) {
    const seat = (t % SEAT_COUNT) as Seat
    actions.push({ type: 'draw', seat }, { type: 'discard', seat, tile: live[t] })
  }
  return actions
}

// ---------------------------------------------------------------------------
// The derivation-stack oracle: the gates re-derived HERE, from the same modules
// legality consults but never from legalActions itself — the expectation side of
// the offered ⇔ gates partition. Mirrors record.ts's fold constants.
// ---------------------------------------------------------------------------

function windOf(seat: Seat): WindKind {
  return `${seat + 1}z` as WindKind
}

/** The three ron gates for `seat` on `tile`, evaluated independently of legal.ts. */
function ronGates(
  state: TableState,
  seat: Seat,
  tile: TileId,
): { completes: boolean; furiten: boolean; yakuless: boolean } {
  const kinds = state.hands[seat].map(kindOf)
  const melds = state.melds[seat]
  const completes = isAgari([...kinds, kindOf(tile)], melds)
  if (!completes) return { completes, furiten: false, yakuless: false }
  const pondKinds = new Set(state.ponds[seat].map(kindOf))
  const furiten = waits(kinds, melds).some((kind) => pondKinds.has(kind))
  const yaku = yakuOf({
    concealed: [...kinds, kindOf(tile)],
    melds,
    winningKind: kindOf(tile),
    source: 'discard',
    lastTile: state.live.length === 0,
    seatWind: windOf(seat),
    roundWind: '1z',
    riichi: 'none',
    ippatsu: false,
  })
  return { completes, furiten, yakuless: yaku.length === 0 }
}

/** The two tsumo gates for the turn seat's drawn tile. */
function tsumoGates(state: TableState): { completes: boolean; yakuless: boolean } {
  const seat = state.turn
  const kinds = state.hands[seat].map(kindOf)
  const melds = state.melds[seat]
  const completes = isAgari([...kinds, kindOf(state.drawn!)], melds)
  if (!completes) return { completes, yakuless: false }
  const yaku = yakuOf({
    concealed: [...kinds, kindOf(state.drawn!)],
    melds,
    winningKind: kindOf(state.drawn!),
    source: state.drawnFrom!,
    lastTile: state.live.length === 0,
    seatWind: windOf(seat),
    roundWind: '1z',
    riichi: 'none',
    ippatsu: false,
  })
  return { completes, yakuless: yaku.length === 0 }
}

// ---------------------------------------------------------------------------
// Frozen anchors — mined by this ticket's scratchpad scans (probing the
// derivation stack only), plus the win.test.ts fixtures reused as offer points.
//
// Seed 3951 — seat 3 dealt tenpai, pinfu waits 1s/4s/7s. Turn 0: seat 0
// tsumogiris live[0] = 72 (1s) — seat 3 rons it, and NO claim material exists
// anywhere. Turn 35: seat 3 draws live[35] = 85 (4s) — its tsumo point.
// Seed 4851 — seat 1 dealt tenpai (pinfu/tanyao/sanshoku on 4s ranks). Turn 4:
// seat 0 tsumogiris live[4] = 87 (4s) — seat 1 rons it, seat 2 holds the pon
// pair [86, 84], seat 1 (the chi seat) holds [79, 82]: ron+pon+chi coexist.
// Seed 23798 — seat 1 dealt tenpai waiting 6p/9p; its turn-9 draw is 58 (6p),
// tsumogiri'd — FURITEN from then on. Turn 20: seat 0 tsumogiris 70 (9p), a
// completing, yaku-bearing (pinfu) wait: the offer is withheld, the fold accepts.
// Seed 12754 — seat 2 completes seat 1's turn-1 tsumogiri 101 (8s) with NO yaku
// (the win.test.ts one-yaku fixture): no offer, and the fold throws.
// Seed 147508 — houtei: the final discard (turn 69, seat 1, tile 43, 2p) is seat
// 3's chiitoitsu+houtei win, NOT furiten — the ryuukyoku arm's positive offer.
// Seed 103897 — houtei where the winner (seat 2, tile 72) IS furiten (waits
// 1s/4s intersect its own tsumogiri pond): the ryuukyoku arm offers nothing,
// the fold still accepts — the divergence in the houtei arm.
// Seed 29732 — seat 1's turn-49 draw completes its ankan [33,32,35,34]; the
// rinshan replacement dead[0] = 22 completes the hand (rinshan kaihou): the
// tsumo offer must read drawnFrom = 'rinshan'.
// ---------------------------------------------------------------------------

const RON_SEED = 3951
const ronWindowPrefix = (): HandAction[] => scriptedTurns(dealtLive(RON_SEED), 1)
const tsumoPointPrefix = (): HandAction[] => [
  ...scriptedTurns(dealtLive(RON_SEED), 35),
  { type: 'draw', seat: 3 },
]

const COEXIST_SEED = 4851
const coexistPrefix = (): HandAction[] => scriptedTurns(dealtLive(COEXIST_SEED), 5)

const FURITEN_SEED = 23798
const furitenPrefix = (): HandAction[] => scriptedTurns(dealtLive(FURITEN_SEED), 21)
const FURITEN_RON: HandAction = { type: 'ron', seat: 1, tile: 70 }

const YAKULESS_SEED = 12754
const yakulessPrefix = (): HandAction[] => scriptedTurns(dealtLive(YAKULESS_SEED), 2)

const HOUTEI_SEED = 147508
const houteiPrefix = (): HandAction[] => scriptedTurns(dealtLive(HOUTEI_SEED), 70)

const FURITEN_HOUTEI_SEED = 103897
const furitenHouteiPrefix = (): HandAction[] => scriptedTurns(dealtLive(FURITEN_HOUTEI_SEED), 70)

const RINSHAN_SEED = 29732
function rinshanPrefix(): HandAction[] {
  const live = dealtLive(RINSHAN_SEED)
  const actions = scriptedTurns(live, 49)
  actions[91] = { type: 'discard', seat: 1, tile: 58 } // the turn-45 tedashi (win.test.ts)
  actions.push({ type: 'draw', seat: 1 }, { type: 'ankan', seat: 1, uses: [33, 32, 35, 34] })
  return actions
}

describe('tsumo offers', () => {
  it('offered right after the 14 discards when the wall draw completes a yaku-bearing hand', () => {
    const state = foldRecord({ seed: RON_SEED, actions: tsumoPointPrefix() })
    expect(state.drawn).toBe(85)
    expect(state.drawnFrom).toBe('wall')
    const offered = legalActions(state)
    // T-009-01-01: every one of the 14 discard candidates also leaves this hand
    // at tenpai, so a riichi offer follows each discard before the win — 14
    // discards + 14 riichi offers + the win (mined/re-verified against
    // riichiOffers directly at capture time; never regenerate by hand).
    expect(offered[28]).toEqual({ type: 'tsumo', seat: 3 })
    expect(offered).toHaveLength(29) // 14 discards + 14 riichi + the win; no kan material
  })

  it('offered on a completing rinshan replacement — drawnFrom is the source', () => {
    const state = foldRecord({ seed: RINSHAN_SEED, actions: rinshanPrefix() })
    expect(state.drawn).toBe(22)
    expect(state.drawnFrom).toBe('rinshan')
    const offered = legalActions(state)
    // Ten hand tiles after the ankan → 11 discards, then (T-009-01-01) 11
    // riichi offers (every discard candidate here also leaves tenpai), then
    // the win.
    expect(offered[22]).toEqual({ type: 'tsumo', seat: 1 })
  })

  it('not offered one turn earlier: the same seat’s non-completing draw carries no win', () => {
    const state = foldRecord({
      seed: RON_SEED,
      actions: [...scriptedTurns(dealtLive(RON_SEED), 31), { type: 'draw', seat: 3 }],
    })
    expect(legalActions(state).some((a) => a.type === 'tsumo')).toBe(false)
  })

  it('offered ⇔ the drawn tile completes with yaku, over random post-draw states (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 69 }), (seed, turns) => {
        const seat = (turns % SEAT_COUNT) as Seat
        const state = foldRecord({
          seed,
          actions: [...scriptedTurns(dealtLive(seed), turns), { type: 'draw', seat }],
        })
        const gates = tsumoGates(state)
        const offered = legalActions(state).some((a) => a.type === 'tsumo')
        expect(offered).toBe(gates.completes && !gates.yakuless)
      }),
    )
  })
})

describe('ron offers and the frozen order', () => {
  it('the coexistence window: draw, then the ron, then the pon, then the chi', () => {
    const state = foldRecord({ seed: COEXIST_SEED, actions: coexistPrefix() })
    expect(state.claimable).toEqual({ seat: 0, tile: 87 })
    expect(legalActions(state)).toEqual([
      { type: 'draw', seat: 1 },
      { type: 'ron', seat: 1, tile: 87 },
      { type: 'pon', seat: 2, tile: 87, uses: [86, 84] },
      { type: 'chi', seat: 1, tile: 87, uses: [79, 82] },
    ])
  })

  it('a claimless ron window offers exactly the draw and the ron', () => {
    const state = foldRecord({ seed: RON_SEED, actions: ronWindowPrefix() })
    expect(legalActions(state)).toEqual([
      { type: 'draw', seat: 1 },
      { type: 'ron', seat: 3, tile: 72 },
    ])
  })

  it('every offered ron folds to the agari the fold derives (agreement, both anchors)', () => {
    for (const { seed, prefix } of [
      { seed: COEXIST_SEED, prefix: coexistPrefix() },
      { seed: RON_SEED, prefix: ronWindowPrefix() },
    ]) {
      const ron = legalActions(foldRecord({ seed, actions: prefix })).find(
        (a) => a.type === 'ron',
      )!
      const state = foldRecord({ seed, actions: [...prefix, ron] })
      expect(state.phase).toBe('agari')
      expect(state.win?.winner).toBe(ron.seat)
    }
  })

  it('rons precede every claim over random windows, and each names the fresh discard (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 70 }), (seed, turns) => {
        const state = foldRecord({ seed, actions: scriptedTurns(dealtLive(seed), turns) })
        if (state.phase !== 'playing') return
        const offered = legalActions(state)
        const types = offered.map((a) => a.type)
        const firstRon = types.indexOf('ron')
        if (firstRon === -1) return
        const firstClaim = types.findIndex((t) => t === 'pon' || t === 'daiminkan' || t === 'chi')
        expect(firstRon).toBeGreaterThan(0) // never ahead of the draw
        if (firstClaim !== -1) expect(types.lastIndexOf('ron')).toBeLessThan(firstClaim)
      }),
    )
  })
})

describe('the furiten divergence: not offered, still folds', () => {
  it('a completing, yaku-bearing wait is withheld when the seat’s waits intersect its own pond', () => {
    const state = foldRecord({ seed: FURITEN_SEED, actions: furitenPrefix() })
    expect(state.claimable).toEqual({ seat: 0, tile: 70 })
    const gates = ronGates(state, 1, 70)
    expect(gates).toEqual({ completes: true, furiten: true, yakuless: false })
    expect(state.ponds[1].map(kindOf)).toContain('6p') // the turn-9 tsumogiri'd wait
    expect(legalActions(state).some((a) => a.type === 'ron')).toBe(false)
  })

  it('the SAME ron appended to the log still folds — furiten is legality’s narrowing, not the fold’s', () => {
    const state = foldRecord({ seed: FURITEN_SEED, actions: [...furitenPrefix(), FURITEN_RON] })
    expect(state.phase).toBe('agari')
    expect(state.win).toMatchObject({ by: 'ron', winner: 1, from: 0, tile: 70 })
  })
})

describe('the one-yaku gate: agreement, not divergence', () => {
  it('a yakuless completion is neither offered nor folded', () => {
    const state = foldRecord({ seed: YAKULESS_SEED, actions: yakulessPrefix() })
    expect(state.claimable).toEqual({ seat: 1, tile: 101 })
    const gates = ronGates(state, 2, 101)
    expect(gates.completes).toBe(true)
    expect(gates.yakuless).toBe(true)
    expect(legalActions(state).some((a) => a.type === 'ron')).toBe(false)
    expect(() =>
      foldRecord({
        seed: YAKULESS_SEED,
        actions: [...yakulessPrefix(), { type: 'ron', seat: 2, tile: 101 }],
      }),
    ).toThrow('a yakuless win is not a win (the one-yaku gate)')
  })
})

describe('houtei: the ryuukyoku carve-out', () => {
  it('ryuukyoku offers exactly the non-furiten houtei ron, and it folds to houtei agari', () => {
    const state = foldRecord({ seed: HOUTEI_SEED, actions: houteiPrefix() })
    expect(state.phase).toBe('ryuukyoku')
    expect(legalActions(state)).toEqual([{ type: 'ron', seat: 3, tile: 43 }])
    const won = foldRecord({
      seed: HOUTEI_SEED,
      actions: [...houteiPrefix(), { type: 'ron', seat: 3, tile: 43 }],
    })
    expect(won.phase).toBe('agari')
    expect(won.win).toEqual({
      by: 'ron',
      winner: 3,
      from: 1,
      tile: 43,
      yaku: ['chiitoitsu', 'houtei'],
    })
  })

  it('a furiten houtei winner gets no offer, but its ron still folds (the divergence, houtei arm)', () => {
    const state = foldRecord({ seed: FURITEN_HOUTEI_SEED, actions: furitenHouteiPrefix() })
    expect(state.phase).toBe('ryuukyoku')
    expect(ronGates(state, 2, 72)).toEqual({ completes: true, furiten: true, yakuless: false })
    expect(legalActions(state)).toEqual([])
    const won = foldRecord({
      seed: FURITEN_HOUTEI_SEED,
      actions: [...furitenHouteiPrefix(), { type: 'ron', seat: 2, tile: 72 }],
    })
    expect(won.phase).toBe('agari')
  })

  it('an agari state offers nothing, whichever way it was won', () => {
    for (const { seed, actions } of [
      { seed: RON_SEED, actions: [...tsumoPointPrefix(), { type: 'tsumo', seat: 3 } as const] },
      { seed: RON_SEED, actions: [...ronWindowPrefix(), { type: 'ron', seat: 3, tile: 72 } as const] },
      { seed: HOUTEI_SEED, actions: [...houteiPrefix(), { type: 'ron', seat: 3, tile: 43 } as const] },
    ]) {
      const state = foldRecord({ seed, actions })
      expect(state.phase).toBe('agari')
      expect(legalActions(state)).toEqual([])
    }
  })
})

describe('the two-sided win partition', () => {
  // Every encodable win candidate at every anchor: the turn seat's tsumo (when a
  // drawn tile exists) and each seat's ron on the live discard. Offered ⇔ the
  // derivation-stack gates pass; folds ⇔ completion ∧ yaku (structural guards
  // aside) — so the partition table has exactly one asymmetric cell: furiten.
  const anchors: ReadonlyArray<{ label: string; seed: number; actions: () => HandAction[] }> = [
    { label: 'seed-3951 ron window', seed: RON_SEED, actions: ronWindowPrefix },
    { label: 'seed-3951 tsumo point', seed: RON_SEED, actions: tsumoPointPrefix },
    { label: 'seed-4851 coexistence window', seed: COEXIST_SEED, actions: coexistPrefix },
    { label: 'seed-23798 furiten window', seed: FURITEN_SEED, actions: furitenPrefix },
    { label: 'seed-12754 yakuless window', seed: YAKULESS_SEED, actions: yakulessPrefix },
    { label: 'seed-147508 houtei', seed: HOUTEI_SEED, actions: houteiPrefix },
    { label: 'seed-103897 furiten houtei', seed: FURITEN_HOUTEI_SEED, actions: furitenHouteiPrefix },
    { label: 'seed-29732 rinshan point', seed: RINSHAN_SEED, actions: rinshanPrefix },
  ]

  it('offered ⇔ gates pass; folds ⇔ completes with yaku — furiten the only asymmetry', () => {
    for (const { label, seed, actions } of anchors) {
      const prefix = actions()
      const state = foldRecord({ seed, actions: prefix })
      const offered = legalActions(state)

      // Tsumo candidates: the turn seat at a post-draw point.
      if (state.phase === 'playing' && state.drawn !== null && !state.mustDiscard) {
        const gates = tsumoGates(state)
        const shouldOffer = gates.completes && !gates.yakuless
        expect(
          offered.some((a) => a.type === 'tsumo'),
          `${label}: tsumo offer`,
        ).toBe(shouldOffer)
        const fold = () =>
          foldRecord({ seed, actions: [...prefix, { type: 'tsumo', seat: state.turn }] })
        if (shouldOffer) expect(fold, `${label}: offered tsumo folds`).not.toThrow()
        else expect(fold, `${label}: unoffered tsumo throws`).toThrow(RangeError)
      }

      // Ron candidates: every seat on the live discard (open window or houtei).
      const window =
        state.phase === 'ryuukyoku'
          ? { seat: state.turn, tile: state.ponds[state.turn][state.ponds[state.turn].length - 1] }
          : state.claimable
      if (window === null) continue
      for (let s = 0; s < SEAT_COUNT; s++) {
        const seat = s as Seat
        const candidate: HandAction = { type: 'ron', seat, tile: window.tile }
        const isOffered = offered.some((a) => a.type === 'ron' && a.seat === seat)
        const fold = () => foldRecord({ seed, actions: [...prefix, candidate] })
        if (seat === window.seat) {
          expect(isOffered, `${label}: discarder never offered its own ron`).toBe(false)
          expect(fold, `${label}: own-discard ron throws`).toThrow(RangeError)
          continue
        }
        const gates = ronGates(state, seat, window.tile)
        expect(
          isOffered,
          `${label}: seat ${seat} ron offer matches the gates`,
        ).toBe(gates.completes && !gates.furiten && !gates.yakuless)
        if (gates.completes && !gates.yakuless) {
          expect(fold, `${label}: seat ${seat} completing yaku-bearing ron folds`).not.toThrow()
        } else {
          expect(fold, `${label}: seat ${seat} corrupt ron throws`).toThrow(RangeError)
        }
      }
    }
  })

  it('purity at the win anchors: fresh, equal arrays; the state never mutated', () => {
    for (const { label, seed, actions } of anchors) {
      const state = foldRecord({ seed, actions: actions() })
      const snapshot = structuredClone(state)
      const first = legalActions(state)
      const second = legalActions(state)
      expect(state, label).toEqual(snapshot)
      expect(second, label).toEqual(first)
      for (let i = 0; i < first.length; i++) expect(second[i], label).not.toBe(first[i])
    }
  })
})
