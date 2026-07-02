import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createRng, nextInt, shuffleInPlace, type Rng } from './index'

/** The canonical seed domain: integers [0, 2^32). The arbitrary all property tickets copy. */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

function take(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng())
}

describe('seeded rng', () => {
  it('reproduces the frozen mulberry32 golden vectors — a mismatch here means the algorithm changed and every stored seed is invalid', () => {
    // Cross-checked against an independent transcription of the published mulberry32
    // reference at capture time (see T-001-02-02 progress.md). Never regenerate.
    expect(take(createRng(0), 5)).toEqual([
      1144304738, 1416247, 958946056, 627933444, 2007157716,
    ])
    expect(take(createRng(1), 5)).toEqual([
      2693262067, 11749833, 2265367787, 4213581821, 4159151403,
    ])
    expect(take(createRng(0xdeadbeef), 5)).toEqual([
      4043151706, 1147597007, 3315858022, 1538288752, 2042435954,
    ])
  })

  it('yields identical streams for identical seeds (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(take(createRng(seed), 32)).toEqual(take(createRng(seed), 32))
      }),
    )
  })

  it('normalizes any JS number seed with >>> 0 (property)', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false, noDefaultInfinity: false }), (d) => {
        expect(take(createRng(d), 8)).toEqual(take(createRng(d >>> 0), 8))
      }),
    )
  })

  it('emits uint32 values (property)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        for (const value of take(createRng(seed), 16)) {
          expect(Number.isInteger(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(0xffffffff)
        }
      }),
    )
  })

  it('nextInt stays inside [0, bound) for any bound (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 0x100000000 }), (seed, bound) => {
        const rng = createRng(seed)
        for (let i = 0; i < 8; i++) {
          const value = nextInt(rng, bound)
          expect(Number.isInteger(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThan(bound)
        }
      }),
    )
  })

  it('nextInt rejects out-of-contract bounds loudly', () => {
    const rng = createRng(0)
    expect(() => nextInt(rng, 0)).toThrow(RangeError)
    expect(() => nextInt(rng, -3)).toThrow(RangeError)
    expect(() => nextInt(rng, 1.5)).toThrow(RangeError)
    expect(() => nextInt(rng, 0x100000001)).toThrow(RangeError)
    expect(() => nextInt(rng, Number.NaN)).toThrow(RangeError)
  })

  it('shuffleInPlace permutes in place, deterministically per seed (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.array(fc.integer(), { maxLength: 64 }), (seed, items) => {
        const shuffled = [...items]
        const returned = shuffleInPlace(createRng(seed), shuffled)
        // Mutates and returns the same array object.
        expect(returned).toBe(shuffled)
        // Same multiset as the input.
        expect([...shuffled].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b))
        // Same seed, same input → same order.
        expect(shuffleInPlace(createRng(seed), [...items])).toEqual(shuffled)
      }),
    )
  })
})
