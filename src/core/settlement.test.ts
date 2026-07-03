// settlement.ts's fixture suite — the AC's own literal numbers (30fu/4han 7700
// non-dealer ron / 11600 dealer ron) as the load-bearing regression fixture,
// plus tsumo splits, yakuman payment, the mangan cap, the reading-selection
// design decision (design.md's Rejected Option A: summing state.win.yaku's
// UNION across readings would silently overcount), and noten-bappu across
// every tenpai count. Every expected number is hand-derived in a comment from
// research.md §3's table BEFORE the assertion, never from a first run — the
// fu.test.ts/han.test.ts precedent. Fixtures are hand-built TableState-shaped
// objects (settlementOf's real input), not folded HandRecords — constructing a
// wall/deal that happens to land on a specific han/fu combination is
// impractical, and settlementOf's riskiest new logic (winOf's reconstruction)
// is exactly what a full TableState fixture exercises.

import { describe, expect, it } from 'vitest'
import {
  settlementOf,
  tileId,
  type CopyIndex,
  type Seat,
  type TableState,
  type TileId,
  type TileKind,
} from './index'

/** mpsz shorthand: '123m55z' → ['1m','2m','3m','5z','5z']. Test-side sugar only. */
function h(spec: string): TileKind[] {
  const out: TileKind[] = []
  let ranks: string[] = []
  for (const ch of spec) {
    if (ch >= '1' && ch <= '9') {
      ranks.push(ch)
    } else {
      for (const rank of ranks) out.push(`${rank}${ch}` as TileKind)
      ranks = []
    }
  }
  return out
}

/** Assigns sequential copy indices per kind, in array order — never exceeds 4 per kind. */
function idsOf(kinds: readonly TileKind[]): TileId[] {
  const used = new Map<TileKind, number>()
  return kinds.map((kind) => {
    const copy = (used.get(kind) ?? 0) as CopyIndex
    used.set(kind, copy + 1)
    return tileId(kind, copy)
  })
}

/**
 * A minimal but fully-typed ended-or-playing TableState. Fields settlementOf
 * never reads (dead, doraIndicator(s), ponds, claimable, mustDiscard, turn)
 * carry arbitrary placeholders; `live` defaults to one placeholder tile so
 * `lastTile` reads false (avoiding an accidental haitei/houtei yaku from a
 * fixture that isn't testing that circumstance).
 */
function baseState(): TableState {
  return {
    hands: [[], [], [], []],
    live: [tileId('9m', 0)],
    dead: [],
    doraIndicator: tileId('1m', 0),
    dora: '2m',
    doraIndicators: [tileId('1m', 0)],
    doras: [],
    ponds: [[], [], [], []],
    turn: 0,
    melds: [[], [], [], []],
    claimable: null,
    mustDiscard: false,
    drawn: null,
    drawnFrom: null,
    phase: 'playing',
    win: null,
    riichi: [false, false, false, false],
    pot: 0,
    scoresIn: [25000, 25000, 25000, 25000],
  }
}

interface WinOpts {
  hand13: readonly TileKind[]
  winningKind: TileKind
  winner: Seat
  doras?: readonly TileKind[]
}

/** A closed ron-ending TableState: `hand13` + `winningKind` is the real 14-tile win. */
function ronState(opts: WinOpts & { discarder: Seat }): TableState {
  const ids = idsOf([...opts.hand13, opts.winningKind])
  const tile = ids[ids.length - 1]
  const hands: [TileId[], TileId[], TileId[], TileId[]] = [[], [], [], []]
  hands[opts.winner] = ids.slice(0, -1)
  return {
    ...baseState(),
    hands,
    doras: [...(opts.doras ?? [])],
    phase: 'agari',
    win: { by: 'ron', winner: opts.winner, from: opts.discarder, tile, yaku: [] },
  }
}

