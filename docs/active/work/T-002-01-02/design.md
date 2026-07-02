# T-002-01-02 — Design: wall partition and dead wall

Decisions for turning `buildWall`'s bare permutation into a legal riichi wall: API shape,
orientation, dead-wall layout, and the initial dora indicator position. Grounded in
research.md; each decision lists what was rejected and why.

## 1. API shape — a pure partition function over a wall array

**Chosen: `partitionWall(wall: readonly TileId[]): WallPartition`** — a pure function
that takes an already-built wall and returns `{ live, dead, doraIndicator }` as fresh
arrays/values, leaving `buildWall` untouched.

```ts
interface WallPartition {
  live: TileId[]          // 122 tiles, in draw order
  dead: TileId[]          // 14 tiles, layout documented below
  doraIndicator: TileId   // === dead[INITIAL_DORA_INDICATOR_INDEX], pre-read for callers
}
```

Rejected alternatives:

- **B: `buildPartitionedWall(seed)` replacing `buildWall` as the entry point.** Couples
  the shuffle and the partition into one opaque step. The record contract says the seed
  *is* the wall order; keeping `buildWall(seed) → sequence` as the frozen primitive and
  deriving structure from it separately mirrors "table state is always derived." It also
  lets property tests feed *arbitrary* permutations to the partition, not just seeded
  ones, and keeps T-002-01-01/03/04 free to compose the pieces they need.
- **C: change `buildWall` to return the structure.** Breaks `wall.test.ts`'s frozen
  contract tests and every documented caller expectation for no benefit. `buildWall`'s
  own header comment promised this ticket would layer *on top of* the sequence, not
  rewrite it.
- **Destructive splice** (consume the input array, per `buildWall`'s "callers may consume
  it destructively" note): that note grants *callers* permission; the partition is a
  derivation, and derivations in this codebase are pure. Fresh `slice()`s cost nothing at
  n=136 and make "same seed → identical partition, as fresh arrays" trivially testable —
  the exact idiom `wall.test.ts` already uses for `buildWall` itself.

`partitionWall` composes: `partitionWall(buildWall(seed))`. T-002-01-04's fold will do
exactly this. No RNG draws happen inside the partition, so the frozen mulberry32 stream
is untouched (research.md §3.2).

## 2. Orientation — dead wall is the LAST 14 tiles; live wall draws from index 0

**Chosen: `live = wall.slice(0, 122)`, `dead = wall.slice(122)`.** The live wall is
consumed front-to-back: `live[0]` is the first tile dealt.

Rationale:

- Some fixed convention is required (research.md §7); the rules only constrain sizes, not
  linearization. Front-to-back draw order is the natural reading of an array and the
  convention major digital implementations (Tenhou-style linearizations) use: deal from
  the head, dead wall at the tail.
- T-002-01-03 deals "in E/S/W/N dealer order from the live wall" — `live[0], live[1], …`
  gives it an obvious, documentable draw sequence with no index arithmetic from the far
  end.
- The frozen seed-1 prefix test (`buildWall(1).slice(0, 12)`) already reads the head of
  the array as "the first tiles"; putting the deal there keeps one mental model.

Rejected: **dead wall at the front** (`wall.slice(0, 14)`) — no benefit, and it would
put the deal at an offset instead of 0. **Live wall drawn from the tail** (pop()-style) —
efficient for destructive consumption but reverses the reading order of the frozen
prefix and of every future log; clarity wins over a micro-optimization the engine (which
folds immutably) would never use.

Once shipped, this orientation is **frozen** exactly like the RNG stream: a stored seed
plus the replay fold must reproduce the same deal forever. The golden test (§5) pins it.

## 3. Dead-wall internal layout — documented now, consumed later

The 14 dead-wall tiles get a fixed, documented index map (research.md §4: 4 rinshan +
5 dora indicators + 5 ura indicators):

| `dead[i]` | Role |
| --- | --- |
| 0–3 | Rinshan (kan replacement) draws, in draw order |
| 4, 6, 8, 10, 12 | Dora indicators — initial flip at 4; kan flips walk rightward |
| 5, 7, 9, 11, 13 | Ura-dora indicators, each paired directly after its dora indicator |

**Only the initial indicator is *exposed* by this ticket** (as `doraIndicator` and the
`INITIAL_DORA_INDICATOR_INDEX = 4` constant). The rest of the map ships as documentation
in `wall.ts` so the future kan/ura tickets extend a written convention instead of
inventing one against frozen data. This satisfies the AC's "documented fixed position"
with the strongest form of documentation the repo has: a constant + doc comment + a
golden test.

Rationale for indicator-at-4 with interleaved ura: it directly mirrors the physical dead
wall (rinshan tiles at the open end, indicator stacks behind them, ura beneath each
indicator) flattened pairwise, and it keeps every future flip a pure index computation
(`4 + 2k` for the k-th indicator). Rejected: **indicator at dead[2]** or other ad-hoc
indices — no physical analogue, and rinshan draws would straddle the indicator; **blocked
layout** (rinshan 0–3, doras 4–8, uras 9–13) — equally workable, but loses the
pairing-under-the-indicator physical intuition and makes each kan flip touch two distant
indices. Any fixed map would satisfy the rules; this one is chosen for legibility and
then frozen.

## 4. Validation and types

- `partitionWall` throws a `RangeError` if `wall.length !== TILE_COUNT`. Precedent:
  `nextInt`'s loud guard — "a bad bound is a programmer error inside the engine, so it
  fails loudly." A 135-tile wall is corruption, never a valid state. (TileId *values* are
  not validated, per the tiles.ts boundary rule: ids from outside are validated at the
  log-parser boundary.)
