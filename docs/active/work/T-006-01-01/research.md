# T-006-01-01 seatview-projection — Research

## Ticket

Add a read-only SeatView projection over folded `TableState` exposing exactly one seat's
legitimate view — own concealed hand + own drawn tile, all four ponds, all exposed melds,
flipped dora indicators, live-wall count, turn, phase — and nothing hidden.

AC: `src/core` exports `seatView(state, seat)`; a test asserts the returned view contains
own hand and drawn but no other seat's hand tiles, no wall/dead-wall tile ids, and only
`live.length` (a number) for wall count.

Story S-006-01 (seatview-fair-play) pairs this with T-006-01-02 (fair-play property
tests: two TableStates differing only in hidden tiles project to identical SeatViews;
no tile id outside the public zones ever appears). This ticket builds the projection and
its unit tests; -02 proves the property. Whatever shape this ticket exports is what -02
quantifies over, so the public/hidden partition must be exactly right here.

## Where the state lives

### TableState (`src/core/record.ts:162-272`)

The folded table — the object SeatView projects. Full field inventory with a
public/hidden reading for one observing seat:

| Field | Type | Visibility to a seat |
|---|---|---|
| `hands` | `[TileId[] ×4]` | **Own seat only.** Other hands are THE hidden information. |
| `live` | `TileId[]` | **Hidden.** Only its `length` is public (tiles remaining). |
| `dead` | `TileId[]` | **Hidden**, except flipped indicators (already surfaced below). |
| `doraIndicator` | `TileId` | Public — physically flipped on the table. |
| `dora` | `TileKind` | Public (derived from the indicator). |
| `doraIndicators` | `TileId[]` | Public — every flipped indicator, flip order. |
| `doras` | `TileKind[]` | Public, same order. |
| `ponds` | `[TileId[] ×4]` | Public — the complete discard history, all four seats. |
| `turn` | `Seat` | Public. |
| `melds` | `[Meld[] ×4]` | Public — exposed calls. Ankan is declared and revealed in riichi, so all four Meld forms are public (`own` + `claimed`/`from` where present). |
| `claimable` | `{seat, tile} \| null` | Public — the fresh discard everyone can see and claim. |
| `mustDiscard` | `boolean` | Public — a claim happened in the open; everyone knows the caller owes a discard. |
| `drawn` | `TileId \| null` | **Own only.** Non-null only for `turn`'s seat; another seat's drawn tile id is hidden (the fact of holding one is public, its identity is not). |
| `drawnFrom` | `'wall' \| 'rinshan' \| null` | The draw's source is publicly visible (rinshan comes off the dead wall in the open), but it's in lockstep with `drawn`. |
| `phase` | `'playing' \| 'ryuukyoku' \| 'agari'` | Public. |
| `win` | `{by, winner, [from], tile, yaku} \| null` | Public once agari — a win is declared, the tile named, yaku scored openly. Note `win.tile` for tsumo IS the winner's drawn tile; at agari it is announced. |

Documented conventions that matter here:

- Every array in a folded state is **fresh per fold**; the fold mutates them in place
  across actions. Nothing is frozen. A projection sharing array references with the
  state would alias mutable internals.
