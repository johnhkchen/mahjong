# T-002-02-01 — Structure: render dealt hand on table

The blueprint: which files change, their public shapes, internal organization, and
ordering. All changes are in `src/app/`; `src/core/` is untouched.

## 1. File manifest

| File | Change | Role after this ticket |
| --- | --- | --- |
| `src/app/Tile.svelte` | **created** (~45 lines) | The one tile-face renderer: `TileId` in, chip markup out. Future tile-art reskin point. |
| `src/app/Table.svelte` | **modified** (prop swap + east-seat hand + center rewrite) | Stateless view of `TableState`: seats, player hand, center (indicator + live count). |
| `src/app/App.svelte` | **modified** (derivation swap, ~4 lines) | State owner: holds the record's ingredients, folds, passes `table` down. |
| `src/app/app.ssr.test.ts` | **rewritten** (~65 lines) | SSR assertions per design §8. |

Not touched: `src/core/**` (frozen — all needed exports exist), `src/app/main.ts`,
build/config files, `index.html`, justfile. No deletions.

## 2. `src/app/Tile.svelte` (new)

```
<script lang="ts">
  import { kindOf, suitOf, type TileId } from '../core'
  let { id }: { id: TileId } = $props()
  const kind = $derived(kindOf(id))
</script>

<span class="tile {suit class via suitOf(kind)}">{kind}</span>

<style> .tile chip: light face, rounded rect, monospace-ish kind text,
        per-suit text color (m red-brown / p blue / s green / z ink) </style>
```

- **Interface**: one required prop `id: TileId`. No events, no slots, no state.
- Header comment: presentational leaf; the future tile-art ticket replaces this
  component's internals (kind text → original SVG face) and nothing else moves.
- Imports only from `'../core'` (the barrel), like every app file.
- The suit class is presentation styling only — the test never references classes.

## 3. `src/app/Table.svelte` (modified)

Prop contract change (the only public-shape change in the app):

```
- let { wall }: { wall: readonly TileId[] } = $props()
+ let { table }: { table: TableState } = $props()
```

Internal additions:

- `const hand = $derived(sorted copy of table.hands[0] by kindIndexOf(kindOf(id)))`
  — the Seat-0 (East = the player) hand in canonical display order. The header
  comment updates: Table still never *derives game facts*; sorting is presentation
  per core's own contract (deal.ts / TableState doc comments).
- East seat markup grows a hand row **inside the existing `.seat.east` cell**, after
  the wind label:
  `<ul class="hand" aria-label="your hand"> {#each hand as id (id)} <li><Tile {id}/></li> {/each} </ul>`
  Keyed by `id` (stable physical identity; duplicate kinds exist). A `<ul>` because
  it *is* a list of 13 things; `aria-label` names the region per the test idiom.
- `.center` rewritten: the wall-count placeholder markup (`.count`/`.label` spans
  showing `wall.length` / "tiles in the wall") is **removed**, replaced by:
  `<Tile id={table.doraIndicator} />` wrapped in an element with
  `aria-label="dora indicator"` + a visible "dora indicator" label, and a secondary
  line `{table.live.length} tiles left`.
- `SEATS` const and the seat loop are unchanged (structure §7 of design: other seats
  untouched); grid CSS unchanged except whatever the east cell needs to lay out the
  hand row (flex column already; add hand-row flex + tile sizing, `list-style: none`).
- Imports become: `Tile` from `'./Tile.svelte'`; `kindIndexOf`, `kindOf`,
  `type TableState` from `'../core'` (`TileId` type import drops out if unused).

## 4. `src/app/App.svelte` (modified)

```
- import { buildWall } from '../core'
+ import { foldRecord } from '../core'
  ...
  let seed = $state(1)                       (unchanged, comment intact)
- const wall = $derived(buildWall(seed))
+ const table = $derived(foldRecord({ seed, actions: [] }))
  ...
- <Table {wall} />
+ <Table {table} />
```

The derivation comment updates to say: the app's authoritative state is the hand
record (seed + empty action log for now); everything on the table is a fold of it —
the CLAUDE.md invariant, now literally the app's data flow. Styles unchanged.

## 5. `src/app/app.ssr.test.ts` (rewritten)

Keeps: the header-comment idiom (content + aria only), `BOOT_SEED = 1` with its
sync-point comment, `render(App)` from `svelte/server`, the winds-exactly-once test,
the `aria-label="mahjong table"` landmark test.

Replaces the wall-count test with (names indicative):

- `it('renders exactly the 13 dealt tiles and the dora indicator, derived via the core fold')`
  — `const table = foldRecord({ seed: BOOT_SEED, actions: [] })`;
  `expected = [...table.hands[0].map(kindOf), kindOf(table.doraIndicator)]`;
  `actual = [...body.matchAll(/>([1-9][mpsz])</g)].map(m => m[1])`;
  compare as multisets: `expect(actual.toSorted()).toEqual(expected.toSorted())`.
  (14 tokens total — proves containment *and* that nothing extra renders tiles.)
- `it('names the hand and dora-indicator regions for assistive tech')` —
  `aria-label="your hand"`, `aria-label="dora indicator"` present.
- `it('replaces the wall-count placeholder with the live-wall remaining count')` —
  body contains `` `${table.live.length}` `` (as `>70<`-ish content match) and does
  **not** contain `tiles in the wall`.

Imports from `'../core'`: `foldRecord`, `kindOf`. (`buildWall` import drops.)

## 6. Module/boundary invariants preserved

- **Dependency direction**: `main → App → Table → Tile`, every app file importing
  core **only via `'../core'`** (the barrel). Core imports nothing from app (purity
  gate keeps enforcing core-side).
- **No engine logic in app** (AC b): app calls `foldRecord`, `kindOf`, `kindIndexOf`,
  `suitOf` — all public core accessors; the only app-side computations are a
  presentation sort and `.length` reads. Nothing re-derives deal/wall/dora facts.
- **State ownership**: App holds state (`seed`), Table/Tile are `$props()`-only.
- **Single-file gate** untouched: one more `.svelte` component compiles into the same
  inlined bundle; no new assets, no new imports outside the graph.

## 7. Ordering of changes

Single atomic slice — the four files must land together to stay green (swapping App's
derivation breaks the old test; the new test needs the new markup):

1. `Tile.svelte` (leaf, compiles standalone),
2. `Table.svelte` (consumes Tile, new prop shape),
3. `App.svelte` (feeds the new prop),
4. `app.ssr.test.ts` (asserts the result),
then `just test && just check && just build` as the gate, one code commit.

## 8. Size expectations

Tile ~45 lines (mostly chip CSS); Table delta ~+45/−15 (hand row, center rewrite,
tile-row CSS); App delta ~±6; test ~65 lines total. No file approaches a size that
needs splitting.
