# T-003-01-02 — Research: legal-actions-surface

Descriptive map of what exists, where the legality knowledge currently lives, and the
constraints anything exposing it must respect. No solutions proposed here.

## The ticket in one line

Export a `legalActions` surface from the core barrel — the "legal actions out" half of
the architecture.md §"log in → legal actions / next state out" contract — with an
agreement test proving it against the step function across seeds and log prefixes.

## Where the relevant code lives

```
src/core/
  index.ts        # barrel: `export * from` tiles/rng/wall/dora/deal/record
  record.ts       # HandAction, HandRecord, TableState, applyAction (private), foldRecord
  deal.ts         # Seat (0|1|2|3), SEAT_COUNT, STARTING_HAND_SIZE, DEAL_SIZE, dealHands
  tiles.ts        # TileId (physical id 0..135), TileKind, kindOf
  wall.ts         # buildWall, partitionWall, LIVE_WALL_SIZE, TILE_COUNT
  record.test.ts  # 67 tests: fold entrypoint, draw/discard step, 9-case throw matrix
  purity.test.ts  # gate: runtime core modules may import only './sibling'
```

The app (`src/app/`) reads core only through the barrel; nothing in the app currently
computes or guesses legality (T-003-02-01, the rendering sibling, is display-only).

## The state machine as T-003-01-01 left it

`foldRecord(record)` builds the dealt table and applies each action via the
module-private `applyAction(state, action, index)`. The turn cycle it enforces is
small and fully determined by three `TableState` fields:

- `phase: 'playing' | 'ryuukyoku'` — once not `'playing'`, *every* action throws
  (`action ${i}: the hand already ended in ...`). Ended ⇔ `live.length === 0`.
- `turn: Seat` — the only seat allowed to act; any other seat's action throws.
- `drawn: TileId | null` —
  - `null` → the turn seat must **draw** (no tile recorded; wall order is authority).
    A draw when `live` is empty throws, but that state is unreachable through a legal
    fold (phase flips to ryuukyoku on the discard that empties `live`).
  - non-null → the turn seat must **discard**: either the drawn tile itself
    (tsumogiri) or any tile in `hands[turn]` (tedashi). Any other tile id throws
    (`neither holds nor just drew`).

So at every reachable state the legal set is closed-form and finite:

| state                                | legal actions                                            | count |
|--------------------------------------|----------------------------------------------------------|-------|
| `phase !== 'playing'`                 | none                                                     | 0     |
| `drawn === null`                      | `{type:'draw', seat: turn}`                              | 1     |
| `drawn !== null`                      | `{type:'discard', seat: turn, tile}` for `tile ∈ hands[turn] ∪ {drawn}` | 14    |

Physical `TileId`s are unique (0..135), so the 13 hand tiles plus the drawn tile are
always 14 *distinct* discard actions — no dedup question arises. `HandAction` is a
frozen, extend-only encoding; `TableState` is explicitly a *widenable derived view*
(its doc comment says it may grow fields), so a new exported function alongside it is
the same kind of extension prior tickets made.

## Who consumes this next (why the shape matters)

- **T-003-01-03** (`turn-loop-property-suite`, depends on this ticket) drives a
  random-legal-sequence generator off `legalActions` to prove conservation,
  determinism, and termination. It needs the *full enumerated set* to sample from.
- **AI bots** (charter: stateless `table state → action`) will pick from this set.
- **App/hints/teaching** (P1/P5): the view enables only what core says is legal.

## Existing test conventions the agreement test will sit among

`record.test.ts` establishes the house patterns this ticket's test must match:

- `fast-check` properties over `seedArb` (`fc.integer({min:0, max:0xffffffff})`) and
  `turnsArb` (0..`FULL_TURNS` = 70 complete turns).
- Helpers `dealtLive(seed)` / `tsumogiriRecord(seed, turns)` / `maximalRecord(seed)`
  derive expectations from the frozen upstream contracts (wall → partition → deal),
  never from the code under test. Prefixes of a tsumogiri record reach both
  action-point shapes: even prefix → pre-draw (`drawn === null`), odd → post-draw.
- Illegal-action tests append one bad action to a legally reachable prefix and assert
  `RangeError` plus a message fragment.
- Frozen seed-1 literals (East's hand `[64, ...]`, first draw `100`) anchor examples.
- `purity.test.ts` allows test files only `vitest`/`fast-check`/`node:` imports and
  runtime modules only `./sibling` imports — wherever the function lands must obey.

The AC's exact demands: (1) export from the core barrel; (2) for folded states across
many seeds and log prefixes, every returned action is accepted by the step function;
(3) sampled actions *outside* the returned set throw; (4) an ended (ryuukyoku) state
returns no legal actions.

## Constraints and assumptions surfaced

- **Purity/freshness house rules**: core functions are pure; `foldRecord` returns
  fresh arrays and never mutates inputs. A legality surface must not mutate the state
  it inspects, and callers must not be able to corrupt a fold through what it returns.
- **The step is the semantics; legality must agree, not define.** `applyAction` stays
  the single authority on what folds. The AC's agreement test is meaningful only if
  the legal-set computation is an independent statement cross-checked against the
  step — a tautological "try it and catch" derivation would make the test vacuous.
- **Determinism**: same state → same legal set, in a stable order (bots and the
  T-003-01-03 generator sample by index; charter requires deterministic simulation).
- **Extend-only vocabulary**: calls/riichi/agari tickets will widen `HandAction` and
  `phase`. Today's function only ever sees `'playing' | 'ryuukyoku'` and emits
  draw/discard; its contract wording should not block widening.
- **`TableState` is trusted, not validated**: per the TileId/seed precedent,
  validation belongs at boundaries; states reaching `legalActions` come from
  `foldRecord`. Hand-built corrupt states (e.g. `drawn === null` with empty `live`
  while `'playing'`) are out of scope the same way `applyAction`'s empty-live draw
  guard is defense-in-depth.
- **Naming is fixed by the AC**: the export is `legalActions`.

## What is *not* in scope (owned elsewhere)

- Random legal-sequence generation, mutation testing, termination proofs —
  T-003-01-03.
- Rendering any of this — T-003-02-01.
- Calls (pon/chi/kan), riichi, agari legality — future epics; today's action
  vocabulary is draw/discard only, so "legal actions" is exactly the turn seat's
  next move.
