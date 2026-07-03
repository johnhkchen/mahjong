# T-006-01-01 seatview-projection — Plan

## Steps

### Step 1 — the module + barrel export (commit 1)

1. Create `src/core/seatview.ts` per structure.md:
   - Module header: pure projection; the type IS the fair-play boundary (no field can
     hold hidden information); fresh arrays per call, Meld/claimable/win shared as
     readonly never-mutated records; the drawn rule (`turn === seat ? drawn : null`);
     the widening rule (derived view — TableState widenings must re-audit the -02
     property).
   - `export interface SeatView` — 13 fields per structure.md, doc comment per field.
   - `export function seatView(state: TableState, seat: Seat): SeatView` — single
     object-literal return, spread copies for arrays.
2. Add `export * from './seatview'` to `src/core/index.ts` after the `./record` line.

**Verify:** `just check` (tsc + svelte-check) passes — the module compiles, the barrel
re-exports without name collisions. `just test` still green (purity gate now scans the
new file: type-only `./` imports pass).

**Commit:** `T-006-01-01: seatView — the fair-play projection over TableState`

### Step 2 — the tests (commit 2)

Create `src/core/seatview.test.ts` per structure.md. Helpers first (seedArb, seatArb,
tsumogiriRecord, dealtLive, dealtDead, exposedTileIds collector), then five describe
groups:

1. `own view` —
   - Fixed: seed 1, `tsumogiriRecord(1, 5)` + a dangling draw (append
     `{type:'draw', seat:1}` after 5 turns → seat 1 holds live[5]); assert
     `view.hand` deep-equals `state.hands[1]` and `view.drawn === state.drawn`.
   - All other seats at that state: `drawn === null` even though state.drawn ≠ null —
     the leak the ticket names, pinned as its own `it`.
   - Property (seed, turns, seat): `view.hand` always deep-equals `state.hands[seat]`
     (draw order preserved, not sorted).
2. `nothing hidden` (the AC's negative half) —
   - Property (seed, turns ∈ [0,70], dangleDraw, seat): fold, project, collect
     `exposedTileIds(view)`; assert intersection with each OTHER seat's
     `state.hands[s]` is empty; intersection with `state.live` is empty; intersection
     with `state.dead` is exactly the flipped indicators the view already names
     (⊆ `state.doraIndicators`; for kan-less tsumogiri logs: only `doraIndicators[0]`).
   - `'live' in view === false`, `'dead' in view === false`, `'hands' in view ===
     false` — the type has no slot; the runtime object must not either.
3. `wall count` —
   - Property (seed, turns): `view.wallCount === state.live.length` and
     `typeof view.wallCount === 'number'`.
   - Fixed spot-checks: dealt state → 70; after `maximalRecord`-style full hand → 0.
4. `public facts pass through` —
   - Property (seed, turns): ponds, doraIndicators, doras deep-equal state's; turn,
     phase, mustDiscard, seat echo state/input; claimable and win are the state's
     values (reference equality is fine — shared readonly records).
   - Fixed meld fixture (transplant the record.test.ts seed-67 geometry): fold seed 67
     with `[{draw,0},{discard,0,91},{pon,3,91,[90,88]}]` → for every seat, `view.melds[3]`
     holds the pon (claimed 91, from 0, own [90,88]), `view.mustDiscard === true`; the
     pre-pon prefix (2 actions) → `view.claimable` equals `{seat:0, tile:91}` for every
     observer, and the collector still leaks nothing (melds/claimable exercise the
     collector's claimed/tile arms).
5. `freshness` —
   - Project, then `state.hands[seat].push(…)` / mutate `state.ponds[0]` → view arrays
     unchanged (deep-equal snapshots taken before).
   - Mutate `view.hand` / `view.ponds[0]` (cast via `as TileId[]`) → state unchanged.
   - `view.doraIndicators` / `view.doras` / `view.melds[s]` likewise fresh (spot-check
     one of each: `expect(view.melds[3]).not.toBe(state.melds[3])`).

**Verify:** `just test` — new suite green, everything else untouched. `just check`.

**Commit:** `T-006-01-01: seatView tests — own view, nothing hidden, wall count`

### Step 3 — full verification + review artifact

- `just test` and `just check` from clean tree — both green.
- Re-read the AC line by line against the diff:
  - [ ] `src/core` exports `seatView(state, seat)` — barrel line + function.
  - [ ] test asserts view contains own hand and drawn — group 1.
  - [ ] …but no other seat's hand tiles, no wall/dead-wall tile ids — group 2.
  - [ ] …and only `live.length` (a number) for wall count — group 3 + the `in` checks.
- Write `progress.md` (during step 1-2, kept current) and `review.md`.

## Testing strategy summary

| Concern | Kind | Where |
|---|---|---|
| Own hand/drawn passthrough | fixed + property | group 1 |
| Hidden-zone disjointness | property over seeds/turns/seats | group 2 |
| No live/dead/hands slots on the object | fixed | group 2 |
| wallCount = live.length | property + endpoints (70, 0) | group 3 |
| Public passthrough incl. melds/claimable | property + seed-67 fixture | group 4 |
| Copy freshness both directions | fixed | group 5 |

Integration beyond the fold is out of scope: no app change, no driver change. The -02
ticket adds the hidden-permutation equivalence property; nothing here blocks it (the
view shape is what it quantifies over).

## Risks / contingencies

- **Seed-67 fixture drift**: the geometry is documented in record.test.ts and pinned by
  its own tests; transplanting the three-action prefix is safe. If the fold rejects it,
  re-derive from `dealtLive(67)`/hand dumps rather than trusting the comment.
- **Name collision in the barrel**: `SeatView`/`seatView` are new names; tsc catches
  any collision at step 1's `just check`.
- **`'hands' in view` assertion**: TypeScript objects built by literal cannot carry
  excess keys, so these are tautological today — kept anyway as regression guards
  against a future "spread the state and delete" refactor, which is exactly the
  implementation style this ticket forbids.

## Step/commit discipline

Two commits, each independently green (module+barrel compiles and is scanned by the
purity gate before its tests land; tests then pin behavior). progress.md updated after
each commit; deviations documented there before proceeding.
