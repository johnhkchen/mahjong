# Structure — T-009-03-02: furiten badge and yakuless notice

## Files modified

### `src/core/legal.ts`

Add two exported functions after `ronOffers` (they read the same vocabulary —
`waits`, `winYaku`, `isMenzen`, `SEAT_COUNT` — and belong beside the furiten
doctrine already documented in this file's header):

- `export function furitenSeal(state: TableState, seat: Seat): TileId | null`
- `export function yakulessTenpai(state: TableState, seat: Seat): boolean`

No signature of any existing exported function changes. No new imports (both
reuse `waits`, `kindOf`, `SEAT_COUNT`, `isMenzen`, `winYaku`, all already
present in this file). The module's header comment gets a short addendum
naming the two new exports and their relationship to the furiten doctrine
already documented there (extend-only, matching the file's existing
"Extend-only, like the action vocabulary it mirrors" convention for
`legalActions` itself).

Both are automatically re-exported from `src/core/index.ts`'s
`export * from './legal'` — no barrel change needed.

### `src/core/legal.furiten.test.ts` (new)

A new colocated unit suite, sibling to `legal.win.test.ts`, importing its
seed/prefix-building conventions (`scriptedTurns`, `dealtLive`) rather than
importing the other test file directly (test files don't import each other in
this codebase; the pattern is duplicated per-suite, matching `win.test.ts`
vs. `legal.win.test.ts`'s existing sibling relationship). Covers:

- `furitenSeal` basic case: `FURITEN_SEED = 23798` (reused constant, same
  seed as `legal.win.test.ts`, redeclared locally per convention), 21
  scripted turns, seat 1 — asserts the returned `TileId`'s `kindOf` is `6p`
  and that it is a member of `state.ponds[1]` (own pond).
- `furitenSeal` clears after the seat's own next draw: one more scripted
  draw for seat 1, `furitenSeal` returns `null` again (mirrors
  `legal.win.test.ts`'s own tempFuriten-clears-on-draw assertion, but through
  the new query instead of the raw field).
- `furitenSeal` temp/riichi case: a hand-authored fixture (built inline via
  `foldRecord` + a short scripted prefix, matching `record.test.ts`'s
  "furiten tracking" describe block's own style) where a seat holds tenpai,
  passes on another seat's winning discard, and `furitenSeal` returns that
  physical tile from the OTHER seat's pond, not the seat's own.
- `yakulessTenpai` true case: `YAKULESS_SEED = 12754`, zero actions (seat 2 is
  dealt tenpai on 8s with no yaku from the start — `win.test.ts`'s own
  documented geometry) — asserts `true`.
- `yakulessTenpai` false cases: a riichi-locked seat (`true` structurally
  impossible — assert `false` even when otherwise yakuless, using the
  `legal.win.test.ts` riichi-furiten fixture's post-riichi state) and an open
  (called) yakuless-tenpai hand (assert `false` — needs a small hand-authored
  fixture with one pon folded).
- `yakulessTenpai` yaku-bearing case: `RON_SEED = 3951` at its tenpai point
  (pinfu waits) — asserts `false` (a wait DOES carry yaku).

### `src/app/Table.svelte`

- Widen the props type with two new optional fields:
  `furitenTile?: TileId | null` and `yakulessTenpai?: boolean` (optional,
  default-absent, mirroring `scores?`/`onnext?`'s own optionality — every
  existing caller/test that constructs `Table` without them keeps compiling
  and rendering exactly as today, since both new blocks are `{#if}`-gated on
  values that default to falsy/undefined).
- Inside the existing `{#if seat.you}` block, after the drawn-tile section,
  add two conditionally-rendered `<p>` elements per Decision 6's copy,
  labeled `aria-label="furiten"` and `aria-label="yakuless tenpai"` — plain
  presentational markup only, no new script-side computation. `furitenTile`
  renders through the existing `Tile` component exactly like the drawn tile
  above it.
- New minimal CSS for `.furiten`/`.yakuless`, visually consistent with the
  existing `.hint` treatment in `App.svelte` (same register: no chrome, small
  uppercase label text) but scoped inside Table.svelte's own `<style>` block
  since that is where the new markup lives.

### `src/app/App.svelte`

- Import `furitenSeal` and `yakulessTenpai` from `'../core'` alongside the
  existing core imports.
- Two new `$derived` values, declared beside `riichi`/`hint`:
  ```ts
  const furitenTile = $derived(furitenSeal(table, PLAYER))
  const yakuless = $derived(yakulessTenpai(table, PLAYER))
  ```
- Pass both through to `<Table>` as new props (`{furitenTile} yakulessTenpai={yakuless}`).
  No change to the console slot's `{#if}` cascade (prompt → riichi → hint) —
  per Design Decision 5, the new facts render in `Table`, not the console.

### `src/app/app.ssr.test.ts`

Add a new `describe` block (sibling to the existing "dealt-table view (SSR)"
and mid-hand blocks) rendering `Table` directly (not `App`) against
hand-authored folded states, following the file's own documented pattern
("Mid-hand and wall-exhausted states render Table directly with
hand-authored folded records"):

- Basic furiten state (the same `FURITEN_SEED`/21-turn geometry as the core
  suite) → renders the `aria-label="furiten"` region containing the `6p`
  tile token.
- The seat's own next draw folded on top → the region is absent.
- The `YAKULESS_SEED`/zero-action dealt-tenpai state → renders the
  `aria-label="yakuless tenpai"` region with its literal text.
- A state with neither condition (e.g. the plain `BOOT_SEED` fresh deal
  already used elsewhere in this file) → neither region renders.

## Files NOT touched

- `src/core/seatview.ts` — Decision 1 rejects widening `SeatView`; no change.
- `src/app/drive.ts` — the new facts are read directly off `TableState` by
  `App.svelte`, the same way `riichiPrompt`/`winChoice` already are; they are
  not "elements of `legalActions`," so they do not belong in drive.ts's own
  seam (its header: "nothing in this module computes legality... or
  constructs an action" — these two queries are neither).
- `src/app/ClaimPrompt.svelte`, `src/app/RiichiPrompt.svelte`,
  `src/app/HandEnd.svelte` — untouched; the console slot's cascade is
  unchanged (Decision 5).
- `src/core/record.ts` — no new `TableState` field; `furitenSeal` reads the
  three existing fold-tracked facts (`ponds`, `tempFuriten`, `riichiFuriten`)
  verbatim, per Decision 3's documented gap (not solved by threading a new
  field through the fold).

## Ordering

1. `legal.ts` additions + `legal.furiten.test.ts` (pure core, independently
   verifiable — the highest-value review unit, per rdspi-workflow's own
   "Research and Design... best return" note applied one phase later here).
2. `Table.svelte` prop widening + markup.
3. `App.svelte` wiring.
4. `app.ssr.test.ts` additions (depend on 2 and 3 existing).

Each step commits independently and green (plan.md sequences the exact
commits).
