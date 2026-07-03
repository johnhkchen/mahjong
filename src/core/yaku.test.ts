// The standard yaku catalog's suite — the epic's per-yaku rigor exhibit: every
// catalog yaku gets at least one positive and one adversarial NEAR-MISS negative,
// driven by a table over the catalog names so a missing case is a failure, not a
// review catch. Expected values are derived in comments from the riichi rules,
// never from module output. Contexts are built through the REAL decomposeAgari so
// a fixture typo fails as "not a win" instead of silently testing an impossible
// shape.

import { describe, expect, it } from 'vitest'
import {
  TILE_KINDS,
  decomposeAgari,
  kindIndexOf,
  standardYakuOf,
  tileId,
  type AgariDecomposition,
  type Meld,
  type TileKind,
  type WinContext,
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

/** The kind `steps` ranks above `kind` within its suit block. */
function up(kind: TileKind, steps: number): TileKind {
  return TILE_KINDS[kindIndexOf(kind) + steps]
}

// ---------------------------------------------------------------------------
// Meld builders with REAL kinds — unlike agari.test.ts's arity-only fakes, the
// catalog reads meld tile kinds (openness, triplet/run identity, tile scans).
// claimed/from are arbitrary but well-typed; copies are chosen so no id repeats
// within one meld.
// ---------------------------------------------------------------------------

function chi(start: TileKind): Meld {
  return { type: 'chi', claimed: tileId(start, 0), from: 3, own: [tileId(up(start, 1), 0), tileId(up(start, 2), 0)] }
}

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

// ---------------------------------------------------------------------------
// Context builder: concealed tiles through the real decomposer. Ambiguous hands
// must pick their reading explicitly — every ambiguity in a fixture is a visible,
// deliberate choice. Defaults: wall self-draw mid-hand, East seat in an East
// round (so 1z is DOUBLY yakuhai — fixtures holding winds set the winds they
// mean), winning tile = the spec's first tile.
// ---------------------------------------------------------------------------

interface CtxOverrides {
  melds?: readonly Meld[]
  winningKind?: TileKind
  source?: WinContext['source']
  lastTile?: boolean
  seatWind?: WinContext['seatWind']
  roundWind?: WinContext['roundWind']
  pick?: (decomposition: AgariDecomposition) => boolean
}

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
    lastTile: overrides.lastTile ?? false,
    seatWind: overrides.seatWind ?? '1z',
    roundWind: overrides.roundWind ?? '1z',
  }
}

// ---------------------------------------------------------------------------
// The per-yaku table. Each entry: one positive and one NEAR-MISS negative, with
// the rule-derivation in a comment. Typed over the names present so far; the
// final step tightens the type to the total Record over YakuName.
// ---------------------------------------------------------------------------

interface YakuCase {
  positive: WinContext
  negative: WinContext
}

