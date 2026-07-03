// The P5 crown the charter names: settlement.ts's property/grid suite, sibling to the
// hand-built fixtures in settlement.test.ts (the shanten.test.ts / shanten.property.
// test.ts split — fixtures in one file, property/table coverage in another, both testing
// the same module). Six sections:
//
//   §A the han×fu base-points grid, against baseOf directly (exported by T-008-01-04 —
//      see settlement.ts's header) — table-driven, not fast-check: the published table
//      is a small exact step function, so an exhaustive nested-loop table names every
//      failing cell directly, where a random sampler would under-cover or hide which
//      cell broke (design.md Decision 2).
//   §B roundUp100 boundary values, the same table-driven style.
//   §C the dealer-ness × ron/tsumo payment split, against ronDeltas/tsumoDeltas directly
//      (design.md Decision 3) — same table-driven style, over a representative base-point
//      sample chosen to hit every rounding shape roundUp100 can produce.
//   §D zero-sum conservation over random ended hands: fast-check over seeds, driving a
//      real four-seat AI-vs-AI game to an ended TableState (a trimmed copy of selfplay.
//      test.ts's selfPlay driver — design.md Decision 4) and asserting settlementOf's
//      four deltas sum to exactly 0.
//   §E fu invariants (pinfu 20/30, chiitoitsu 25, fu always a multiple of 10 except 25):
//      fast-check over constructed winning hands (a trimmed copy of shanten.property.
//      test.ts's buildWinner/buildMelds/buildTenpaiParts toolkit — design.md Decision 5),
//      cross-checking fu.ts's pinfu-shape detection against yaku.ts's independently
//      written pinfu predicate via standardYakuOf.
//   §F the dora-gate property: dora is additive to price, never a gate — a monotonicity
//      property (design.md Decision 6) over the same constructed-hand toolkit, restricted
//      to closed self-draws so menzen-tsumo guarantees a non-vacuous priced win regardless
//      of which extra dora kind is added.
//
// Every expected number in §A-C is hand-derived in a comment BEFORE the assertion, from
// research.md §3 (restated from T-008-01-03's own research.md §3), never from a first run
// of settlement.ts — the fu.test.ts/han.test.ts/settlement.test.ts precedent. No shared
// test-utils module exists anywhere in src/core/ (the established convention), so the
// generator infrastructure below is a local, trimmed duplicate of two existing files'
// toolkits, not an import from them.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  COPIES_PER_KIND,
  DEAL_SIZE,
  KIND_COUNT,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  TILE_KINDS,
  baseOf,
  callPolicy,
  copyOf,
  decomposeAgari,
  discardPolicy,
  foldRecord,
  fuOf,
  kindOf,
  legalActions,
  roundUp100,
  ronDeltas,
  seatView,
  settlementOf,
  standardYakuOf,
  tileId,
  tsumoDeltas,
  yakuOf,
  type CopyIndex,
  type HandAction,
  type Meld,
  type Seat,
  type TableState,
  type TileId,
  type TileKind,
  type Win,
  type WinContext,
} from './index'

// ---------------------------------------------------------------------------
// §A — the han×fu base-points grid.
//
// The published tier table (research.md §3): han 1-4 use fu * 2^(2+han), capped at
// 2000; han 5 is a flat 2000 (mangan); han 6-7 flat 3000 (haneman); han 8-10 flat 4000
// (baiman); han 11-12 flat 6000 (sanbaiman); han >=13 is 8000 * floor(han/13) (yakuman,
// stacking by multiples of 13). Every [han, fu, base] row below is computed BY HAND from
// that formula, independent of baseOf's own source.
// ---------------------------------------------------------------------------

// han 1 (×8): no fu step in this range reaches the 2000 cap.
const HAN_1: readonly [number, number, number][] = [
  [1, 20, 160],
  [1, 30, 240],
  [1, 40, 320],
  [1, 50, 400],
  [1, 60, 480],
  [1, 70, 560],
  [1, 80, 640],
  [1, 90, 720],
  [1, 100, 800],
  [1, 110, 880],
]

// han 2 (×16): still under 2000 across the ordinary fu range; fu=130 (an unrealistic but
// formula-valid input) is added to prove the cap fires here too, not just at han 3-4.
const HAN_2: readonly [number, number, number][] = [
  [2, 20, 320],
  [2, 30, 480],
  [2, 40, 640],
  [2, 50, 800],
  [2, 60, 960],
  [2, 70, 1120],
  [2, 80, 1280],
  [2, 90, 1440],
  [2, 100, 1600],
  [2, 110, 1760],
  [2, 130, 2000], // raw 130*16 = 2080, capped
]

