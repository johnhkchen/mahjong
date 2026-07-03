# T-006-01-02 fair-play-property-tests — Structure

## File-level changes

| File | Change |
|---|---|
| `src/core/seatview.fairplay.test.ts` | **Created.** The entire ticket. |
| everything else | Untouched. No runtime code, no exports, no barrel change, no app change. |

The purity gate (`purity.test.ts`) picks the new file up automatically via
`import.meta.glob('./*.ts')`; its imports must be `./index`, `vitest`, `fast-check`
only.

## Internal organization of `seatview.fairplay.test.ts`

One file, four layers, in reading order: imports/arbs → state sources → the surgery →
the suites. Target ≈ 300–380 lines including the house-style header comment.

### Header comment

States the ticket's claim: fair play is structural — the hidden-permutation
equivalence and the public-set inclusion quantify seatView's guarantee over
call-dense and agari states; names the division of labor with `seatview.test.ts`
(single-state partition pinning lives there) and the frozen-anchor citations
(dynamics.test.ts corpus facts). Notes this suite is the re-audit gate the
seatview.ts header points at.

### Layer 1 — imports and arbitraries

```ts
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE, LIVE_WALL_SIZE, SEAT_COUNT, TILE_COUNT,
  buildWall, createRng, dealHands, foldRecord, legalActions, nextInt,
  partitionWall, seatView, shuffleInPlace,
  type HandAction, type HandRecord, type Seat, type SeatView,
  type TableState, type TileId,
} from './index'

const seedArb    // fc.integer 0..0xffffffff — house arb
const seatArb    // 0..3 mapped to Seat
const FULL_TURNS // LIVE_WALL_SIZE - DEAL_SIZE = 70
const turnsArb   // 0..FULL_TURNS
const permSeedArb // = seedArb's shape; feeds createRng for the shuffle mutant
```

### Layer 2 — state sources (test-local replicas, origin-cited)

```ts
function dealtLive(seed): number[]            // replica of seatview.test.ts
function tsumogiriRecord(seed, turns): HandRecord
function foldedState(seed, turns, dangle): TableState

function isWin(a: HandAction): boolean        // replica of dynamics.test.ts
function isCall(a: HandAction): boolean
function playGreedy(seed): HandRecord         // verbatim replica, origin comment
function playWinEager(seed): HandRecord       // verbatim replica, origin comment
const ACTION_BOUND                            // replica constant (loop guard)

const GREEDY_SEEDS = [0, 1, 2, 63, 67, 69]    // 63/67/69: pinned ankan carriers
const greedyCorpus: readonly HandRecord[]
const WIN_CARRIER_SEEDS = [100, 277, 360, 626, 731, 834, 876, 950] // frozen anchors
const winCorpus: readonly HandRecord[]
```

Both drivers keep dynamics' hard `ACTION_BOUND` throw. Corpora are built once at
module load (same pattern as dynamics.test.ts).

### Layer 3 — the surgery and its collectors

```ts
/** Deep-copy a TableState: fresh hands/live/dead/ponds/melds/doraIndicators/doras
 *  arrays, meld elements + claimable/win shared (readonly, never mutated). */
function copyState(state: TableState): TableState

/** Indices in the pool-slot order — the ONE definition both collect and write use.
 *  Slot order (frozen within this suite): hands[t≠s] in seat order, each in hand
 *  order; drawn iff turn !== s && drawn !== null; live in order; unflipped dead in
 *  order (membership by doraIndicators ids). */
function collectHidden(state: TableState, seat: Seat): TileId[]
function writeHidden(state: TableState, seat: Seat, pool: readonly TileId[]): void

/** The two mutants. Both: copyState → collect → transform → write. */
function rotatedSibling(state: TableState, seat: Seat): TableState        // pool[i] ← pool[(i+1)%n]
function shuffledSibling(state: TableState, seat: Seat, permSeed): TableState

/** Replica of seatview.test.ts's explicit-field view collector, origin comment. */
function exposedTileIds(view: SeatView): TileId[]

/** The public side, computed from STATE independently of the projection:
 *  own hand ∪ (own drawn iff turn===seat) ∪ ponds ∪ melds own+claimed ∪ flipped
 *  indicators. claimable/win tiles are marks into these zones, not additions —
 *  but included defensively so the set is the full lawful universe. */
function publicIds(state: TableState, seat: Seat): Set<TileId>

/** Replica of dynamics' six-zone flatten, for the mutant-conservation guard. */
function allZones(state: TableState): number[]
```

`collectHidden`/`writeHidden` sharing one slot-order definition is the load-bearing
choice: the bijection property (guard suite) then verifies both at once, and rotate
vs shuffle differ only in the pool transform between the two calls.

### Layer 4 — suites

```ts
describe('the surgery is a valid sibling constructor', () => {
  // (a) mutant conserves 136 distinct ids across the six zones
  // (b) mutant public part unchanged: own hand, ponds, melds, doraIndicators,
  //     doras, turn, phase, claimable, mustDiscard, win, live.length, own drawn
  // (c) rotation non-vacuity: pool size >= 2 at every corpus state sampled, and
  //     every hidden slot differs from the original under rotation
  // over: a representative sample — corpus finals + a few mid-game prefixes,
  //       all four seats
})

describe('hidden-permutation equivalence (the AC property)', () => {
  // fc: ∀ seed, turns, dangle, seat, permSeed —
  //     seatView(rotatedSibling)  toEqual seatView(original)
  //     seatView(shuffledSibling) toEqual seatView(original)
  // corpus: every prefix × every seat × rotation (+ shuffle with 2 fixed perm
  //         seeds) over greedyCorpus and winCorpus
})

describe('no tile id outside the public zones (the AC inclusion)', () => {
  // fc: ∀ seed, turns, dangle, seat — exposedTileIds ⊆ publicIds
  // corpus: every prefix × every seat over greedyCorpus and winCorpus
  //         (agari finals: win.tile present and still inside publicIds)
})
```

## Interfaces and boundaries

- **Public interface changes: none.** The suite consumes the barrel only.
- **Contract touched:** SeatView's fair-play guarantee, quantified. The whole-object
  `toEqual` makes any future SeatView widening re-audited here automatically (the
  seatview.ts:13 pointer).
- **Cross-suite duplication (deliberate, per convention):** `dealtLive`/
  `tsumogiriRecord`/`foldedState`/`exposedTileIds` from seatview.test.ts;
  `playGreedy`/`playWinEager`/`isWin`/`isCall`/`ACTION_BOUND`/`allZones` from
  dynamics.test.ts. Each replica carries a one-line origin comment; pinned corpus
  facts (ankan carriers, win carriers) are cited to dynamics.test.ts as the owning
  suite — re-mining happens there first.

## Ordering of changes

Single file, but built and committed in three verifiable increments:

1. **Sources + surgery + guard suite** — the sibling constructor proven sound before
   any property uses it (a broken surgery would make the equivalence property pass
   vacuously against a corrupt sibling; guards first).
2. **Equivalence suite** (fc + corpus) — the AC's first clause.
3. **Inclusion suite** (fc + corpus) — the AC's second clause; measure total suite
   runtime here and apply the strided-prefix lever only if > ~2s.

Each increment leaves `just test` green and is commit-sized.

## What could force a structure change

- Suite runtime blowing past the budget → stride corpus prefixes (every 3rd) in the
  no-leak pass only; the equivalence pass keeps every prefix (it is the AC).
- A discovered leak in seatView (not expected) → stop, file against seatview.ts;
  this file's scope stays test-only.
