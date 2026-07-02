# T-002-01-03 — Research: deal four starting hands

Descriptive survey of what exists and what constrains this ticket. No solutions here
(that is design.md).

## 1. The ticket in one line

Deal four 13-tile starting hands in E/S/W/N dealer order from the live wall produced by
T-002-01-02 — "the first legal slice of a finishable hand."

Acceptance criterion (one property test, three clauses): over random seeds, (a) 4×13 hand
tiles + dead wall + remaining live wall together are exactly the 136 distinct tile ids
with no duplicates, (b) hands arrive in E/S/W/N seat order, and (c) the same seed
produces the identical deal.

`depends_on: [T-002-01-02]` — satisfied: the wall partition is committed (89a90e5) and
its conventions are frozen.

## 2. What exists in `src/core/` today

Five runtime modules plus tests; `src/core/` is the pure engine, with the zero-DOM rule
enforced executably by `purity.test.ts`.

| File | Contents relevant to this ticket |
| --- | --- |
| `src/core/wall.ts` | `buildWall(seed)` — frozen seeded permutation of all 136 ids — and `partitionWall(wall)` → `WallPartition { live, dead, doraIndicator }`. `live` is 122 tiles **in draw order: `live[0]` is the first tile dealt** (documented on the interface). `LIVE_WALL_SIZE = 122`, `DEAD_WALL_SIZE = 14`, `INITIAL_DORA_INDICATOR_INDEX = 4` exported. The header comment reserves this ticket's work: "Deal order and calls remain positions/consumers within this sequence, owned by later tickets." |
| `src/core/tiles.ts` | The tile domain. `TileId` = integer 0–135, `TILE_COUNT = 136`, `kindOf(id)` decodes. Import-free foundation. No seat/wind concept exists here beyond honor kinds `1z`–`4z` being documented as East, South, West, North. |
| `src/core/rng.ts` | mulberry32 kit under contract freeze — the output stream is part of the replay format. Dealing must not draw from the RNG (the wall order already encodes everything). |
| `src/core/dora.ts` | `doraKindOf(indicator)` (T-002-01-01) — kind-level rules knowledge. Shows the "new concern → new sibling module" pattern: one small file, imports only `./tiles`, barrel-exported. |
| `src/core/index.ts` | The barrel — core's public face. Currently `export * from` tiles/rng/wall/dora. A new module must be added here to be public. |
| `src/core/wall.test.ts` | The test idiom to extend: `seedArb = fc.integer({min: 0, max: 0xffffffff})`, fast-check properties per invariant, purity (input-not-mutated) properties, loud-guard tests, and **frozen goldens for seed 1** (wall prefix `[64, 53, 95, …]`; dead wall `[80, 41, 88, 6, 24, …]`, indicator `24`) whose names explain what a failure means. |
| `src/core/purity.test.ts` | Runtime core modules may import only `./`-siblings; test files add only `vitest`/`fast-check`/`node:`. Scans raw source **including comments** — a quoted bare specifier in a comment fails the gate. |

There is no dealing, hand, or seat code anywhere in the repo yet
(`grep -ri 'deal|hand|seat' src/core/*.ts` matches only comments). `src/app/` still
renders a placeholder table and imports nothing dealt.

## 3. Frozen conventions this ticket inherits (may not reinterpret)

From T-002-01-02's design/implementation, now part of the replay contract:

1. **Orientation**: dead wall is the *last* 14 tiles of `buildWall(seed)`; the live wall
   is `wall.slice(0, 122)` consumed **front-to-back** — `live[0]` is the first tile
   dealt. The deal must consume from index 0 upward.
2. **Purity of derivations**: `partitionWall` takes `readonly TileId[]`, returns fresh
   slices, never mutates, never touches the RNG. Established explicitly as "derivations
   in this codebase are pure" (T-002-01-02 design §1) despite `buildWall`'s
   "callers may consume destructively" note, which grants permission only to true
   consumers.
3. **Loud guards**: a wrong-length wall throws `RangeError` (the `nextInt` precedent —
   corruption inside the engine fails loudly). TileId *values* are not validated;
   outside ids are validated at the future log-parser boundary.
4. **Golden tests**: concrete seed-1 values pinned once, cross-checked independently at
   capture time, never regenerated (see both prior progress.md files).

## 4. Riichi domain facts the deal must respect

