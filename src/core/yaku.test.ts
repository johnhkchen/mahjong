// The standard yaku catalog's suite — the epic's per-yaku rigor exhibit: every
// catalog yaku gets at least one positive and one adversarial NEAR-MISS negative,
// driven by a table over the catalog names so a missing case is a failure, not a
// review catch. Expected values are derived in comments from the riichi rules,
// never from module output. Contexts are built through the REAL decomposeAgari so
// a fixture typo fails as "not a win" instead of silently testing an impossible
// shape.

import { describe, expect, it } from 'vitest'
import {
  STANDARD_YAKU_NAMES,
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
// The per-yaku table — TOTAL over YakuName by its type, so the compiler enforces
// the AC's "every catalog yaku has at least one positive and one negative case".
// Each entry: one positive and one NEAR-MISS negative, with the rule-derivation
// in a comment.
// ---------------------------------------------------------------------------

interface YakuCase {
  positive: WinContext
  negative: WinContext
}

const CASES: Record<YakuName, YakuCase> = {
  // Self-draw on a closed hand; the negative opens the SAME shape with a chi.
  'menzen-tsumo': {
    positive: ctxOf('123m456m789m234p55s', { source: 'wall' }),
    negative: ctxOf('123m456m234p55s', { melds: [chi('7m')], source: 'wall' }),
  },
  // All runs, non-yakuhai pair, won on 4s = the low end of 456s (ryanmen);
  // the negative wins the SAME hand on 4p, the middle of 345p (kanchan).
  pinfu: {
    positive: ctxOf('234m567m345p88p456s', { winningKind: '4s' }),
    negative: ctxOf('234m567m345p88p456s', { winningKind: '4p' }),
  },
  // One duplicated 123m run, closed; the negative is the same pairing OPENED
  // by a chi — iipeikou is a closed yaku.
  iipeikou: {
    positive: ctxOf('123m123m456p789s55z'),
    negative: ctxOf('123m123m456p55z', { melds: [chi('7s')] }),
  },
  // 234m+234m and 567p+567p are two duplicated runs; the negative holds only
  // the one 123m duplication.
  ryanpeikou: {
    positive: ctxOf('223344m556677p88s', { pick: (d) => d.form === 'standard' }),
    negative: ctxOf('123m123m456p789s55z'),
  },
  // The 234 run in all three suits; the negative has it in only m and p.
  'sanshoku-doujun': {
    positive: ctxOf('234m567m234p234s88s'),
    negative: ctxOf('234m567m234p567p88s'),
  },
  // The 222 triplet in all three suits; the negative's souzu triplet is 333s.
  'sanshoku-doukou': {
    positive: ctxOf('222m345m222p222s88s'),
    negative: ctxOf('222m345m222p333s88s'),
  },
  // 123-456-789 in manzu; the negative spreads the straight across suits.
  ittsuu: {
    positive: ctxOf('123m456m789m234p55s'),
    negative: ctxOf('123m234m456p789s55s'),
  },
  // Every set holds a terminal or honor, with a run and honors present; the
  // negative's 234m is the one all-simple set.
  chanta: {
    positive: ctxOf('123m789m789p111z22z'),
    negative: ctxOf('234m789m789p111z22z'),
  },
  // Every set and the pair hold a TERMINAL, no honors; the negative swaps the
  // 999s triplet for 111z — an honor set is chanta territory, never junchan.
  junchan: {
    positive: ctxOf('123m789m123p999s99p'),
    negative: ctxOf('123m789m123p111z99p'),
  },
  // Four triplet-class sets (two concealed, two pons); the negative turns one
  // pon into a chi — a single run breaks toitoi.
  toitoi: {
    positive: ctxOf('222m333p11s', { melds: [pon('7s'), pon('5p')] }),
    negative: ctxOf('222m333p11s', { melds: [chi('5p'), pon('7s')] }),
  },
  // Three concealed triplets by self-draw; the negative RONS the 4s that
  // completes the third triplet with no run to absorb it — two concealed left.
  sanankou: {
    positive: ctxOf('222m567m333p444s88s', { source: 'wall', winningKind: '4s' }),
    negative: ctxOf('222m567m333p444s88s', { source: 'discard', winningKind: '4s' }),
  },
  // Three kans of mixed forms; the negative downgrades one kan to a pon.
  sankantsu: {
    positive: ctxOf('234m88s', { melds: [ankan('2z'), daiminkan('9p'), shouminkan('5s')] }),
    negative: ctxOf('234m88s', { melds: [ankan('2z'), daiminkan('9p'), pon('5s')] }),
  },
  // Two dragon triplets + the third dragon as pair; the negative holds all
  // THREE dragon triplets — daisangen territory, not shousangen.
  shousangen: {
    positive: ctxOf('234m567p555z666z77z'),
    negative: ctxOf('234m555z666z777z88s'),
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
  it('the case table covers the catalog exactly', () => {
    expect(Object.keys(CASES).sort()).toEqual([...STANDARD_YAKU_NAMES].sort())
    expect(STANDARD_YAKU_NAMES).toHaveLength(27)
    expect(new Set(STANDARD_YAKU_NAMES).size).toBe(27)
    expect(Object.isFrozen(STANDARD_YAKU_NAMES)).toBe(true)
  })

  for (const name of STANDARD_YAKU_NAMES) {
    it(`${name}: positive fixture fires`, () => {
      expect(standardYakuOf(CASES[name].positive)).toContain(name)
    })
    it(`${name}: near-miss negative stays silent`, () => {
      expect(standardYakuOf(CASES[name].negative)).not.toContain(name)
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

// ---------------------------------------------------------------------------
// Interactions: the conventions design D5 encodes as predicate structure —
// disjoint families, favorable attributions, double-fires — each pinned by a
// directed test.
// ---------------------------------------------------------------------------

describe('standardYakuOf interactions', () => {
  it('ryanpeikou supersedes iipeikou — never both', () => {
    const names = standardYakuOf(
      ctxOf('223344m556677p88s', { pick: (d) => d.form === 'standard' }),
    )
    expect(names).toContain('ryanpeikou')
    expect(names).not.toContain('iipeikou')
  })

  it('the chanta family is pairwise exclusive on its boundary hands', () => {
    // Junchan shape: terminals in every set, no honors → junchan only.
    const junchanNames = standardYakuOf(ctxOf('123m789m123p999s99p'))
    expect(junchanNames).toContain('junchan')
    expect(junchanNames).not.toContain('chanta')
    expect(junchanNames).not.toContain('honroutou')
    // Chanta shape: honors present, runs present → chanta only.
    const chantaNames = standardYakuOf(ctxOf('123m789m789p111z22z'))
    expect(chantaNames).toContain('chanta')
    expect(chantaNames).not.toContain('junchan')
    expect(chantaNames).not.toContain('honroutou')
    // Honroutou shape: terminals/honors only, no runs → honroutou (and toitoi
    // co-fires — a different family, stacking is legal).
    const honroutouNames = standardYakuOf(ctxOf('111m999m111p11s', { melds: [pon('9p')] }))
    expect(honroutouNames).toContain('honroutou')
    expect(honroutouNames).toContain('toitoi')
    expect(honroutouNames).not.toContain('chanta')
    expect(honroutouNames).not.toContain('junchan')
  })

  it('honroutou also fires over the chiitoitsu form', () => {
    const names = standardYakuOf(ctxOf('1199m1199p1122z99s'))
    expect(names).toContain('honroutou')
    expect(names).toContain('chiitoitsu')
  })

  it('a dealer East triplet in an East round fires BOTH wind yakuhai', () => {
    const names = standardYakuOf(
      ctxOf('234m567p678s22s111z', { seatWind: '1z', roundWind: '1z' }),
    )
    expect(names).toContain('yakuhai-seat-wind')
    expect(names).toContain('yakuhai-round-wind')
  })

  it('pinfu accepts only the two-sided wait', () => {
    // 123m 789m 456p 567s + 22p: won on 3m = 12m penchan; on 7m = 89m penchan;
    // on 2p = tanki; on 4p = 56p... no — 456p won on 4p is the LOW end, wait
    // was 56p, two-sided (3p/6p): ryanmen. Derivations per completesRyanmen.
    const spec = '123m789m456p22p567s'
    expect(standardYakuOf(ctxOf(spec, { winningKind: '3m' }))).not.toContain('pinfu')
    expect(standardYakuOf(ctxOf(spec, { winningKind: '7m' }))).not.toContain('pinfu')
    expect(standardYakuOf(ctxOf(spec, { winningKind: '2p' }))).not.toContain('pinfu')
    expect(standardYakuOf(ctxOf(spec, { winningKind: '4p' }))).toContain('pinfu')
    // 789s won on 9s: wait was 78s, two-sided (6s/9s) — the high-end ryanmen.
    expect(
      standardYakuOf(ctxOf('234m567m345p88p789s', { winningKind: '9s' })),
    ).toContain('pinfu')
  })

  it('an otakaze wind pair does not break pinfu; a seat-wind pair does', () => {
    // Pair 2z with East seat and round: not yakuhai, pinfu stands.
    const ctx = ctxOf('123m456m789m22z567s', {
      winningKind: '1m',
      seatWind: '1z',
      roundWind: '1z',
    })
    expect(standardYakuOf(ctx)).toContain('pinfu')
    // The same hand seen by the South seat (2z pair IS its wind): no pinfu.
    expect(standardYakuOf({ ...ctx, seatWind: '2z' })).not.toContain('pinfu')
  })

  it('a run absorbs the ron tile and preserves sanankou', () => {
    // 222m 88m 333p 345s 444s, ron 4s: the 345s run can take the winning tile,
    // so all three triplets stay concealed (the favorable attribution).
    const ctx = ctxOf('222m88m333p345s444s', { source: 'discard', winningKind: '4s' })
    expect(standardYakuOf(ctx)).toContain('sanankou')
  })

  it('a rinshan win as the wall empties is rinshan, never haitei', () => {
    const names = standardYakuOf(
      ctxOf('234m345m456p567s88s', { source: 'rinshan', lastTile: true }),
    )
    expect(names).toContain('rinshan')
    expect(names).not.toContain('haitei')
  })

  it('a yakuless open completion returns [] exactly', () => {
    // Chi 1m2m3m + 345s among runs of three suits, terminal 9s, junk pair:
    // no flush, no tanyao, no honor, no circumstance — nothing fires.
    const ctx = ctxOf('456p789s345s99p', { melds: [chi('1m')], source: 'discard' })
    expect(standardYakuOf(ctx)).toEqual([])
  })

  it('a kokushi decomposition answers [] — the yakuman is -04 business', () => {
    const ctx = ctxOf('19m19p19s11234567z')
    expect(ctx.decomposition.form).toBe('kokushi')
    expect(standardYakuOf(ctx)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Contract: result order, purity, guards.
// ---------------------------------------------------------------------------

describe('standardYakuOf contract', () => {
  it('returns names in catalog order — the full list of a multi-yaku hand', () => {
    // 123m 123m 456m 789m + 11m, self-drawn on 1m: closed tsumo; all runs with
    // a non-yakuhai pair won on the 23m ryanmen (pinfu); duplicated 123m
    // (iipeikou); 123-456-789m (ittsuu); one suit, no honors (chinitsu).
    const ctx = ctxOf('123m123m456m789m11m', { winningKind: '1m', source: 'wall' })
    expect(standardYakuOf(ctx)).toEqual([
      'menzen-tsumo',
      'pinfu',
      'iipeikou',
      'ittsuu',
      'chinitsu',
    ])
  })

  it('is a pure read: inputs unmutated, repeat calls identical', () => {
    const ctx = ctxOf('222m567m333p444s88s', { melds: [], source: 'discard', winningKind: '4s' })
    const snapshot = JSON.stringify(ctx)
    const first = standardYakuOf(ctx)
    const second = standardYakuOf(ctx)
    expect(JSON.stringify(ctx)).toBe(snapshot)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
  })

  it('throws on a standard context whose sets and melds do not total four', () => {
    const good = ctxOf('123m456m789m234p55s')
    expect(() => standardYakuOf({ ...good, melds: [pon('5z')] })).toThrow(RangeError)
  })

  it('throws on a pairs-form context carrying a meld', () => {
    const good = ctxOf('1122m3344p5566s77z')
    expect(() => standardYakuOf({ ...good, melds: [pon('5z')] })).toThrow(RangeError)
  })
})