/** A closed tsumo-ending TableState: same shape as ronState, self-drawn. */
function tsumoState(opts: WinOpts): TableState {
  const ids = idsOf([...opts.hand13, opts.winningKind])
  const tile = ids[ids.length - 1]
  const hands: [TileId[], TileId[], TileId[], TileId[]] = [[], [], [], []]
  hands[opts.winner] = ids.slice(0, -1)
  return {
    ...baseState(),
    hands,
    doras: [...(opts.doras ?? [])],
    drawn: tile,
    drawnFrom: 'wall',
    phase: 'agari',
    win: { by: 'tsumo', winner: opts.winner, tile, yaku: [] },
  }
}

/** A ryuukyoku TableState from four seats' 13-tile concealed hands, no melds. */
function ryuukyokuState(
  hands13: readonly [
    readonly TileKind[],
    readonly TileKind[],
    readonly TileKind[],
    readonly TileKind[],
  ],
): TableState {
  const hands = hands13.map((kinds) => idsOf(kinds)) as [TileId[], TileId[], TileId[], TileId[]]
  return { ...baseState(), hands, live: [], phase: 'ryuukyoku' }
}

// ---------------------------------------------------------------------------
// Fixture 1 — the AC's own literal numbers: 30fu/4han, 7700 non-dealer ron,
// 11600 dealer ron.
//
// Closed hand: 33p (pair, non-valuable) + 234m + 234m (duplicated run) + 456p
// + 6s7s waiting on 8s (ryanmen). All tiles simple (2-8) and every concealed
// set a run with a non-valuable pair completed by ryanmen — the PINFU shape.
//
// Yaku (ron, closed): pinfu(1) + tanyao(1, all simple) + iipeikou(1, the
// duplicated 234m run) = 3 han. + 1 dora (kind 5p, held once, in the 456p
// run) = 4 han. Fu: base 20 + menzen-ron 10 + pinfu's own ryanmen wait (+0,
// already the raw pinfu-ron total) = 30, exactly PINFU_RON_FU — no rounding
// needed. Base points = 30 * 2^(2+4) = 30*64 = 1920.
//
// THE KIRIAGE BOUNDARY: 1920 is NOT kiriage-rounded up to a flat mangan
// (which would pay 8000/12000) — non-dealer ron pays ceil(1920*4/100)*100 =
// ceil(7680/100)*100 = 7700; dealer ron pays ceil(1920*6/100)*100 =
// ceil(11520/100)*100 = 11600. These are exactly the ticket's AC numbers.
// ---------------------------------------------------------------------------
const PINFU_HAND_13 = h('33p223344m456p67s')
const PINFU_WINNING_KIND: TileKind = '8s'
const PINFU_DORA: readonly TileKind[] = ['5p']

describe('30fu/4han — the AC fixture', () => {
  it('non-dealer ron pays 7700, not the kiriage-mangan 8000', () => {
    const state = ronState({
      hand13: PINFU_HAND_13,
      winningKind: PINFU_WINNING_KIND,
      winner: 1,
      discarder: 0,
      doras: PINFU_DORA,
    })
    expect(settlementOf(state)).toEqual([-7700, 7700, 0, 0])
  })

  it('dealer ron pays 11600, not the kiriage-mangan 12000', () => {
    const state = ronState({
      hand13: PINFU_HAND_13,
      winningKind: PINFU_WINNING_KIND,
      winner: 0,
      discarder: 1,
      doras: PINFU_DORA,
    })
    expect(settlementOf(state)).toEqual([11600, -11600, 0, 0])
  })
})

