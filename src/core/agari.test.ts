// The agari decomposer's suite: deterministic fixtures with hand-derived expected
// lists, plus property agreement with a BRUTE-FORCE REFERENCE that is structurally
// different from the shipped algorithm — positional search over sorted tiles with
// dedup-after, vs the counts backtracker's unique-by-construction enumeration — so
// agreement is evidence, not tautology. The reference is test-local and never ships
// (core is "big in tests" by design). Fixture expected values are derived in comments
// from the rules, never from module output.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  COPIES_PER_KIND,
  KIND_COUNT,
  TILE_KINDS,
  decomposeAgari,
  isAgari,
  kindIndexOf,
  type AgariDecomposition,
  type Meld,
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

/**
 * Hand-built melds for arity: decomposeAgari reads only `.length` (design D2), so
 * the tile ids here are arbitrary — one of each call shape to keep the type honest.
 */
const FAKE_MELDS: readonly Meld[] = [
  { type: 'pon', claimed: 0, from: 1, own: [1, 2] },
  { type: 'chi', claimed: 36, from: 3, own: [40, 44] },
  { type: 'ankan', own: [72, 73, 74, 75] },
  { type: 'shouminkan', claimed: 100, from: 2, own: [101, 102, 103] },
]

function melds(count: number): readonly Meld[] {
  return FAKE_MELDS.slice(0, count)
}

// ---------------------------------------------------------------------------
// Normalization: both the module's output and the reference's partitions map to
// canonical string keys, so whole decomposition SETS can be compared exactly.
// ---------------------------------------------------------------------------

/** Canonical token for one set: type letter + zero-padded kind index. */
function setToken(type: 'run' | 'triplet', kindIndex: number): string {
  return `${type === 'run' ? 'r' : 't'}${String(kindIndex).padStart(2, '0')}`
}

function standardKey(pairIndex: number, tokens: readonly string[]): string {
  return `p${String(pairIndex).padStart(2, '0')}|${[...tokens].sort().join(',')}`
}

/** The module-side key of any decomposition form. */
function keyOf(decomposition: AgariDecomposition): string {
  switch (decomposition.form) {
    case 'standard':
      return standardKey(
        kindIndexOf(decomposition.pair),
        decomposition.sets.map((set) =>
          set.type === 'run'
            ? setToken('run', kindIndexOf(set.start))
            : setToken('triplet', kindIndexOf(set.kind)),
        ),
      )
    case 'chiitoitsu':
      return `c|${decomposition.pairs.map((kind) => kindIndexOf(kind)).join(',')}`
    case 'kokushi':
      return `k${kindIndexOf(decomposition.pair)}`
  }
}

// ---------------------------------------------------------------------------
// The brute-force reference: positional exhaustive search. Sort the kind indices,
// choose the pair as any two equal-kind POSITIONS, then repeatedly bind the first
// remaining position with every later pair of positions completing a triplet or a
// run; collect complete partitions as keys, deduped by the Set. Written from the
// rules (a run is three consecutive ranks in one numbered suit; a triplet three of
// a kind), independently of the shipped counts backtracker.
// ---------------------------------------------------------------------------

/** Set shape of a sorted kind-index triple, or null. Suits are 9-index blocks. */
function refSetOf(a: number, b: number, c: number): string | null {
  if (a === b && b === c) return setToken('triplet', a)
  const numbered = a < 27
  const sameSuit = Math.floor(a / 9) === Math.floor(c / 9)
  if (numbered && sameSuit && b === a + 1 && c === a + 2) return setToken('run', a)
  return null
}

/** Emit the sorted set tokens of every partition of `tiles` into 3-tile sets. */
function refPartitions(tiles: readonly number[], acc: string[], emit: (tokens: string[]) => void): void {
  if (tiles.length === 0) {
    emit([...acc])
    return
  }
  const [first, ...rest] = tiles
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      const token = refSetOf(first, rest[i], rest[j])
      if (token === null) continue
      acc.push(token)
      refPartitions(
        rest.filter((_, at) => at !== i && at !== j),
        acc,
        emit,
      )
      acc.pop()
    }
  }
}