// han 3 (×32): fu 70-110 all exceed 2000 raw and are capped — the natural cap boundary.
const HAN_3: readonly [number, number, number][] = [
  [3, 20, 640],
  [3, 30, 960],
  [3, 40, 1280],
  [3, 50, 1600],
  [3, 60, 1920],
  [3, 70, 2000], // raw 2240, capped
  [3, 80, 2000], // raw 2560, capped
  [3, 90, 2000], // raw 2880, capped
  [3, 100, 2000], // raw 3200, capped
  [3, 110, 2000], // raw 3520, capped
]

// han 4 (×64): the AC's own fixture pair — 30fu uncapped at 1920, 40fu capped at 2000.
const HAN_4: readonly [number, number, number][] = [
  [4, 20, 1280],
  [4, 30, 1920], // the AC fixture's own raw value, uncapped
  [4, 40, 2000], // raw 2560, capped — the AC fixture's mangan-cap sibling
  [4, 50, 2000],
  [4, 60, 2000],
  [4, 70, 2000],
  [4, 80, 2000],
  [4, 90, 2000],
  [4, 100, 2000],
  [4, 110, 2000],
]

// han 5-12: flat per tier, fu-independent — two fu values per han proves fu is ignored.
const FLAT_TIERS: readonly [number, number, number][] = [
  [5, 20, 2000], // mangan
  [5, 110, 2000],
  [6, 30, 3000], // haneman
  [6, 110, 3000],
  [7, 30, 3000],
  [7, 110, 3000],
  [8, 30, 4000], // baiman
  [8, 110, 4000],
  [9, 30, 4000],
  [10, 30, 4000],
  [11, 30, 6000], // sanbaiman
  [11, 110, 6000],
  [12, 30, 6000],
]

// han >=13: 8000 * floor(han/13) — the yakuman stacking tier. fu is irrelevant; 0 stands
// in for it to make that explicit.
const YAKUMAN_TIER: readonly [number, number, number][] = [
  [13, 0, 8000], // floor(13/13) = 1
  [14, 0, 8000], // floor(14/13) = 1 — still single, not yet double
  [25, 0, 8000], // floor(25/13) = 1
  [26, 0, 16000], // floor(26/13) = 2 — double yakuman
  [39, 0, 24000], // floor(39/13) = 3 — triple yakuman
]

const HAN_FU_GRID: readonly [number, number, number][] = [
  ...HAN_1,
  ...HAN_2,
  ...HAN_3,
  ...HAN_4,
  ...FLAT_TIERS,
  ...YAKUMAN_TIER,
]

describe('baseOf — the han×fu base-points grid', () => {
  for (const [han, fu, base] of HAN_FU_GRID) {
    it(`han ${han}, fu ${fu} -> ${base}`, () => {
      expect(baseOf(han, fu)).toBe(base)
    })
  }
})

// ---------------------------------------------------------------------------
// §B — roundUp100: ceiling to the next 100, including the two AC fixture numbers
// (1920*4 = 7680 -> 7700, 1920*6 = 11520 -> 11600) as a direct cross-check.
// ---------------------------------------------------------------------------

const ROUND_UP_100_TABLE: readonly [number, number][] = [
  [0, 0],
  [100, 100],
  [101, 200],
  [150, 200],
  [199, 200],
  [200, 200],
  [201, 300],
  [7680, 7700],
  [11520, 11600],
]

describe('roundUp100 — ceiling to the next hundred', () => {
  for (const [input, expected] of ROUND_UP_100_TABLE) {
    it(`${input} -> ${expected}`, () => {
      expect(roundUp100(input)).toBe(expected)
    })
  }
})

// ---------------------------------------------------------------------------
// §C — dealer-ness × ron/tsumo payment split, against ronDeltas/tsumoDeltas directly.
// Base points sampled to hit every rounding shape (exact hundreds, non-hundreds, one
// value per tier): 400, 1000, 1920, 2000, 3000, 4000, 6000, 8000. Ron uses winner=0/
// discarder=2 (dealer win) and winner=1/discarder=3 (non-dealer win); tsumo uses
// winner=0 (dealer win, payers 1/2/3) and winner=1 (non-dealer win, dealer 0 pays the
// dealer rate, seats 2/3 pay the non-dealer rate). Every expected 4-tuple is computed by
// hand from the published split (research.md §3): ron — discarder pays roundUp100(base*6)
// for a dealer winner or roundUp100(base*4) otherwise; tsumo — roundUp100(base*2) is the
// dealer-rate payment, roundUp100(base*1) the non-dealer-rate, applied per research.md
// §3's table. base=1920/2000/8000 rows double as cross-checks against settlement.test.ts's
// own AC/mangan/yakuman fixtures.
// ---------------------------------------------------------------------------

