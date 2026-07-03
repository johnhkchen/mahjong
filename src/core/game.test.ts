// game.ts's test suite. handSeedOf gets pure math coverage (no engine involvement):
// determinism, the documented formula spot-checked by hand arithmetic, and the
// injectivity proof (design.md Decision 3) sampled over many game seeds. foldGame is
// tested through REAL bot-driven hands — a locally-duplicated self-play driver (the
// selfplay.test.ts precedent: "the codebase locks independent statements by test rather
// than sharing them"), with game seeds MINED offline (a throwaway script, not committed
// — the win.test.ts "fixtures were seed-mined" precedent) for the specific outcomes each
// scenario needs: a dealer win (renchan), a non-dealer win (rotation), a ryuukyoku
// (rotation), and a two-hand composition (renchan into a further rotation). Every
// expected `scores`/`seatWinds` value is hand-computed in a comment from `settlementOf`'s
// own real, already-tested output (settlement.test.ts covers its correctness) remapped
// through the by-hand dealer — this suite tests the remapping/accumulation/rotation
// arithmetic, not settlementOf's own correctness.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { foldGame, handSeedOf, type GameRecord, type HandAction } from './index'

describe('handSeedOf', () => {
  it('is deterministic', () => {
    expect(handSeedOf(12345, 7)).toBe(handSeedOf(12345, 7))
  })

  it('matches the documented formula for concrete values', () => {
    // gameSeed=0, handIndex=0: 0 ^ Math.imul(1, 0x9e3779b1) = 0x9e3779b1 = 2654435761
    expect(handSeedOf(0, 0)).toBe(2654435761)
    // gameSeed=1, handIndex=0: 0x9e3779b1 is odd, so XORing gameSeed=1 flips only its
    // low bit: 2654435761 (...0001) -> 2654435760 (...0000)
    expect(handSeedOf(1, 0)).toBe(2654435760)
    // gameSeed=0, handIndex=1: Math.imul(2, 0x9e3779b1) mod 2^32
    // = 2*2654435761 = 5308871522 -> 5308871522 - 4294967296 = 1013904226
    expect(handSeedOf(0, 1)).toBe(1013904226)
  })

  it('never collides across hand indices for a fixed game seed (the injectivity proof, sampled)', () => {
    // Decision 3's algebraic argument: for a fixed gameSeed, handIndex -> derived seed is
    // a composition of two bijections on Z/2^32Z (odd-multiplier Math.imul, then XOR by a
    // constant), so it is injective for EVERY handIndex, not just empirically likely to
    // avoid collisions. This samples many game seeds and a wide handIndex range as a
    // regression check on that guarantee.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (gameSeed) => {
        const seeds = new Set<number>()
        for (let handIndex = 0; handIndex < 500; handIndex++) {
          seeds.add(handSeedOf(gameSeed, handIndex))
        }
        expect(seeds.size).toBe(500)
      }),
      { numRuns: 20 },
    )
  })

  it('rejects a negative or non-integer handIndex', () => {
    expect(() => handSeedOf(0, -1)).toThrow(RangeError)
    expect(() => handSeedOf(0, 1.5)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// Mined fixtures for foldGame. Each was found by a throwaway local script (deleted
// before commit, per design.md Decision 7 / structure.md §4) that ran the SAME bots
// (discardPolicy/callPolicy over legalActions/seatView — the selfplay.test.ts shape,
// duplicated here, not imported, per that file's own stated doctrine) over
// handSeedOf(gameSeed, index) for small integer gameSeed candidates, until each named
// outcome was found. Comments record what was searched for and the mined constant.
// ---------------------------------------------------------------------------

// gameSeed 0: handSeedOf(0, 0) = 2654435761 self-plays to a DEALER win (engine seat 0
// rons seat 1's discard, tile 100, yaku pinfu+tanyao+iipeikou). Used standalone (renchan
// case) AND as hand 0 of the two-hand composition case below (gameSeed 0 also happens to
// carry a non-dealer win at hand index 1 — Case D).
const DEALER_WIN_GAME_SEED = 0
const HAND0_DEALER_WIN: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 39 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 0 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 113 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 126 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 105 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 114 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 116 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 133 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 104 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 103 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 132 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 3 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 28 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 125 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 106 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 131 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 127 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 119 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 107 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 129 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 41 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 118 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 120 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 1 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 77 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 47 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 73 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 32 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 15 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 124 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 75 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 109 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 78 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 74 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 79 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 110 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 18 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 100 },
  { type: 'ron', seat: 0, tile: 100 },
]
// settlementOf on this hand's folded TableState (verified by running settlementOf
// directly on the mined record, the same real function settlement.test.ts covers):
// [5800, -5800, 0, 0] — dealer (engine seat 0) gains 5800 from seat 1.
const HAND0_DEALER_WIN_DELTAS = [5800, -5800, 0, 0] as const

// gameSeed 2: handSeedOf(2, 0) self-plays to a NON-DEALER win (engine seat 2 tsumo,
// tile 12, yaku yakuhai-hatsu).
const NON_DEALER_WIN_GAME_SEED = 2
const HAND0_NON_DEALER_WIN: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 111 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 117 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 123 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 121 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 120 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 115 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 128 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 108 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 38 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 127 },
  { type: 'pon', seat: 0, tile: 127, uses: [124, 126] },
  { type: 'discard', seat: 0, tile: 100 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 116 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 32 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 134 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 74 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 112 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 75 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 133 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 129 },
  { type: 'pon', seat: 2, tile: 129, uses: [130, 131] },
  { type: 'discard', seat: 2, tile: 69 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 105 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 118 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 2 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 0 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 6 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 107 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 68 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 104 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 31 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 78 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 29 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 103 },
  { type: 'pon', seat: 1, tile: 103, uses: [101, 102] },
  { type: 'discard', seat: 1, tile: 47 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 42 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 135 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 66 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 122 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 70 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 39 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 95 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 46 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 7 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 114 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 10 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 15 },
  { type: 'chi', seat: 2, tile: 15, uses: [5, 8] },
  { type: 'discard', seat: 2, tile: 79 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 36 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 34 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 21 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 73 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 40 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 3 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 37 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 60 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 119 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 92 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 71 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 82 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 58 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 35 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 109 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 83 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 113 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 77 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 63 },
  { type: 'draw', seat: 2 },
  { type: 'tsumo', seat: 2 },
]
// settlementOf: [-500, -300, 1100, -300] — engine seat 2 (non-dealer) tsumo wins 1100.
const HAND0_NON_DEALER_WIN_DELTAS = [-500, -300, 1100, -300] as const