/** All standard-form decomposition keys of the concealed kinds, deduped. */
function referenceStandardKeys(kinds: readonly TileKind[]): Set<string> {
  const sorted = kinds.map(kindIndexOf).sort((x, y) => x - y)
  const keys = new Set<string>()
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[i] !== sorted[j]) continue
      refPartitions(
        sorted.filter((_, at) => at !== i && at !== j),
        [],
        (tokens) => keys.add(standardKey(sorted[i], tokens)),
      )
    }
  }
  return keys
}

/** First-principles chiitoitsu scan: seven distinct kinds, each exactly twice. */
function referenceChiitoitsuKey(kinds: readonly TileKind[]): string | null {
  if (kinds.length !== 14) return null
  const distinct = [...new Set(kinds)]
  if (distinct.length !== 7) return null
  if (!distinct.every((kind) => kinds.filter((k) => k === kind).length === 2)) return null
  return `c|${distinct
    .map((kind) => kindIndexOf(kind))
    .sort((x, y) => x - y)
    .join(',')}`
}

const KOKUSHI_KINDS: readonly TileKind[] = [
  '1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z',
]

/** First-principles kokushi scan: all 13 terminal/honor kinds, one duplicated. */
function referenceKokushiKey(kinds: readonly TileKind[]): string | null {
  if (kinds.length !== 14) return null
  if (!kinds.every((kind) => KOKUSHI_KINDS.includes(kind))) return null
  if (!KOKUSHI_KINDS.every((kind) => kinds.includes(kind))) return null
  const doubled = KOKUSHI_KINDS.find((kind) => kinds.filter((k) => k === kind).length === 2)
  return doubled === undefined ? null : `k${kindIndexOf(doubled)}`
}

/** Every decomposition key the reference finds for the query, across all forms. */
function referenceKeys(kinds: readonly TileKind[], meldCount: number): Set<string> {
  const keys = referenceStandardKeys(kinds)
  if (meldCount === 0) {
    const chiitoitsu = referenceChiitoitsuKey(kinds)
    if (chiitoitsu !== null) keys.add(chiitoitsu)
    const kokushi = referenceKokushiKey(kinds)
    if (kokushi !== null) keys.add(kokushi)
  }
  return keys
}

