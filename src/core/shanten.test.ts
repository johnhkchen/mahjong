// The standard-form shanten suite: pinned fixtures with RULE-DERIVED expected values —
// every expectation argued in its comment as an explicit block decomposition (value =
// 2·sets + partials + head, shanten = 8 − 2·melds − value) plus, where it clarifies, the
// exchange sequence that realizes the count. Never derived from module output. Several
// hands deliberately echo waits.test.ts fixtures whose tenpai status is independently
// pinned there — the cross-module agreement is the point. Property sweeps against a
// brute-force reference live in shanten.property.test.ts (T-006-02-03). Melds are
// arity-only stubs with arbitrary ids (the agari.test.ts FAKE_MELDS pattern) — honest
// here because standardShanten, like decomposeAgari, reads meld arity only.

import { describe, expect, it } from 'vitest'
import { shanten, standardShanten, type Meld, type TileKind } from './index'

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

const FAKE_MELDS: readonly Meld[] = [
  { type: 'pon', claimed: 0, from: 1, own: [1, 2] },
  { type: 'chi', claimed: 36, from: 3, own: [40, 44] },
  { type: 'ankan', own: [72, 73, 74, 75] },
  { type: 'shouminkan', claimed: 100, from: 2, own: [101, 102, 103] },
]

function melds(count: number): readonly Meld[] {
  return FAKE_MELDS.slice(0, count)
}

describe('complete hands', () => {
  it('a standard 14-tile winner reads −1', () => {
    // 123m 456p 789s 111z + 22z: 4 sets + head → value 9, shanten 8 − 9 = −1.
    expect(standardShanten(h('123m456p789s111z22z'), [])).toBe(-1)
  })

  it('four melds and the bare pair read −1 — the deepest discount', () => {
    // All four sets called; concealed 55z is the head → value 1, 8 − 8 − 1 = −1.
    expect(standardShanten(h('55z'), melds(4))).toBe(-1)
  })
})

describe('tenpai hands (shanten 0)', () => {
  it('ryanmen: 23m open with head and three sets', () => {
    // Sets 456p 789s 111z (6) + head 55z (1) + partial 23m (1) → 8, shanten 0.
    // The waits.test.ts ryanmen fixture — pinned there as waiting on 1m/4m.
    expect(standardShanten(h('23m456p789s111z55z'), [])).toBe(0)
  })

  it('tanki: four sets and a lone head candidate', () => {
    // Sets 123m 456p 789s 111z (8), 2z a floater — no head, blocks full → 8, shanten 0.
    // The no-head-with-four-blocks edge: the floater IS the tenpai (tanki on 2z).
    expect(standardShanten(h('123m456p789s111z2z'), [])).toBe(0)
  })

  it('shanpon: two pairs over three sets', () => {
    // Sets 456s 789s 111z (6) + head 22m (1) + partial pair 33p (1) → 8, shanten 0.
    expect(standardShanten(h('22m33p456s789s111z'), [])).toBe(0)
  })

  it('the four-meld tanki reads 0', () => {
    // One concealed tile, all sets called: value 0, 8 − 8 − 0 = 0 — tanki on 3p.
    expect(standardShanten(h('3p'), melds(4))).toBe(0)
  })

  it('a 14-tile hand containing a tenpai thirteen reads 0', () => {
    // Sets 123m 456p 789s 111z (8) + floaters 2z 5s: blocks full, no head → value 8,
    // shanten 0 — discarding 5s leaves the tanki-on-2z tenpai above.
    expect(standardShanten(h('123m456p789s111z2z5s'), [])).toBe(0)
  })
})

describe('n-shanten ladders', () => {
  it('one exchange out: the ryanmen tenpai with its head broken', () => {
    // Sets 456p 789s 111z (6) + partial 23m (1), 5z/7z lone — no head → value 7,
    // shanten 1. Realized: draw 1m, discard 7z → 123m 456p 789s 111z 5z, tanki tenpai.
    expect(standardShanten(h('23m456p789s111z5z7z'), [])).toBe(1)
  })

  it('two exchanges out: three sets and four scattered singles', () => {
    // Sets 123m 456p 789s (6); 1s 2z 5z 7z share nothing — no partial, no head →
    // value 6, shanten 2. Realized: draw 2z (pair, 1-shanten), draw 2z again or pair
    // any single and complete — two exchanges to a shanpon/tanki tenpai.
    expect(standardShanten(h('123m456p789s1s2z5z7z'), [])).toBe(2)
  })

  it('the maximally scattered thirteen reads 8 — the AC worst case', () => {
    // 147 in each suit (every gap 3 — beyond proto-run reach) + four distinct honors:
    // no set, no partial, no pair anywhere → value 0, shanten 8, the standard-form
    // ceiling. The "13 tiles apart" anchor.
    expect(standardShanten(h('147m147p147s1234z'), [])).toBe(8)
  })
})