// ---------------------------------------------------------------------------
// Fixture 2 — tsumo splits, via the SAME pinfu hand won by self-draw instead
// of ron. Tsumo adds menzen-tsumo (the win is still fully closed): pinfu(1) +
// tanyao(1) + iipeikou(1) + menzen-tsumo(1) + dora(1) = 5 han — mangan, base
// 2000 flat (fu is 20, the fixed pinfu-tsumo value, but irrelevant at han 5).
//
// Non-dealer tsumo: dealer pays ceil(2000*2/100)*100 = 4000; each other
// non-dealer pays ceil(2000*1/100)*100 = 2000 — the well-known mangan
// "2000-4000" split, winner receives 4000+2000+2000 = 8000.
// Dealer tsumo: each of the other three pays ceil(2000*2/100)*100 = 4000 —
// "4000 all", winner receives 12000.
// ---------------------------------------------------------------------------
describe('tsumo splits (mangan, via menzen-tsumo pushing the pinfu hand to 5 han)', () => {
  it('non-dealer tsumo: dealer pays 4000, others pay 2000 each', () => {
    const state = tsumoState({
      hand13: PINFU_HAND_13,
      winningKind: PINFU_WINNING_KIND,
      winner: 1,
      doras: PINFU_DORA,
    })
    expect(settlementOf(state)).toEqual([-4000, 8000, -2000, -2000])
  })

  it('dealer tsumo: every other seat pays 4000', () => {
    const state = tsumoState({
      hand13: PINFU_HAND_13,
      winningKind: PINFU_WINNING_KIND,
      winner: 0,
      doras: PINFU_DORA,
    })
    expect(settlementOf(state)).toEqual([12000, -4000, -4000, -4000])
  })
})

// ---------------------------------------------------------------------------
// Fixture 3 — the mangan CAP, distinct from fixture 2's mangan TIER: a 4-han
// hand (never reaching the han-5 tier) whose raw fu formula EXCEEDS 2000 and
// must be capped, not the flat han-5+ table.
//
// Closed ron: 2m2m (pair, non-valuable) + 5z5z5z (haku, closed anko) + 234p +
// 678p + 4s_6s waiting on 5s (kanchan). Yaku: yakuhai-haku (1 han, the haku
// triplet) + 3 dora (kind 5z, held 3 times by the triplet) = 4 han. Fu: base
// 20 + menzen-ron 10 + haku closed-triplet-honor 8 + kanchan wait 2 = 40.
// Base points = 40 * 2^(2+4) = 40*64 = 2560 — capped to 2000 (mangan), NOT
// left at the raw 2560.
//
// Non-dealer ron: ceil(2000*4/100)*100 = 8000. Dealer ron: ceil(2000*6/100)*
// 100 = 12000 — the ordinary mangan payments, proving the >2000 cap fired.
// ---------------------------------------------------------------------------
const MANGAN_CAP_HAND_13 = h('22m555z234p678p46s')
const MANGAN_CAP_WINNING_KIND: TileKind = '5s'
const MANGAN_CAP_DORA: readonly TileKind[] = ['5z']

describe('mangan cap — 4han40fu (raw 2560) prices as flat mangan (2000)', () => {
  it('non-dealer ron pays 8000', () => {
    const state = ronState({
      hand13: MANGAN_CAP_HAND_13,
      winningKind: MANGAN_CAP_WINNING_KIND,
      winner: 1,
      discarder: 0,
      doras: MANGAN_CAP_DORA,
    })
    expect(settlementOf(state)).toEqual([-8000, 8000, 0, 0])
  })

  it('dealer ron pays 12000', () => {
    const state = ronState({
      hand13: MANGAN_CAP_HAND_13,
      winningKind: MANGAN_CAP_WINNING_KIND,
      winner: 0,
      discarder: 1,
      doras: MANGAN_CAP_DORA,
    })
    expect(settlementOf(state)).toEqual([12000, -12000, 0, 0])
  })
})