interface SplitRow {
  base: number
  dealerRon: number
  nonDealerRon: number
  dealerPaysTsumo: number
  nonDealerPaysTsumo: number
}

const SPLIT_TABLE: readonly SplitRow[] = [
  { base: 400, dealerRon: 2400, nonDealerRon: 1600, dealerPaysTsumo: 800, nonDealerPaysTsumo: 400 },
  { base: 1000, dealerRon: 6000, nonDealerRon: 4000, dealerPaysTsumo: 2000, nonDealerPaysTsumo: 1000 },
  { base: 1920, dealerRon: 11600, nonDealerRon: 7700, dealerPaysTsumo: 3900, nonDealerPaysTsumo: 2000 },
  { base: 2000, dealerRon: 12000, nonDealerRon: 8000, dealerPaysTsumo: 4000, nonDealerPaysTsumo: 2000 },
  { base: 3000, dealerRon: 18000, nonDealerRon: 12000, dealerPaysTsumo: 6000, nonDealerPaysTsumo: 3000 },
  { base: 4000, dealerRon: 24000, nonDealerRon: 16000, dealerPaysTsumo: 8000, nonDealerPaysTsumo: 4000 },
  { base: 6000, dealerRon: 36000, nonDealerRon: 24000, dealerPaysTsumo: 12000, nonDealerPaysTsumo: 6000 },
  { base: 8000, dealerRon: 48000, nonDealerRon: 32000, dealerPaysTsumo: 16000, nonDealerPaysTsumo: 8000 },
]

describe('ronDeltas — dealer-ness split', () => {
  for (const row of SPLIT_TABLE) {
    it(`base ${row.base}, dealer win: discarder pays ${row.dealerRon}`, () => {
      expect(ronDeltas(row.base, 0, 2)).toEqual([row.dealerRon, 0, -row.dealerRon, 0])
    })
    it(`base ${row.base}, non-dealer win: discarder pays ${row.nonDealerRon}`, () => {
      expect(ronDeltas(row.base, 1, 3)).toEqual([0, row.nonDealerRon, 0, -row.nonDealerRon])
    })
  }
})

describe('tsumoDeltas — dealer-ness split', () => {
  for (const row of SPLIT_TABLE) {
    it(`base ${row.base}, dealer win: every other seat pays ${row.dealerPaysTsumo}`, () => {
      const winnerGain = row.dealerPaysTsumo * 3
      expect(tsumoDeltas(row.base, 0)).toEqual([
        winnerGain,
        -row.dealerPaysTsumo,
        -row.dealerPaysTsumo,
        -row.dealerPaysTsumo,
      ])
    })
    it(`base ${row.base}, non-dealer win: dealer pays ${row.dealerPaysTsumo}, others pay ${row.nonDealerPaysTsumo}`, () => {
      const winnerGain = row.dealerPaysTsumo + 2 * row.nonDealerPaysTsumo
      expect(tsumoDeltas(row.base, 1)).toEqual([
        -row.dealerPaysTsumo,
        winnerGain,
        -row.nonDealerPaysTsumo,
        -row.nonDealerPaysTsumo,
      ])
    })
  }
})

// ---------------------------------------------------------------------------
// Shared generator infrastructure for §D-F.
// ---------------------------------------------------------------------------

/** All kind indices, the filter base for budgeted choices (shanten.property.test.ts). */
const ALL_KINDS: readonly number[] = Array.from({ length: KIND_COUNT }, (_, k) => k)

/** Every legal 3-tile set as kind indices: 34 triplets, then 21 runs. */
const SET_CANDIDATES: readonly (readonly number[])[] = [
  ...Array.from({ length: KIND_COUNT }, (_, k) => [k, k, k]),
  ...Array.from({ length: 27 }, (_, k) => k)
    .filter((k) => k % 9 <= 6)
    .map((k) => [k, k + 1, k + 2]),
]