// gameSeed 17: handSeedOf(17, 0) self-plays to RYUUKYOKU (the wall exhausts with no win).
const RYUUKYOKU_GAME_SEED = 17
const HAND0_RYUUKYOKU: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 111 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 109 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 126 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 108 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 32 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 35 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 122 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 120 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 71 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 37 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 135 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 114 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 124 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 66 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 34 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 75 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 117 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 31 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 119 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 113 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 102 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 130 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 100 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 125 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 2 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 107 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 127 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 69 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 116 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 76 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 68 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 38 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 5 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 83 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 28 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 27 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 30 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 25 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 42 },
  { type: 'pon', seat: 0, tile: 42, uses: [40, 43] },
  { type: 'discard', seat: 0, tile: 101 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 6 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 77 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 8 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 65 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 80 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 3 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 128 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 110 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 44 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 46 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 0 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 131 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 48 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 106 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 70 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 133 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 67 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 39 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 24 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 115 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 7 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 47 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 36 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 129 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 134 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 9 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 104 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 11 },
  { type: 'chi', seat: 1, tile: 11, uses: [4, 15] },
  { type: 'discard', seat: 1, tile: 21 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 41 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 121 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 45 },
]
// settlementOf (noten-bappu): [1500, 1500, -1500, -1500] — a 2-tenpai/2-noten split.
const HAND0_RYUUKYOKU_DELTAS = [1500, 1500, -1500, -1500] as const