const CASES: Partial<Record<YakuName, YakuCase>> = {
  // Self-draw on a closed hand; the negative opens the SAME shape with a chi.
  'menzen-tsumo': {
    positive: ctxOf('123m456m789m234p55s', { source: 'wall' }),
    negative: ctxOf('123m456m234p55s', { melds: [chi('7m')], source: 'wall' }),
  },
  // All simples; the negative differs only by 123m carrying the terminal 1m.
  tanyao: {
    positive: ctxOf('234m345m456p567s88s'),
    negative: ctxOf('123m345m456p567s88s'),
  },
  // A haku (5z) triplet; the negative holds haku only as the PAIR.
  'yakuhai-haku': {
    positive: ctxOf('234m567p678s22s555z'),
    negative: ctxOf('234m345m567p678s55z'),
  },
  // Same shape one dragon up: hatsu (6z) triplet vs hatsu pair.
  'yakuhai-hatsu': {
    positive: ctxOf('234m567p678s22s666z'),
    negative: ctxOf('234m345m567p678s66z'),
  },
  // Chun (7z) triplet vs chun pair.
  'yakuhai-chun': {
    positive: ctxOf('234m567p678s22s777z'),
    negative: ctxOf('234m345m567p678s77z'),
  },
  // A 2z (South) triplet is yakuhai for the South seat, otakaze for East.
  'yakuhai-seat-wind': {
    positive: ctxOf('234m567p678s22s222z', { seatWind: '2z', roundWind: '1z' }),
    negative: ctxOf('234m567p678s22s222z', { seatWind: '1z', roundWind: '1z' }),
  },
  // The same 2z triplet under a South ROUND vs an East round.
  'yakuhai-round-wind': {
    positive: ctxOf('234m567p678s22s222z', { seatWind: '1z', roundWind: '2z' }),
    negative: ctxOf('234m567p678s22s222z', { seatWind: '1z', roundWind: '1z' }),
  },
  // Seven distinct pairs; the negative is a standard-form hand.
  chiitoitsu: {
    positive: ctxOf('1122m3344p5566s77z'),
    negative: ctxOf('234m345m456p567s88s'),
  },
  // Terminals/honors only (toitoi shape); the negative swaps one triplet to 5p.
  honroutou: {
    positive: ctxOf('111m999m111p11s', { melds: [pon('9p')] }),
    negative: ctxOf('111m999m555p11s', { melds: [pon('9p')] }),
  },
  // One suit plus honors; the negative is the pure flush (no honor = chinitsu).
  honitsu: {
    positive: ctxOf('123m345m789m11z555z', { seatWind: '2z', roundWind: '2z' }),
    negative: ctxOf('123m123m456m789m11m'),
  },
  // One suit, no honors; the negative reintroduces the honors.
  chinitsu: {
    positive: ctxOf('123m123m456m789m11m'),
    negative: ctxOf('123m345m789m11z555z', { seatWind: '2z', roundWind: '2z' }),
  },
  // Last live-wall draw; the negative wins on a rinshan draw as the wall empties
  // — rinshan, never haitei (the source check, not the flag, decides).
  haitei: {
    positive: ctxOf('234m345m456p567s88s', { source: 'wall', lastTile: true }),
    negative: ctxOf('234m345m456p567s88s', { source: 'rinshan', lastTile: true }),
  },
  // Ron on the final discard; the negative is the same last tile SELF-drawn.
  houtei: {
    positive: ctxOf('234m345m456p567s88s', { source: 'discard', lastTile: true }),
    negative: ctxOf('234m345m456p567s88s', { source: 'wall', lastTile: true }),
  },
  // Kan replacement draw; the negative is an ordinary wall draw.
  rinshan: {
    positive: ctxOf('234m345m456p567s88s', { source: 'rinshan' }),
    negative: ctxOf('234m345m456p567s88s', { source: 'wall' }),
  },
  // Robbing a shouminkan; the negative is an ordinary discard ron.
  chankan: {
    positive: ctxOf('234m345m456p567s88s', { source: 'chankan' }),
    negative: ctxOf('234m345m456p567s88s', { source: 'discard' }),
  },
}

describe('standardYakuOf per-yaku cases', () => {
  for (const [name, cases] of Object.entries(CASES) as [YakuName, YakuCase][]) {
    it(`${name}: positive fixture fires`, () => {
      expect(standardYakuOf(cases.positive)).toContain(name)
    })
    it(`${name}: near-miss negative stays silent`, () => {
      expect(standardYakuOf(cases.negative)).not.toContain(name)
    })
  }
})

describe('standardYakuOf meld builders sanity', () => {
  it('open melds read as their kind-level sets (pon/kan yakuhai fire)', () => {
    // 5z pon, 6z daiminkan, 7z shouminkan around a simple concealed remainder:
    // every dragon yakuhai fires, and menzen-tsumo does not (open hand).
    const ctx = ctxOf('234m88s', {
      melds: [pon('5z'), daiminkan('6z'), shouminkan('7z')],
    })
    const names = standardYakuOf(ctx)
    expect(names).toContain('yakuhai-haku')
    expect(names).toContain('yakuhai-hatsu')
    expect(names).toContain('yakuhai-chun')
    expect(names).not.toContain('menzen-tsumo')
  })

  it('an ankan keeps the hand closed for menzen-tsumo', () => {
    const ctx = ctxOf('234m567p678s55z', { melds: [ankan('3s')], source: 'wall' })
    expect(standardYakuOf(ctx)).toContain('menzen-tsumo')
  })
})
