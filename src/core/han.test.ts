// han.ts's fixture suite: a table-driven check of hanOf against an
// independently-spelled expected table (the dora.test.ts "second independent
// spelling" precedent — never derived from han.ts's own YAKU_HAN), small
// hand-built Win fixtures for doraHanOf's counting rules, and the AC's
// explicit win-gate proof — a yakuless dora-laden hand still cannot win.
// Win fixtures pass through the real isAgari (the yakuman.test.ts idiom) so a
// fixture typo fails as "not a win" instead of silently testing an
// impossible shape.

import { describe, expect, it } from 'vitest'
import {
  STANDARD_YAKU_NAMES,
  YAKUMAN_NAMES,
  doraHanOf,
  hanOf,
  isAgari,
  tileId,
  yakuOf,
  type Meld,
  type TileKind,
  type Win,
  type YakuName,
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
// Meld builders with real kinds — the yaku.test.ts/yakuman.test.ts idiom.
// ---------------------------------------------------------------------------

function chi(start: TileKind): Meld {
  const up = (k: TileKind, n: number): TileKind => `${Number(k[0]) + n}${k[1]}` as TileKind
  return { type: 'chi', claimed: tileId(start, 0), from: 3, own: [tileId(up(start, 1), 0), tileId(up(start, 2), 0)] }
}

function pon(kind: TileKind): Meld {
  return { type: 'pon', claimed: tileId(kind, 0), from: 0, own: [tileId(kind, 1), tileId(kind, 2)] }
}

// ---------------------------------------------------------------------------
// Win builder — real isAgari-checked fixtures, the yakuman.test.ts idiom.
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
    riichi: 'none',
    ippatsu: false,
  }
}

// ---------------------------------------------------------------------------
// hanOf — the full standard-yaku table, table-driven so a missing case is a
// failure, not a review catch. Expected values transcribed BY HAND from the
// published riichi rule table (design.md), never read off han.ts's own
// YAKU_HAN — a second independent spelling.
// ---------------------------------------------------------------------------

describe('hanOf — the standard yaku table', () => {
  // { closed, open } per name. Names whose predicate requires a fully closed
  // hand (menzen-tsumo, pinfu, iipeikou, chiitoitsu, ryanpeikou) are never
  // reachable open through standardYakuOf — only their closed value is
  // exercised below.
  const EXPECTED: Record<YakuName, { closed: number; open: number }> = {
    'menzen-tsumo': { closed: 1, open: 1 },
    riichi: { closed: 1, open: 1 },
    'double-riichi': { closed: 2, open: 2 },
    ippatsu: { closed: 1, open: 1 },
    pinfu: { closed: 1, open: 1 },
    tanyao: { closed: 1, open: 1 },
    iipeikou: { closed: 1, open: 1 },
    'yakuhai-haku': { closed: 1, open: 1 },
    'yakuhai-hatsu': { closed: 1, open: 1 },
    'yakuhai-chun': { closed: 1, open: 1 },
    'yakuhai-seat-wind': { closed: 1, open: 1 },
    'yakuhai-round-wind': { closed: 1, open: 1 },
    'sanshoku-doujun': { closed: 2, open: 1 },
    'sanshoku-doukou': { closed: 2, open: 2 },
    ittsuu: { closed: 2, open: 1 },
    chanta: { closed: 2, open: 1 },
    junchan: { closed: 3, open: 2 },
    toitoi: { closed: 2, open: 2 },
    sanankou: { closed: 2, open: 2 },
    sankantsu: { closed: 2, open: 2 },
    chiitoitsu: { closed: 2, open: 2 },
    honroutou: { closed: 2, open: 2 },
    shousangen: { closed: 2, open: 2 },
    honitsu: { closed: 3, open: 2 },
    chinitsu: { closed: 6, open: 5 },
    ryanpeikou: { closed: 3, open: 3 },
    haitei: { closed: 1, open: 1 },
    houtei: { closed: 1, open: 1 },
    rinshan: { closed: 1, open: 1 },
    chankan: { closed: 1, open: 1 },
  }

  // The names whose han value actually drops when open — the only ones worth
  // asserting an OPEN reading for; every other name's "open" column is either
  // identical to closed or unreachable in practice.
  const VARIES_WITH_OPENNESS: readonly YakuName[] = [
    'sanshoku-doujun',
    'ittsuu',
    'chanta',
    'junchan',
    'honitsu',
    'chinitsu',
  ]

  it('covers every catalog name (compiler-enforced total)', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...STANDARD_YAKU_NAMES].sort())
  })

  for (const name of STANDARD_YAKU_NAMES) {
    it(`${name} — closed`, () => {
      expect(hanOf(name, [])).toBe(EXPECTED[name].closed)
    })
  }

  for (const name of VARIES_WITH_OPENNESS) {
    it(`${name} — open`, () => {
      expect(hanOf(name, [chi('2m')])).toBe(EXPECTED[name].open)
    })
  }
})

