// Seeded deterministic randomness kit — domain-agnostic, import-free (foundation layer,
// like tiles.ts). The generator is mulberry32.
//
// CONTRACT FREEZE: the exact output stream of createRng is part of the replay format —
// a hand's record is its seed plus its action list, so every stored seed depends on
// these constants never changing. Golden-vector tests in rng.test.ts enforce this;
// if you change the algorithm, you invalidate every saved hand log.

/** A seeded deterministic generator: each call returns the next uint32 and advances state. */
export type Rng = () => number

const TWO_32 = 0x100000000 // 2^32

/**
 * mulberry32 over a single uint32 state word. The canonical seed domain is integers in
 * [0, 2^32); any JS number is accepted and normalized with `>>> 0` (seeds arriving from
 * outside the program — action logs — are validated at the log-parser boundary, per the
 * TileId precedent).
 */
export function createRng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return (t ^ (t >>> 14)) >>> 0
  }
}

/**
 * Exact-uniform integer in [0, bound), via rejection sampling on the raw u32 stream — no
 * floats, no modulo bias. Requires an integer bound in [1, 2^32]; a bad bound is a
 * programmer error inside the engine, so it fails loudly here.
 */
export function nextInt(rng: Rng, bound: number): number {
  if (!Number.isInteger(bound) || bound < 1 || bound > TWO_32) {
    throw new RangeError(`nextInt bound must be an integer in [1, 2^32], got ${bound}`)
  }
  const limit = TWO_32 - (TWO_32 % bound)
  let draw = rng()
  while (draw >= limit) draw = rng()
  return draw % bound
}

/** Fisher–Yates (Durstenfeld) shuffle. Mutates and returns `items` (for composition). */
export function shuffleInPlace<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i >= 1; i--) {
    const j = nextInt(rng, i + 1)
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}