/** Every legal run alone (no triplets) — §E's dedicated pinfu-shape generator. */
const PINFU_RUN_CANDIDATES: readonly (readonly number[])[] = Array.from({ length: 27 }, (_, k) => k)
  .filter((k) => k % 9 <= 6)
  .map((k) => [k, k + 1, k + 2])

/** tileId at the next unconsumed copy of a kind — ids stay distinct per budget. */
function nextCopyId(counts: number[], k: number): number {
  return tileId(TILE_KINDS[k], counts[k] as CopyIndex)
}

/**
 * REAL melds from a shared budget: pon/chi/ankan by formChoices, target by setChoices,
 * both mod the still-legal candidates. Mutates `counts` — the caller threads the same
 * budget through its concealed tiles. Trimmed from shanten.property.test.ts's copy: same
 * shape, this file's only consumer.
 */
function buildMelds(
  meldCount: number,
  formChoices: readonly number[],
  setChoices: readonly number[],
  counts: number[],
): Meld[] {
  const built: Meld[] = []
  for (let s = 0; s < meldCount; s += 1) {
    const form = (['pon', 'chi', 'ankan'] as const)[formChoices[s] % 3]
    if (form === 'pon') {
      const legal = ALL_KINDS.filter((k) => counts[k] + 3 <= COPIES_PER_KIND)
      const k = legal[setChoices[s] % legal.length]
      const claimed = nextCopyId(counts, k)
      counts[k] += 1
      const own: [number, number] = [nextCopyId(counts, k), 0]
      counts[k] += 1
      own[1] = nextCopyId(counts, k)
      counts[k] += 1
      built.push({ type: 'pon', claimed, from: 3, own })
    } else if (form === 'chi') {
      const legal = ALL_KINDS.filter(
        (k) =>
          k < 27 &&
          k % 9 <= 6 &&
          counts[k] < COPIES_PER_KIND &&
          counts[k + 1] < COPIES_PER_KIND &&
          counts[k + 2] < COPIES_PER_KIND,
      )
      const k = legal[setChoices[s] % legal.length]
      const claimed = nextCopyId(counts, k)
      const own: [number, number] = [nextCopyId(counts, k + 1), nextCopyId(counts, k + 2)]
      counts[k] += 1
      counts[k + 1] += 1
      counts[k + 2] += 1
      built.push({ type: 'chi', claimed, from: 3, own })
    } else {
      const legal = ALL_KINDS.filter((k) => counts[k] === 0)
      const k = legal[setChoices[s] % legal.length]
      built.push({
        type: 'ankan',
        own: [
          tileId(TILE_KINDS[k], 0),
          tileId(TILE_KINDS[k], 1),
          tileId(TILE_KINDS[k], 2),
          tileId(TILE_KINDS[k], 3),
        ],
      })
      counts[k] = COPIES_PER_KIND
    }
  }
  return built
}

/**
 * A complete winning 14 − 3·meldCount + 3·meldCount = 14 tile hand: real melds first
 * (from the shared budget), then concealed sets, then the pair. Trimmed from shanten.
 * property.test.ts's buildTenpaiParts — same construction, no waits-clause pieces.
 */
function buildTenpaiParts(
  meldCount: number,
  formChoices: readonly number[],
  setChoices: readonly number[],
  pairChoice: number,
): { concealed14: TileKind[]; melds: Meld[] } {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  const built = buildMelds(meldCount, formChoices, setChoices, counts)
  const hand: TileKind[] = []
  for (let s = meldCount; s < 4; s += 1) {
    const legal = SET_CANDIDATES.filter((tiles) =>
      tiles.every((k) => counts[k] + tiles.filter((x) => x === k).length <= COPIES_PER_KIND),
    )
    const picked = legal[setChoices[s] % legal.length]
    for (const k of picked) {
      counts[k] += 1
      hand.push(TILE_KINDS[k])
    }
  }
  const pairable = ALL_KINDS.filter((k) => counts[k] + 2 <= COPIES_PER_KIND)
  const pairKind = pairable[pairChoice % pairable.length]
  hand.push(TILE_KINDS[pairKind], TILE_KINDS[pairKind])
  return { concealed14: hand, melds: built }
}

const meldCountArb = fc.integer({ min: 0, max: 4 })
const fourChoicesArb = fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 })

