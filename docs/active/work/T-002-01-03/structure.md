# T-002-01-03 — Structure: deal four starting hands

File-level blueprint for the design in design.md. The shape of the code, not the code.

## 1. Files touched

| File | Change | Contents |
| --- | --- | --- |
| `src/core/deal.ts` | **create** | The deal module: `Seat`, constants, `Deal`, `dealHands`. ~60 lines with doc comments. |
| `src/core/deal.test.ts` | **create** | Property tests, guard test, golden test. ~120 lines. |
| `src/core/index.ts` | **modify** | Add `export * from './deal'` (one line, keeps barrel-order alphabet-of-dependency: tiles, rng, wall, dora, deal). |

Nothing else changes. `wall.ts`, `tiles.ts`, `rng.ts`, `dora.ts` and their tests are
frozen and untouched. No app code. `purity.test.ts` needs no edit (auto-globs; its
known-files guard asserts containment of existing files only).

## 2. `src/core/deal.ts` — module layout

Header comment: dealing is the first consumer of the live wall; states the frozen
4-4-4-1 convention and that the module never touches the RNG.

Imports (purity-gate compliant, `./`-siblings only):

```ts
import { LIVE_WALL_SIZE } from './wall'
import type { TileId } from './tiles'
```

Public surface, in order:

1. `export type Seat = 0 | 1 | 2 | 3`
   Doc: seat index in E/S/W/N dealer order — 0 = East (dealer), 1 = South, 2 = West,
   3 = North; anchored to the same ordering as honor kinds 1z–4z.
2. `export const SEAT_COUNT = 4`
3. `export const STARTING_HAND_SIZE = 13`
   Doc: the dealer's 14th tile is the first draw of play, not part of the deal.
4. `export const DEAL_SIZE = SEAT_COUNT * STARTING_HAND_SIZE` (= 52)
   Derived expression, the `LIVE_WALL_SIZE` precedent — the identity is visible in code.
5. `export interface Deal`
   - `hands: readonly [TileId[], TileId[], TileId[], TileId[]]` — 4-tuple indexed by
     `Seat`; each hand is 13 tiles **in draw order** (never sorted — sorting is
     presentation). Fresh arrays per call.
   - `live: TileId[]` — the 70 remaining live-wall tiles in draw order; `live[0]` is the
     dealer's first draw. Fresh array per call.
6. `export function dealHands(live: readonly TileId[]): Deal`
   - Doc comment carries the **CONTRACT FREEZE** block (the partitionWall precedent):
     the 4-4-4-1 index map — round r ∈ {0,1,2}, seat s: `live[16r + 4s .. 16r + 4s + 3]`;
     final single `live[48 + s]`; remainder `live.slice(52)` — is part of the replay
     format; moving it silently changes every stored hand.
   - Guard: `if (live.length !== LIVE_WALL_SIZE) throw new RangeError(...)` with the got
     value in the message (nextInt/partitionWall precedent). TileId values not validated
     (log-parser-boundary rule).
   - Body: build four hand arrays by the index map (double loop or explicit pushes —
     implementer's choice, but the loop mirrors the r/s formula in the docs), then
     `live.slice(DEAL_SIZE)`. Input never mutated; output arrays all fresh.

No default export (repo has none). No other private helpers expected.

## 3. `src/core/deal.test.ts` — test layout

Imports from `./index` (the wall.test.ts idiom — tests exercise the public barrel):
`buildWall`, `partitionWall`, `dealHands`, `DEAL_SIZE`, `LIVE_WALL_SIZE`,
`SEAT_COUNT`, `STARTING_HAND_SIZE`, `TILE_COUNT`, plus `fc`/vitest.

File-top helper: `seedArb` (copied idiom, same bounds `[0, 0xffffffff]`) and a
`dealFor(seed)` convenience chaining build → partition → deal, returning the pieces the
properties need (wall, partition, deal).

`describe('deal four starting hands')` with, in order:

1. `it('conserves all 136 tiles across hands + remaining live wall + dead wall, 13 per
   hand, for any seed (property)')` — AC clause (a). Asserts each of 4 hands has
   length `STARTING_HAND_SIZE`, `deal.live.length === LIVE_WALL_SIZE - DEAL_SIZE`,
   concatenation of hands + deal.live + dead has length `TILE_COUNT` and set size
   `TILE_COUNT`.
2. `it('deals hands in E/S/W/N seat order by the frozen 4-4-4-1 procedure (property)')`
   — AC clause (b). Rebuilds each expected hand from the documented index map over the
   input live wall and deep-equals against `hands[s]`; also asserts
   `deal.live` equals `live.slice(DEAL_SIZE)`.
3. `it('produces an identical deal for the same seed, as fresh arrays (property)')` —
   AC clause (c). Two chains deep-equal; `not.toBe` on `hands`, each `hands[s]`, and
   `live`.
4. `it('does not mutate the input live wall (property)')` — snapshot compare.
5. `it('rejects live walls that are not exactly 122 tiles')` — lengths
   `[0, 52, 121, 123, 136]` throw RangeError.
6. `it('reproduces the frozen deal for seed 1 — a mismatch means the deal convention
   changed and every stored seed's hands are invalid')` — golden: all four 13-tile
   hands pinned as literal arrays plus the first few tiles of the remaining live wall
   (e.g. `deal.live.slice(0, 4)`), values captured per §5. Comment: captured once,
   cross-checked independently, never regenerate.

## 4. `src/core/index.ts` — barrel

```ts
export * from './deal'
```

appended after `./dora`. Name-collision check (export * silently drops ambiguous names,
so this matters): `Seat`, `SEAT_COUNT`, `STARTING_HAND_SIZE`, `DEAL_SIZE`, `Deal`,
`dealHands` collide with nothing in tiles/rng/wall/dora (verified against current
exports in research.md §2).

## 5. Golden-capture procedure (feeds plan.md)

The golden values are derived, not invented:

1. Throwaway script in the scratchpad (never committed) imports `buildWall`,
   `partitionWall` from core, applies the §2 index map **written out independently**
   (explicit index lists, not by calling `dealHands`) to seed 1, prints hands + first
   remaining live tiles.
2. Run `dealHands` on the same input; both derivations must agree tile-for-tile.
3. Sanity anchor: East's first four tiles must equal the already-frozen wall.test.ts
   prefix `buildWall(1).slice(0, 4)` = `[64, 53, 95, 45]`, and `deal.live[0]` must be
   `buildWall(1)[52]`.
4. Pin the agreed values as literals in the golden test.

## 6. Ordering of changes

1. `deal.ts` (module compiles standalone).
2. Barrel line in `index.ts` (public surface exists; `just check` clean).
3. `deal.test.ts` properties + guard (everything but the golden).
4. Golden capture (§5), then the golden test.
5. Full `just test` + `just check`.

Steps 1–2 before 3 because tests import from `./index`. Nothing here conflicts with
parallel tickets: T-002-01-04 depends on this ticket, and no other open ticket touches
`src/core/`.