// ---------------------------------------------------------------------------
// Fixture 4 — yakuman payment (ron): tsuuiisou (all-honor), single yakuman,
// han 13, base 8000 flat (no fu, no dora — yakuman scoring ignores both).
//
// Closed hand: 1z1z1z (East) + 2z2z2z (South) + 5z5z5z (haku) + 7z7z (chun
// pair) + 3z_3z waiting on the third 3z (West), completed by RON — chosen
// specifically so suuankou does NOT also fire (a ron-completed triplet is not
// concealed, so only 3 of the 4 triplets stay anko; suuankou needs all 4).
// Only tsuuiisou fires: no dragon is tripled 3x with another as pair
// (daisangen needs all three; only haku is tripled here) and only 3 of the 4
// winds are tripled with none as pair (shousuushii needs the 4th wind AS the
// pair; ours is the chun dragon).
//
// Non-dealer ron: ceil(8000*4/100)*100 = 32000. Dealer ron: ceil(8000*6/100)*
// 100 = 48000.
// ---------------------------------------------------------------------------
const TSUUIISOU_HAND_13 = h('111z222z555z77z33z')
const TSUUIISOU_WINNING_KIND: TileKind = '3z'

describe('yakuman payment (ron) — single tsuuiisou, base 8000 flat', () => {
  it('non-dealer ron pays 32000', () => {
    const state = ronState({
      hand13: TSUUIISOU_HAND_13,
      winningKind: TSUUIISOU_WINNING_KIND,
      winner: 1,
      discarder: 0,
    })
    expect(settlementOf(state)).toEqual([-32000, 32000, 0, 0])
  })

  it('dealer ron pays 48000', () => {
    const state = ronState({
      hand13: TSUUIISOU_HAND_13,
      winningKind: TSUUIISOU_WINNING_KIND,
      winner: 0,
      discarder: 1,
    })
    expect(settlementOf(state)).toEqual([48000, -48000, 0, 0])
  })
})

// ---------------------------------------------------------------------------
// Fixture 5 — yakuman payment (tsumo): ryuuiisou (all-green), single yakuman,
// base 8000 flat. A different hand than fixture 4 (a 4-triplet all-honor
// shape completed by self-draw would ALSO trigger suuankou, stacking a
// second yakuman — deliberately avoided here by using a shape with two runs,
// which suuankou's "every concealed set a triplet" clause can never satisfy).
//
// Closed hand: 2s2s (pair) + 234s + 234s (duplicated run, all green) + 6z6z6z
// (hatsu, green) + 8s_8s waiting on the third 8s, completed by TSUMO.
//
// Non-dealer tsumo: dealer pays ceil(8000*2/100)*100 = 16000; each other
// non-dealer pays ceil(8000*1/100)*100 = 8000 — winner receives 32000.
// Dealer tsumo: each of the other three pays 16000 — winner receives 48000.
// ---------------------------------------------------------------------------
const RYUUIISOU_HAND_13 = h('2222s33s44s666z88s')
const RYUUIISOU_WINNING_KIND: TileKind = '8s'

describe('yakuman payment (tsumo) — single ryuuiisou, base 8000 flat', () => {
  it('non-dealer tsumo: dealer pays 16000, others pay 8000 each', () => {
    const state = tsumoState({
      hand13: RYUUIISOU_HAND_13,
      winningKind: RYUUIISOU_WINNING_KIND,
      winner: 1,
    })
    expect(settlementOf(state)).toEqual([-16000, 32000, -8000, -8000])
  })

  it('dealer tsumo: every other seat pays 16000', () => {
    const state = tsumoState({
      hand13: RYUUIISOU_HAND_13,
      winningKind: RYUUIISOU_WINNING_KIND,
      winner: 0,
    })
    expect(settlementOf(state)).toEqual([48000, -16000, -16000, -16000])
  })
})