/** The full agreement assertion: module keys unique and set-equal to reference. */
function expectAgreement(kinds: readonly TileKind[], meldCount: number): AgariDecomposition[] {
  const result = decomposeAgari(kinds, melds(meldCount))
  const keys = result.map(keyOf)
  expect(new Set(keys).size, 'duplicate decompositions in module output').toBe(keys.length)
  expect(new Set(keys)).toEqual(referenceKeys(kinds, meldCount))
  return result
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

describe('standard form fixtures', () => {
  it('decomposes the plain one-reading hand', () => {
    // 123m 456p 789s 111z 22z: three runs + honor triplet + pair, nothing else —
    // no alternative grouping exists (honors cannot run, no rank overlaps).
    expect(decomposeAgari(h('123m456p789s111z22z'), [])).toEqual([
      {
        form: 'standard',
        pair: '2z',
        sets: [
          { type: 'run', start: '1m' },
          { type: 'run', start: '4p' },
          { type: 'run', start: '7s' },
          { type: 'triplet', kind: '1z' },
        ],
      },
    ])
  })

  it('emits every reading of the 111222333 shape, triplets branch first', () => {
    // 111222333m = {111,222,333} or {123,123,123}; pair 7z is forced, 456s fixed.
    // Documented order: at kind 1m the triplet branch precedes the run branch.
    expect(decomposeAgari(h('111222333m456s77z'), [])).toEqual([
      {
        form: 'standard',
        pair: '7z',
        sets: [
          { type: 'triplet', kind: '1m' },
          { type: 'triplet', kind: '2m' },
          { type: 'triplet', kind: '3m' },
          { type: 'run', start: '4s' },
        ],
      },
      {
        form: 'standard',
        pair: '7z',
        sets: [
          { type: 'run', start: '1m' },
          { type: 'run', start: '1m' },
          { type: 'run', start: '1m' },
          { type: 'run', start: '4s' },
        ],
      },
    ])
  })

  it('orders multiple pair choices ascending (the contract order)', () => {
    // 11223344m: pair 1m leaves 234m+234m, pair 4m leaves 123m+123m; pairs 2m/3m
    // strand non-consecutive rests. 567p and 999s ride along in both readings.
    expect(decomposeAgari(h('11223344m567p999s'), [])).toEqual([
      {
        form: 'standard',
        pair: '1m',
        sets: [
          { type: 'run', start: '2m' },
          { type: 'run', start: '2m' },
          { type: 'run', start: '5p' },
          { type: 'triplet', kind: '9s' },
        ],
      },
      {
        form: 'standard',
        pair: '4m',
        sets: [
          { type: 'run', start: '1m' },
          { type: 'run', start: '1m' },
          { type: 'run', start: '5p' },
          { type: 'triplet', kind: '9s' },
        ],
      },
    ])
  })

  it('never runs across a suit boundary', () => {
    // 8m 9m 1p are contiguous KIND INDICES (8, 9, 10) but not a run; nothing else
    // completes 8m9m or the lone 1p, so the hand has no reading at all.
    expect(decomposeAgari(h('89m1p234p567s111z22z'), [])).toEqual([])
  })

  it('never runs honors', () => {
    // 1z 2z 3z are consecutive kind indices but honors have no rank; with the pair
    // on 4m every reading needs a set from the three distinct honors — impossible.
    expect(decomposeAgari(h('111222333m44m1z2z3z'), [])).toEqual([])
  })

  it('decomposes with melds: the concealed remainder shrinks by 3 per meld', () => {
    // One meld → 11 concealed tiles arranged as 3 sets + pair.
    expect(decomposeAgari(h('123m456p789s11z'), melds(1))).toEqual([
      {
        form: 'standard',
        pair: '1z',
        sets: [
          { type: 'run', start: '1m' },
          { type: 'run', start: '4p' },
          { type: 'run', start: '7s' },
        ],
      },
    ])
  })

  it('handles the four-meld pair-only edge', () => {
    expect(decomposeAgari(h('55z'), melds(4))).toEqual([
      { form: 'standard', pair: '5z', sets: [] },
    ])
  })
})

describe('chiitoitsu fixtures', () => {
  it('accepts seven distinct pairs, ascending', () => {
    expect(decomposeAgari(h('1122m3344p5566s77z'), [])).toEqual([
      { form: 'chiitoitsu', pairs: ['1m', '2m', '3p', '4p', '5s', '6s', '7z'] },
    ])
  })

  it('refuses four of a kind as two pairs', () => {
    // 1111m + five pairs: only six DISTINCT kinds — not chiitoitsu, and no standard
    // reading exists either (1111m cannot form a set with 2m absent past 22m).
    expect(decomposeAgari(h('1111m22m33p44p55s66s'), [])).toEqual([])
  })

  it('refuses six pairs plus a non-pair remainder', () => {
    // Six pairs + the singles 6z and 7z: eight distinct kinds, and no standard
    // reading can absorb two lone honors — no form at all.
    expect(decomposeAgari(h('1122m3344p5566s6z7z'), [])).toEqual([])
  })
})

describe('kokushi fixtures', () => {
  it('accepts each of the thirteen possible duplicates', () => {
    // The thirteen-wait family: one of each terminal/honor kind plus one duplicate.
    for (const doubled of KOKUSHI_KINDS) {
      const kinds = [...KOKUSHI_KINDS, doubled]
      expect(decomposeAgari(kinds, [])).toEqual([{ form: 'kokushi', pair: doubled }])
    }
  })

  it('refuses a near miss: a missing kind is not covered by a second duplicate', () => {
    // 7z missing, 1m tripled — every kokushi kind must be present.
    expect(decomposeAgari(h('111m9m1p9p1s9s1z2z3z4z5z6z'), [])).toEqual([])
  })

  it('refuses a simple tile in the fourteen', () => {
    expect(decomposeAgari([...KOKUSHI_KINDS, '5m'], [])).toEqual([])
  })
})

describe('overlap and result order', () => {
  it('reports ryanpeikou shapes as standard AND chiitoitsu, standard first', () => {
    expect(decomposeAgari(h('223344m556677p88s'), [])).toEqual([
      {
        form: 'standard',
        pair: '8s',
        sets: [
          { type: 'run', start: '2m' },
          { type: 'run', start: '2m' },
          { type: 'run', start: '5p' },
          { type: 'run', start: '5p' },
        ],
      },
      { form: 'chiitoitsu', pairs: ['2m', '3m', '4m', '5p', '6p', '7p', '8s'] },
    ])
  })
})

describe('contract', () => {
  it('throws on a wrong-arity query, naming both numbers', () => {
    expect(() => decomposeAgari(h('123m456p789s11z'), [])).toThrowError(
      new RangeError('decomposeAgari requires 14 concealed tiles with 0 melds, got 11'),
    )
    expect(() => decomposeAgari(h('123m456p789s11122z'), melds(1))).toThrowError(
      new RangeError('decomposeAgari requires 11 concealed tiles with 1 melds, got 14'),
    )
  })

  it('throws on more than four melds', () => {
    expect(() => decomposeAgari([], [...FAKE_MELDS, FAKE_MELDS[0]])).toThrowError(
      new RangeError('decomposeAgari with 5 melds — a hand holds at most 4'),
    )
  })

  it('is a pure read: inputs unmutated, repeat calls identical', () => {
    const kinds = h('111222333m456s77z')
    const before = [...kinds]
    const first = decomposeAgari(kinds, [])
    const second = decomposeAgari(kinds, [])
    expect(kinds).toEqual(before)
    expect(first).toEqual(second)
  })

  it('isAgari is the emptiness read of decomposeAgari', () => {
    expect(isAgari(h('123m456p789s111z22z'), [])).toBe(true)
    expect(isAgari(h('89m1p234p567s111z22z'), [])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Property agreement with the reference over randomized hands, meld arity 0–4.
// Two distributions: CONSTRUCTED winners (dense positives — random hands almost
// never win, so the positive side needs building) and random multiset draws
// (dense negatives with the occasional accidental win). Plus one-tile
// perturbations of winners for near-miss negatives.
// ---------------------------------------------------------------------------

/** Every legal 3-tile set as kind indices: 34 triplets, then 21 runs. */
const SET_CANDIDATES: readonly (readonly number[])[] = [
  ...Array.from({ length: KIND_COUNT }, (_, k) => [k, k, k]),
  ...Array.from({ length: 27 }, (_, k) => k)
    .filter((k) => k % 9 <= 6)
    .map((k) => [k, k+ 1, k + 2]),
]

/**
 * Deterministic winner construction: each choice indexes (mod) the candidates
 * still legal under the 4-copy cap, so no rejection loop is needed — a triplet of
 * some untouched kind is always available (at most 12 tiles touch at most 12 of
 * the 34 kinds). The pair choice indexes kinds with 2+ copies of headroom.
 */
function buildWinner(meldCount: number, setChoices: readonly number[], pairChoice: number): TileKind[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  const hand: TileKind[] = []
  for (let s = 0; s < 4 - meldCount; s++) {
    const legal = SET_CANDIDATES.filter((tiles) =>
      tiles.every((k) => counts[k] + tiles.filter((x) => x === k).length <= COPIES_PER_KIND),
    )
    const picked = legal[setChoices[s] % legal.length]
    for (const k of picked) {
      counts[k] += 1
      hand.push(TILE_KINDS[k])
    }
  }
  const pairable = Array.from({ length: KIND_COUNT }, (_, k) => k).filter(
    (k) => counts[k] + 2 <= COPIES_PER_KIND,
  )
  const pairKind = pairable[pairChoice % pairable.length]
  hand.push(TILE_KINDS[pairKind], TILE_KINDS[pairKind])
  return hand
}

const meldCountArb = fc.integer({ min: 0, max: 4 })

const winnerArb = fc
  .record({
    meldCount: meldCountArb,
    setChoices: fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 }),
    pairChoice: fc.nat(10_000),
  })
  .map(({ meldCount, setChoices, pairChoice }) => ({
    meldCount,
    hand: buildWinner(meldCount, setChoices, pairChoice),
  }))

/** The 136-tile multiset as kinds — the draw pool for random hands. */
const POOL: readonly TileKind[] = TILE_KINDS.flatMap((kind) => [kind, kind, kind, kind])

const randomHandArb = meldCountArb.chain((meldCount) =>
  fc.record({
    meldCount: fc.constant(meldCount),
    hand: fc.shuffledSubarray([...POOL], {
      minLength: 14 - 3 * meldCount,
      maxLength: 14 - 3 * meldCount,
    }),
  }),
)

/** A winner with one tile swapped for any kind with copy headroom — near misses. */
const perturbedArb = fc
  .record({ winner: winnerArb, at: fc.nat(13), replaceWith: fc.nat(10_000) })
  .map(({ winner, at, replaceWith }) => {
    const hand = [...winner.hand]
    const dropped = hand.splice(at % hand.length, 1)[0]
    const counts = new Array<number>(KIND_COUNT).fill(0)
    for (const kind of hand) counts[kindIndexOf(kind)] += 1
    const kinds = Array.from({ length: KIND_COUNT }, (_, k) => k).filter(
      (k) => counts[k] < COPIES_PER_KIND,
    )
    hand.push(TILE_KINDS[kinds[replaceWith % kinds.length]])
    return { meldCount: winner.meldCount, hand, dropped }
  })

/** Kind counts of a hand — the re-expansion comparison basis. */
function countsOfHand(kinds: readonly TileKind[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const kind of kinds) counts[kindIndexOf(kind)] += 1
  return counts
}

/** Re-expand a standard reading to kind counts: the pair plus every set's tiles. */
function expandStandard(decomposition: Extract<AgariDecomposition, { form: 'standard' }>): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  counts[kindIndexOf(decomposition.pair)] += 2
  for (const set of decomposition.sets) {
    if (set.type === 'triplet') {
      counts[kindIndexOf(set.kind)] += 3
    } else {
      const start = kindIndexOf(set.start)
      counts[start] += 1
      counts[start + 1] += 1
      counts[start + 2] += 1
    }
  }
  return counts
}

describe('agreement with the brute-force reference', () => {
  it('constructed winners respect the wall (generator self-test)', () => {
    fc.assert(
      fc.property(winnerArb, ({ meldCount, hand }) => {
        expect(hand.length).toBe(14 - 3 * meldCount)
        expect(Math.max(...countsOfHand(hand))).toBeLessThanOrEqual(COPIES_PER_KIND)
      }),
      { numRuns: 200 },
    )
  })

  it('finds every reading of a constructed winner, and only those', () => {
    fc.assert(
      fc.property(winnerArb, ({ meldCount, hand }) => {
        const result = expectAgreement(hand, meldCount)
        // Anti-vacuity: winners are winners — the construction guarantees a
        // standard reading, so empty agreement can never silently pass here.
        expect(result.length).toBeGreaterThan(0)
        // Every standard reading re-expands to exactly the queried tiles.
        const counts = countsOfHand(hand)
        for (const decomposition of result) {
          if (decomposition.form === 'standard') {
            expect(expandStandard(decomposition)).toEqual(counts)
          }
        }
      }),
      { numRuns: 300 }, // the positive-dense side of the AC's property suite
    )
  })

  it('agrees on random multiset draws (negative-dense)', () => {
    fc.assert(
      fc.property(randomHandArb, ({ meldCount, hand }) => {
        const result = expectAgreement(hand, meldCount)
        // Special forms demand full concealment: never reported alongside melds.
        if (meldCount > 0) {
          expect(result.every((decomposition) => decomposition.form === 'standard')).toBe(true)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('agrees on one-tile perturbations of winners (near misses)', () => {
    fc.assert(
      fc.property(perturbedArb, ({ meldCount, hand }) => {
        expectAgreement(hand, meldCount)
      }),
      { numRuns: 200 },
    )
  })
})
