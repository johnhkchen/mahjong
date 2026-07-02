# T-002-01-02 — Plan: wall partition and dead wall

Ordered, independently verifiable steps executing structure.md. One code commit at the
end of step 4 (the API and its proof land atomically, per structure.md §4); artifacts
committed separately per repo convention.

## Step 1 — Extend `src/core/wall.ts`

1. Update the header comment: the module now owns the wall sequence *and* its partition
   (live/dead/initial indicator); deal order and calls remain later tickets'. Keep the
   comment free of quoted import-like specifiers (purity gate scans comments).
2. Add `TILE_COUNT` to the existing `./tiles` import.
3. Append, below `buildWall` (which stays byte-for-byte unchanged):
   - `export const DEAD_WALL_SIZE = 14` (comment: 4 rinshan + 5 dora + 5 ura indicators)
   - `export const LIVE_WALL_SIZE = TILE_COUNT - DEAD_WALL_SIZE` (122)
   - `export const INITIAL_DORA_INDICATOR_INDEX = 4` (freeze warning in comment)
   - `export interface WallPartition { live; dead; doraIndicator }` with the per-field
     doc comments from structure.md §2(4)
   - `export function partitionWall(wall: readonly TileId[]): WallPartition` —
     RangeError guard on `wall.length !== TILE_COUNT`; `live = wall.slice(0,
     LIVE_WALL_SIZE)`; `dead = wall.slice(LIVE_WALL_SIZE)`;
     `doraIndicator = dead[INITIAL_DORA_INDICATOR_INDEX]`. Doc comment carries the
     orientation freeze + full dead-wall layout table.

**Verify:** `just check` passes (types only; no tests yet reference the new API).

## Step 2 — Capture the seed-1 golden values

Before writing the golden test, derive the frozen values from the frozen wall:

```
node (via flox) →
  wall = buildWall(1)  // or compute in a vitest scratch: wall[122..135] and wall[126]
```

Record in progress.md: the seed-1 dead-wall 14-tuple and `wall[126]` (the indicator).
Cross-check by hand: the indicator must equal element index 126 of the frozen sequence
and `dead[4]`, and the dead wall must be the last 14 of the 136. These derive from the
already-frozen mulberry32 stream (pinned by rng/wall golden tests), so capturing once
from the running code is sound — the *convention* (which positions), not the stream, is
what the new golden pins. Never regenerate.

**Verify:** the two independent reads (slice of full wall vs. partition fields) agree.

## Step 3 — Extend `src/core/wall.test.ts`

Add `describe('wall partition')` with the six tests, exactly as named in structure.md §3:

1. Conservation property: `live.length === LIVE_WALL_SIZE`, `dead.length ===
   DEAD_WALL_SIZE`, `[...live, ...dead]` equals `buildWall(seed)`, and (AC verbatim)
   the union is 136 distinct ids: `new Set([...live, ...dead]).size === TILE_COUNT`.
2. Indicator-position property: `doraIndicator === dead[INITIAL_DORA_INDICATOR_INDEX]`
   and `=== wall[126]`.
3. Same-seed determinism property: two partitions deep-equal; `live`/`dead` arrays fresh
   (`not.toBe`) across calls.
4. Input-purity property: copy wall before, `toEqual` after `partitionWall`.
5. Guard: lengths 0, 135, 137 each `toThrow(RangeError)`.
6. Golden: seed-1 `doraIndicator` and dead-wall tuple pinned to step-2 values; test name
   states that a mismatch means the partition convention changed and stored hands'
   doras are invalid.

Imports: add the new names to the existing `./index` import list.

**Verify:** `just test` — all suites green, including untouched `purity.test.ts`
(AC bullet) and the pre-existing wall/rng/tiles suites (proves `buildWall` and the
stream are unperturbed).

## Step 4 — Full gate + commit

1. `just test` && `just check` (svelte-check + tsc strict).
2. `git add src/core/wall.ts src/core/wall.test.ts` — **only** these two; ticket
   frontmatter files currently modified in the worktree belong to lisa, not this commit.
3. Commit: `T-002-01-02: partition wall into live + 14-tile dead wall, flip initial dora indicator`
   (+ Co-Authored-By trailer per repo convention).

## Step 5 — progress.md and review.md

Write `progress.md` (steps completed, golden-value capture record, deviations if any),
then `review.md` (changes, coverage assessment, open concerns), then commit the six
RDSPI artifacts in one commit: `T-002-01-02: add RDSPI artifacts`.

## Testing strategy summary

| Concern | Test | Type |
| --- | --- | --- |
| AC: 136 distinct ids, dead = 14 | conservation property (test 1) | fast-check property |
| AC: documented fixed indicator position | position property (test 2) + constant + doc comment | property + golden |
| AC: same seed → identical partition | determinism property (test 3) | fast-check property |
| AC: purity gate still passes | existing `purity.test.ts`, zero new imports | existing suite |
| Regression: convention freeze | seed-1 golden (test 6) | golden vector |
| Robustness: bad input | RangeError guard (test 5) | example |
| Non-mutation | input-purity property (test 4) | fast-check property |
| Stream unperturbed | pre-existing rng/wall goldens keep passing | existing suite |

No integration tests needed: nothing outside `src/core/wall.*` changes, and the app does
not consume the wall yet (that is T-002-02-01, four tickets away).

## Risks / contingencies

- **Golden capture error**: mitigated by dual derivation in step 2 (full-wall index 126
  vs. partition field) and by the conservation property, which would catch any
  slice-boundary off-by-one across ~100 random seeds.
- **Purity gate tripping on comments**: the layout table in doc comments uses no quoted
  module-like strings; verified by the gate itself in step 3.
- **Parallel ticket T-002-01-01 committing between steps**: no shared files
  (structure.md §1); lisa's file locking serializes the commits regardless.
