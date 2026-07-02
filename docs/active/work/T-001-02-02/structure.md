# T-001-02-02 — Structure: files, interfaces, ordering

The blueprint for the code decided in design.md. Two new source modules, two new test
files, one barrel line, one devDependency. Nothing in `src/app/`, no config changes.

## File inventory

| File | Action | Role |
| --- | --- | --- |
| `src/core/rng.ts` | **create** | Domain-agnostic seeded randomness kit: `Rng`, `createRng`, `nextInt`, `shuffleInPlace`. Import-free (like tiles.ts — foundation layer). |
| `src/core/wall.ts` | **create** | Riichi wall build: `buildWall(seed)`. Imports only from `./tiles` and `./rng`. |
| `src/core/rng.test.ts` | **create** | Unit + property tests for the randomness kit, incl. the mulberry32 golden vectors. |
| `src/core/wall.test.ts` | **create** | The AC property tests (census / determinism / sensitivity) + wall golden vector. |
| `src/core/index.ts` | **modify** | Add `export * from './rng'` and `export * from './wall'`. |
| `package.json`, `package-lock.json` | **modify** | Add exact-pinned `fast-check` devDependency (via `npm install -D -E fast-check` inside flox). |
| `docs/active/work/T-001-02-02/*` | create | RDSPI artifacts (this directory). |

Deleted files: none. `vite.config.ts`, `tsconfig*.json`, `justfile`: untouched — vitest
already globs `src/**/*.test.ts`, and the justfile `_deps` recipe auto-installs the new
lockfile on next run.

## Module: `src/core/rng.ts`

Header comment mirrors tiles.ts: pure, import-free, and states the freeze contract — *the
mulberry32 stream is part of the replay format; changing any constant invalidates every
stored seed* (golden test enforces).

```ts
export type Rng = () => number
// A seeded deterministic generator: each call returns the next uint32 and advances state.

export function createRng(seed: number): Rng
// mulberry32. Normalizes seed with `>>> 0`; canonical seed domain is integers [0, 2^32).
// Implementation shape: closure over one uint32 state word `s`:
//   s = (s + 0x6D2B79F5) >>> 0
//   let t = s; t = Math.imul(t ^ (t >>> 15), t | 1)
//   t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
//   return (t ^ (t >>> 14)) >>> 0
// (Returns the raw u32 — NOT divided into [0,1). Integer-only per design D2.)

export function nextInt(rng: Rng, bound: number): number
// Exact-uniform integer in [0, bound) by rejection sampling:
//   limit = 2^32 - (2^32 % bound); draw u32 until < limit; return draw % bound.
// Precondition: bound is an integer, 1 <= bound <= 2^32. Guarded by a thrown RangeError —
// unlike TileId (validated at the log boundary), a bad bound is a programmer error inside
// the engine and should fail loudly at the call site.

export function shuffleInPlace<T>(rng: Rng, items: T[]): T[]
// Fisher–Yates (Durstenfeld): for i from items.length-1 down to 1,
//   j = nextInt(rng, i + 1); swap items[i], items[j].
// Mutates and returns `items` (return value is for composition).
```

Ordering within the file: type, `createRng`, `nextInt`, `shuffleInPlace` — dependency
order, reads top-down.

## Module: `src/core/wall.ts`

```ts
import { allTileIds, type TileId } from './tiles'
import { createRng, shuffleInPlace } from './rng'

export function buildWall(seed: number): TileId[]
// = shuffleInPlace(createRng(seed), allTileIds())
// Doc comment states the contract: a wall IS the seeded permutation of all 136 tile ids;
// same seed → identical order, forever (replay/log invariant). Fresh mutable array per
// call — callers (deal/draw, later tickets) may consume it destructively.
```

Deliberately *no* deal/dead-wall/dora structure here — research.md §5: those are positions
within this sequence, owned by later S-001-02 tickets.

## Barrel: `src/core/index.ts`

```ts
export * from './tiles'
export * from './rng'
export * from './wall'
```

No name collisions exist between the three modules (checked: tiles exports no `Rng`/
`createRng`/`nextInt`/`shuffleInPlace`/`buildWall`).

## Test file: `src/core/rng.test.ts`

Imports from `./index` (barrel = public-API check, per tiles.test.ts precedent), plus
`fc` from `fast-check`. One `describe('seeded rng')` containing:

1. **Golden vectors** (`it`): `createRng(0)`, `createRng(1)`, `createRng(0xDEADBEEF)` —
   first 5 u32 outputs each, hand-cross-checked against an independent mulberry32
   reference at implement time. Test name says what breaking it means
   (invalidates stored seeds).
2. **Determinism property**: ∀ seed ∈ [0, 2^32): two `createRng(seed)` streams agree on
   their first 32 outputs.
3. **Normalization property**: ∀ double d: `createRng(d)` stream ≡ `createRng(d >>> 0)`
   stream (first few outputs).
4. **`nextInt` range property**: ∀ seed, ∀ bound ∈ [1, 2^32]: output is an integer in
   [0, bound).
5. **`nextInt` guard** (`it`): bound 0, negative, and non-integer each throw RangeError.
6. **`shuffleInPlace` permutation property**: ∀ seed, ∀ integer array: result is the same
   multiset (sorted-copy equality), same array object identity, and same-seed shuffles of
   equal inputs are equal.

## Test file: `src/core/wall.test.ts`

One `describe('wall build')`, the AC lives here:

1. **Census property** (AC-a): ∀ seed: length 136; `Set` size 136; every id in [0, 136);
   `kindOf` census = exactly 4 for each of the 34 `TILE_KINDS`.
2. **Determinism property** (AC-b): ∀ seed: `buildWall(seed)` deep-equals a second call;
   the two are distinct array objects (freshness).
3. **Sensitivity property** (AC-c): ∀ distinct seed pairs (uint32 × uint32, filtered or
   pre-mapped to distinct): walls are not deeply equal.
4. **Normalization property**: ∀ double d: `buildWall(d)` ≡ `buildWall(d >>> 0)`.
5. **Golden wall** (`it`): for one fixed seed, pin the first ~12 ids of the wall exactly
   (captured once, cross-checked by hand-running mulberry32 + the shuffle on paper/REPL).

Arbitraries used: `const seedArb = fc.integer({ min: 0, max: 0xffffffff })` defined once
per file at top — the idiom later tickets copy. Distinct pairs via
`fc.tuple(seedArb, seedArb).filter(([a, b]) => a !== b)`.

## Public interface delta (what the barrel gains)

`Rng`, `createRng`, `nextInt`, `shuffleInPlace`, `buildWall`. All future consumers
(deal/draw state, AI tie-breaks, shanten Monte-Carlo, attract mode) reach these through
`src/core/index.ts` only.

## Ordering of changes (matters)

1. `npm install -D -E fast-check` (inside `flox activate`) — lockfile first, so tests can
   be written against a real import immediately.
2. `rng.ts` → `rng.test.ts` — the kit and its proof, incl. capturing + cross-checking
   golden vectors (must exist before the wall golden, which depends on the same stream).
3. `wall.ts` → `wall.test.ts` — the two-line composition and the AC properties.
4. Barrel update (tests import from `./index`, so this actually lands with step 2's start).
5. Full gate: `just test`, `just check`, `just build`, purity grep of `src/core/`.

Steps 1–5 form one code commit (`T-001-02-02: seeded rng + wall build + first property
tests`); artifacts land in a second commit, matching the repo's two-commit precedent.
Stage only this ticket's files — the working tree carries unrelated lisa edits.
