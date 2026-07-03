// The shanten property crown (T-006-02-03): agreement with a BRUTE-FORCE REFERENCE
// that is structurally different from the shipped algorithm — the module maximizes a
// block count over decompositions of the tiles the hand HOLDS (cap-and-head
// backtracker); the reference enumerates the winning hands the query could BECOME and
// reads the definition directly:
//
//   refShanten(H) = min over winning multisets W of Σ_k max(0, W[k] − H[k]) − 1
//
// A hand missing `n` tiles of some W reaches tenpai in n − 1 exchanges (draw all but
// one missing tile, discarding non-W tiles — arities balance at 13−3m and 14−3m
// alike), and no shorter path exists because one exchange adds at most one tile of any
// W; −1 for complete hands and 0 at tenpai fall out of the same formula, so both
// module arities share one reference. W is UNCAPPED per kind — the module's frozen
// KIND-level shape convention (shanten.ts header: a completion may need a fifth copy;
// see the exhaustion-boundary fixtures below), and repetition of set shapes is allowed
// freely since min(H, W) never rewards the excess. The reference consults no module
// algorithm — not isAgari, not countsOf; only tile vocabulary. Agreement is evidence,
// not tautology (the agari.test.ts standard).
//
// Second AC clause — shanten 0 vs the enumerated waits: the raw biconditional
// `shanten === 0 ⟺ isTenpai` is FALSE under the two modules' frozen conventions
// (shanten is shape distance, waits excludes self-exhausted kinds), so it is pinned as
// three statements: soundness (isTenpai ⟹ shanten 0, unconstrained), completeness on
// exhaustion-free samples (the AC's "constrained samples" — the full ⟺ there), and
// the explanation property (every divergence is exactly a self-exhausted structural
// wait). This file is the reconciliation shanten.ts:8–11 promises.

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
  shanten,
  tileId,
  waits,
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
 * Arity stubs with arbitrary ids (the agari.test.ts pattern) — honest wherever only
 * shanten and refShanten read them (both are arity-only). The waits-clause properties
 * build REAL melds instead: waits reads meld content.
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

/** Kind counts of a hand — the reference's working representation. */
function countsOfHand(kinds: readonly TileKind[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const kind of kinds) counts[kindIndexOf(kind)] += 1
  return counts
}