describe('hanOf — yakuman is flat 13, openness-independent', () => {
  for (const name of YAKUMAN_NAMES) {
    it(`${name} — closed and open both 13`, () => {
      expect(hanOf(name, [])).toBe(13)
      expect(hanOf(name, [pon('5z')])).toBe(13)
    })
  }
})

// ---------------------------------------------------------------------------
// doraHanOf — dora + kan-dora counting.
// ---------------------------------------------------------------------------

describe('doraHanOf', () => {
  // Closed (zero melds) wins need 14 concealed tiles: pair (2) + 4 sets (12).
  // 22m 567m 345p 678s 234s — pair 22m, runs 567m/345p/678s/234s.
  it('one copy under one indicator scores 1', () => {
    const win = winOf('22m567m345p678s234s', { winningKind: '5p' })
    expect(doraHanOf(win, ['5p'])).toBe(1)
  })

  it('a triplet under one indicator scores 3', () => {
    // Same shape, 345p replaced by the triplet 555p (three copies of 5p).
    const win = winOf('22m567m555p678s234s', { winningKind: '5p' })
    expect(doraHanOf(win, ['5p'])).toBe(3)
  })

  it('two indicators on the same kind stack: 2 copies × 2 indicators = 4', () => {
    // Pair IS the dora kind (55p, two copies); two indicators both point at 5p.
    const win = winOf('55p234p567m678s234s', { winningKind: '5p' })
    expect(doraHanOf(win, ['5p', '5p'])).toBe(4)
  })

  it('dora tiles held inside an open meld count too', () => {
    // Open (one pon, 3 tiles): concealed shrinks to 11 = pair + 3 sets, with
    // NO 5p concealed — every counted copy comes from the meld's claimed +
    // own tiles (3 physical copies of 5p).
    const win = winOf('22m234p678s234s', {
      melds: [pon('5p')],
      winningKind: '2p',
    })
    expect(doraHanOf(win, ['5p'])).toBe(3)
  })

  it('zero when no dora indicator matches anything in the hand', () => {
    const win = winOf('22m567m345p678s234s', { winningKind: '5p' })
    expect(doraHanOf(win, ['9s'])).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// The AC's explicit ask: a yakuless dora-laden hand still cannot win. Dora
// is priced positively by doraHanOf while yakuOf's list for the SAME win is
// empty — the win-gate refusal — proving dora alone never satisfies it.
// ---------------------------------------------------------------------------

describe('dora never satisfies the one-yaku win gate', () => {
  it('an open, yakuless hand rich in dora still returns no yaku', () => {
    // Open pon of 9m (kills menzen-tsumo/pinfu/iipeikou/ryanpeikou/chiitoitsu
    // — all closed-only), a non-terminal non-honor pair 2s2s (kills chanta/
    // junchan, both requiring a terminal/honor pair), no honor tiles at all
    // (kills every yakuhai), three distinct numbered suits present across
    // p/s/m (kills honitsu/chinitsu, both requiring exactly one), runs whose
    // starts never coincide across three suits (kills sanshoku-doujun), a
    // single triplet-class set — the meld itself, one short of any
    // triplet/kan-count yaku (kills toitoi/sanankou/sankantsu/sanshoku-
    // doukou/shousangen), no 1-4-7 same-suit run coverage (kills ittsuu):
    // a genuinely yakuless open ron.
    const win = winOf('234p567p456s22s', {
      melds: [pon('9m')],
      source: 'discard',
      winningKind: '4p',
      seatWind: '2z',
      roundWind: '1z',
    })
    const yaku = yakuOf(win)
    expect(yaku).toEqual([])
    // Yet the hand holds a 4p an indicator could hit — dora prices
    // positively for the very same win the yaku list refuses.
    const dora = doraHanOf(win, ['4p', '4p'])
    expect(dora).toBeGreaterThan(0)
  })
})