// ---------------------------------------------------------------------------
// §D — zero-sum conservation over random ended hands.
//
// endedStateOf drives one whole hand from a seed with every seat botted — the same
// per-step arbitration rule selfplay.test.ts's selfPlay uses (claim windows consulted in
// offered order, earliest non-draw answer wins), trimmed to return only the terminal
// TableState: no record/claims-tally/double-play machinery, since this property only
// reads the ended state. A wrong arbitration would fold an illegal action and throw
// before reaching an end, so this driver only ever produces REAL, rule-legal endings —
// design.md Decision 4.
// ---------------------------------------------------------------------------

const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE
const ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 * SEAT_COUNT + 2

type ClaimAction = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

function isClaimAction(action: HandAction): action is ClaimAction {
  return action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan'
}

function endedStateOf(seed: number): TableState {
  const actions: HandAction[] = []
  for (;;) {
    const state = foldRecord({ seed, actions })
    const legal = legalActions(state)
    if (state.phase === 'agari' || legal.length === 0) return state
    const isCallPoint =
      state.phase === 'ryuukyoku' ||
      (state.drawn === null && !state.mustDiscard && state.claimable !== null)
    let chosen: HandAction
    if (isCallPoint) {
      const consulted = new Set<Seat>()
      let best: HandAction | null = null
      let bestAt = Infinity
      for (const offer of legal) {
        if (offer.type !== 'ron' && !isClaimAction(offer)) continue
        if (consulted.has(offer.seat)) continue
        consulted.add(offer.seat)
        const answer = callPolicy(seatView(state, offer.seat), legal)
        if (answer.type === 'draw') continue
        const at = legal.indexOf(answer)
        if (at < bestAt) {
          best = answer
          bestAt = at
        }
      }
      if (best === null) {
        if (state.phase === 'ryuukyoku') {
          throw new Error(`seed ${seed}: ryuukyoku call point declined every ron`)
        }
        chosen = legal[0]
      } else {
        chosen = best
      }
    } else {
      chosen = discardPolicy(seatView(state, state.turn), legal)
    }
    actions.push(chosen)
    if (actions.length > ACTION_BOUND) {
      throw new Error(`seed ${seed}: settlement property driver exceeded ${ACTION_BOUND} actions`)
    }
  }
}

describe('settlementOf — zero-sum conservation over random ended hands', () => {
  it(
    'every random seed folds to an ended TableState whose four deltas sum to zero',
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
          const state = endedStateOf(seed)
          const deltas = settlementOf(state)
          expect(deltas.reduce((sum, delta) => sum + delta, 0)).toBe(0)
        }),
        { numRuns: 50 },
      )
    },
  )
})

// ---------------------------------------------------------------------------
// §E — fu invariants: multiple of 10 (or exactly 25), pinfu 20/30, chiitoitsu 25.
//
// winContextArb builds a complete winning hand via buildTenpaiParts, runs it through the
// REAL decomposeAgari (never a hand-typed decomposition, the fu.test.ts precedent), and
// wraps one of its non-kokushi readings (fu does not apply to a yakuman, by rule — fu.ts's
// own throw) into a WinContext. The winning kind is any tile drawn from the hand: every
// tile in a decomposeAgari reading belongs to the pair, a triplet of its own kind, or a
// run spanning its own kind, so any concealed tile is always a structurally valid winning
// kind for SOME candidate in fuOf's wait-attribution search.
// ---------------------------------------------------------------------------

interface CtxSample {
  ctx: WinContext
}

const winContextParamsArb = fc.record({
  meldCount: meldCountArb,
  formChoices: fourChoicesArb,
  setChoices: fourChoicesArb,
  pairChoice: fc.nat(10_000),
  winningAt: fc.nat(13),
  readingChoice: fc.nat(10_000),
  tsumo: fc.boolean(),
})

/** Builds one WinContext sample, or null when the hand decomposes ONLY as kokushi. */
function buildCtxSample(params: {
  meldCount: number
  formChoices: readonly number[]
  setChoices: readonly number[]
  pairChoice: number
  winningAt: number
  readingChoice: number
  tsumo: boolean
}): CtxSample | null {
  const { concealed14, melds } = buildTenpaiParts(
    params.meldCount,
    params.formChoices,
    params.setChoices,
    params.pairChoice,
  )
  const winningKind = concealed14[params.winningAt % concealed14.length]
  const readings = decomposeAgari(concealed14, melds).filter((r) => r.form !== 'kokushi')
  if (readings.length === 0) return null
  const decomposition = readings[params.readingChoice % readings.length]
  const ctx: WinContext = {
    decomposition,
    melds,
    winningKind,
    source: params.tsumo ? 'wall' : 'discard',
    lastTile: false,
    seatWind: '3z',
    roundWind: '4z',
    riichi: 'none',
    ippatsu: false,
  }
  return { ctx }
}