- The 136-tile conservation partition: every tile id lives in exactly one of
  hands / melds' `own` / ponds / `drawn` / live / dead. Public zones are therefore:
  own hand, all `own` meld tiles, all `claimed` meld tiles (counted in ponds), all
  ponds, own drawn, flipped indicators (ids inside `dead`), and — at agari — `win.tile`
  (which stays in `drawn` or the discarder's pond, per the zone-keeping rule).
- `TableState` is explicitly a **derived view, not a frozen contract** — "this shape
  may grow fields in later tickets without invalidating any stored hand." A projection
  over it is likewise derived-view territory, free to be shaped for consumers.

### Meld (`src/core/record.ts:125-153`)

Discriminated union: chi/pon (`claimed`, `from`, `own ×2`), daiminkan (`own ×3`),
shouminkan (`own ×3`), ankan (`own ×4`, no claimed). All fields `readonly`; the meld
objects themselves are never mutated after push (shouminkan REPLACES the pon object).
Object references are immutable-by-type but live inside per-seat arrays that grow.

### Supporting types

- `Seat` = 0|1|2|3 (`deal.ts:15`), `SEAT_COUNT` = 4.
- `TileId` = number 0-135 (`tiles.ts:22`), `TileKind` (`tiles.ts:12`).
- `foldRecord(record): TableState` (`record.ts:909`) — the only producer of TableState.

## Consumers and precedents

### The barrel (`src/core/index.ts`)

Core's public face: `export * from './<module>'` per module, one line each. App imports
only from `../core`. A new module joins by one barrel line.

### The purity gate (`src/core/purity.test.ts`)

Every runtime module in core may import **only same-directory siblings** (`./x`);
test files additionally get vitest/fast-check/node:. A new `seatview.ts` importing
`./record`, `./deal`, `./tiles` passes automatically; the gate scans `./*.ts` via glob
so new files are covered without registration.

### App today (`src/app/`)

- `App.svelte:25`: `const table = $derived(foldRecord({ seed, actions }))` — the app
  folds full TableState and hands it to `Table.svelte` as one prop.
- `Table.svelte` reads `table.hands[0]` (player's hand only, sorted at presentation),
  `table.ponds[*]`, `table.melds[*]`, `table.turn`, `table.drawn`, `table.doraIndicator`,
  `table.live.length` (renders "N tiles left" — exactly the count SeatView will carry),
  `table.phase`, `table.win`. The player UI already consumes only seat-0-legitimate
  data plus `live.length` — i.e. Table.svelte is a hand-rolled seat-0 view; SeatView
  is that discipline made structural.
- `drive.ts`: the driver seam. Bots are placeholders (tsumogiri chooser); the module
  never reads hands — it selects among `legalActions(state)` elements. The architecture
  note in CLAUDE.md ("AI is a stateless peripheral: table state → action") plus the
  vision's "three competent, **non-cheating** bots — the opponents see only what a
  player in that seat could see" is what this ticket's projection exists to serve:
  future bot signatures take a SeatView, so reading hidden state becomes a type error,
  not a policy.

### legalActions (`src/core/legal.ts:290`)

Takes full TableState (it must — it enumerates wins over concealed hands). Legality
stays a full-state function; SeatView doesn't replace it. A bot consumes offered
actions + its SeatView; the driver holds full state.

## Test conventions to reuse

`record.test.ts` establishes the house style:

- `seedArb = fc.integer({min: 0, max: 0xffffffff})`, `fc.assert(fc.property(...))`.
- `tsumogiriRecord(seed, turns)` / `maximalRecord(seed)` — predictable logs whose
  expectations derive from the frozen upstream contracts (wall→partition→deal), never
  from the function under test.
- `dealtLive(seed)` / `dealtDead(seed)` — the expected wall zones from upstream.
- Zone-collector helpers (`allZonesWithMelds`) that flatten a state's tile-bearing
  fields — the same pattern a SeatView test needs to collect "every tile id the view
  exposes" and assert disjointness from hidden zones.
- Hard-coded call-action fixtures at known seeds for meld coverage (e.g. `DAIMINKAN67`
  at record.test.ts:630) — reusable shape for getting melds into a projected state.

`just test` runs vitest over src/core; `just check` runs svelte-check + tsc.

## Constraints and assumptions

- **No framework, no DOM** in core; pure function only. Same-directory imports only.
- **Read-only means no aliasing**: state arrays are fold-fresh but mutable; if a caller
  folds, projects, then folds further actions via a longer log, arrays are new anyway
  (each fold is fresh) — but within one state object, handing out the state's own
  arrays would let a view consumer mutate engine state. Fresh copies are the existing
  convention ("fresh arrays per fold/call" appears on every producer).
- **Naming freedom**: AC pins the export name `seatView(state, seat)` and that wall
  count is a number; field names of the returned view are unpinned.
- **The enumerated public list** in the ticket (own hand, own drawn, ponds, melds,
  indicators, wall count, turn, phase) is a floor; `claimable`, `mustDiscard`, `win`,
  `doras`/`dora` are public facts too — whether to include them is a Design decision.
  The -02 property ("no tile id outside the public zones") defines the ceiling: nothing
  from other hands, live, or unflipped dead.
- `win.tile` and ura-dora: ura indicators (`dead[5,7,...]`) are never flipped by any
  current fold — `doraIndicators` only ever holds dora-side flips — so "flipped
  indicators" leaks no ura. `win` carries no hand reveal today (yaku names only), but
  it does carry `tile`; at agari that tile is publicly declared.
- No existing `seatview.ts`, no prior art for projections in the repo; this is a
  greenfield module against a stable, well-documented state shape.

## Files relevant to the change

| File | Role |
|---|---|
| `src/core/record.ts` | TableState + Meld types to project (read-only dependency). |
| `src/core/deal.ts` | `Seat`, `SEAT_COUNT`. |
| `src/core/tiles.ts` | `TileId`, `TileKind`. |
| `src/core/index.ts` | Barrel — add one export line. |
| `src/core/seatview.ts` | **New** — the projection. |
| `src/core/seatview.test.ts` | **New** — AC tests. |
| `src/core/purity.test.ts` | No change; auto-covers new files. |
| `src/app/*` | No change this ticket (Table.svelte could later consume a SeatView; out of scope). |