describe('meld discount — called sets reduce required sets', () => {
  it('one meld: the ryanmen tenpai over a 10-tile remainder', () => {
    // The meld is the fourth set; concealed sets 456p 789s (4) + head 55z (1) +
    // partial 23m (1) → 6, shanten 8 − 2 − 6 = 0. The waits.test.ts meld fixture.
    expect(standardShanten(h('23m456p789s55z'), melds(1))).toBe(0)
  })

  it('two melds: two concealed sets and a tanki floater', () => {
    // Concealed sets 123m 456p (4), 5z floater, blocks full at 4 − 2 = 2 → value 4,
    // shanten 8 − 4 − 4 = 0 — tanki on 5z.
    expect(standardShanten(h('123m456p5z'), melds(2))).toBe(0)
  })

  it('three melds: one concealed set and the tanki', () => {
    // Set 123m (2), 5z floater, cap 1 block → value 2, shanten 8 − 6 − 2 = 0.
    expect(standardShanten(h('123m5z'), melds(3))).toBe(0)
  })

  it('the same shape stranded without its melds counts the missing sets', () => {
    // 123m + 5z alone cannot be queried at 4 tiles meldless (arity), but the ladder
    // above IS the discount clause: identical concealed material moves 0 → 0 → 0 as
    // melds supply the sets a meldless hand would still owe. The converse: at four
    // melds the SAME lone 5z that was a floater becomes instant tenpai.
    expect(standardShanten(h('5z'), melds(4))).toBe(0)
  })
})

describe('head vs partial tension — the exactness edges', () => {
  it('finds the double-run reading that keeps the pair as head', () => {
    // 22334455m: greedy low-first pairing (22m as a block, or runs 234m+345m leaving
    // 2m/5m stranded) tops out at value 6. The maximum keeps 22m as HEAD and runs
    // 345m TWICE: sets 345m 345m 123p (6) + head 22m (1) → 7, shanten 1. Realized:
    // draw 2m, discard 1z → 222m 345m 345m 123p 9s, tanki tenpai.
    expect(standardShanten(h('22334455m123p9s1z'), [])).toBe(1)
  })

  it('six pairs and a single read 3 in standard form — the block cap', () => {
    // 1122m 3344p 5566s 7z: pairs/proto-runs everywhere, but blocks cap at 4 + head:
    // e.g. head 11m (1) + partials 22m 33p 44p (3) + one more block 55s (1) → wait —
    // cap admits FOUR blocks: partials 22m 33p 44p 55s (4) + head 11m (1) → value 5,
    // shanten 3. No decomposition does better (no set exists; value 2·0 + 4 + 1).
    // Chiitoitsu reads this hand as tenpai — that is T-006-02-02's combinator, and
    // exactly why standardShanten must NOT: the forms are distinct data.
    expect(standardShanten(h('1122m3344p5566s7z'), [])).toBe(3)
  })

  it('keeps a triple as a set rather than splitting it for the head', () => {
    // 222m: as a triplet — sets 222m 345p 345s (6) + head 77z (1) → 7, shanten 1
    // (draw 9s? no — draw any 77z completion: draw 7z, discard 1s → 222m 345p 345s
    // 777z 9s... rather: value 7 pins 1-shanten; e.g. draw 1s → 11s? no pair — draw
    // 9s pairs 9s: 222m 345p 345s 77z 99s is 1-shanten's tenpai successor). Splitting
    // 222m as head 22m + floater 2m forfeits the set: value ≤ 6. The triplet branch
    // must win.
    expect(standardShanten(h('222m345p345s77z19s'), [])).toBe(1)
  })
})

describe('contract', () => {
  it('accepts both arities: drawing the wait moves tenpai 0 to complete −1', () => {
    expect(standardShanten(h('23m456p789s111z55z'), [])).toBe(0)
    expect(standardShanten(h('123m456p789s111z55z'), [])).toBe(-1)
  })

  it('throws on a wrong-arity query, naming both accepted counts', () => {
    expect(() => standardShanten(h('123m'), [])).toThrowError(
      new RangeError('standardShanten requires 13 or 14 concealed tiles with 0 melds, got 3'),
    )
    expect(() => standardShanten(h('23m456p789s111z55z'), melds(1))).toThrowError(
      new RangeError('standardShanten requires 10 or 11 concealed tiles with 1 melds, got 13'),
    )
  })

  it('throws on more than four melds', () => {
    expect(() => standardShanten([], [...FAKE_MELDS, FAKE_MELDS[0]])).toThrowError(
      new RangeError('standardShanten with 5 melds — a hand holds at most 4'),
    )
  })

  it('is a pure read: inputs unmutated, repeat calls identical', () => {
    const hand = h('23m456p789s111z5z7z')
    const stubbed = [...melds(0)]
    const handBefore = [...hand]
    const first = standardShanten(hand, stubbed)
    const second = standardShanten(hand, stubbed)
    expect(hand).toEqual(handBefore)
    expect(stubbed).toEqual([])
    expect(first).toBe(second)
    expect(first).toBe(1)
  })
})

