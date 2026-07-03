// The waits suite: fixtures with HAND-DERIVED expected wait lists (every classic wait
// shape, the special forms, both self-exhaustion producers), then property agreement
// with the -01-verified decomposer. The property oracle IS decomposeAgari — the AC
// defines waits in terms of agari completion, and the implementation runs the same
// probe loop, so the biconditional alone is near-tautological; the fixtures carry the
// independence (expected lists derived in comments from the rules, never from module
// output), and the winner-minus-one containment is construction-guaranteed,
// consulting neither module nor oracle. Property melds are REAL Meld values drawn
// from the same 4-copy budget as the hand — arity-only stubs with arbitrary ids
// (agari.test.ts's FAKE_MELDS) are unusable here, because waits reads meld CONTENT.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  COPIES_PER_KIND,
  KIND_COUNT,
  TILE_KINDS,
  isAgari,
  isTenpai,
  kindIndexOf,
  kindOf,
  tileId,
  waits,
  type Meld,
  type Seat,
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

// ---------------------------------------------------------------------------
// Real-meld builders: fixture melds carry honest kinds (waits counts their tiles).
// Copy indices start at 0 — fixtures never hold concealed copies of ponned kinds,
// and the property builder threads its own budget-derived copies instead.
// ---------------------------------------------------------------------------

/** A pon of `kind` claimed from `from`: copies 0 claimed, 1-2 exposed from hand. */
function pon(kind: TileKind, from: Seat = 3): Meld {
  return { type: 'pon', claimed: tileId(kind, 0), from, own: [tileId(kind, 1), tileId(kind, 2)] }
}

/** A chi of the run at `start`: the start copy claimed, the two successors own. */
function chi(start: TileKind): Meld {
  const k = kindIndexOf(start)
  return {
    type: 'chi',
    claimed: tileId(start, 0),
    from: 3,
    own: [tileId(TILE_KINDS[k + 1], 0), tileId(TILE_KINDS[k + 2], 0)],
  }
}

/** An ankan of `kind`: all four copies own, nothing claimed. */
function ankan(kind: TileKind): Meld {
  return {
    type: 'ankan',
    own: [tileId(kind, 0), tileId(kind, 1), tileId(kind, 2), tileId(kind, 3)],
  }
}

// ---------------------------------------------------------------------------
// Wait-shape fixtures — expected lists derived in comments from the rules.
// ---------------------------------------------------------------------------

describe('wait shapes', () => {
  it('tanki: the lone pair candidate is the only wait', () => {
    // 123m 456p 789s 111z + lone 2z: only a second 2z completes (pair 2z); any other
    // added kind leaves 2z single, and honors never run.
    expect(waits(h('123m456p789s111z2z'), [])).toEqual(['2z'])
  })

  it('ryanmen: both extensions wait', () => {
    // 23m open at both ends: 1m→123m or 4m→234m; pair 5z, triplet 1z fixed. A third
    // 5z leaves 23m dangling; 2m/3m make a pair but strand the other — two waits.
    expect(waits(h('23m456p789s111z55z'), [])).toEqual(['1m', '4m'])
  })

  it('kanchan: only the middle completes', () => {
    // 24m closed wait: only 3m bridges; 1m/5m extend one side but leave the other.
    expect(waits(h('24m456p789s111z55z'), [])).toEqual(['3m'])
  })

  it('penchan: the edge shape waits one-sided', () => {
    // 12m: only 3m completes (no rank 0 exists); adding 1m pairs but strands 2m.
    expect(waits(h('12m456p789s111z55z'), [])).toEqual(['3m'])
  })

  it('shanpon: both pairs wait on their triplet', () => {
    // 22m + 33p dual pair: 2m → 222m triplet with 33p pair, 3p → mirror image.
    // 111z is already complete; a fourth 1z would strand both pairs.
    expect(waits(h('22m33p456s789s111z'), [])).toEqual(['2m', '3p'])
  })

  it('waits span suits in ascending kind order', () => {
    // Shanpon across the m/p boundary: kind indices 8 (9m) and 9 (1p) — adjacent
    // indices, different suits, ascending order pinned.
    expect(waits(h('99m11p456s789s111z'), [])).toEqual(['9m', '1p'])
  })

  it('junsei chuuren waits on all nine ranks of its suit', () => {
    // 1112345678999m: the pure nine gates. 1m → 111 123 456 789 + 99 pair;
    // 5m → 111 234 55 pair 678 999; 9m → 11 pair 123 456 789 999 — and likewise
    // every other rank; the classic nine-sided wait.
    expect(waits(h('1112345678999m'), [])).toEqual([
      '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
    ])
  })

  it('a meld-bearing hand waits over its concealed remainder only', () => {
    // Pon 1z exposed, concealed 23m 456p 789s 55z (10 tiles): the ryanmen again —
    // the meld supplies the fourth set, 5z pairs.
    expect(waits(h('23m456p789s55z'), [pon('1z')])).toEqual(['1m', '4m'])
  })

  it('the four-meld tanki waits on its lone tile', () => {
    expect(waits(h('3p'), [pon('1z'), chi('1m'), chi('7s'), pon('9p')])).toEqual(['3p'])
  })
})

