// The yakuman catalog and win-gate suite: every yakuman gets a positive and an
// adversarial NEAR-MISS negative that is STILL A WIN (yakuOf throws on
// non-wins), driven by a table total over YakumanName; the aggregator's three
// conventions — the one-yaku gate's [] refusal, yakuman-supersedes, yakuman
// stacking — plus the union-across-readings semantics are each pinned by an
// exact-list test. Expected values are derived in comments from the riichi
// rules, never from module output. Fixtures pass through the real
// decomposeAgari (via isAgari inside winOf) so a typo fails as "not a win".

import { describe, expect, it } from 'vitest'
import {
  STANDARD_YAKU_NAMES,
  YAKUMAN_NAMES,
  isAgari,
  tileId,
  yakuOf,
  type Meld,
  type TileKind,
  type Win,
  type YakumanName,
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

// ---------------------------------------------------------------------------
// Meld builders with real kinds (the yaku.test.ts idiom — the aggregator reads
// meld tile kinds for the multiset scans and kan arity for suukantsu).
// ---------------------------------------------------------------------------

function pon(kind: TileKind): Meld {
  return { type: 'pon', claimed: tileId(kind, 0), from: 0, own: [tileId(kind, 1), tileId(kind, 2)] }
}

function daiminkan(kind: TileKind): Meld {
  return {
    type: 'daiminkan',
    claimed: tileId(kind, 0),
    from: 0,
    own: [tileId(kind, 1), tileId(kind, 2), tileId(kind, 3)],
  }
}

function shouminkan(kind: TileKind): Meld {
  return {
    type: 'shouminkan',
    claimed: tileId(kind, 0),
    from: 0,
    own: [tileId(kind, 1), tileId(kind, 2), tileId(kind, 3)],
  }
}

function ankan(kind: TileKind): Meld {
  return { type: 'ankan', own: [tileId(kind, 0), tileId(kind, 1), tileId(kind, 2), tileId(kind, 3)] }
}

function chi(start: TileKind): Meld {
  const next = `${Number(start[0]) + 1}${start[1]}` as TileKind
  const third = `${Number(start[0]) + 2}${start[1]}` as TileKind
  return { type: 'chi', claimed: tileId(start, 0), from: 3, own: [tileId(next, 0), tileId(third, 0)] }
}

// ---------------------------------------------------------------------------
// Win builder: the aggregator consumes ALL readings, so unlike ctxOf there is
// no `pick` — but the fixture must still BE a win, checked through the real
// decomposer. Defaults: wall self-draw mid-hand, East seat in an East round,
// winning tile = the spec's first tile.
// ---------------------------------------------------------------------------

interface WinOverrides {
  melds?: readonly Meld[]
  winningKind?: TileKind
  source?: Win['source']
  lastTile?: boolean
  seatWind?: Win['seatWind']
  roundWind?: Win['roundWind']
}

function winOf(spec: string, overrides: WinOverrides = {}): Win {
  const concealed = h(spec)
  const melds = overrides.melds ?? []
  if (!isAgari(concealed, melds)) throw new Error(`fixture ${spec} is not a win`)
  return {
    concealed,
    melds,
    winningKind: overrides.winningKind ?? concealed[0],
    source: overrides.source ?? 'wall',
    lastTile: overrides.lastTile ?? false,
    seatWind: overrides.seatWind ?? '1z',
    roundWind: overrides.roundWind ?? '1z',
  }
}

// ---------------------------------------------------------------------------
// The per-yakuman table — TOTAL over YakumanName by its type, so the compiler
// enforces the AC's "each in-scope yakuman has positive and negative tests".
// Every negative is a near-miss that still completes a (lesser) win.
// ---------------------------------------------------------------------------

interface YakumanCase {
  positive: Win
  negative: Win
}

const CASES: Record<YakumanName, YakumanCase> = {
  // The thirteen orphans with 7z doubled; the negative is the closest lesser
  // shape — an all-terminal/honor CHIITOITSU (honroutou), no kokushi form.
  kokushi: {
    positive: winOf('19m19p19s12345677z'),
    negative: winOf('1199m1199p1199s11z'),
  },
  // Four concealed triplets self-drawn; the negative RONS the 1m that
  // completes the fourth triplet — demoted to open, three concealed left.
  suuankou: {
    positive: winOf('111m333m555p777s44s', { source: 'wall', winningKind: '1m' }),
    negative: winOf('111m333m555p777s44s', { source: 'discard', winningKind: '1m' }),
  },
  // All three dragon triplets; the negative keeps two with the chun as PAIR —
  // shousangen, one triplet short.
  daisangen: {
    positive: winOf('555z666z777z123m44m'),
    negative: winOf('555z666z77z123m444m'),
  },
  // Three wind triplets with the fourth wind as the pair; the negative holds
  // the same three triplets but a NUMBER pair — the fourth wind is absent.
  shousuushii: {
    positive: winOf('111z222z333z44z234m'),
    negative: winOf('111z222z333z234m44m'),
  },
  // All four wind triplets; the negative is the shousuushii shape — the
  // fourth wind only paired, exactly the boundary between the two.
  daisuushii: {
    positive: winOf('111z222z333z444z55m'),
    negative: winOf('111z222z333z44z234m'),
  },
  // Honors only (ron completing 1z keeps suuankou out of the stack); the
  // negative swaps the pair to 88m — one number pair breaks all-honors.
  tsuuiisou: {
    positive: winOf('111z222z333z555z66z', { source: 'discard', winningKind: '1z' }),
    negative: winOf('111z222z333z555z88m', { source: 'discard', winningKind: '1z' }),
  },
  // Terminals only (ron-demoted so no suuankou); the negative trades one
  // terminal triplet for 111z — honroutou territory, not chinroutou.
  chinroutou: {
    positive: winOf('111m999m111p999p11s', { source: 'discard', winningKind: '1m' }),
    negative: winOf('111m999m111p111z11s', { source: 'discard', winningKind: '1m' }),
  },
  // 234s+234s+666s+666z with an 88s pair — every tile in {2s,3s,4s,6s,8s,6z};
  // the negative swaps one 234s for 456s, and the lone 5s is not green.
  ryuuiisou: {
    positive: winOf('223344s666s88s666z'),
    negative: winOf('234s456s666s88s666z'),
  },
  // 1112345678999m + a surplus 5m, fully concealed — the nine-gates multiset;
  // the negative is a clean chinitsu whose 9m count is 1, the multiset broken.
  'chuuren-poutou': {
    positive: winOf('11123455678999m', { winningKind: '5m' }),
    negative: winOf('111234456789m88m'),
  },
  // Four kans of mixed forms around a pair; the negative downgrades the
  // fourth kan to a pon — sankantsu, one kan short.
  suukantsu: {
    positive: winOf('11s', { melds: [ankan('2z'), daiminkan('9p'), shouminkan('5s'), ankan('3m')] }),
    negative: winOf('11s', { melds: [ankan('2z'), daiminkan('9p'), shouminkan('5s'), pon('3m')] }),
  },
}

describe('yakuOf per-yakuman cases', () => {
  it('the case table covers the yakuman catalog exactly', () => {
    expect(Object.keys(CASES).sort()).toEqual([...YAKUMAN_NAMES].sort())
    expect(YAKUMAN_NAMES).toHaveLength(10)
    expect(new Set(YAKUMAN_NAMES).size).toBe(10)
    expect(Object.isFrozen(YAKUMAN_NAMES)).toBe(true)
    // The two catalogs never share a name — a WinYakuName is unambiguous.
    for (const name of YAKUMAN_NAMES) {
      expect(STANDARD_YAKU_NAMES).not.toContain(name)
    }
  })

  for (const name of YAKUMAN_NAMES) {
    it(`${name}: positive fixture fires`, () => {
      expect(yakuOf(CASES[name].positive)).toContain(name)
    })
    it(`${name}: near-miss negative stays silent`, () => {
      expect(yakuOf(CASES[name].negative)).not.toContain(name)
    })
  }
})

// ---------------------------------------------------------------------------
// The gate and the supersession/stacking conventions — each pinned by an
// exact-list assertion, expected values derived from the rules.
// ---------------------------------------------------------------------------

describe('yakuOf gate and supersession', () => {
  it('a yakuless open completion answers [] exactly — the win gate refusal', () => {
    // Chi 1m2m3m + runs across three suits, terminal 9s kills tanyao, junk
    // pair, closed-hand and circumstance yaku all absent: nothing fires.
    const win = winOf('456p789s345s99p', { melds: [chi('1m')], source: 'discard' })
    expect(yakuOf(win)).toEqual([])
  })

  it('a yakuman suppresses every standard yaku — suuankou hides its shadows', () => {
    // The suuankou tsumo would read menzen-tsumo + toitoi + sanankou as
    // standard yaku; under the supersession the list is the yakuman alone.
    expect(yakuOf(CASES.suuankou.positive)).toEqual(['suuankou'])
  })

  it('the ron-demoted suuankou hand falls back to its standard names', () => {
    // Ron completes 111m: three concealed triplets remain (sanankou), all
    // four sets are still triplet-class (toitoi); no menzen-tsumo (ron), the
    // 1m terminal kills tanyao, three suits kill the flushes.
    expect(yakuOf(CASES.suuankou.negative)).toEqual(['toitoi', 'sanankou'])
  })

  it('multiple yakuman stack, in catalog order', () => {
    // Four wind triplets + haku pair, self-drawn: all-honor tiles
    // (tsuuiisou), four wind triplets (daisuushii), four concealed triplets
    // by tsumo (suuankou). Not shousuushii — the fourth wind is a triplet,
    // not the pair. YAKUMAN_NAMES order: suuankou, daisuushii, tsuuiisou.
    const win = winOf('111z222z333z444z55z', { source: 'wall', winningKind: '1z' })
    expect(yakuOf(win)).toEqual(['suuankou', 'daisuushii', 'tsuuiisou'])
  })

  it('a kokushi win answers exactly [kokushi]', () => {
    expect(yakuOf(CASES.kokushi.positive)).toEqual(['kokushi'])
  })
})

// ---------------------------------------------------------------------------
// Union across readings + the contract reads: order, purity, corruption.
// ---------------------------------------------------------------------------

describe('yakuOf union across readings', () => {
  it('lists every yaku any reading supports — ryanpeikou AND chiitoitsu', () => {
    // 223344m 556677p 88s self-drawn on the 8s tanki: the standard reading
    // (234m×2, 567p×2, 88s) gives menzen-tsumo + tanyao + ryanpeikou (tanki
    // completes no run two-sidedly, so no pinfu); the chiitoitsu reading
    // gives menzen-tsumo + tanyao + chiitoitsu. The union, in catalog order:
    const win = winOf('223344m556677p88s', { source: 'wall', winningKind: '8s' })
    expect(yakuOf(win)).toEqual(['menzen-tsumo', 'tanyao', 'chiitoitsu', 'ryanpeikou'])
  })
})

describe('yakuOf contract', () => {
  it('is a pure read: inputs unmutated, repeat calls identical and fresh', () => {
    const win = winOf('223344s666s88s666z')
    const snapshot = JSON.stringify(win)
    const first = yakuOf(win)
    const second = yakuOf(win)
    expect(JSON.stringify(win)).toBe(snapshot)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
  })

  it('throws on a completion-shaped hand that is not a win', () => {
    // Arity-correct 14 tiles, but 1s+5s can never pair up — not a win, and
    // "no yaku" must never be the answer to "not a win".
    const win: Win = {
      concealed: h('123m456m789m123p15s'),
      melds: [],
      winningKind: '1m',
      source: 'wall',
      lastTile: false,
      seatWind: '1z',
      roundWind: '1z',
    }
    expect(() => yakuOf(win)).toThrow(RangeError)
  })

  it('throws when the winning kind is absent from the concealed tiles', () => {
    const good = winOf('223344s666s88s666z')
    expect(() => yakuOf({ ...good, winningKind: '1z' })).toThrow(RangeError)
  })

  it('passes decomposeAgari arity corruption through as RangeError', () => {
    const good = winOf('223344s666s88s666z')
    expect(() => yakuOf({ ...good, concealed: good.concealed.slice(1) })).toThrow(RangeError)
  })
})