describe('shanten combinator', () => {
  describe('chiitoitsu binds the minimum', () => {
    it('six pairs plus a single: chiitoitsu tenpai where standard reads 3', () => {
      // Same hand as the standard-form "block cap" fixture above: standardShanten
      // reads 3 there. Chiitoitsu: pairs = 6 (1m 2m 3p 4p 5s 6s), kinds = 7 (+7z) →
      // 6 − 6 + max(0, 7 − 7) = 0. min(3, 0, kokushi) = 0.
      expect(standardShanten(h('1122m3344p5566s7z'), [])).toBe(3)
      expect(shanten(h('1122m3344p5566s7z'), [])).toBe(0)
    })

    it('seven distinct pairs: a complete chiitoitsu hand where standard reads 3', () => {
      // The agari.test.ts chiitoitsu fixture, 14 tiles. Chiitoitsu: pairs = kinds = 7
      // → 6 − 7 + max(0, 0) = −1 (a win). Standard: no set exists (every kind holds
      // exactly 2 copies) — best value is 1 head + 4 capped partials = 5, shanten
      // 8 − 5 = 3. min(3, −1, kokushi) = −1.
      expect(standardShanten(h('1122m3344p5566s77z'), [])).toBe(3)
      expect(shanten(h('1122m3344p5566s77z'), [])).toBe(-1)
    })
  })

  describe('kokushi binds the minimum', () => {
    it('thirteen distinct orphans: kokushi tenpai where standard reads 8', () => {
      // All 13 terminal/honor kinds, no duplicate — the waits.test.ts thirteen-sided
      // fixture. Kokushi: kinds = 13, hasPair = false → 13 − 13 − 0 = 0. Standard: no
      // kind repeats and no two kinds are run-adjacent (terminals of different suits,
      // honors) — value 0, shanten 8. min(8, chiitoi, 0) = 0.
      expect(standardShanten(h('19m19p19s1234567z'), [])).toBe(8)
      expect(shanten(h('19m19p19s1234567z'), [])).toBe(0)
    })

    it('thirteen orphans plus a duplicate: complete kokushi where standard reads 7', () => {
      // 1m doubled, 14 tiles — the agari.test.ts kokushi-duplicate pattern. Kokushi:
      // kinds = 13, hasPair = true → 13 − 13 − 1 = −1 (a win). Standard: 11m is the
      // only pair (head, value 1), every other kind is a lone terminal/honor with no
      // adjacent partner — value 1, shanten 8 − 1 = 7. min(7, chiitoi, −1) = −1.
      expect(standardShanten(h('119m19p19s1234567z'), [])).toBe(7)
      expect(shanten(h('119m19p19s1234567z'), [])).toBe(-1)
    })
  })

  describe('standard form wins when neither special form is close', () => {
    it('the ryanmen tenpai: standard 0 beats chiitoitsu 4 and kokushi 9', () => {
      // 23m456p789s111z55z: chiitoitsu pairs = {1z, 5z} = 2, kinds = 10 →
      // 6 − 2 + max(0, 7 − 10) = 4. Kokushi kinds present = {9s, 1z, 5z} = 3,
      // hasPair (1z or 5z) → 13 − 3 − 1 = 9. min(0, 4, 9) = 0.
      expect(shanten(h('23m456p789s111z55z'), [])).toBe(0)
      expect(shanten(h('23m456p789s111z55z'), [])).toBe(
        standardShanten(h('23m456p789s111z55z'), []),
      )
    })
  })

  describe('meld gate: special forms never apply with melds present', () => {
    it('one meld: shanten reads exactly standardShanten regardless of concealed shape', () => {
      // 23m456p789s55z with one meld is standard-tenpai (pinned above); chiitoitsu
      // and kokushi are zero-meld forms by rule, so the combinator must not even
      // consider them here.
      expect(shanten(h('23m456p789s55z'), melds(1))).toBe(0)
      expect(shanten(h('23m456p789s55z'), melds(1))).toBe(
        standardShanten(h('23m456p789s55z'), melds(1)),
      )
    })
  })

  describe('contract', () => {
    it('throws the same RangeError standardShanten throws, verbatim', () => {
      expect(() => shanten(h('123m'), [])).toThrowError(
        new RangeError('standardShanten requires 13 or 14 concealed tiles with 0 melds, got 3'),
      )
      expect(() => shanten([], [...FAKE_MELDS, FAKE_MELDS[0]])).toThrowError(
        new RangeError('standardShanten with 5 melds — a hand holds at most 4'),
      )
    })

    it('is a pure read: inputs unmutated, repeat calls identical', () => {
      const hand = h('1122m3344p5566s7z')
      const stubbed = [...melds(0)]
      const handBefore = [...hand]
      const first = shanten(hand, stubbed)
      const second = shanten(hand, stubbed)
      expect(hand).toEqual(handBefore)
      expect(stubbed).toEqual([])
      expect(first).toBe(second)
      expect(first).toBe(0)
    })
  })
})
