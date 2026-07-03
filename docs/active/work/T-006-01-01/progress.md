# T-006-01-01 seatview-projection — Progress

## Completed

### Step 1 — module + barrel (commit 79f15aa)

- Created `src/core/seatview.ts`: `SeatView` interface (13 fields) + `seatView(state,
  seat)` — single object-literal projection, fresh arrays, shared readonly records
  (Meld elements, claimable, win), `drawn` gated on `turn === seat`, `wallCount`
  replacing the live array, no dead-wall field at all.
- Added `export * from './seatview'` to `src/core/index.ts`.
- Verified: `just check` 0 errors; `just test` 431 passed (purity gate scans the new
  module — type-only same-directory imports pass).

### Step 2 — tests (commit afea399)

- Created `src/core/seatview.test.ts` — 14 tests in the five planned groups:
  - `own view`: fixed seed-1 mid-draw hand/drawn passthrough; the non-turn observers
    see `drawn === null` while the state holds a draw; property over
    (seed, turns, dangle, seat) for hand identity and the drawn rule.
  - `nothing hidden`: properties asserting `exposedTileIds(view)` is disjoint from
    every other seat's hand and from `live`, and touches `dead` only at flipped
    indicators; fixed check that the runtime object has no `hands`/`live`/`dead` keys.
  - `wall count`: property `wallCount === state.live.length` and is a number;
    endpoints 70 (dealt) and 0 (full tsumogiri hand).
  - `public facts pass through`: property for ponds/indicators/doras/turn/phase/
    mustDiscard/claimable/win/seat; the record.test.ts seed-67 geometry transplanted
    for a real claim window (`claimable = {seat:0, tile:91}` visible to all four
    observers) and a real pon (`melds[3]`, `mustDiscard`, hidden zones still hidden).
  - `freshness`: state mutation after projection leaves the view unchanged; view-array
    mutation leaves the state unchanged; projected arrays are never the state's own
    references.
- Verified: `just test` 445 passed (18 files); `just check` 0 errors.

## Remaining

- Review phase artifact (`review.md`), artifact commit.

## Deviations from plan

- None of substance. The plan's group-4 "agari fixture if cheap" resolved to the
  cheap arm the plan itself allowed: `win` passthrough is covered by the property
  (reference equality on `win`, which is `null` across tsumogiri states) and by the
  collector's `win.tile` arm existing for -02; no winning-hand fixture was
  transplanted, since the field is a reference copy, not logic, and the hidden-zone
  property is what the AC pins.
- Commit messages match plan verbatim.

## AC status

- [x] `src/core` exports `seatView(state, seat)` — seatview.ts + barrel line.
- [x] Test asserts the view contains own hand and drawn — `own view` group.
- [x] …but no other seat's hand tiles, no wall/dead-wall tile ids — `nothing hidden`
      group (properties over seeds/turns/seats + seed-67 meld states).
- [x] …and only `live.length` (a number) for wall count — `wall count` group + the
      no-`live`/`dead`-keys check.
