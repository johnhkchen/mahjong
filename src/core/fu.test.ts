// fu.ts's fixture suite — the AC's "classic traps," built through the REAL
// decomposeAgari (never hand-typed AgariDecomposition literals) so a fixture typo
// fails as "not a win" instead of silently testing an impossible shape. Every
// expected number is derived by hand in a comment from the standard fu table
// (research.md §3 / structure.md), never reverse-engineered from a first run.

import { describe, expect, it } from 'vitest'
import {
  decomposeAgari,
  fuOf,
  tileId,
  type AgariDecomposition,
  type Meld,
  type TileKind,
  type WinContext,
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

function chi(start: TileKind): Meld {
  const up = (k: TileKind, n: number): TileKind =>
    `${Number(k[0]) + n}${k[1]}` as TileKind
  return {
    type: 'chi',
    claimed: tileId(start, 0),
    from: 3,
    own: [tileId(up(start, 1), 0), tileId(up(start, 2), 0)],
  }
}

function daiminkan(kind: TileKind): Meld {
  return {
    type: 'daiminkan',
    claimed: tileId(kind, 0),
    from: 0,
    own: [tileId(kind, 1), tileId(kind, 2), tileId(kind, 3)],
  }
}

function ankan(kind: TileKind): Meld {
  return { type: 'ankan', own: [tileId(kind, 0), tileId(kind, 1), tileId(kind, 2), tileId(kind, 3)] }
}

interface CtxOverrides {
  melds?: readonly Meld[]
  winningKind?: TileKind
  source?: WinContext['source']
  seatWind?: WinContext['seatWind']
  roundWind?: WinContext['roundWind']
  pick?: (decomposition: AgariDecomposition) => boolean
}

/** Builds a WinContext through the real decomposer, per yaku.test.ts's ctxOf. */
function ctxOf(spec: string, overrides: CtxOverrides = {}): WinContext {
  const concealed = h(spec)
  const melds = overrides.melds ?? []
  const all = decomposeAgari(concealed, melds)
  if (all.length === 0) throw new Error(`fixture ${spec} is not a win`)
  const chosen = overrides.pick ? all.filter(overrides.pick) : all
  if (chosen.length !== 1) {
    throw new Error(`fixture ${spec}: ${chosen.length} readings match — pick exactly one`)
  }
  return {
    decomposition: chosen[0],
    melds,
    winningKind: overrides.winningKind ?? concealed[0],
    source: overrides.source ?? 'wall',
    lastTile: false,
    seatWind: overrides.seatWind ?? '3z',
    roundWind: overrides.roundWind ?? '4z',
    riichi: 'none',
    ippatsu: false,
  }
}

describe('fuOf — pinfu tsumo 20 / ron 30', () => {
  // 22m + 234p/567p/234s/678s, won on 6s = the low end of 678s (ryanmen).
  // Closed, all runs, non-yakuhai pair (2m). Tsumo: FIXED 20 (the named
  // exception — raw base(20)+tsumo(2)=22 is suppressed). Ron: raw
  // base(20)+menzen(10)=30, which already equals the fixed value.
  it('tsumo is fixed at 20', () => {
    const ctx = ctxOf('22m234p567p234s678s', { winningKind: '6s', source: 'wall' })
    expect(fuOf(ctx)).toBe(20)
  })
  it('ron is fixed at 30', () => {
    const ctx = ctxOf('22m234p567p234s678s', { winningKind: '6s', source: 'discard' })
    expect(fuOf(ctx)).toBe(30)
  })
})

describe('fuOf — chiitoitsu is fixed 25, no rounding', () => {
  // Seven distinct pairs, 1m through 7m.
  it('tsumo is 25', () => {
    const ctx = ctxOf('11223344556677m', {
      pick: (d) => d.form === 'chiitoitsu',
      source: 'wall',
    })
    expect(fuOf(ctx)).toBe(25)
  })
  it('ron is 25', () => {
    const ctx = ctxOf('11223344556677m', {
      pick: (d) => d.form === 'chiitoitsu',
      source: 'discard',
    })
    expect(fuOf(ctx)).toBe(25)
  })
})

describe('fuOf — open pinfu-shaped ron 30 (kuipinfu convention)', () => {
  // One chi(789m) meld + concealed 234m/567m/456s + pair 88p, won on 4s (low
  // end of 456s, ryanmen). Open, so no menzen bonus; every other component is
  // 0 (chi=0, all-run set fu=0, non-yakuhai pair=0, ryanmen wait=0) — the raw
  // ron sum is exactly 20, which the kuipinfu rule bumps to 30 rather than
  // leaving at 20 (20-fu ron is reserved for a TRULY closed pinfu).
  it('ron: raw 20 is bumped to 30 by the kuipinfu convention', () => {
    const ctx = ctxOf('234m567m88p456s', {
      melds: [chi('7m')],
      winningKind: '4s',
      source: 'discard',
    })
    expect(fuOf(ctx)).toBe(30)
  })
  // Tsumo needs no special case: raw = 20 base + 2 tsumo = 22, which the
  // ordinary round-up-to-10 rule already sends to 30.
  it('tsumo: raw 22 rounds up to 30 with no special case needed', () => {
    const ctx = ctxOf('234m567m88p456s', {
      melds: [chi('7m')],
      winningKind: '4s',
      source: 'wall',
    })
    expect(fuOf(ctx)).toBe(30)
  })
})

describe('fuOf — closed ron +10 menzen fu', () => {
  // Pair 55z (haku, +2 pair fu), 123m/789p/234s runs, 456s completed on 5s
  // (offset 1 from start 4s — always kanchan, +2). Closed (zero melds).
  //
  // Ron:   20 base + 10 menzen + 0 tsumo + 2 pair + 0 set + 2 kanchan = 34 → 40
  // Tsumo: 20 base +  0 menzen + 2 tsumo + 2 pair + 0 set + 2 kanchan = 26 → 30
  it('ron scores 40 (menzen +10, no tsumo +2)', () => {
    const ctx = ctxOf('123m789p234s456s55z', { winningKind: '5s', source: 'discard' })
    expect(fuOf(ctx)).toBe(40)
  })
  it('tsumo scores 30 (tsumo +2, no menzen +10)', () => {
    const ctx = ctxOf('123m789p234s456s55z', { winningKind: '5s', source: 'wall' })
    expect(fuOf(ctx)).toBe(30)
  })
})

describe('fuOf — closed/open triplet vs kan fu, terminal/honor rate', () => {
  // Shared shape: pair 33p (non-valuable) + 456m/234s/789s runs, won on 4m
  // (low end of 456m, ryanmen, +0) unless noted. The varying 4th component
  // carries the honor (1z) triplet/kan.

  // Concealed 111z triplet, tsumo: self-draws always resolve anko (closed)
  // regardless of attribution. 20 base + 0 menzen + 2 tsumo + 0 pair +
  // 8 closed-honor-triplet + 0 ryanmen = 30 (already a multiple of 10).
  it('concealed triplet (anko), tsumo: closed terminal/honor rate 8', () => {
    const ctx = ctxOf('456m789s234s111z33p', { winningKind: '4m', source: 'wall' })
    expect(fuOf(ctx)).toBe(30)
  })

  // Same triplet, but won BY RON on the triplet's own kind (1z) with no run
  // able to absorb it (honors never run) — the ron adjustment downgrades it
  // to the open (minko) rate: 20 base + 10 menzen + 0 tsumo + 0 pair +
  // 8 default-closed-set-fu + (4 open − 8 closed) triplet delta = 34 → 40.
  it('concealed triplet completed by ron: downgraded to open rate', () => {
    const ctx = ctxOf('456m789s234s111z33p', { winningKind: '1z', source: 'discard' })
    expect(fuOf(ctx)).toBe(40)
  })

  // Meld daiminkan(1z) replaces the concealed triplet — open kan, honor:
  // 20 base + 0 menzen (daiminkan opens the hand) + 2 tsumo + 0 pair +
  // 16 open-honor-kan + 0 ryanmen = 38 → 40.
  it('open kan (daiminkan): open terminal/honor rate 16', () => {
    const ctx = ctxOf('456m789s234s33p', {
      melds: [daiminkan('1z')],
      winningKind: '4m',
      source: 'wall',
    })
    expect(fuOf(ctx)).toBe(40)
  })

  // Meld ankan(1z) — closed kan, honor, and ankan does NOT break menzen for
  // the ron bonus: 20 base + 10 menzen + 0 tsumo + 0 pair +
  // 32 closed-honor-kan + 0 ryanmen = 62 → 70.
  it('closed kan (ankan): closed terminal/honor rate 32, menzen intact', () => {
    const ctx = ctxOf('456m789s234s33p', {
      melds: [ankan('1z')],
      winningKind: '4m',
      source: 'discard',
    })
    expect(fuOf(ctx)).toBe(70)
  })
})

describe('fuOf — round up to the next 10', () => {
  // Pair 55z (+2), triplet 999s (terminal, default closed, untouched by the
  // winning tile: +8), runs 234m/789m, and 456p completed on 5p (kanchan,
  // +2), won by RON (+10 menzen, +0 tsumo):
  // 20 + 10 + 0 + 2 + 8 + 2 = 42 → rounds up to 50.
  it('42 raw rounds up to 50', () => {
    const ctx = ctxOf('234m789m456p999s55z', { winningKind: '5p', source: 'discard' })
    expect(fuOf(ctx)).toBe(50)
  })
})

describe('fuOf — wait-attribution ambiguity resolves to the max fu', () => {
  // Pair 4p (3 total copies: 2 pair + 1 run) with a run 456p also containing
  // 4p at its LOW end (offset 0, rank 4 ≤ 6 → ryanmen, +0). The winning tile
  // 4p is structurally consistent with EITHER a tanki wait on the pair (+2)
  // or a ryanmen completion of the run (+0) from this one decomposition.
  // Correct: take the max (tanki, +2) — 20 base + 10 menzen (ron) + 2 tanki
  // = 32 → 40. A naive "always prefer run absorption" implementation would
  // instead land on 20 + 10 + 0 = 30, a DIFFERENT rounded total, so this
  // fixture actually distinguishes the two strategies.
  it('prefers the tanki attribution over ryanmen run-absorption', () => {
    const ctx = ctxOf('44456p123789m234s', { winningKind: '4p', source: 'discard' })
    expect(fuOf(ctx)).toBe(40)
  })
})

describe('fuOf — kokushi throws (fu does not apply to a yakuman)', () => {
  it('throws RangeError', () => {
    const ctx = ctxOf('119m19p19s1234567z', { pick: (d) => d.form === 'kokushi' })
    expect(() => fuOf(ctx)).toThrow(RangeError)
  })
})