// Composition case: gameSeed 0 (the SAME seed as HAND0_DEALER_WIN above — handSeedOf(0,
// 1) = 1013904226 self-plays to a NON-DEALER win: engine seat 2 rons engine seat 0's
// discard, tile 72, yaku pinfu.
const HAND1_NON_DEALER_WIN_AFTER_RENCHAN: readonly HandAction[] = [
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 123 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 135 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 118 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 130 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 119 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 117 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 112 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 110 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 132 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 106 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 133 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 116 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 32 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 126 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 109 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 127 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 100 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 124 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 36 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 113 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 73 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 66 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 111 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 104 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 108 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 79 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 29 },
  { type: 'pon', seat: 1, tile: 29, uses: [31, 30] },
  { type: 'discard', seat: 1, tile: 103 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 24 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 114 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 25 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 82 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 96 },
  { type: 'chi', seat: 3, tile: 96, uses: [89, 94] },
  { type: 'discard', seat: 3, tile: 43 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 6 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 129 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 78 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 4 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 40 },
  { type: 'draw', seat: 1 },
  { type: 'discard', seat: 1, tile: 5 },
  { type: 'draw', seat: 2 },
  { type: 'discard', seat: 2, tile: 128 },
  { type: 'draw', seat: 3 },
  { type: 'discard', seat: 3, tile: 115 },
  { type: 'draw', seat: 0 },
  { type: 'discard', seat: 0, tile: 72 },
  { type: 'ron', seat: 2, tile: 72 },
]
// settlementOf: [-2000, 0, 2000, 0] — engine seat 2 rons engine seat 0 for 2000.
const HAND1_NON_DEALER_WIN_AFTER_RENCHAN_DELTAS = [-2000, 0, 2000, 0] as const

const STARTING_SCORE = 25000
const IDENTITY_WINDS = ['1z', '2z', '3z', '4z'] as const
const ROTATED_ONE_WINDS = ['4z', '1z', '2z', '3z'] as const

describe('foldGame — single-hand base case', () => {
  const record: GameRecord = { seed: 999, hands: [[]] }

  it('a fresh game (one empty, in-progress hand) has the starting dealer/winds/scores', () => {
    const state = foldGame(record)
    expect(state.dealer).toBe(0)
    expect(state.seatWinds).toEqual(IDENTITY_WINDS)
    expect(state.scores).toEqual([STARTING_SCORE, STARTING_SCORE, STARTING_SCORE, STARTING_SCORE])
    expect(state.table.phase).toBe('playing')
  })

  it('folding the same GameRecord twice is deeply equal (the AC purity requirement)', () => {
    expect(foldGame(record)).toEqual(foldGame(record))
  })
})

describe('foldGame — dealer win renchans (the dealer does not rotate)', () => {
  const record: GameRecord = {
    seed: DEALER_WIN_GAME_SEED,
    hands: [HAND0_DEALER_WIN, []],
  }

  it('dealer stays Player 0 and seat winds stay the identity', () => {
    const state = foldGame(record)
    expect(state.dealer).toBe(0)
    expect(state.seatWinds).toEqual(IDENTITY_WINDS)
  })

  it('scores add hand 0\'s deltas directly (dealer 0 maps engine seats to players 1:1)', () => {
    const state = foldGame(record)
    expect(state.scores).toEqual([
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[0],
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[1],
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[2],
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[3],
    ])
  })

  it('the active hand is the trailing empty hand, still playing', () => {
    expect(foldGame(record).table.phase).toBe('playing')
  })
})

