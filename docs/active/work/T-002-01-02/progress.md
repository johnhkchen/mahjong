# T-002-01-02 — Progress

## Completed

- **Step 1 — `src/core/wall.ts` extended** (per plan.md): header comment updated to own
  the partition; `TILE_COUNT` added to the `./tiles` import; `buildWall` untouched; new
  `DEAD_WALL_SIZE = 14`, `LIVE_WALL_SIZE = TILE_COUNT - DEAD_WALL_SIZE`,
  `INITIAL_DORA_INDICATOR_INDEX = 4` (with contract-freeze warning), `WallPartition`
  interface (dead-wall layout documented on the `dead` field), and
  `partitionWall(wall: readonly TileId[]): WallPartition` with the RangeError length
  guard and the orientation-freeze doc comment. `just check` green.

- **Step 2 — seed-1 golden values captured** (record, per plan.md — never regenerate):
  - Derivation: `partitionWall(buildWall(1))` executed via tsx through the pinned flox
    toolchain; cross-checked by independently reading `buildWall(1).slice(122)` and
    `buildWall(1)[126]` in the same run. Both reads agreed.
  - Seed-1 dead wall (last 14 of the frozen wall):
    `[80, 41, 88, 6, 24, 128, 112, 124, 30, 99, 43, 101, 108, 75]`
  - Seed-1 initial dora indicator: `24` = `dead[4]` = `wall[126]` (tile id 24 decodes to
    kind index 6, copy 0 — the first 7m).
  - Soundness note: these derive from the mulberry32 stream already frozen by the
    rng/wall golden tests, so capturing from the running code pins only the new
    *partition convention* (which positions), not the stream.

- **Step 3 — `src/core/wall.test.ts` extended**: new `describe('wall partition')` with
  the six planned tests — conservation property (122+14, order-preserving reassembly,
  136 distinct ids), indicator-position property (`dead[4]` = `wall[126]`), same-seed
  determinism property (deep-equal, fresh arrays), input-non-mutation property,
  RangeError guard (lengths 0/135/137), and the seed-1 frozen-partition golden. Imports
  extended from `./index` only. `just test`: **6 files, 38 tests, all green** —
  including `purity.test.ts` unchanged (AC) and all pre-existing rng/wall goldens
  (stream unperturbed).

- **Step 4 — gate + commit**: `just test` and `just check` both clean. Committed
  `89a90e5` — only `src/core/wall.ts` + `src/core/wall.test.ts` staged; the
  lisa-owned ticket-frontmatter modifications in the worktree were left uncommitted as
  planned.

## Remaining

- Step 5: review.md, then commit the six RDSPI artifacts.

## Deviations from plan

None. All steps executed as written; no golden-capture discrepancy, no purity-gate
trips, no interference from parallel ticket T-002-01-01 (no shared files touched).
