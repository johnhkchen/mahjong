# T-002-01-02 — Review

Self-assessment and handoff for the wall-partition / dead-wall / initial-dora ticket.
All acceptance criteria met; `just test` (6 files, 38 tests) and `just check` clean.

## What changed

One code commit (`89a90e5`, +125/−3 lines, 2 files), everything additive; no files
created or deleted, no dependencies or config touched.

| File | Change |
| --- | --- |
| `src/core/wall.ts` | **Modified.** `buildWall` byte-for-byte unchanged. Added: `DEAD_WALL_SIZE = 14` (4 rinshan + 5 dora + 5 ura), `LIVE_WALL_SIZE = TILE_COUNT - DEAD_WALL_SIZE` (122), `INITIAL_DORA_INDICATOR_INDEX = 4` (contract-freeze warning in comment), `WallPartition` interface, and `partitionWall(wall: readonly TileId[]): WallPartition` — pure derivation: RangeError unless exactly 136 tiles, then `live = slice(0, 122)`, `dead = slice(122)`, `doraIndicator = dead[4]`. No RNG draws; input never mutated. Header comment updated to claim the partition concern. |
| `src/core/wall.test.ts` | **Modified.** New `describe('wall partition')`, six tests (below). Existing `describe('wall build')` untouched. |
| `src/core/index.ts` | **Untouched** — already `export * from './wall'`; the five new names (`partitionWall`, `WallPartition`, three constants) surface automatically, verified by tests importing from `./index`. |

## Frozen conventions this ticket establishes (the real deliverable)

Now part of the replay contract, alongside the rng stream — changing any of these
invalidates stored hands:

1. **Orientation**: dead wall = the LAST 14 tiles of `buildWall`'s sequence; live wall =
   first 122, drawn front-to-back (`live[0]` is the first tile dealt).
2. **Initial dora indicator** = `dead[4]` = `wall[126]`.
3. **Dead-wall layout map** (documented on `WallPartition.dead` for future tickets;
   only the initial indicator is *exposed* now): `[0..3]` rinshan draws in order,
   `[4,6,8,10,12]` dora indicators walking rightward per kan, `[5,7,9,11,13]` paired
   ura indicators.

The freeze is enforced by a seed-1 golden test whose name states the failure meaning;
values were captured once via dual derivation (full-wall index reads vs. partition
fields, agreeing) from the already-frozen stream — procedure and values in progress.md.

## Acceptance criteria → evidence

| AC bullet | Evidence |
| --- | --- |
| live + dead re-assemble to exactly the 136 distinct tile ids, dead wall exactly 14 | Conservation property (∀ seed): lengths 122/14, `[...live, ...dead]` deep-equals the original wall (order-preserving — stronger than set equality), plus explicit `Set` size = 136. |
| dora indicator is a documented fixed position within the dead wall | `INITIAL_DORA_INDICATOR_INDEX = 4` constant + doc comments + position property (`dead[4]` = `wall[126]`, ∀ seed) + seed-1 golden (`24`, the first 7m). |
| same seed yields an identical partition | Determinism property: two builds+partitions deep-equal, arrays fresh per call. |
| purity.test.ts still passes (no new imports into core) | Zero imports added anywhere (wall.ts only widened its existing `./tiles` import); the gate ran green in the full suite. |

## Test coverage assessment

- **Covered well:** every new export is exercised through the barrel; conservation,
  position, determinism, and non-mutation are all ∀-seed properties; the guard has
  examples at 0/135/137; the convention has a golden. Pre-existing rng/wall goldens
  passing doubles as proof the frozen stream was unperturbed.
- **Gaps, judged acceptable:**
  - `partitionWall` is only property-tested against *seeded* walls plus degenerate
    length cases — not arbitrary 136-length arrays. The function is slice arithmetic;
    seeded permutations cover the domain that exists in practice.
  - Tile-id *values* are not validated (deliberate, per the tiles.ts boundary rule —
    log-parser's job).
  - The dead-wall layout map beyond index 4 is documentation, not code — untestable
    until the kan/ura tickets give it behavior. Flagged for those tickets below.

## Open concerns / notes for humans

1. **The layout map (`[0..3]` rinshan, interleaved dora/ura pairs) is now written down
   but unconsumed.** The future kan ticket must build on it rather than re-derive its
   own — if a reviewer disagrees with interleaved-pairs vs. blocked layout, **now** is
   the cheap moment to say so, before T-002-01-04 freezes `WallPartition` into the
   fold's public state. Rationale for the choice is in design.md §3.
2. **`doraIndicator` is exposed as a redundant convenience field** (always
   `dead[INITIAL_DORA_INDICATOR_INDEX]`), pre-read for T-002-01-04's table state. The
   invariant is property-tested, so the redundancy cannot drift silently.
3. **No wall-replenishment modeling**: real kans shift the live/dead boundary. The
   partition models the *initial* wall only; the kan ticket owns whether replenishment
   is a re-partition or a live-wall haircut. Nothing here precludes either.
4. Worktree hygiene: lisa's ticket-frontmatter edits (`phase: ready → research`) were
   present throughout and deliberately left uncommitted.

## Handoff state

- Ready for T-002-01-03 (deal from `live`, front-to-back) and, jointly with
  T-002-01-01's mapping, for T-002-01-04's fold.
- Commits: `89a90e5` (code), plus one artifacts commit following this file.
- TODOs left in code: none.