- Each player starts with **13 tiles**; the dealer's 14th is the first *draw* of play,
  not part of the deal. 4 × 13 = 52 tiles leave the live wall, leaving 122 − 52 = **70
  live tiles** for draws.
- Seats are **East, South, West, North**; East is the dealer and takes tiles first.
  Deal order is by seat, East first — the ticket's "E/S/W/N dealer order."
- The physical procedure deals in **three rounds of 4 tiles per player** (E,S,W,N; ×3 =
  12 each), then **1 final tile each** in the same order (the dealer traditionally takes
  two at once — 14th being the first draw — but engine-wise 13 + first-draw is the clean
  decomposition). On a linearized wall this fixes *which* live-wall indices land in
  which hand: a convention the engine must pick and document, exactly like the
  dead-wall layout question in T-002-01-02 §7. Since the wall is a uniform permutation,
  chunked-vs-contiguous assignment is statistically indistinguishable — the choice is
  about legibility, physical fidelity, and cross-engine comparability, not fairness.
- Hands have no inherent order in the rules; players sort for comfort. Whether the
  engine stores hands in draw order or sorted is a convention decision (sorting is
  presentational vs. draw order being part of the record).

## 5. Neighboring tickets — the boundary this ticket must not cross

| Ticket | Relationship |
| --- | --- |
| T-002-01-02 wall-partition (done) | Producer. This ticket consumes `WallPartition.live`. Nothing in `wall.ts` should need to change. |
| T-002-01-01 dora-mapping (done) | Independent; the deal never interprets tile kinds. |
| T-002-01-04 hand-record-fold-entrypoint | `depends_on: [T-002-01-01, T-002-01-03]`. Its fold of an empty action log must yield "live/dead wall, dora indicator + mapped dora, **four hands, seats**" — so this ticket's return shape and any seat naming become part of core's public contract that the fold re-exports. Whatever "seat" means to core is effectively decided here or there; here is first. |
| T-002-02-01 render-dealt-hand | App-side; reads "the player's 13 dealt tiles" through T-002-01-04's fold. Confirms hands must be individually addressable by seat. |
| Future draw/discard tickets | Will consume the *remaining* 70-tile live wall in the same front-to-back order, so the deal must return what's left in a defined form. |

Out of scope: the dealer's first draw, turn order/rotation, action-log types, seat wind
assignment across rounds (East stays seat 0 for a single hand), sorting/presentation,
any app code.

## 6. Testing idioms available

- fast-check 4.8.0, vitest 4. Idiom: `fc.assert(fc.property(seedArb, …))` with one named
  property per invariant; `expect(a).not.toBe(b)` for fresh-array checks; explicit
  RangeError guard tests; goldens named as contract alarms.
- `just test` → vitest over `src/**/*.test.ts` (auto-globbed — a new `deal.test.ts` is
  picked up with no config change); `just check` → svelte-check + tsc strict.
- `purity.test.ts` auto-globs `./*.ts`, so a new core module is gated automatically; its
  "guard against silently-empty scan" test lists known files but does not need updating
  for additions (it only asserts containment of four existing files).

## 7. Assumptions and open questions for Design

- **Chunk convention**: physical 4-4-4-1 interleave vs. contiguous 13-tile blocks per
  seat. Both consume `live[0..51]`; the assignment differs and freezes into the replay
  format. (§4 — legibility/fidelity tradeoff, zero statistical difference.)
- **API shape**: pure function over the live wall array vs. over a `WallPartition` vs. a
  seed-taking convenience. Precedent (partitionWall, doraKindOf) favors small pure
  composable derivations.
- **Input strictness**: require exactly 122 tiles (a full pre-deal live wall) or merely
  ≥ 52? The loud-guard precedent and the fact that dealing only ever happens at hand
  start argue for strict.
- **Return shape**: hands as a 4-tuple indexed by seat vs. named fields; remaining live
  wall returned alongside vs. caller re-slicing. T-002-01-04's fold wants both hands and
  remaining wall.
- **Seat representation**: introduce a `Seat` type/constants now (0=East … 3=North) or
  leave seats implicit as array index with documentation. First ticket to face it.
- **Module placement**: new `deal.ts` sibling (the dora.ts precedent, keeps frozen
  wall.ts untouched) vs. extending wall.ts (the partition precedent, same-file concern).
- **Hand tile order**: preserve draw order (record-flavored) vs. sort by id
  (presentation-flavored). Downstream shanten/render code will have opinions; the record
  invariant ("a hand is its record") suggests draw order with sorting left to callers.
