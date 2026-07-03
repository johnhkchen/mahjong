# T-006-01-01 seatview-projection — Review

## What changed

| File | Change | Commit |
|---|---|---|
| `src/core/seatview.ts` | **created** (94 lines) — `SeatView` interface + `seatView(state, seat)` | 79f15aa |
| `src/core/index.ts` | +1 line — barrel export | 79f15aa |
| `src/core/seatview.test.ts` | **created** (266 lines, 14 tests) | afea399 |

No existing runtime code was touched; no frozen contract (record encoding, wall/deal
conventions, TableState fields) changed. App code untouched.

## The shape shipped

`seatView(state: TableState, seat: Seat): SeatView` — pure, total (no throws), fresh
arrays per call. The view's 13 fields: `seat`, `hand` (own, draw order), `drawn` (own
only — `turn === seat ? state.drawn : null`), `ponds` ×4, `melds` ×4 (all Meld forms
are public in riichi, ankan included), `doraIndicators`/`doras` (flip order),
`wallCount` (**the only wall fact — a number**), `turn`, `phase`, `claimable`,
`mustDiscard`, `win`. Deliberately absent: other hands, `live`/`dead` arrays, another
seat's drawn tile, `drawnFrom`, the singular `doraIndicator`/`dora` (plural forms
carry them at index 0).

Fair play is structural: the interface has no field that can hold hidden information,
so a bot typed against `SeatView` cannot express a peek — the story's
"fair-play-by-construction," and the exact surface T-006-01-02's property test
quantifies over.

## Acceptance criteria — all met

- **`src/core` exports `seatView(state, seat)`**: seatview.ts via the barrel.
- **Test: view contains own hand and drawn**: fixed seed-1 mid-draw case plus a
  property over (seed, turns, dangling-draw, seat).
- **Test: no other seat's hand tiles, no wall/dead-wall tile ids**: an explicit
  `exposedTileIds(view)` collector (every tile-bearing field: hand, drawn, ponds,
  melds' own+claimed, indicators, claimable.tile, win.tile) asserted disjoint from
  other hands and `live` at every generated state, and touching `dead` only at flipped
  indicators. The collector is field-explicit, not a recursive number scan, because
  `wallCount`/`turn`/`seat` are numbers that can collide with tile-id values.
- **Test: only `live.length` (a number) for wall count**: property + endpoint checks
  (70 dealt, 0 after a full hand) + a runtime check that the object carries no
  `hands`/`live`/`dead` keys at all.

## Test coverage

445 tests pass (431 before, +14), `just check` clean. Coverage by concern:

- Passthrough and the drawn-gating rule: property over the full seed domain ×
  turn counts 0–70 × optional dangling draw × all four seats.
- Hidden-zone disjointness: same generator space; plus the seed-67 geometry
  (transplanted from record.test.ts's frozen kan-anchor facts) for states with an
  open claim window and an exposed pon — the collector's `claimed`/`claimable.tile`
  arms are exercised by real melds, not just tsumogiri states.
- Freshness both directions, plus reference-inequality spot checks (projected arrays
  are never the state's own).
- The purity gate (`purity.test.ts`) auto-covers the new module: type-only
  same-directory imports.

### Coverage gaps (known, judged acceptable)

- **No agari-state projection test.** `win` passthrough is covered only as
  reference-copy behavior (`view.win` is `state.win`, `null` throughout the generated
  states) and the collector already handles `win.tile`. A winning fixture would test
  the fold, not the projection — but a projected-at-agari case (win tile exposed,
  winner's concealed hand still hidden from other observers) would be a stronger
  belt. T-006-01-02's property over seeded hands is the natural place; flagged for it.
- **No kan-state projection test.** Multiple flipped indicators (kan-dora) reach the
  view only through the passthrough property's `doraIndicators` equality on kan-less
  logs. The dead-wall disjointness property would get sharper teeth from a seed-67
  daiminkan state (rinshan drawn tile, second indicator flipped). Cheap to add in -02
  or a follow-up; the projection code has no kan-specific path, so risk is low.
- Tsumogiri-only generators: no chi, no riichi (riichi isn't in the vocabulary yet).
  Same mitigation — the projection is field-wise, with no path that depends on how
  the state was reached.

## Open concerns for a human reviewer

1. **Scope widening beyond the ticket's enumerated list** — the view includes
   `claimable`, `mustDiscard`, `win`, `doras`, `seat` beyond the ticket's floor
   (own hand/drawn, ponds, melds, indicators, wall count, turn, phase). Rationale in
   design.md §2: all are public-by-construction table facts, and omitting them forces
   future consumers back onto TableState — the channel this ticket closes. If Lisa/the
   reviewer wants the strict floor, deleting fields is a five-minute change; -02 has
   not landed yet, so nothing downstream depends on them.
2. **`win.tile` at agari is exposed to every observer.** Correct by the rules (a win
   is declared and the tile named openly), and for tsumo that tile id is the winner's
   drawn tile — public only because the hand ended. -02's "public zones" definition
   must include `win.tile`, or its no-leak property will flag this as a false
   positive. Noted here so the -02 author inherits the decision consciously.
3. **Meld/claimable/win records are shared by reference, not copied.** Safe under the
   fold's documented replace-never-mutate discipline (shouminkan REPLACES its pon;
   discards replace `claimable`); the assumption is pinned in the module header and in
   the interface doc. If a future fold ever mutates a meld in place, the view aliases
   it — the freshness tests would not catch that (they test arrays), so the discipline
   is load-bearing.
4. **Indexed-access type aliases** (`TableState['phase' | 'claimable' | 'win']`) make
   the view widen automatically when TableState widens (e.g. riichi adds a phase or
   win fields). That is the derived-view intent, but it means a TableState widening
   silently widens the fair-play surface; the module header directs any such ticket to
   re-audit the -02 property.

## No TODOs left in code

No `TODO`/`FIXME` markers were added; no deviations from plan beyond the documented
cheap-arm choice on the agari fixture (progress.md).

## Verification trail

- `just check`: 0 errors, 0 warnings (169 files).
- `just test`: 18 files, 445 tests, all passing.
- Commits: 79f15aa (module + barrel), afea399 (tests) — each independently green.