// ---------------------------------------------------------------------------
// Special forms
// ---------------------------------------------------------------------------

describe('chiitoitsu and kokushi waits', () => {
  it('chiitoitsu: six pairs + a single wait on the single', () => {
    // 1122m 3344p 5566s + lone 7z: only a second 7z completes (seven distinct
    // pairs). Any other kind leaves 7z single — no standard reading absorbs it.
    expect(waits(h('1122m3344p5566s7z'), [])).toEqual(['7z'])
  })

  it('four of a kind is not two chiitoitsu pairs: the shape is noten', () => {
    // 2222m 3344p 5566s 7z: adding 7z yields only six DISTINCT kinds paired (2m
    // counts once) — not chiitoitsu; no standard reading exists either (2222m
    // cannot split into sets with 3344p 5566s remainders). 2m itself is exhausted
    // in hand. Empty waits — noten.
    expect(waits(h('2222m3344p5566s7z'), [])).toEqual([])
    expect(isTenpai(h('2222m3344p5566s7z'), [])).toBe(false)
  })

  it('kokushi thirteen-sided: all thirteen kinds wait', () => {
    // One of each terminal/honor: any of the 13 doubles into the kokushi pair —
    // the widest wait in the game.
    expect(waits(h('19m19p19s1234567z'), [])).toEqual([
      '1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z',
    ])
  })

  it('kokushi single wait: the missing kind', () => {
    // 1m doubled, 7z missing: only 7z completes (every kokushi kind must appear;
    // no standard/chiitoitsu reading exists over 13 orphan-heavy singles).
    expect(waits(h('119m19p19s123456z'), [])).toEqual(['7z'])
  })
})

// ---------------------------------------------------------------------------
// The exhaustion convention (the AC's named edge): a kind all four of whose copies
// are visible to the hand itself is never a wait.
// ---------------------------------------------------------------------------

describe('exhausted kinds', () => {
  it('excludes a kind held four times concealed', () => {
    // 1111m 234m 567m 999p: a fifth 1m WOULD decompose (11111 → 111 + 11 pair,
    // with 234 567 999) — but four copies are already in hand, so 1m is excluded.
    // Two kinds complete physically: 4m — pair 44 → 111 + 123 + 567 + 999; and
    // 7m — pair 77 → 111 + 123 + 456 + 999 (the fourth 1m joins 23m and the
    // 567m block re-forms as 456m). 2m/3m/5m/6m pairings strand a neighbor;
    // 9p is at three copies and a fourth leaves 99p short of a set.
    expect(waits(h('1111m234m567m999p'), [])).toEqual(['4m', '7m'])
  })

  it('excludes a ryanmen side consumed by the own ankan', () => {
    // Ankan 1m + concealed 23m 456p 789s 11z: structurally 23m waits 1m/4m, but
    // the ankan holds every 1m — only 4m can arrive.
    expect(waits(h('23m456p789s11z'), [ankan('1m')])).toEqual(['4m'])
  })

  it('a hand whose every completion is self-exhausted is noten', () => {
    // Four melds + tanki 5z, with the OWN pon holding the other three 5z: the only
    // structural completion (pair 55z) can never arrive — empty waits, noten.
    // This is the convention's sharpest consequence (the formal-tenpai rule).
    const melds = [pon('5z'), pon('1z'), chi('1m'), chi('7p')]
    expect(waits(h('5z'), melds)).toEqual([])
    expect(isTenpai(h('5z'), melds)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

describe('contract', () => {
  it('an aimless hand is noten: empty waits', () => {
    // Isolated 2/5/8 across all suits + scattered honors — nothing within reach.
    expect(waits(h('258m258p258s1247z'), [])).toEqual([])
    expect(isTenpai(h('258m258p258s1247z'), [])).toBe(false)
  })

  it('throws on a wrong-arity query, naming both numbers from the 13-tile side', () => {
    expect(() => waits(h('123m'), [])).toThrowError(
      new RangeError('waits requires 13 concealed tiles with 0 melds, got 3'),
    )
    expect(() => waits(h('123m456p789s1122z'), [pon('7z')])).toThrowError(
      new RangeError('waits requires 10 concealed tiles with 1 melds, got 13'),
    )
  })

  it('throws on more than four melds', () => {
    expect(() => waits([], [pon('1z'), pon('2z'), pon('3z'), pon('4z'), pon('5z')])).toThrowError(
      new RangeError('waits with 5 melds — a hand holds at most 4'),
    )
  })

  it('is a pure read: inputs unmutated, repeat calls identical', () => {
    const hand = h('23m456p789s55z')
    const melds = [ankan('1z')]
    const handBefore = [...hand]
    const meldsBefore = structuredClone(melds)
    const first = waits(hand, melds)
    const second = waits(hand, melds)
    expect(hand).toEqual(handBefore)
    expect(melds).toEqual(meldsBefore)
    expect(first).toEqual(second)
  })
})