- Input is `readonly TileId[]` — the signature advertises purity.
- Constants exported: `LIVE_WALL_SIZE = 122`, `DEAD_WALL_SIZE = 14`,
  `INITIAL_DORA_INDICATOR_INDEX = 4`. `LIVE_WALL_SIZE` is derived
  (`TILE_COUNT - DEAD_WALL_SIZE`) so the 136 = 122 + 14 identity is visible in code.
- Everything lands in `src/core/wall.ts` (same concern, already barrel-exported;
  research.md §5 notes this also avoids any file overlap with parallel T-002-01-01).

## 5. Test design (the AC, itemized)

All in `wall.test.ts`, new `describe('wall partition')`, existing idioms:

1. **Conservation property** (∀ seed): `live.length === 122`, `dead.length === 14`,
   `[...live, ...dead]` deep-equals `buildWall(seed)` — which is *stronger* than the AC's
   set-equality ("re-assemble to exactly the 136 distinct tile ids"): order-preserving
   concatenation implies it, given the already-tested wall census.
2. **Indicator position property** (∀ seed): `doraIndicator === dead[4] === wall[126]`.
3. **Determinism property** (∀ seed): two `partitionWall(buildWall(seed))` calls
   deep-equal, with fresh (non-identical) arrays.
4. **Purity property** (∀ seed): `partitionWall` does not mutate its input.
5. **Guard test**: length 135 / 137 / 0 throws RangeError.
6. **Golden test**: seed 1's `doraIndicator` pinned to its concrete value (derived from
   the frozen wall, cross-checked by hand from the frozen prefix machinery before
   pinning), named so a failure reads as "the partition convention moved — every stored
   seed's dora is now wrong."
7. `purity.test.ts` passes unchanged — the work adds zero imports.

## 6. What this design deliberately leaves undone

No dealing (T-002-01-03), no indicator→kind mapping (T-002-01-01), no kan/rinshan/ura
mechanics (future tickets — they get a documented map, not code), no wall-replenishment
modeling, no action-log types (T-002-01-04). The public surface grows by exactly one
function, one interface, and three constants.
