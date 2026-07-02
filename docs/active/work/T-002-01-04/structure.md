# T-002-01-04 — Structure: hand-record fold entrypoint

File-level blueprint for the design in design.md. The shape of the code, not the code.

## 1. Files touched

| File | Change | Contents |
| --- | --- | --- |
| `src/core/record.ts` | **create** | The record/fold module: `HandAction`, `HandRecord`, `TableState`, `foldRecord`. ~70 lines with doc comments. |
| `src/core/record.test.ts` | **create** | Property tests, guard test, golden test. ~130 lines. |
| `src/core/index.ts` | **modify** | Add `export * from './record'` (one line, after `./deal` — dependency order). |

Nothing else changes. `tiles.ts`, `rng.ts`, `wall.ts`, `dora.ts`, `deal.ts` and their
tests are frozen and untouched. No app code. `purity.test.ts` needs no edit (auto-globs;
its known-files guard asserts containment of existing files only).

## 2. `src/core/record.ts` — module layout

Header comment: the keystone made code — a hand is its record (seed + ordered action
log); table state is always derived by folding the pure engine over it; this module is
the contract layer every later epic (replay, undo, review, AI, app) reads through.

Imports (purity-gate compliant, `./`-siblings only; no quoted bare-package-looking
strings in comments):

```ts
import { kindOf, type TileId, type TileKind } from './tiles'
import { buildWall, partitionWall } from './wall'
import { doraKindOf } from './dora'
import { dealHands } from './deal'
```

Public surface, in order:

1. `export type HandAction = never`
   Doc: the ordered-log element type and the engine's action vocabulary — currently
   empty (no draw/discard/call exists in this slice), so the only well-typed log is
   `[]`. Draw/discard/call tickets widen this union; the name, not the shape, is the
   extension point. The action *encoding*, once defined, becomes part of the replay
   contract — deliberately not stubbed here.
2. `export interface HandRecord`
   - `seed: number` — canonical domain integers [0, 2^32), normalized `>>> 0` by the
     rng (rng.ts contract); seeds arriving from outside the program are validated at
     the future log-parser boundary, per the TileId precedent.
   - `actions: readonly HandAction[]` — the ordered action log. A hand IS this pair
     plus nothing (architecture keystone); doc points at replay/undo/review being
     folds over prefixes of it.
3. `export interface TableState`
   Doc: **a derived view, not a frozen contract** — the record and the frozen
   derivation conventions (rng stream, wall orientation, deal map) are the replay
   format; this shape may grow fields (discard piles, melds, turn) in later tickets
   without invalidating stored hands.
   - `hands: readonly [TileId[], TileId[], TileId[], TileId[]]` — seat-indexed
     (`Seat`: 0 = East … 3 = North), each 13 tiles in draw order, never sorted. Fresh
     arrays per fold.
   - `live: TileId[]` — 70 post-deal live-wall tiles in draw order; `live[0]` is the
     dealer's first draw. Fresh per fold.
   - `dead: TileId[]` — 14 tiles, layout per `WallPartition.dead`'s frozen table.
     Fresh per fold.
   - `doraIndicator: TileId` — the flipped physical tile,
     `dead[INITIAL_DORA_INDICATOR_INDEX]`.
   - `dora: TileKind` — the mapped dora kind, `doraKindOf(kindOf(doraIndicator))`.
4. `export function foldRecord(record: HandRecord): TableState`
   - Doc: fold entrypoint — record in, table state out; folding the empty log yields
     the freshly dealt table because the deal is the seed's own derivation, not an
     action. Pure: no RNG beyond the seed's wall build, record untouched, fresh arrays
     out. Same record → same state, forever (the composed frozen conventions).
   - Guard: `if (record.actions.length > 0) throw new RangeError(...)` — message says
     the action vocabulary is empty in this engine slice; an uninterpretable action
     must never fold silently into a wrong state (nextInt precedent). This guard IS
     the step function for an empty vocabulary; action tickets replace it.
   - Body: `const { dead, doraIndicator } = partitionWall(buildWall(record.seed))`
     (destructure live too), `const deal = dealHands(live)`, return
     `{ hands: deal.hands, live: deal.live, dead, doraIndicator,
     dora: doraKindOf(kindOf(doraIndicator)) }`.

