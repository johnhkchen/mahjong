# T-001-02-02 — Design: seeded RNG, wall build, first property test

Four decisions to make: (1) the PRNG algorithm and seed type, (2) how uniform integers are
derived for the shuffle, (3) the module/API shape, (4) the property-test library and idiom.
Each is a long-term contract: research.md §4.2 established that the seed → wall function is
part of the replay format, so the algorithm choice is effectively permanent.

## D1. PRNG algorithm and seed type

### Options considered

| Option | State | Notes |
| --- | --- | --- |
| **mulberry32** | 32-bit | ~7 lines; hash-style output mix over a Weyl-sequence state (`+0x6D2B79F5` per step), so nearby seeds produce uncorrelated streams; passes gjrand at its state size; the *entire* state is the seed word — trivially auditable determinism. |
| sfc32 / xoshiro128** | 128-bit | Better statistical head-room and period, but need 4 seed words → require a seed-expansion step (itself another PRNG), an all-zero-state guard (xoshiro), and 4× the serialization surface for the future log header. |
| `Math.random` | — | Unseedable. Violates the seeded-determinism invariant outright. Rejected on arrival. |
| `crypto.getRandomValues` | — | Platform import in `core/`, unseedable. Rejected on arrival. |

### Decision: mulberry32 over a uint32 seed

A shuffled wall for a solo game needs *fairness a player can't perceive and determinism a
replay can rely on*, not cryptographic strength. mulberry32 gives 2^32 distinct walls
(4.3 billion — a player at one hand per minute for 80 years sees ~42 million), passes
serious statistical batteries at its size, and its single-word state makes every property
of the system easy to state: seed *is* state, `seed >>> 0` is the whole normalization
story, and the future action-log seed header is one small integer that survives JSON,
`localStorage`, and a human pasting it into a bug report. The 128-bit generators buy
statistical head-room this use cannot observe, at the cost of seed-expansion code, a
4-word serialized seed, and a bigger contract to freeze forever. Simplicity here is not
laziness; it is minimizing the surface of a permanent format.

**Seed type: `number`, canonically an integer in [0, 2^32).** Inputs are normalized with
`>>> 0` (deterministic for every JS number, including negatives and floats), and the doc
comment states the canonical domain. Validation of seeds arriving from *outside* the
program is the log parser's job, matching the `TileId` precedent in tiles.ts.

**The algorithm is frozen by a golden test** (D4): pinned known-answer outputs for a fixed
seed, plus a pinned wall prefix. Anyone who touches the generator breaks a test that says,
in its name, that stored seeds would be invalidated.

## D2. Uniform integer derivation (the shuffle's fairness)

Fisher–Yates needs `nextInt(bound)` uniform on [0, bound). Options:

1. `Math.floor(next01() * bound)` — float detour; bias ~bound/2^32. Negligible but
   inexact, and floats invite representation questions a permanent format shouldn't carry.
2. **Rejection sampling on the raw u32** — draw again while the draw falls in the final
   partial bucket (`u32 >= 2^32 - (2^32 % bound)`). *Exactly* uniform, integer-only,
   ~5 lines; for bound ≤ 136 the rejection probability is < 3.2e-8, so the expected extra
   draws are zero in practice but the correctness claim is unconditional.
3. Lemire multiply-shift — the fast version needs 64-bit intermediates (BigInt or split
   arithmetic in JS): more code for speed we don't need at 136 draws per wall.

**Decision: rejection sampling (option 2).** The property test then asserts a clean claim —
"the shuffle is an unbiased Fisher–Yates over an exact-uniform integer source" — with no
epsilon anywhere. Note rejection makes the *number of raw draws* per shuffle data-dependent
but still fully seed-deterministic, which is all the replay contract needs.

## D3. Module and API shape

### Options

- (a) One `rng.ts` exposing a generator + generic shuffle, and a separate `wall.ts` owning
  the mahjong-specific seed → wall composition.
- (b) Everything in one `wall.ts`.
- (c) A stateful `class Rng` object.

**Decision: (a), with closure-based functions, no classes.**

```ts
// rng.ts — pure, domain-agnostic randomness kit
export type Rng = () => number                       // next u32, advances state
export function createRng(seed: number): Rng          // mulberry32; seed >>> 0
export function nextInt(rng: Rng, bound: number): number   // exact-uniform [0, bound)
export function shuffleInPlace<T>(rng: Rng, items: T[]): T[]  // Fisher–Yates, returns items

// wall.ts — the riichi-specific composition
export function buildWall(seed: number): TileId[]      // shuffleInPlace(createRng(seed), allTileIds())
```