describe('foldGame — non-dealer win rotates the dealer by one player', () => {
  const record: GameRecord = {
    seed: NON_DEALER_WIN_GAME_SEED,
    hands: [HAND0_NON_DEALER_WIN, []],
  }

  it('dealer becomes Player 1', () => {
    expect(foldGame(record).dealer).toBe(1)
  })

  it('seat winds rotate one step: player 0 is now North, player 1 is now East', () => {
    expect(foldGame(record).seatWinds).toEqual(ROTATED_ONE_WINDS)
  })

  it('scores add hand 0\'s deltas under the OLD dealer (0), before the rotation', () => {
    const state = foldGame(record)
    expect(state.scores).toEqual([
      STARTING_SCORE + HAND0_NON_DEALER_WIN_DELTAS[0],
      STARTING_SCORE + HAND0_NON_DEALER_WIN_DELTAS[1],
      STARTING_SCORE + HAND0_NON_DEALER_WIN_DELTAS[2],
      STARTING_SCORE + HAND0_NON_DEALER_WIN_DELTAS[3],
    ])
  })
})

describe('foldGame — ryuukyoku also rotates the dealer', () => {
  const record: GameRecord = {
    seed: RYUUKYOKU_GAME_SEED,
    hands: [HAND0_RYUUKYOKU, []],
  }

  it('dealer becomes Player 1, same as a non-dealer win', () => {
    expect(foldGame(record).dealer).toBe(1)
    expect(foldGame(record).seatWinds).toEqual(ROTATED_ONE_WINDS)
  })

  it('scores add the noten-bappu deltas under the pre-rotation dealer (0)', () => {
    const state = foldGame(record)
    expect(state.scores).toEqual([
      STARTING_SCORE + HAND0_RYUUKYOKU_DELTAS[0],
      STARTING_SCORE + HAND0_RYUUKYOKU_DELTAS[1],
      STARTING_SCORE + HAND0_RYUUKYOKU_DELTAS[2],
      STARTING_SCORE + HAND0_RYUUKYOKU_DELTAS[3],
    ])
  })
})

describe('foldGame — two real hands compose: renchan carries the dealer, then it rotates', () => {
  const record: GameRecord = {
    seed: DEALER_WIN_GAME_SEED,
    hands: [HAND0_DEALER_WIN, HAND1_NON_DEALER_WIN_AFTER_RENCHAN, []],
  }

  it('the final dealer is Player 1 — hand 1\'s rotation, on top of hand 0\'s carried-over dealer', () => {
    expect(foldGame(record).dealer).toBe(1)
    expect(foldGame(record).seatWinds).toEqual(ROTATED_ONE_WINDS)
  })

  it('scores accumulate BOTH hands\' deltas, both mapped under dealer 0 (renchan kept the mapping unchanged between them)', () => {
    const state = foldGame(record)
    expect(state.scores).toEqual([
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[0] + HAND1_NON_DEALER_WIN_AFTER_RENCHAN_DELTAS[0],
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[1] + HAND1_NON_DEALER_WIN_AFTER_RENCHAN_DELTAS[1],
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[2] + HAND1_NON_DEALER_WIN_AFTER_RENCHAN_DELTAS[2],
      STARTING_SCORE + HAND0_DEALER_WIN_DELTAS[3] + HAND1_NON_DEALER_WIN_AFTER_RENCHAN_DELTAS[3],
    ])
  })

  it('the active hand is the trailing empty hand 2, still playing', () => {
    expect(foldGame(record).table.phase).toBe('playing')
  })
})

describe('guards', () => {
  it('throws when hands is empty', () => {
    expect(() => foldGame({ seed: 0, hands: [] })).toThrow(RangeError)
  })

  it('throws when a non-last hand is still playing', () => {
    const midPlay = HAND0_DEALER_WIN.slice(0, 10) // real prefix, still phase 'playing'
    const record: GameRecord = {
      seed: DEALER_WIN_GAME_SEED,
      hands: [midPlay, []],
    }
    expect(() => foldGame(record)).toThrow(RangeError)
  })
})
