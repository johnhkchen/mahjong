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

// ---------------------------------------------------------------------------
// Properties: constructed winners with CONTENT-HONEST melds (one shared 4-copy
// budget across concealed sets and meld tiles), winner-minus-one tenpai hands, and
// random multiset draws. The 34-kind biconditional restates the module's definition
// (visible < 4 ∧ completes agari) with test-local counting — near-tautological on
// purpose; independence lives in the fixtures above and in the construction-
// guaranteed containment, which consults neither module nor oracle.
// ---------------------------------------------------------------------------

/** Every legal 3-tile set as kind indices: 34 triplets, then 21 runs. */
const SET_CANDIDATES: readonly (readonly number[])[] = [
  ...Array.from({ length: KIND_COUNT }, (_, k) => [k, k, k]),
  ...Array.from({ length: 27 }, (_, k) => k)
    .filter((k) => k % 9 <= 6)
    .map((k) => [k, k + 1, k + 2]),
]

/** All kind indices, the filter base for budgeted choices. */
const ALL_KINDS: readonly number[] = Array.from({ length: KIND_COUNT }, (_, k) => k)

/** tileId at the next unconsumed copy of a kind — ids stay distinct per budget. */
function nextCopyId(counts: number[], k: number): number {
  return tileId(TILE_KINDS[k], counts[k] as 0 | 1 | 2 | 3)
}

/**
 * Deterministic winner construction with REAL melds: slots 0..3 are melds for
 * s < meldCount (form pon/chi/ankan by formChoices, target by setChoices, both
 * mod the still-legal candidates — no rejection loops; ≤ 9 kinds are touched
 * before any slot, so a legal pon/ankan kind and an unblocked chi start always
 * remain) and concealed sets after (the agari.test.ts buildWinner pattern), then
 * the pair. Meld tile ids consume running copy indices from the shared budget.
 */
function buildTenpaiParts(
  meldCount: number,
  formChoices: readonly number[],
  setChoices: readonly number[],
  pairChoice: number,
): { concealed14: TileKind[]; melds: Meld[] } {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  const melds: Meld[] = []
  const hand: TileKind[] = []
  for (let s = 0; s < 4; s += 1) {
    if (s < meldCount) {
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
        melds.push({ type: 'pon', claimed, from: 3, own })
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
        melds.push({ type: 'chi', claimed, from: 3, own })
      } else {
        const legal = ALL_KINDS.filter((k) => counts[k] === 0)
        const k = legal[setChoices[s] % legal.length]
        melds.push({
          type: 'ankan',
          own: [tileId(TILE_KINDS[k], 0), tileId(TILE_KINDS[k], 1), tileId(TILE_KINDS[k], 2), tileId(TILE_KINDS[k], 3)],
        })
        counts[k] = COPIES_PER_KIND
      }
    } else {
      const legal = SET_CANDIDATES.filter((tiles) =>
        tiles.every((k) => counts[k] + tiles.filter((x) => x === k).length <= COPIES_PER_KIND),
      )
      const picked = legal[setChoices[s] % legal.length]
      for (const k of picked) {
        counts[k] += 1
        hand.push(TILE_KINDS[k])
      }
    }
  }
  const pairable = ALL_KINDS.filter((k) => counts[k] + 2 <= COPIES_PER_KIND)
  const pairKind = pairable[pairChoice % pairable.length]
  hand.push(TILE_KINDS[pairKind], TILE_KINDS[pairKind])
  return { concealed14: hand, melds }
}

/** Test-local visible counting — the convention's definition, stated inline. */
function visibleOf(hand: readonly TileKind[], melds: readonly Meld[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const kind of hand) counts[kindIndexOf(kind)] += 1
  for (const meld of melds) {
    for (const tile of meld.own) counts[kindIndexOf(kindOf(tile))] += 1
    if (meld.type !== 'ankan') counts[kindIndexOf(kindOf(meld.claimed))] += 1
  }
  return counts
}

const partsArb = fc
  .record({
    meldCount: fc.integer({ min: 0, max: 4 }),
    formChoices: fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 }),
    setChoices: fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 }),
    pairChoice: fc.nat(10_000),
  })
  .map(({ meldCount, formChoices, setChoices, pairChoice }) => ({
    meldCount,
    ...buildTenpaiParts(meldCount, formChoices, setChoices, pairChoice),
  }))

/** A winner minus one concealed tile: tenpai by construction, `removed` a known wait. */
const minusOneArb = fc.record({ parts: partsArb, at: fc.nat(13) }).map(({ parts, at }) => {
  const hand13 = [...parts.concealed14]
  const removed = hand13.splice(at % hand13.length, 1)[0]
  return { hand13, melds: parts.melds, removed }
})

/** The 136-tile multiset as kinds — the draw pool for random 13-tile hands. */
const POOL: readonly TileKind[] = TILE_KINDS.flatMap((kind) => [kind, kind, kind, kind])

const randomHandArb = fc.shuffledSubarray([...POOL], { minLength: 13, maxLength: 13 })

/** The definition, checked both directions over all 34 kinds. */
function expectBiconditional(hand: readonly TileKind[], melds: readonly Meld[]): TileKind[] {
  const result = waits(hand, melds)
  const inWaits = new Set(result)
  const visible = visibleOf(hand, melds)
  for (let k = 0; k < KIND_COUNT; k += 1) {
    const completes =
      visible[k] < COPIES_PER_KIND && isAgari([...hand, TILE_KINDS[k]], melds)
    expect(inWaits.has(TILE_KINDS[k]), `kind ${TILE_KINDS[k]}`).toBe(completes)
  }
  return result
}

describe('waits properties', () => {
  it('constructed winners respect the wall and win (generator self-test)', () => {
    fc.assert(
      fc.property(partsArb, ({ meldCount, concealed14, melds }) => {
        expect(concealed14.length).toBe(14 - 3 * meldCount)
        expect(melds.length).toBe(meldCount)
        expect(Math.max(...visibleOf(concealed14, melds))).toBeLessThanOrEqual(COPIES_PER_KIND)
        expect(isAgari(concealed14, melds)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('a winner minus one tile waits on the removed kind, and exactly the defined set', () => {
    fc.assert(
      fc.property(minusOneArb, ({ hand13, melds, removed }) => {
        const result = expectBiconditional(hand13, melds)
        // Construction-guaranteed, oracle-free: the budget capped the removed
        // kind at 4 visible copies INCLUDING the removed one, so after removal
        // it is under 4 and its re-add is a known win — it must be waited on.
        expect(result).toContain(removed)
        // The contract order: ascending TILE_KINDS, strictly.
        const indices = result.map(kindIndexOf)
        expect(indices).toEqual([...indices].sort((x, y) => x - y))
        expect(new Set(indices).size).toBe(indices.length)
      }),
      { numRuns: 300 },
    )
  })

  it('random 13-tile draws match the definition; noten means empty waits', () => {
    fc.assert(
      fc.property(randomHandArb, (hand) => {
        const result = expectBiconditional(hand, [])
        expect(isTenpai(hand, [])).toBe(result.length > 0)
      }),
      { numRuns: 300 },
    )
  })
})