Rationale: shanten Monte-Carlo, AI tie-breaking, and attract mode will all need seeded
randomness that has nothing to do with walls — `rng.ts` is that shared kit, and keeping it
domain-agnostic means its tests are pure math. `wall.ts` stays a two-line composition whose
*meaning* (a wall is a seeded permutation of the 136 tile ids) is the thing the property
test pins. A class adds `this`-state ceremony for a generator whose closure already *is*
the state; functions match the existing core idiom (tiles.ts is all functions). `Rng` as a
bare `() => u32` keeps helpers composable (`nextInt`, `shuffleInPlace` take any conforming
function, including a stub in tests).

`buildWall` returns a fresh mutable array per call (inherits `allTileIds()` freshness) —
callers (the future deal/draw state) may consume it destructively, same contract as
tiles.ts established. Both modules re-export through the `index.ts` barrel; tests import
from the barrel per the tiles.test.ts precedent.

## D4. Property-test library and idiom

### Options

| Option | Assessment |
| --- | --- |
| **fast-check, used directly inside vitest `it` blocks** | The de-facto TS property-testing library: typed arbitraries, shrinking, failure seeds printed for reproduction. Zero config with vitest — `fc.assert(fc.property(...))` inside a normal `it`. Dev-only, never ships (architecture.md: tests never ship). |
| `@fast-check/vitest` wrapper | Adds `test.prop` sugar; second dependency for syntax only, and hides the `fc.assert` seam where per-property `numRuns`/seed policy lives. |
| Hand-rolled generator loops | Would use this ticket's own PRNG to test itself — circular — and forfeits shrinking, which is the pedagogical core of the idiom later tickets copy. |

**Decision: fast-check directly, exact-pinned devDependency** (version resolved against
the registry at implement time, matching the repo's pinning convention). No wrapper.

### The idiom this ticket establishes (later property tickets copy this)

- Properties live inside ordinary `it` blocks: `fc.assert(fc.property(arbitraries…, predicate))`.
- Default `numRuns` (100) and default random run-seed: over many CI runs this explores more
  of the space; any failure prints `{ seed, path }` which reproduces exactly via
  `fc.assert(prop, { seed, path })`. Determinism-of-the-code, randomness-of-the-probe.
- Seeds are drawn as `fc.integer({ min: 0, max: 0xffffffff })` — full canonical domain.
- Each AC clause is its own named property, not one mega-assertion.

### The properties themselves

1. **Census** (AC-a): ∀ seed — `buildWall(seed)` has length 136, all ids distinct, and a
   `kindOf` census counts exactly 4 per kind for all 34 kinds (partition stated as in
   tiles.test.ts).
2. **Determinism** (AC-b): ∀ seed — two independent `buildWall(seed)` calls are deeply
   equal, and are *distinct array objects* (freshness).
3. **Sensitivity** (AC-c): ∀ pairs of distinct seeds — the walls differ. Two distinct
   uint32 seeds colliding on a 136-tile permutation is possible in principle; for this
   generator the chance any tested pair collides is ≪ 2^-100, so the property is
   deterministic-in-practice. If it *ever* fires it has found a genuine seed collision —
   which we'd want to know.
4. **Normalization**: `buildWall(seed)` equals `buildWall(seed >>> 0)` for arbitrary JS
   doubles — pins the coercion contract.
5. **Golden vectors** (example-based, not property): pinned first u32 outputs of
   `createRng` for fixed seeds, and a pinned `buildWall` prefix + full census for one seed —
   the algorithm-freeze test from D1. Golden values are *captured from the implementation
   once* at implement time, then hand-verified against an independent mulberry32 reference,
   and never regenerated.
6. **rng.ts unit properties**: `nextInt` stays in [0, bound) for arbitrary bounds ≥ 1;
   `shuffleInPlace` returns a permutation (same multiset) of its input for arbitrary
   arrays; same-seed `Rng` streams are equal element-wise.

## Rejected-alternatives summary

- 128-bit PRNGs (sfc32/xoshiro): statistical head-room invisible to this use; cost is
  seed-expansion code and a 4-word permanent seed format. Rejected for contract size.
- Float-based `nextInt`: inexact; rejected for an epsilon-free fairness claim.
- PRNG class / single-module layout: state ceremony / poor reuse for future non-wall
  randomness. Rejected.
- `@fast-check/vitest`: dependency for sugar. Rejected.
- Testing "different seeds differ" only on a fixed example pair: weaker than the AC's
  spirit; the pairwise property is deterministic-in-practice anyway. Rejected.

## Risks going in

- fast-check current major vs vitest 4.1.9 compatibility: fast-check is
  framework-agnostic (pure assertion library), so risk is low; confirmed by actually
  running the suite in Implement.
- Golden-vector capture must be cross-checked against an independent mulberry32
  implementation to guard against transcription bugs freezing a *wrong* algorithm.
