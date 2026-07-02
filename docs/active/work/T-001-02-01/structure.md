# T-001-02-01 tile-types-and-identities — Structure

## File-level changes

| File | Change | Contents |
| --- | --- | --- |
| `src/core/tiles.ts` | **create** | The entire tile domain: types, canonical constants, id encoding, accessors, predicates. Zero imports of any kind (not even type-only) — purity is visible at a glance. |
| `src/core/tiles.test.ts` | **create** | All tests for the domain. Imports from `'./index'` (the barrel), plus vitest. |
| `src/core/index.ts` | **rewrite** | Becomes a pure barrel: header comment (purity invariant, "the barrel is core's public face") + `export * from './tiles'`. `ENGINE_NAME` deleted. |
| `src/core/index.test.ts` | **delete** | The scaffold smoke test; superseded — `tiles.test.ts` importing through `'./index'` proves the same wiring against real code. |

No changes to `package.json`, `vite.config.ts`, `tsconfig*.json`, `justfile`, or anything
under `src/app/`.

## `src/core/tiles.ts` — public interface

Ordering inside the file mirrors this spec: types → constants → id encoding → accessors →
predicates. Everything below is exported; there are no private helpers except the reverse
index map.

### Types

```ts
export type NumberedSuit = 'm' | 'p' | 's'
export type Suit = NumberedSuit | 'z'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type NumberedKind = `${Rank}${NumberedSuit}`      // 27 members
export type HonorKind = `${1 | 2 | 3 | 4 | 5 | 6 | 7}z`  // 7: E S W N haku hatsu chun
export type TileKind = NumberedKind | HonorKind           // exactly 34 members

export type CopyIndex = 0 | 1 | 2 | 3
/** Integer 0–135; encoding: kindIndex * COPIES_PER_KIND + copy (see tileId/kindOf). */
export type TileId = number
```

### Constants

```ts
export const KIND_COUNT = 34
export const COPIES_PER_KIND = 4
export const TILE_COUNT = 136   // KIND_COUNT * COPIES_PER_KIND

/** Canonical order = canonical kind index: 1m…9m, 1p…9p, 1s…9s, 1z…7z. */
export const TILE_KINDS: readonly TileKind[]
```

`TILE_KINDS` is built by explicit generation (loops over suits/ranks), `Object.freeze`d, and
typed `readonly TileKind[]` — the literal sequence is asserted in tests rather than
hand-typed twice. Internal (not exported): `const KIND_INDEX: Record<TileKind, number>`
derived from `TILE_KINDS` for O(1) reverse lookup.

### Id encoding and accessors

```ts
export function kindIndexOf(kind: TileKind): number        // 0–33, position in TILE_KINDS
export function tileId(kind: TileKind, copy: CopyIndex): TileId
export function kindOf(id: TileId): TileKind               // TILE_KINDS[floor(id / 4)]
export function copyOf(id: TileId): CopyIndex              // id % 4
export function allTileIds(): TileId[]                     // fresh [0, 1, …, 135]
```

- `allTileIds()` returns a *fresh mutable array* each call — T-001-02-02 will shuffle its
  result in place; a frozen shared constant would be a trap.
- **No runtime range validation** in `kindOf`/`copyOf`: the type system guards construction,
  and ids only enter from outside the program via the action log, whose *parser* (a later
  ticket) owns validation at the boundary. A precondition comment states this contract.

### Predicates and field accessors (kind-level)

```ts
export function suitOf(kind: TileKind): Suit          // last char
export function rankOf(kind: TileKind): Rank | null   // numeric char for m/p/s; null for honors
export function isHonor(kind: TileKind): boolean      // suit === 'z'            (7 kinds)
export function isTerminal(kind: TileKind): boolean   // rank 1 or 9 in m/p/s    (6 kinds)
export function isSimple(kind: TileKind): boolean     // numbered, rank 2–8      (21 kinds)
```

`rankOf` returns `null` for honors (not a thrown error, not `0`): callers writing yaku logic
will branch on honor-ness anyway, and `Rank | null` makes forgetting that branch a compile
error under `strict`. Note `isHonor ∪ isTerminal ∪ isSimple` partitions all 34 kinds — a test
asserts the partition (7 + 6 + 21 = 34, pairwise disjoint).

## `src/core/index.ts` — the barrel

```ts
// src/core/ is the pure engine: framework-agnostic TypeScript, zero DOM/Svelte/platform
// imports — ever. This barrel is core's public face; app code imports only from here.
export * from './tiles'
```

## `src/core/tiles.test.ts` — test structure

One `describe('tile domain')` with focused `it` blocks, in this order:

1. **AC counts** — `TILE_KINDS.length === 34` with all entries distinct (Set); `allTileIds()`
   has length 136 with all entries distinct.
2. **Canonical sequence exactness** — the full 34-element array equals the literal expected
   sequence (spelled out in the test — this is where the mpsz honor order E,S,W,N,haku,
   hatsu,chun is pinned against transposition bugs; the test is the second, independent
   spelling of the order that D3's risk register calls for).
3. **Encoding round-trips, exhaustively** — for all 136 ids: `tileId(kindOf(id), copyOf(id))
   === id`; for all 34×4 (kind, copy) pairs: `kindOf(tileId(k, c)) === k` and
   `copyOf(tileId(k, c)) === c`. Also: each kind appears exactly 4 times across
   `allTileIds().map(kindOf)` (the "4 copies each" clause of the ticket).
4. **kindIndex bridge** — `kindIndexOf(TILE_KINDS[i]) === i` for all 34; ids of kind at index
   i are exactly `[4i, 4i+3]`.
5. **Classification** — exact member lists for terminals (6) and honors (7); simples count
   21; the three predicates partition TILE_KINDS (every kind satisfies exactly one).
6. **Accessors** — `suitOf`/`rankOf` spot-checked on representatives (`'1m'`, `'9s'`, `'5p'`,
   `'1z'`, `'7z'`) plus `rankOf` null-for-all-honors / non-null-for-all-numbered swept
   exhaustively.
7. **Immutability** — `TILE_KINDS` is frozen; `allTileIds()` returns a new array per call
   (`allTileIds() !== allTileIds()`, and mutating one doesn't affect the next).

## Module-boundary notes

- `tiles.ts` imports nothing; `index.ts` imports only `./tiles`; the test file imports
  `vitest` + `./index`. That keeps the grep gate trivial: any `svelte|document|window` hit
  under `src/core/` is a violation, with no allowlist needed.
- Nothing in `src/app/` starts importing core in this ticket (T-001-03-01's boundary).

## Ordering of changes

Single logical unit — the four file changes land together in one commit (they're
interdependent: deleting the smoke test without the new module breaks `just test`'s
1-test floor; the barrel rewrite without `tiles.ts` breaks compilation). RDSPI artifacts
follow in a second docs-only commit, matching the T-001-01-01/-02 precedent.