describe('fuOf — fu invariants over constructed winning hands', () => {
  it('every fu value is a multiple of 10, or exactly 25', () => {
    fc.assert(
      fc.property(winContextParamsArb, (params) => {
        const sample = buildCtxSample(params)
        fc.pre(sample !== null)
        const fu = fuOf(sample!.ctx)
        expect(fu % 10 === 0 || fu === 25).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  // Pinfu shapes (all four sets runs, closed, non-yakuhai pair, ryanmen wait) are rare
  // by coincidence from buildTenpaiParts' mixed triplet/run construction — the same
  // rarity the chiitoitsu clause above hits. This clause gets its own generator: three
  // freely-chosen runs plus one DESIGNATED run whose low end (rank <= 6, so a rank above
  // always exists — completesRyanmen's own low-offset rule) is the winning tile, and a
  // pair restricted to numbered kinds (never equal to the fixed honor seatWind/
  // roundWind, so never yakuhai). `standardYakuOf(ctx).includes('pinfu')` is asked of
  // the resulting decomposition (not assumed) as the actual pinfu-shape oracle — this
  // cross-checks fu.ts's independently-written isPinfuShape against yaku.ts's
  // independently-written pinfu predicate, not just fu.ts's OWN idea of the shape.
  //
  // THE WAIT-ATTRIBUTION TRAP (a real edge case this property surfaced — see review.md):
  // fu.ts's own "favorable attribution" rule (fu.ts's header, fu.test.ts's "prefers the
  // tanki attribution over ryanmen run-absorption" fixture) takes the MAX fu across every
  // structurally valid attribution of the winning tile within ONE decomposition — and
  // that search is blind to whether a higher-fu attribution also happens to be the one
  // standardYakuOf's pinfu() predicate used to grant the yaku. If the winning kind is
  // ALSO reachable as the pair (a coincidental tanki) or via a second run in the SAME
  // suit overlapping the designated run's range (a coincidental kanchan/penchan), fu.ts
  // scores the higher-fu attribution — breaking the fixed pinfu 20/30 promise even
  // though standardYakuOf still reports 'pinfu' for this same ctx. fu.test.ts's own
  // fixed-fu fixture avoids this by construction (its pair shares no kind with any run);
  // this generator does the same, deliberately: the designated (winning) run lives in
  // suit 'm' alone, every OTHER run and the pair are drawn only from suits 'p'/'s' — a
  // different suit than the winning kind, so runContains/pair-equality can never see a
  // second candidate for the winning tile. This tests the FIXED-VALUE promise fu.ts's
  // own header actually documents, not a stronger universal claim the current
  // implementation does not make.
  it('pinfu tsumo is exactly 20, pinfu ron is exactly 30', () => {
    const winningRunCandidates = PINFU_RUN_CANDIDATES.filter(([start]) => start < 9 && start % 9 <= 5)
    const otherRunCandidates = PINFU_RUN_CANDIDATES.filter(([start]) => start >= 9)
    const pinfuHandArb = fc.record({
      winningRunChoice: fc.nat(10_000),
      otherRunChoices: fc.array(fc.nat(10_000), { minLength: 3, maxLength: 3 }),
      pairChoice: fc.nat(10_000),
      tsumo: fc.boolean(),
    })
    let pinfuHits = 0
    fc.assert(
      fc.property(pinfuHandArb, ({ winningRunChoice, otherRunChoices, pairChoice, tsumo }) => {
        const counts = new Array<number>(KIND_COUNT).fill(0)
        const hand: TileKind[] = []
        const winningRun = winningRunCandidates[winningRunChoice % winningRunCandidates.length]
        for (const k of winningRun) {
          counts[k] += 1
          hand.push(TILE_KINDS[k])
        }
        const winningKind = TILE_KINDS[winningRun[0]]
        for (let s = 0; s < 3; s += 1) {
          const legal = otherRunCandidates.filter((tiles) =>
            tiles.every((k) => counts[k] + 1 <= COPIES_PER_KIND),
          )
          const picked = legal[otherRunChoices[s] % legal.length]
          for (const k of picked) {
            counts[k] += 1
            hand.push(TILE_KINDS[k])
          }
        }
        const pairable = ALL_KINDS.filter((k) => k >= 9 && k < 27 && counts[k] + 2 <= COPIES_PER_KIND)
        const pairKind = TILE_KINDS[pairable[pairChoice % pairable.length]]
        hand.push(pairKind, pairKind)

        const source = tsumo ? 'wall' : 'discard'
        const readings = decomposeAgari(hand, []).filter((r) => r.form === 'standard')
        const pinfuReading = readings.find((r) => {
          const ctx: WinContext = {
            decomposition: r,
            melds: [],
            winningKind,
            source,
            lastTile: false,
            seatWind: '3z',
            roundWind: '4z',
            riichi: 'none',
            ippatsu: false,
          }
          return standardYakuOf(ctx).includes('pinfu')
        })
        fc.pre(pinfuReading !== undefined)
        pinfuHits += 1
        const ctx: WinContext = {
          decomposition: pinfuReading!,
          melds: [],
          winningKind,
          source,
          lastTile: false,
          seatWind: '3z',
          roundWind: '4z',
          riichi: 'none',
          ippatsu: false,
        }
        expect(fuOf(ctx)).toBe(tsumo ? 20 : 30)
      }),
      { numRuns: 200 },
    )
    // Non-vacuity: the pinfu clause must actually fire across the run, or it proves
    // nothing (the selfplay.test.ts non-vacuity-tally precedent).
    expect(pinfuHits).toBeGreaterThan(0)
  })

  // Chiitoitsu shapes essentially never emerge by coincidence from buildTenpaiParts'
  // triplet/run construction (the same rarity shanten.property.test.ts's own comment
  // notes for ryanpeikou-shaped overlaps), so this clause gets its OWN generator: seven
  // distinct kinds, each held exactly twice — the form's own definition, built directly
  // rather than hoped for.
  it('chiitoitsu is always exactly 25', () => {
    const chiitoitsuHandArb = fc.record({
      kindChoices: fc.array(fc.nat(10_000), { minLength: 34, maxLength: 34 }),
      winningAt: fc.nat(13),
    })
    fc.assert(
      fc.property(chiitoitsuHandArb, ({ kindChoices, winningAt }) => {
        // Fisher-Yates over ALL_KINDS using the sampled choices, then take 7 — a
        // deterministic shuffle from arbitrary integers, no rejection loop.
        const shuffled = [...ALL_KINDS]
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
          const j = kindChoices[i % kindChoices.length] % (i + 1)
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        const sevenKinds = shuffled.slice(0, 7).map((k) => TILE_KINDS[k])
        const concealed14 = sevenKinds.flatMap((kind) => [kind, kind])
        const winningKind = concealed14[winningAt % concealed14.length]
        const readings = decomposeAgari(concealed14, [])
        const chiitoitsu = readings.find((r) => r.form === 'chiitoitsu')
        expect(chiitoitsu).toBeDefined()
        const ctx: WinContext = {
          decomposition: chiitoitsu!,
          melds: [],
          winningKind,
          source: 'wall',
          lastTile: false,
          seatWind: '3z',
          roundWind: '4z',
          riichi: 'none',
          ippatsu: false,
        }
        expect(fuOf(ctx)).toBe(25)
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// §F — the dora-gate property: dora is additive to price, never a gate.
//
// Structurally, Win (yakuman.ts) carries no doraKinds field at all — yakuOf(win) cannot
// read dora, so dora structurally cannot influence the one-yaku win gate (han.ts's own
// header states this as the frozen invariant; han.test.ts's "dora never satisfies the
// one-yaku win gate" fixture proves the concrete case). This section adds the property
// design.md names as this ticket's actual contribution: MONOTONICITY — adding dora never
// LOWERS the priced base. Restricted to closed self-draws (meldCount 0, source 'wall') so
// menzen-tsumo guarantees a non-vacuous priced win regardless of which extra dora kind is
// added — baseOf is non-decreasing in han (every tier's base is >= the previous tier's),
// and the extra dora kind is always drawn from the hand's own held tiles (so doraHanOf
// strictly increases from 0), so the winner's settlement delta is provably non-decreasing,
// never merely "usually" so.
// ---------------------------------------------------------------------------

/** Copy indices already consumed by real melds, per kind — the id-allocation baseline. */
function usedCopiesOf(melds: readonly Meld[]): Map<TileKind, number> {
  const used = new Map<TileKind, number>()
  for (const meld of melds) {
    const tiles = meld.type === 'ankan' ? meld.own : [meld.claimed, ...meld.own]
    for (const tile of tiles) {
      const kind = kindOf(tile)
      used.set(kind, Math.max(used.get(kind) ?? 0, copyOf(tile) + 1))
    }
  }
  return used
}

/** Sequential copy indices for concealed kinds, continuing from an already-used map. */
function idsForConcealed(kinds: readonly TileKind[], startingUsed: Map<TileKind, number>): TileId[] {
  const used = new Map(startingUsed)
  return kinds.map((kind) => {
    const copy = (used.get(kind) ?? 0) as CopyIndex
    used.set(kind, copy + 1)
    return tileId(kind, copy)
  })
}

/** A minimal ended-agari TableState for a closed tsumo win — the settlement.test.ts
 * baseState()/tsumoState() shape, duplicated locally per the no-shared-test-utils
 * convention, trimmed to the closed-tsumo case §F needs. */
function closedTsumoState(hand13: readonly TileId[], tile: TileId, doras: readonly TileKind[]): TableState {
  const hands: [TileId[], TileId[], TileId[], TileId[]] = [[...hand13], [], [], []]
  return {
    hands,
    live: [tileId('9m', 0)],
    dead: [],
    doraIndicator: tileId('1m', 0),
    dora: '2m',
    doraIndicators: [tileId('1m', 0)],
    doras: [...doras],
    uraDoraIndicators: [],
    uradora: [],
    ponds: [[], [], [], []],
    turn: 0,
    melds: [[], [], [], []],
    claimable: null,
    mustDiscard: false,
    drawn: tile,
    drawnFrom: 'wall',
    phase: 'agari',
    win: { by: 'tsumo', winner: 0, tile, yaku: [] },
    riichi: [false, false, false, false],
    doubleRiichi: [false, false, false, false],
    tempFuriten: [false, false, false, false],
    riichiFuriten: [false, false, false, false],
    ippatsu: [false, false, false, false],
    pot: 0,
    scoresIn: [25000, 25000, 25000, 25000],
  }
}

const closedWinArb = fc.record({
  setChoices: fourChoicesArb,
  pairChoice: fc.nat(10_000),
  winningAt: fc.nat(13),
  extraDoraAt: fc.nat(12),
})

describe('dora is additive to price, never a gate', () => {
  it('adding one extra dora indicator never lowers the winner\'s settlement delta', () => {
    let strictIncreases = 0
    fc.assert(
      fc.property(closedWinArb, ({ setChoices, pairChoice, winningAt, extraDoraAt }) => {
        const { concealed14 } = buildTenpaiParts(0, [], setChoices, pairChoice)
        const idx = winningAt % concealed14.length
        const winningKind = concealed14[idx]
        const ordered = [...concealed14]
        ordered.splice(idx, 1)
        ordered.push(winningKind)
        const hand13 = ordered.slice(0, -1) as TileKind[]

        // Anti-vacuity precondition: this hand must actually carry a yaku regardless of
        // dora, so pricedReadingsOf/the yakuman flat tier is never empty on either side
        // of the comparison. A closed self-draw ALWAYS carries at least one: either
        // menzen-tsumo (when no yakuman fires, since decomposeAgari always finds the
        // exact reading this hand was built from and that reading's closed+tsumo
        // circumstance satisfies menzenTsumo unconditionally) or a yakuman name (which
        // supersedes menzen-tsumo in yakuOf's union but is itself always non-empty when
        // it fires) — never zero either way.
        const win: Win = {
          concealed: ordered,
          melds: [],
          winningKind,
          source: 'wall',
          lastTile: false,
          seatWind: '1z',
          roundWind: '1z',
          riichi: 'none',
          ippatsu: false,
        }
        expect(yakuOf(win).length).toBeGreaterThan(0)

        const ids = idsForConcealed(ordered, usedCopiesOf([]))
        const tile = ids[ids.length - 1]
        const hand13Ids = ids.slice(0, -1)
        const extraDoraKind = hand13[extraDoraAt % hand13.length]

        const withoutDora = settlementOf(closedTsumoState(hand13Ids, tile, []))
        const withDora = settlementOf(closedTsumoState(hand13Ids, tile, [extraDoraKind]))
        expect(withDora[0]).toBeGreaterThanOrEqual(withoutDora[0])
        if (withDora[0] > withoutDora[0]) strictIncreases += 1
      }),
      { numRuns: 150 },
    )
    // Non-vacuity: the extra dora must actually raise the price in at least some samples,
    // or `>=` alone would tolerate a component that never prices dora at all.
    expect(strictIncreases).toBeGreaterThan(0)
  })
})