/** Test-local visible counting: concealed + meld content (the waits convention). */
function visibleOf(hand: readonly TileKind[], meldList: readonly Meld[]): number[] {
  const counts = countsOfHand(hand)
  for (const meld of meldList) {
    for (const tile of meld.own) counts[kindIndexOf(kindOf(tile))] += 1
    if (meld.type !== 'ankan') counts[kindIndexOf(kindOf(meld.claimed))] += 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// The brute-force reference. Pure functions over count arrays; the only search
// smarts permitted are one sound branch prune (a bound too simple to be wrong)
// and a gain-2 early exit in the pair scan (2 is the ceiling of a pair's gain).
// ---------------------------------------------------------------------------

/** Every legal 3-tile set as kind indices: 34 triplets, then 21 runs. */
const SET_CANDIDATES: readonly (readonly number[])[] = [
  ...Array.from({ length: KIND_COUNT }, (_, k) => [k, k, k]),
  ...Array.from({ length: 27 }, (_, k) => k)
    .filter((k) => k % 9 <= 6)
    .map((k) => [k, k + 1, k + 2]),
]

/**
 * Max overlap Σ min(hand, W) over standard W: `setsLeft` more sets chosen from
 * SET_CANDIDATES in non-decreasing index order (multiset enumeration, no dedup
 * needed) plus a pair. Overlap accrues incrementally: one added copy of kind k
 * gains 1 iff W held fewer copies than the hand. The pair scan runs over `present`
 * (kinds the hand holds — an absent-kind pair gains 0, so nothing is lost) and
 * exits at gain 2, the pair ceiling. The one prune: a branch is abandoned when even
 * 3 per remaining set + 2 for the pair cannot beat `best` — an overcount, so it
 * never prunes an optimum.
 */
function refStandardBest(
  hand: readonly number[],
  present: readonly number[],
  w: number[],
  overlap: number,
  fromSet: number,
  setsLeft: number,
  best: number,
): number {
  if (overlap + 3 * setsLeft + 2 <= best) return best
  if (setsLeft === 0) {
    let bestGain = 0
    for (const p of present) {
      const gain = Math.min(hand[p], w[p] + 2) - Math.min(hand[p], w[p])
      if (gain > bestGain) bestGain = gain
      if (bestGain === 2) break
    }
    return Math.max(best, overlap + bestGain)
  }
  for (let si = fromSet; si < SET_CANDIDATES.length; si += 1) {
    const set = SET_CANDIDATES[si]
    let gained = 0
    for (const k of set) {
      if (w[k] < hand[k]) gained += 1
      w[k] += 1
    }
    best = refStandardBest(hand, present, w, overlap + gained, si, setsLeft - 1, best)
    for (const k of set) w[k] -= 1
  }
  return best
}

/**
 * Max chiitoitsu overlap: W is 7 DISTINCT kinds × 2, so overlap is Σ min(hand, 2)
 * over the chosen kinds. Kinds absent from the hand contribute 0 and are
 * interchangeable, so exhaustively walking subsets (size ≤ 7) of the present kinds
 * covers every W — dumb and exact, no greedy argument to trust.
 */
function refChiitoiBest(hand: readonly number[]): number {
  const present: number[] = []
  for (let k = 0; k < KIND_COUNT; k += 1) if (hand[k] >= 1) present.push(k)
  let best = 0
  const walk = (idx: number, chosen: number, overlap: number): void => {
    if (overlap > best) best = overlap
    if (chosen === 7 || idx === present.length) return
    walk(idx + 1, chosen + 1, overlap + Math.min(hand[present[idx]], 2))
    walk(idx + 1, chosen, overlap)
  }
  walk(0, 0, 0)
  return best
}

/** The 13 orphan kind indices: terminals of each numbered suit, then every honor. */
const ORPHAN_INDEXES: readonly number[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

/**
 * Max kokushi overlap: W is each orphan kind once plus one duplicated — 13 candidate
 * W total, one per pair choice. Base Σ min(hand, 1) plus the pair kind's second-copy
 * gain.
 */
function refKokushiBest(hand: readonly number[]): number {
  let base = 0
  for (const k of ORPHAN_INDEXES) base += Math.min(hand[k], 1)
  let best = 0
  for (const p of ORPHAN_INDEXES) {
    const gain = Math.min(hand[p], 2) - Math.min(hand[p], 1)
    if (base + gain > best) best = base + gain
  }
  return best
}

/**
 * The reference's face: (14 − 3·melds) − bestOverlap − 1, the definitional formula
 * from the header. Arity-blind (H's size never appears), so 13−3m and 14−3m queries
 * share it. Special forms are zero-meld by rule — gated here on the COUNT, stated
 * independently of the module's own gate.
 */
function refShanten(hand: readonly TileKind[], meldCount: number): number {
  const counts = countsOfHand(hand)
  const present: number[] = []
  for (let k = 0; k < KIND_COUNT; k += 1) if (counts[k] >= 1) present.push(k)
  let best = refStandardBest(
    counts,
    present,
    new Array<number>(KIND_COUNT).fill(0),
    0,
    0,
    4 - meldCount,
    0,
  )
  if (meldCount === 0) {
    best = Math.max(best, refChiitoiBest(counts), refKokushiBest(counts))
  }
  return 14 - 3 * meldCount - best - 1
}

/** The reference's win predicate — used to enumerate STRUCTURAL waits. */
function refIsWin(hand: readonly TileKind[], meldCount: number): boolean {
  return refShanten(hand, meldCount) === -1
}

// ---------------------------------------------------------------------------
// Reference self-test: refShanten against hands whose values are rule-derived in
// shanten.test.ts's fixture comments (block decompositions argued there; the
// W-side derivation restated here). Never against module output.
// ---------------------------------------------------------------------------

describe('reference self-test — hand-derived values', () => {
  it('reads complete hands as −1 across forms and meld counts', () => {
    // W = the hand itself: overlap 14 (or 14 − 3m) → missing 0 → −1.
    expect(refShanten(h('123m456p789s111z22z'), 0)).toBe(-1)
    expect(refShanten(h('55z'), 4)).toBe(-1)
    expect(refShanten(h('1122m3344p5566s77z'), 0)).toBe(-1) // chiitoitsu
    expect(refShanten(h('119m19p19s1234567z'), 0)).toBe(-1) // kokushi
  })

  it('reads tenpai hands as 0', () => {
    // Ryanmen: W = 123m 456p 789s 111z 55z misses only 1m → overlap 13.
    expect(refShanten(h('23m456p789s111z55z'), 0)).toBe(0)
    // Tanki: W = 123m 456p 789s 111z 22z misses one 2z → overlap 13.
    expect(refShanten(h('123m456p789s111z2z'), 0)).toBe(0)
    // 14-tile with a tenpai thirteen inside: W misses one 2z, the floater 5s pays.
    expect(refShanten(h('123m456p789s111z2z5s'), 0)).toBe(0)
    // Four-meld tanki: W concealed part = 33p, overlap 1 of 2.
    expect(refShanten(h('3p'), 4)).toBe(0)
    // One meld: W = 123m 456p 789s 55z over the 10-tile remainder.
    expect(refShanten(h('23m456p789s55z'), 1)).toBe(0)
    // Special-form tenpai: six pairs + single (chiitoitsu W misses a seventh pair
    // partner, overlap 13); thirteen distinct orphans (kokushi W misses the pair).
    expect(refShanten(h('1122m3344p5566s7z'), 0)).toBe(0)
    expect(refShanten(h('19m19p19s1234567z'), 0)).toBe(0)
  })

  it('reads the n-shanten ladder', () => {
    // Head broken: best W (e.g. 123m 456p 789s 111z 55z) misses 1m and a 5z → 1.
    expect(refShanten(h('23m456p789s111z5z7z'), 0)).toBe(1)
    // Three sets + four scattered singles: best W misses 2 (pair up any single and
    // complete a fourth set from one of the others) → 2.
    expect(refShanten(h('123m456p789s1s2z5z7z'), 0)).toBe(2)
    // Three melds + one concealed set + floater: W = 123m 55z misses one 5z → 0.
    expect(refShanten(h('123m5z'), 3)).toBe(0)
  })

  it('the maximally scattered thirteen reads 6 via the special forms', () => {
    // standardShanten pins this hand at 8 (shanten.test.ts: no set, no partial, no
    // pair). The COMBINATOR reads 6: chiitoitsu W over any 7 of the 13 present
    // kinds overlaps 7 (each min(1,2) = 1) → 14 − 7 − 1 = 6; kokushi W overlaps 7
    // (present orphans 1m 1p 1s 1z 2z 3z 4z, no pair) → 6 as well. Standard W tops
    // out at overlap 5 (no set shape can cover two of ranks 1/4/7 in one suit, so
    // 4 sets reach 4, the pair 1 more) → 8. min = 6 — the reference must agree
    // with `shanten`, not `standardShanten`.
    expect(refShanten(h('147m147p147s1234z'), 0)).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// The exhaustion boundary — shanten is shape, waits is physics. The divergence
// witnesses shanten.ts:8–11 defers to this ticket, pinned before the properties
// that quantify them.
// ---------------------------------------------------------------------------

/** An ankan of `kind`: all four copies own, nothing claimed (waits.test.ts twin). */
function ankan(kind: TileKind): Meld {
  return {
    type: 'ankan',
    own: [tileId(kind, 0), tileId(kind, 1), tileId(kind, 2), tileId(kind, 3)],
  }
}

describe('the exhaustion boundary — shanten 0 hands that are noten', () => {
  it('four concealed copies as triplet + tanki: shape tenpai, physically dead', () => {
    // 123m 456p 789s + 2222z: sets 123m 456p 789s 222z + the fourth 2z as tanki —
    // shape shanten 0, but the completing W (222z triplet + 2z2z pair) needs a
    // FIFTH 2z. waits sees counts[2z] = 4 and never probes it: noten.
    const hand = h('123m456p789s2222z')
    expect(shanten(hand, [])).toBe(0)
    expect(refShanten(hand, 0)).toBe(0)
    expect(waits(hand, [])).toEqual([])
    expect(isTenpai(hand, [])).toBe(false)
  })

  it('a kanchan whose only wait sits inside the hand’s own ankan', () => {
    // ankan(3m) + 24m 456p 789s 55z: sets 456p 789s + head 55z + kanchan 24m over
    // the called fourth set — shanten 0 waiting 3m alone, but all four 3m are in
    // the ankan. The real-game divergence case.
    const hand = h('24m456p789s55z')
    const called = [ankan('3m')]
    expect(shanten(hand, called)).toBe(0)
    expect(refShanten(hand, 1)).toBe(0)
    expect(waits(hand, called)).toEqual([])
    expect(isTenpai(hand, called)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Builders and arbitraries. buildWinner is the agari.test.ts FAKE-meld twin;
// buildMelds/buildTenpaiParts the waits.test.ts REAL-meld twin (one shared 4-copy
// budget across meld tiles, concealed sets, and the pair), split so the random
// melded-hand arbitrary can reuse the meld arm.
// ---------------------------------------------------------------------------

/** All kind indices, the filter base for budgeted choices. */
const ALL_KINDS: readonly number[] = Array.from({ length: KIND_COUNT }, (_, k) => k)

/**
 * Deterministic winner construction (FAKE-meld side): each choice indexes (mod) the
 * candidates still legal under the 4-copy cap, so no rejection loop is needed.
 */
function buildWinner(
  meldCount: number,
  setChoices: readonly number[],
  pairChoice: number,
): TileKind[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  const hand: TileKind[] = []
  for (let s = 0; s < 4 - meldCount; s += 1) {
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
  return hand
}

/** tileId at the next unconsumed copy of a kind — ids stay distinct per budget. */
function nextCopyId(counts: number[], k: number): number {
  return tileId(TILE_KINDS[k], counts[k] as 0 | 1 | 2 | 3)
}

/**
 * REAL melds from the shared budget: pon/chi/ankan by formChoices, target by
 * setChoices, both mod the still-legal candidates (≤ 9 kinds are touched before any
 * slot, so a legal target always remains). Mutates `counts` — the caller threads the
 * same budget through its concealed tiles.
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
        own: [tileId(TILE_KINDS[k], 0), tileId(TILE_KINDS[k], 1), tileId(TILE_KINDS[k], 2), tileId(TILE_KINDS[k], 3)],
      })
      counts[k] = COPIES_PER_KIND
    }
  }
  return built
}

/** A complete winner with REAL melds: melds first, then concealed sets, then pair. */
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

/** A winner minus one tile: tenpai (shanten 0) by construction. */
const minusOneArb = fc.record({ winner: winnerArb, at: fc.nat(13) }).map(({ winner, at }) => {
  const hand = [...winner.hand]
  hand.splice(at % hand.length, 1)
  return { meldCount: winner.meldCount, hand }
})

/**
 * A winner with k ∈ 1..4 tiles swapped for arbitrary kinds with copy headroom. One
 * exchange moves the W-formula's missing count by at most 1, so shanten ≤ k − 1 —
 * the near-miss band, asserted reference-side as the bucket's anti-vacuity.
 */
const perturbedArb = fc
  .record({
    winner: winnerArb,
    swaps: fc.array(fc.record({ at: fc.nat(13), replaceWith: fc.nat(10_000) }), {
      minLength: 1,
      maxLength: 4,
    }),
  })
  .map(({ winner, swaps }) => {
    const hand = [...winner.hand]
    for (const { at, replaceWith } of swaps) {
      hand.splice(at % hand.length, 1)
      const counts = countsOfHand(hand)
      const headroom = ALL_KINDS.filter((k) => counts[k] < COPIES_PER_KIND)
      hand.push(TILE_KINDS[headroom[replaceWith % headroom.length]])
    }
    return { meldCount: winner.meldCount, hand, k: swaps.length }
  })

/** The 136-tile multiset as kinds — the draw pool for random hands. */
const POOL: readonly TileKind[] = TILE_KINDS.flatMap((kind) => [kind, kind, kind, kind])

const randomHand13Arb = fc.shuffledSubarray([...POOL], { minLength: 13, maxLength: 13 })
const randomHand14Arb = fc.shuffledSubarray([...POOL], { minLength: 14, maxLength: 14 })

const realPartsArb = fc
  .record({
    meldCount: meldCountArb,
    formChoices: fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 }),
    setChoices: fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 }),
    pairChoice: fc.nat(10_000),
  })
  .map(({ meldCount, formChoices, setChoices, pairChoice }) => ({
    meldCount,
    ...buildTenpaiParts(meldCount, formChoices, setChoices, pairChoice),
  }))

/** A real-meld winner minus one concealed tile: tenpai-dense waits-clause samples. */
const realMinusOneArb = fc.record({ parts: realPartsArb, at: fc.nat(13) }).map(({ parts, at }) => {
  const hand13 = [...parts.concealed14]
  hand13.splice(at % hand13.length, 1)
  return { hand13, melds: parts.melds }
})

/**
 * Real melds + RANDOM concealed remainder drawn kind-by-kind from what the budget
 * has left (kind-uniform, not multiset-uniform — a test distribution, noten-dense).
 */
const randomRealMeldArb = fc
  .record({
    meldCount: meldCountArb,
    formChoices: fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 }),
    setChoices: fc.array(fc.nat(10_000), { minLength: 4, maxLength: 4 }),
    picks: fc.array(fc.nat(10_000), { minLength: 13, maxLength: 13 }),
  })
  .map(({ meldCount, formChoices, setChoices, picks }) => {
    const counts = new Array<number>(KIND_COUNT).fill(0)
    const built = buildMelds(meldCount, formChoices, setChoices, counts)
    const hand13: TileKind[] = []
    for (let i = 0; i < 13 - 3 * meldCount; i += 1) {
      const legal = ALL_KINDS.filter((k) => counts[k] < COPIES_PER_KIND)
      const k = legal[picks[i] % legal.length]
      counts[k] += 1
      hand13.push(TILE_KINDS[k])
    }
    return { hand13, melds: built }
  })

/** Both waits-clause sample shapes, normalized. */
const waitsClauseArb = fc.oneof(realMinusOneArb, randomRealMeldArb)

// ---------------------------------------------------------------------------
// Agreement with the brute-force reference — the AC's first clause. Every
// assertion is shanten === refShanten (the combinator is the ticket's subject;
// FAKE melds are honest because both sides read arity only).
// ---------------------------------------------------------------------------

describe('agreement with the brute-force reference', () => {
  it('generators respect the wall (self-test)', () => {
    fc.assert(
      fc.property(winnerArb, ({ meldCount, hand }) => {
        expect(hand.length).toBe(14 - 3 * meldCount)
        expect(Math.max(...countsOfHand(hand))).toBeLessThanOrEqual(COPIES_PER_KIND)
      }),
      { numRuns: 200 },
    )
    fc.assert(
      fc.property(perturbedArb, ({ meldCount, hand }) => {
        expect(hand.length).toBe(14 - 3 * meldCount)
        expect(Math.max(...countsOfHand(hand))).toBeLessThanOrEqual(COPIES_PER_KIND)
      }),
      { numRuns: 200 },
    )
  })

  it('constructed winners agree and read −1 (positive-dense, both meld arities)', () => {
    fc.assert(
      fc.property(winnerArb, ({ meldCount, hand }) => {
        // Anti-vacuity reference-side: a constructed winner IS a winner.
        expect(refShanten(hand, meldCount)).toBe(-1)
        expect(shanten(hand, melds(meldCount))).toBe(-1)
      }),
      { numRuns: 150 },
    )
  })

  it('winners minus one tile agree and read 0 (tenpai-dense, 13−3m arity)', () => {
    fc.assert(
      fc.property(minusOneArb, ({ meldCount, hand }) => {
        // Anti-vacuity: re-adding the removed tile completes — shape tenpai.
        expect(refShanten(hand, meldCount)).toBe(0)
        expect(shanten(hand, melds(meldCount))).toBe(0)
      }),
      { numRuns: 150 },
    )
  })

  it('k-perturbed winners agree within the construction bound (near misses)', () => {
    fc.assert(
      fc.property(perturbedArb, ({ meldCount, hand, k }) => {
        const ref = refShanten(hand, meldCount)
        // Anti-vacuity: k exchanges from a winner — the bucket is near-tenpai.
        expect(ref).toBeLessThanOrEqual(k - 1)
        expect(shanten(hand, melds(meldCount))).toBe(ref)
      }),
      { numRuns: 150 },
    )
  })

  it('random 13-tile draws agree across the full 0..8 band', () => {
    fc.assert(
      fc.property(randomHand13Arb, (hand) => {
        expect(shanten(hand, [])).toBe(refShanten(hand, 0))
      }),
      { numRuns: 60 },
    )
  })

  it('random 14-tile draws agree; −1 coincides with the reference win predicate', () => {
    fc.assert(
      fc.property(randomHand14Arb, (hand) => {
        const ref = refShanten(hand, 0)
        expect(shanten(hand, [])).toBe(ref)
        expect(refIsWin(hand, 0)).toBe(ref === -1)
      }),
      { numRuns: 60 },
    )
  })
})

// ---------------------------------------------------------------------------
// Shanten 0 and the enumerated waits — the AC's second clause, split per the
// header. Real melds throughout: waits reads meld content.
// ---------------------------------------------------------------------------

describe('shanten 0 and the enumerated waits', () => {
  it('real-meld winners win and respect the wall (builder self-test)', () => {
    fc.assert(
      fc.property(realPartsArb, ({ meldCount, concealed14, melds: built }) => {
        expect(concealed14.length).toBe(14 - 3 * meldCount)
        expect(built.length).toBe(meldCount)
        expect(Math.max(...visibleOf(concealed14, built))).toBeLessThanOrEqual(COPIES_PER_KIND)
        expect(isAgari(concealed14, built)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('tenpai is sound: a non-empty wait set forces shanten 0 (unconstrained)', () => {
    fc.assert(
      fc.property(waitsClauseArb, ({ hand13, melds: built }) => {
        if (isTenpai(hand13, built)) {
          expect(shanten(hand13, built)).toBe(0)
        }
      }),
      { numRuns: 250 },
    )
  })

  it('the biconditional holds on exhaustion-free samples: shanten 0 ⟺ tenpai', () => {
    fc.assert(
      fc.property(waitsClauseArb, ({ hand13, melds: built }) => {
        // The AC's constrained samples: when no kind is visibly exhausted to the
        // hand, waits probes every kind — shape tenpai and physical tenpai agree.
        fc.pre(Math.max(...visibleOf(hand13, built)) < COPIES_PER_KIND)
        expect(shanten(hand13, built) === 0).toBe(isTenpai(hand13, built))
      }),
      { numRuns: 250 },
    )
  })

  it('every divergence is exhaustion: shanten 0 noten hands have only dead waits', () => {
    fc.assert(
      fc.property(waitsClauseArb, ({ hand13, melds: built }) => {
        if (shanten(hand13, built) !== 0 || isTenpai(hand13, built)) return
        // The divergence witnesses: every STRUCTURAL completion (reference-side,
        // module-free) must be a kind all four of whose copies the hand can see —
        // no third cause of disagreement exists.
        const visible = visibleOf(hand13, built)
        for (let k = 0; k < KIND_COUNT; k += 1) {
          if (refIsWin([...hand13, TILE_KINDS[k]], built.length)) {
            expect(visible[k], `structural wait ${TILE_KINDS[k]} is live`).toBeGreaterThanOrEqual(
              COPIES_PER_KIND,
            )
          }
        }
      }),
      { numRuns: 250 },
    )
  })
})
