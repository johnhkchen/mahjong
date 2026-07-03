# T-006-01-01 seatview-projection — Structure

## File-level changes

| File | Change | Contents |
|---|---|---|
| `src/core/seatview.ts` | **create** | `SeatView` interface + `seatView()` function. ~90 lines with the house-style documentation density. |
| `src/core/seatview.test.ts` | **create** | AC unit tests + seeded property tests. ~200 lines. |
| `src/core/index.ts` | **modify** | One line: `export * from './seatview'` (after `./record` — barrel order follows dependency order loosely; record's types are seatview's inputs). |

No other files change. `purity.test.ts` covers the new files automatically via its
`./*.ts` glob. App code is untouched this ticket.

## Module: `src/core/seatview.ts`

### Imports (same-directory only, per the purity gate)

```ts
import type { Seat } from './deal'
import type { Meld, TableState } from './record'
import type { TileId, TileKind } from './tiles'
```

All type-only — the module's only runtime code is array copying. (`SEAT_COUNT` is not
needed: the four-tuple is spelled out, matching TableState's own literal-tuple style.)

### Public interface

```ts
/** Per-seat tuples in the view: index by Seat, same E/S/W/N order as TableState. */
export interface SeatView {
  readonly seat: Seat
  readonly hand: readonly TileId[]
  readonly drawn: TileId | null
  readonly ponds: readonly [readonly TileId[], readonly TileId[], readonly TileId[], readonly TileId[]]
  readonly melds: readonly [readonly Meld[], readonly Meld[], readonly Meld[], readonly Meld[]]
  readonly doraIndicators: readonly TileId[]
  readonly doras: readonly TileKind[]
  readonly wallCount: number
  readonly turn: Seat
  readonly phase: TableState['phase']
  readonly claimable: TableState['claimable']
  readonly mustDiscard: boolean
  readonly win: TableState['win']
}

export function seatView(state: TableState, seat: Seat): SeatView
```

Field semantics (each gets a doc comment in the file, per house style):

- `seat` — whose view this is; echoed input, self-describing value.
- `hand` — fresh copy of `state.hands[seat]`, draw order preserved (sorting stays
  presentation, the deal.ts rule).
- `drawn` — `state.turn === seat ? state.drawn : null`. Null means "this seat holds no
  drawn tile"; another seat's held draw is deliberately indistinguishable from no draw.
- `ponds` — fresh copies, all four, discard order preserved (order is the pond's
  meaning).
- `melds` — fresh per-seat arrays; **Meld elements shared by reference** (readonly,
  never mutated by the fold — the shouminkan step replaces, never mutates; assumption
  pinned in a comment).
- `doraIndicators` / `doras` — fresh copies, flip order. The view has no singular
  `doraIndicator`/`dora`: `doraIndicators[0]`/`doras[0]` are the initial flip.
- `wallCount` — `state.live.length`. The ONLY wall-derived fact in the view; no live or
  dead array exists on the type.
- `turn`, `phase`, `mustDiscard` — copied scalars.
- `claimable`, `win` — shared references (readonly records the fold replaces wholesale,
  never mutates).

### Function body shape

Single object literal return — no branches beyond the `drawn` ternary, no throws, no
loops beyond `map`-style copies:

```ts
export function seatView(state: TableState, seat: Seat): SeatView {
  return {
    seat,
    hand: [...state.hands[seat]],
    drawn: state.turn === seat ? state.drawn : null,
    ponds: [ ...four spreads... ],
    melds: [ ...four spreads... ],
    doraIndicators: [...state.doraIndicators],
    doras: [...state.doras],
    wallCount: state.live.length,
    turn: state.turn,
    phase: state.phase,
    claimable: state.claimable,
    mustDiscard: state.mustDiscard,
    win: state.win,
  }
}
```

### Module header comment

States the contract: pure projection, fresh arrays per call, the type IS the fair-play
boundary (no field can hold hidden information — fair play by construction, not
policy), the widening rule (derived view; indexed-access aliases track TableState
unions; any TableState widening must re-audit the -02 property), and the drawn-tile
rule.

## Module: `src/core/seatview.test.ts`

### Imports

From `./index` (house style — tests import the barrel): `foldRecord`, `seatView`,
`buildWall`, `partitionWall`, `dealHands`, `SEAT_COUNT`, types. Tooling: `vitest`,
`fast-check`.

### Internal helpers (reuse record.test.ts patterns by re-declaration, as sibling test
files already do — helpers are per-file, not shared, in this codebase)

- `seedArb` — `fc.integer({min: 0, max: 0xffffffff})`.
- `seatArb` — `fc.integer({min: 0, max: 3})` mapped to `Seat`.
- `tsumogiriRecord(seed, turns)` — copied pattern from record.test.ts (expectations
  from upstream contracts, never from the fold under test).
- `dealtLive(seed)` / `dealtDead(seed)` — upstream-derived wall zones.
- `exposedTileIds(view): TileId[]` — THE collector: every tile id the view can carry —
  `hand`, `drawn` (when non-null), `ponds` flat, melds' `own` flat + `claimed` where
  present, `doraIndicators`, `claimable.tile` (when open), `win.tile` (when agari).
  Explicit-field by design; a recursive number scan would false-positive on
  `wallCount`/`turn`/`seat`.
- A fixed claim-state fixture (seed + actions producing a pon or daiminkan, borrowing
  the hard-coded-fixture style of record.test.ts) so melds and `claimable` paths are
  exercised, not just tsumogiri states.

### Test groups (describe blocks)

1. **`own view`** — hand equals `state.hands[seat]` (deep, order-preserved); drawn
   equals `state.drawn` when `turn === seat` mid-draw, null otherwise. Covers the AC's
   positive half.
2. **`nothing hidden`** — property over (seed, turns, seat): `exposedTileIds(view)` is
   disjoint from every other seat's `state.hands`, from `state.live`, and from
   `state.dead` minus the flipped indicators; plus `'live' in view` / `'dead' in view`
   are false. Covers the AC's negative half.
3. **`wall count`** — `wallCount === state.live.length` across turn counts;
   `typeof view.wallCount === 'number'`.
4. **`public facts pass through`** — ponds/melds/doraIndicators/doras/turn/phase/
   claimable/mustDiscard/win equal the state's, including a melded + claim-window
   fixture state and an agari fixture if cheap (win passthrough may reuse an existing
   winning fixture from legal.win.test.ts style if one transplants in a few lines;
   otherwise passthrough of `win: null` + the ryuukyoku end state suffices — the win
   field is a reference copy, not logic).
5. **`freshness`** — mutate `view.hand`/`view.ponds[0]` (cast to mutable) → state
   unchanged; mutate `state.hands[seat]` after projection → view unchanged.

## Ordering of changes

1. `seatview.ts` (compiles standalone).
2. `index.ts` barrel line (AC: "src/core exports seatView").
3. `seatview.test.ts` (imports via the barrel, so it needs 2 first).

One commit can carry all three (they are one atomic unit — the module is meaningless
unexported and untested), or two commits (module+barrel, then tests) if intermediate
verification is wanted. Plan will say: single commit for module+barrel+tests is
acceptable at this size, but prefer module+barrel first, tests second, to keep each
commit green and reviewable.

## Boundaries respected

- No change to TableState, foldRecord, legalActions, or any frozen contract.
- No app-side adoption this ticket (Table.svelte keeps taking TableState).
- The view is a derived shape: widening it later (drawnFrom, turnHoldsDraw, ura at
  showdown) is extend-only and invalidates nothing.