// ---------------------------------------------------------------------------
// Fixture 6 — reading selection: a hand that is BOTH a valid standard-form
// reading (pair 5z + duplicated runs 123m/123m/456m/456m — honitsu + ryanpeikou)
// AND a valid chiitoitsu reading (the same 14 tiles are 7 distinct kinds at
// exactly 2 copies each: 1m..6m, 5z).
//
// Reading A (standard): honitsu (3 han closed, one suit + the 5z honor pair) +
// ryanpeikou (3 han closed, peikouCount 2) = 6 han. Fu: base 20 + menzen-ron
// 10 + pair-value (5z is a dragon, +2) + wait (the winning tile completes the
// 5z pair itself — tanki, +2) = 34 -> round up to 40. Han 6 is the HANEMAN
// tier (fu-independent) — base 3000.
// Reading B (chiitoitsu): chiitoitsu (2 han) only. Fu fixed 25. Base =
// min(25*2^4, 2000) = 400.
// bestBaseOf must return Reading A's 3000 — NOT chiitoitsu's 400, and
// CRITICALLY not the WRONG total a naive "sum yakuOf's union across every
// reading" implementation would compute: honitsu(3) + ryanpeikou(3) +
// chiitoitsu(2) = 8 han -> baiman, base 4000. 3000/4000/400 are three
// distinct values, so this fixture discriminates all three implementations.
//
// Ron, winner non-dealer: ceil(3000*4/100)*100 = 12000 (NOT 16000 from the
// union bug, NOT 1600 from a chiitoitsu-only bug).
// ---------------------------------------------------------------------------
describe('reading selection — max-across-readings, not the union, not the first form', () => {
  it('prices the honitsu+ryanpeikou standard reading (3000), not chiitoitsu (400) or the union (4000)', () => {
    const state = ronState({
      hand13: h('112233m445566m5z'),
      winningKind: '5z',
      winner: 1,
      discarder: 0,
    })
    expect(settlementOf(state)).toEqual([-12000, 12000, 0, 0])
  })
})

// ---------------------------------------------------------------------------
// Fixture 7 — ryuukyoku noten-bappu across every tenpai count (research.md
// §3's table). TENPAI_HAND is 123m 456m 789m 11p 23p (three complete runs, a
// pair, and a ryanmen partial — shanten 0). NOTEN_HAND is 13579m 1357p 1357s
// (every tile isolated by a gap of 2, no pair anywhere — shanten 4, far from
// tenpai). Both are exercised only through `shanten(...) === 0`, so the exact
// noten shanten value doesn't matter, only that it isn't zero.
// ---------------------------------------------------------------------------
const TENPAI_HAND = h('123456789m1123p')
const NOTEN_HAND = h('13579m1357p1357s')

describe('ryuukyoku noten-bappu', () => {
  it('0 tenpai: no exchange', () => {
    const state = ryuukyokuState([NOTEN_HAND, NOTEN_HAND, NOTEN_HAND, NOTEN_HAND])
    expect(settlementOf(state)).toEqual([0, 0, 0, 0])
  })

  it('1 tenpai: +3000 / -1000 each', () => {
    const state = ryuukyokuState([TENPAI_HAND, NOTEN_HAND, NOTEN_HAND, NOTEN_HAND])
    expect(settlementOf(state)).toEqual([3000, -1000, -1000, -1000])
  })

  it('2 tenpai: +1500 each / -1500 each', () => {
    const state = ryuukyokuState([TENPAI_HAND, TENPAI_HAND, NOTEN_HAND, NOTEN_HAND])
    expect(settlementOf(state)).toEqual([1500, 1500, -1500, -1500])
  })

  it('3 tenpai: +1000 each / -3000', () => {
    const state = ryuukyokuState([TENPAI_HAND, TENPAI_HAND, TENPAI_HAND, NOTEN_HAND])
    expect(settlementOf(state)).toEqual([1000, 1000, 1000, -3000])
  })

  it('4 tenpai: no exchange', () => {
    const state = ryuukyokuState([TENPAI_HAND, TENPAI_HAND, TENPAI_HAND, TENPAI_HAND])
    expect(settlementOf(state)).toEqual([0, 0, 0, 0])
  })
})

// ---------------------------------------------------------------------------
// Fixture 8 — guard: settlement on an unended hand is caller corruption.
// ---------------------------------------------------------------------------
describe('guard', () => {
  it('throws when phase is still playing', () => {
    expect(() => settlementOf(baseState())).toThrow(RangeError)
  })
})