No default export. No private helpers expected (~10 lines of body).

## 3. `src/core/record.test.ts` — test layout

Imports from `./index` (public-barrel idiom — doubles as AC (d)'s executable check):
`foldRecord`, `buildWall`, `partitionWall`, `dealHands`, `doraKindOf`, `kindOf`,
`TILE_COUNT`, `SEAT_COUNT`, `STARTING_HAND_SIZE`, types `HandRecord`, `TableState`,
plus `fc`/vitest.

File-top: `seedArb` (copied idiom, bounds `[0, 0xffffffff]`) and
`recordOf(seed): HandRecord` → `{ seed, actions: [] }`.

`describe('hand-record fold entrypoint')` with, in order:

1. `it('folds an empty action log to the freshly dealt table — the explicit
   build → partition → deal → dora composition, for any seed (property)')` — AC (a).
   Builds the expected state via the explicit chain in the test body and deep-equals
   `foldRecord(recordOf(seed))` against it, field by field via one `toEqual` on the
   whole object.
2. `it('same seed → identical deal (property)')` — AC (b), named verbatim: two
   independently constructed records, `expect(b.hands).toEqual(a.hands)`.
3. `it('same record → same folded state, deep-equal across repeated folds, as fresh
   arrays (property)')` — AC (c): one record object folded twice; `toEqual` on states;
   `not.toBe` on `hands`, each `hands[s]`, `live`, `dead`.
4. `it('does not mutate the record (property)')` — snapshot `{...record}` +
   `[...record.actions]` compare after folding.
5. `it('conserves all 136 tiles across hands + live + dead through the fold (property)')`
   — lengths (4 hands × 13, live 70, dead 14) and 136-distinct-ids set check.
6. `it('rejects a record whose action log is non-empty — no action vocabulary exists
   yet')` — `foldRecord({ seed: 1, actions: [0] as unknown as HandRecord['actions'] })`
   throws RangeError (single deliberate cast, commented as simulating a corrupt/ahead
   record arriving from JS).
7. `it('reproduces the frozen fold for seed 1 — a mismatch means the record contract
   moved and every stored hand replays wrong')` — golden: hands = the four
   deal.test.ts literals; `dead` = the wall.test.ts dead-wall literal;
   `doraIndicator === 24`; `dora === '8m'`; `live.slice(0, 4)` = `[100, 60, 14, 66]`.
   Comment: literals reused from the already-frozen deal/wall goldens (provenance:
   T-002-01-03 / T-002-01-02 progress.md); `'8m'` derived by hand (id 24 → kind index
   6 → `7m`, dora cycle → `8m`) and cross-checked at capture time via a scratchpad
   run. Never regenerate.

## 4. `src/core/index.ts` — barrel

```ts
export * from './record'
```

appended after `./deal`. Name-collision check (`export *` drops ambiguous names
silently): `HandAction`, `HandRecord`, `TableState`, `foldRecord` against all current
exports of tiles/rng/wall/dora/deal — no collisions (verified against research.md §2).

## 5. Golden-capture procedure (feeds plan.md)

Lighter than prior tickets because every array literal is already frozen elsewhere:

1. Reuse verbatim: four hands (deal.test.ts golden), dead wall + indicator 24
   (wall.test.ts golden), remaining-live prefix `[100, 60, 14, 66]`
   (deal.test.ts golden).
2. The single new fact is the mapped dora kind. Derive by hand from frozen contracts:
   id 24 → `Math.floor(24/4) = 6` → `TILE_KINDS[6] = '7m'` → numbered-cycle dora
   `'8m'`. Cross-check with a throwaway scratchpad script (never committed) that
   prints `foldRecord({seed: 1, actions: []}).dora` and the hand-derived value; both
   must agree before pinning.

## 6. Ordering of changes

1. `record.ts` (module compiles standalone).
2. Barrel line in `index.ts` (public surface exists; `just check` clean — AC (d)).
3. `record.test.ts` properties + guard (tests 1–6).
4. Golden cross-check (§5), then the golden test (test 7).
5. Full `just test` + `just check`.

Steps 1–2 before 3 because tests import from `./index`. No parallel-ticket conflicts:
this is the last open ticket of S-002-01, and T-002-02-01 (app-side) depends on it.
