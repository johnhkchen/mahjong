# T-002-01-02 — Research: wall partition and dead wall

Descriptive survey of what exists and what constrains this ticket. No solutions here
(that is design.md).

## 1. The ticket in one line

Partition the existing `buildWall(seed)` sequence into a live wall and a 14-tile dead
wall, and flip the initial dora indicator — turning the bare 136-tile permutation into a
legal riichi wall.

Acceptance criterion: tests assert (a) live + dead re-assemble to exactly the 136
distinct tile ids with the dead wall exactly 14 tiles, (b) the dora indicator is a
**documented fixed position** within the dead wall, (c) the same seed yields an identical
partition, and (d) `purity.test.ts` still passes (no new imports into core).

`depends_on: []` — the wall foundation (T-001-02-02) is committed and frozen.

## 2. What exists in `src/core/` today

Four runtime modules plus tests; `src/core/` is the pure engine with a hard
zero-DOM/zero-framework rule enforced *executably* by `purity.test.ts`.

| File | Contents relevant to this ticket |
| --- | --- |
| `src/core/wall.ts` | `buildWall(seed): TileId[]` — the seeded permutation of all 136 tile ids via `shuffleInPlace(createRng(seed), allTileIds())`. Returns a fresh mutable array per call. Its header comment explicitly reserves this ticket's work: "deal order, dead wall, and dora indicators are positions WITHIN this sequence, owned by later tickets." |
| `src/core/tiles.ts` | The tile domain. `TileId` = integer 0–135; `TILE_COUNT = 136`; `kindOf(id)` decodes. Import-free foundation layer. |
| `src/core/rng.ts` | mulberry32 kit under a **contract freeze**: the output stream is part of the replay format; golden vectors in `rng.test.ts` enforce it. Nothing in this ticket may perturb how many draws `buildWall` consumes. |
| `src/core/index.ts` | The barrel — "core's public face; app code imports only from here." Already does `export * from './wall'`, so new exports from `wall.ts` surface automatically. |
| `src/core/wall.test.ts` | The wall test idiom this ticket extends: `seedArb = fc.integer({min: 0, max: 0xffffffff})`, fast-check properties inside vitest `it` blocks, census/determinism/sensitivity properties, and a **frozen wall prefix for seed 1** (`[64, 53, 95, 45, 98, 42, ...]`) whose failure means the shuffle stream changed. |
| `src/core/purity.test.ts` | The gate named in the AC: every runtime core module may import only `./`-siblings; test files may add only `vitest`, `fast-check`, `node:`. It scans raw source, **including comments** — a quoted specifier in a comment that looks like a forbidden import fails the gate. |

There is no dead wall, no dora, no partition anywhere in the repo yet
(`grep -ri 'dead|dora|live|partition' src/core/*.ts` matches nothing outside comments).

## 3. Architectural constraints that bind this ticket

From CLAUDE.md invariants and `docs/knowledge/architecture.md`:

1. **A hand is its record** — seed = wall order; all table structure is *derived*. The
   dead wall and dora indicator must therefore be pure derivations of the `buildWall`
   sequence (positions within it), never independently random or stateful.
2. **Contract freeze on the RNG stream.** `buildWall` consumes a fixed number of RNG
   draws; the frozen seed-1 prefix test pins this. Partitioning must not draw from the
   RNG at all, or every stored seed is invalidated.
3. **Core purity.** No new imports beyond `./` siblings; no new dependencies. The AC
   names `purity.test.ts` explicitly.
4. **Determinism is a repo invariant** — same seed → identical partition is both an AC
   bullet and the standing "full hands must be deterministically simulatable" rule.
5. **Barrel exports.** Whatever becomes public must be reachable from `src/core/index.ts`
   (already true via `export * from './wall'` if the work lands in `wall.ts`).

## 4. Riichi domain facts the partition must respect

- The physical wall is 136 tiles. The **dead wall is always exactly 14 tiles**; the
  remaining **122 tiles are the live wall** (deal + draws). The dead wall is
  replenished from the live wall after kan draws in physical play, but its *size*
  invariant (14) is what matters to an engine; replenishment mechanics belong to the
  future kan ticket, not here.
- The dead wall physically comprises: **4 rinshan (replacement) tiles** drawn after kans,
  **5 dora-indicator tiles** (initial + up to 4 kan flips), and **5 ura-dora tiles**
  paired beneath the indicators — 4 + 5 + 5 = 14.
- Exactly **one dora indicator is flipped at the start of every hand**. Which tile that
  is, in a linearized wall, is a *convention the engine documents*, not something the
  rules pin to an array index — physical tables differ only in geometry (3rd stack from
  the dead wall's end), so digital engines each fix a documented mapping.
- The **indicator → dora kind mapping** (e.g. 9m→1m wraparound) is T-002-01-01's ticket,
  running in parallel with no dependency edge either way. This ticket stops at *which
  tile id is the indicator*; it never interprets the tile.

## 5. Neighboring tickets — the boundary this ticket must not cross

| Ticket | Relationship |
| --- | --- |
| T-002-01-01 dora-indicator-mapping | Parallel, independent. Owns indicator→dora *kind* semantics. This ticket exposes only the indicator *tile*. Both may touch `src/core/index.ts` exports; DAG says no edge, and if the work stays in `wall.ts` (already barrel-exported) there is no file overlap at all. |
| T-002-01-03 deal-four-starting-hands | `depends_on: [T-002-01-02]`. Will deal 4×13 from **the live wall** this ticket produces; its conservation property test re-asserts live+dead+hands = 136 distinct. So the live wall must come out of this ticket in a defined draw order, consumable from a defined end. |
| T-002-01-04 hand-record-fold-entrypoint | Folds a record into table state including "live/dead wall, dora indicator + mapped dora" — it will read this ticket's structure directly, so field naming here becomes part of core's public contract. |
| Future kan/riichi tickets | Will need rinshan draws and additional indicator flips *from the same 14 tiles*. Nothing forces this ticket to implement them, but the dead wall's internal layout, once documented and frozen, is what they will build on. |

Out of scope for this ticket: dealing hands, rinshan/kan logic, ura dora exposure, dora
kind mapping, any action-log or state-fold machinery.

## 6. Testing idioms available

- fast-check 4.8.0 is installed (dev-only). Idiom: `fc.assert(fc.property(seedArb, ...))`
  with `seedArb` at file top; one named property per invariant.
- The frozen-golden pattern: pin concrete values derived from the frozen stream in a test
  whose *name* says what a failure means. The seed-1 wall prefix is the exemplar; a
  partition golden for seed 1 can be derived from the same frozen wall.
- `just test` → vitest over `src/**/*.test.ts` (auto-globbed); `just check` →
  svelte-check + tsc strict.

## 7. Assumptions and open questions for Design

- **Which end of the array is the dead wall?** `buildWall` returns a linear sequence with
  no orientation yet. T-001-02-02's artifacts deferred this exactly here. Design must fix
  it (and the draw direction of the live wall) permanently — it becomes part of the
  replay contract.
- **Where inside the dead wall does the initial indicator sit?** The AC demands "a
  documented fixed position"; design must choose the index and document the full 14-tile
  layout so later kan/ura tickets extend rather than reinterpret it.
- **API shape**: partition as a pure function over a wall array vs. a seed-taking
  builder vs. changing `buildWall` itself (the last would break its frozen tests).
- **Mutability**: `buildWall` documents "callers may consume it destructively"; the
  partition must decide whether it slices (pure) or splices (destructive).
