# T-002-01-02 — Structure: wall partition and dead wall

File-level blueprint for the design in design.md. Two files modified, zero created, zero
deleted, zero config/dependency changes.

## 1. File inventory

| File | Change | Contents |
| --- | --- | --- |
| `src/core/wall.ts` | **Modified** | Header comment updated; new constants `DEAD_WALL_SIZE`, `LIVE_WALL_SIZE`, `INITIAL_DORA_INDICATOR_INDEX`; new `WallPartition` interface; new `partitionWall()` function with the dead-wall layout table in its doc comment. `buildWall` itself: byte-for-byte unchanged. |
| `src/core/wall.test.ts` | **Modified** | New `describe('wall partition')` block with the six tests from design.md §5. Existing `describe('wall build')` block: unchanged. Imports extended from the barrel only. |
| `src/core/index.ts` | **Untouched** | Already `export * from './wall'` — new exports surface automatically. Verified by tests importing everything from `./index`. |
| `src/core/tiles.ts`, `src/core/rng.ts` | **Untouched** | Foundation layers; nothing here needs them changed. |
| `src/core/purity.test.ts` | **Untouched** | Must keep passing (AC). The work adds no imports, so it does. |

No file overlap with parallel ticket T-002-01-01 (which creates its own dora-mapping
module); the only shared surface, `index.ts`, is not edited by this ticket.

## 2. `src/core/wall.ts` — internal organization

Order within the file (foundation → derivation, matching the repo's layering habit):

```
// (1) header comment — updated
import { createRng, shuffleInPlace } from './rng'
import { allTileIds, TILE_COUNT, type TileId } from './tiles'   // TILE_COUNT is new here

// (2) buildWall(seed) — UNCHANGED (the frozen primitive)

// (3) partition constants
export const DEAD_WALL_SIZE = 14
export const LIVE_WALL_SIZE = TILE_COUNT - DEAD_WALL_SIZE // 122
export const INITIAL_DORA_INDICATOR_INDEX = 4

// (4) WallPartition interface

// (5) partitionWall(wall)
```

### (1) Header comment

The current header says dead wall / dora indicators are "owned by later tickets" — that
reservation is now partially discharged. New header states: the wall is the seeded
permutation; this module also owns the partition of that sequence into live + dead wall
and the initial dora indicator; deal order and calls remain positions/consumers owned by
later tickets.

**Purity-gate caution** (research.md §2): `purity.test.ts` scans raw source *including
comments* for quoted import-like specifiers. Comments must not contain `from '...'` or
`import('...')` shapes with non-`./` paths.

### (3) Constants

- `DEAD_WALL_SIZE = 14` — literal, with a comment naming the 4+5+5 decomposition.
- `LIVE_WALL_SIZE = TILE_COUNT - DEAD_WALL_SIZE` — derived so 136 = 122 + 14 is in code.
- `INITIAL_DORA_INDICATOR_INDEX = 4` — index **into the dead wall**, with the freeze
  warning (changing it silently re-doras every stored hand).

### (4) `WallPartition`

```ts
export interface WallPartition {
  /** 122 tiles in draw order — live[0] is the first tile dealt. */
  live: TileId[]
  /** 14 tiles; layout: [0..3] rinshan, [4,6,8,10,12] dora indicators, [5,7,9,11,13] ura. */
  dead: TileId[]
  /** The initially flipped indicator — always dead[INITIAL_DORA_INDICATOR_INDEX]. */
  doraIndicator: TileId
}
```

Plain mutable-array fields (matching `buildWall`'s "fresh mutable array per call"
contract — each call returns fresh slices the caller may consume).

### (5) `partitionWall`

```ts
export function partitionWall(wall: readonly TileId[]): WallPartition
```

Body shape: length guard (`RangeError` unless `wall.length === TILE_COUNT`), then two
`slice()`s and one index read. No RNG, no mutation of the input, no loops. Doc comment
carries: the orientation freeze (dead wall = last 14, live drawn front-to-back — part of
the replay contract), the full dead-wall layout table from design.md §3, and the note
that only the initial indicator is exposed here (kan/ura tickets consume the rest of the
documented map).

## 3. `src/core/wall.test.ts` — test block layout

Imports grow to include `DEAD_WALL_SIZE`, `LIVE_WALL_SIZE`,
`INITIAL_DORA_INDICATOR_INDEX`, `partitionWall` — from `./index` as always (tests double
as public-API checks). `seedArb` at file top is shared by both describe blocks.

New `describe('wall partition')` with, in order:

1. `it('splits any seeded wall into a 122-tile live wall and 14-tile dead wall that concatenate back to the original order (property)')`
   — conservation, stronger than the AC's set form (design.md §5.1); also re-asserts
   136 distinct ids explicitly so the AC bullet is verbatim-covered.
2. `it('flips the dora indicator at the documented fixed position — dead[4], i.e. wall[126] (property)')`
3. `it('produces an identical partition for the same seed, as fresh arrays (property)')`
   — deep-equal across two calls; `not.toBe` on `live`/`dead` arrays.
4. `it('does not mutate the input wall (property)')` — snapshot copy before, deep-equal after.
5. `it('rejects walls that are not exactly 136 tiles')` — lengths 0, 135, 137 → RangeError.
6. `it('reproduces the frozen dora indicator for seed 1 — a mismatch means the partition convention changed and every stored hand's dora is invalid')`
   — golden: pins `partitionWall(buildWall(1)).doraIndicator` (and the seed-1 dead-wall
   prefix) to concrete values captured once during Implement.

## 4. Ordering of changes

1. `wall.ts` first (constants → interface → function → comments) — `just check` green on
   its own.
2. `wall.test.ts` second — `just test` green.
3. Single atomic commit (the two files change together as one behavior+proof unit;
   splitting them would leave an untested public API on main between commits).

## 5. Public-surface delta (core barrel, after)

New exports via `export * from './wall'`: `partitionWall`, `WallPartition`,
`DEAD_WALL_SIZE`, `LIVE_WALL_SIZE`, `INITIAL_DORA_INDICATOR_INDEX`. Downstream consumers
(per research.md §5): T-002-01-03 reads `live`; T-002-01-04 embeds `WallPartition`
fields in table state; future kan tickets read the documented dead-wall map.
