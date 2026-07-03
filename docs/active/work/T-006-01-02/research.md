# T-006-01-02 fair-play-property-tests — Research

## The ticket in context

Prove fair-play is structural: a property test over seeded hands showing (a) two
TableStates that differ only in hidden tiles fold to identical SeatViews for a given
seat, and (b) no tile id outside the public zones ever appears in a projection.
Depends on T-006-01-01 (done — merged as `src/core/seatview.ts` + `seatview.test.ts`,
commits 79f15aa / afea399 / 7c3c2a3). This is a **test-only ticket**: the projection
already exists; the ticket quantifies its guarantee.

## What exists

### The projection under test — `src/core/seatview.ts` (94 lines)

`seatView(state: TableState, seat: Seat): SeatView` — pure, total, never throws, all
arrays fresh per call. It reads ONLY:

- `state.hands[seat]` (own hand, copied) — never any other seat's hand
- `state.drawn`, but only when `state.turn === seat`; otherwise the view's `drawn` is
  null (deliberately indistinguishable from "no one holds a draw")
- `state.ponds`, `state.melds` (all four, copied), `state.doraIndicators`, `state.doras`
- `state.live.length` — a NUMBER only (`wallCount`); never live's contents
- scalars/records passed through: `turn`, `phase`, `claimable`, `mustDiscard`, `win`
- it never touches `state.dead`, `state.doraIndicator` (singular), `state.dora`
  (singular), or `state.drawnFrom`

The module header (seatview.ts:10-13) notes the indexed-access aliases
(`phase`/`claimable`/`win` track TableState's unions) and says any ticket widening
those "must re-audit the fair-play property (T-006-01-02)" — this ticket IS that
property; it becomes the standing re-audit gate.

### What T-006-01-01's tests already pin — `seatview.test.ts` (267 lines)

Its header states the division of labor explicitly: "The hidden-permutation
equivalence property is T-006-01-02's; these tests pin the public/hidden partition of
a single real state." Already covered there, over tsumogiri-only folds plus the
seed-67 pon fixture:

- own hand/drawn verbatim; other observers see `drawn: null`
- **disjointness** per hidden zone: exposed ids ∩ other hands = ∅, ∩ live = ∅,
  ∩ unflipped dead = ∅ (fc property over seeds × turns × dangle × seat)
- `wallCount === live.length`, `typeof number`, endpoints 70 and 0
- no `hands`/`live`/`dead` keys on the view object at all
- public facts pass through; freshness both directions; fresh arrays never aliased

It also established **`exposedTileIds(view)`** — the explicit-field collector of every
tile id a SeatView can carry (hand, drawn, ponds flat, melds' own+claimed, indicators,
claimable.tile, win.tile). Explicit rather than a recursive number scan because
`wallCount`/`turn`/`seat` are numbers that collide with tile-id values (70 is both a
wall count and a valid TileId). This ticket's "no id outside the public zones" clause
is the same collector on the other side of a set-inclusion.

### TableState and its hidden/public partition — `src/core/record.ts`

TableState's documented conservation invariant: every tile id lives in exactly one of
hands / melds' own / ponds / drawn / live / dead at all times (record.ts:222-227;
`allZones` + `expectConserved` in dynamics.test.ts:207-227 enforce it at every prefix).
For an observing seat `s`, that partitions the 136 ids into:

**Public to s:** own hand `hands[s]`; own drawn (iff `turn === s`); all four ponds
(claimed-away tiles stay counted in the discarder's pond — the Meld contract); all
melds' `own` tiles (every call is declared in the open, ankan included); flipped
indicators `doraIndicators` (the only public dead-wall tiles); `claimable.tile` and
`win.tile` are marks into ponds/drawn, not extra zones.

**Hidden from s:** the three other concealed hands; `drawn` when `turn !== s`; all of
`live` (identities AND order — `wallCount` is the only lawful fact); `dead` minus the
flipped indicators (unflipped dora/ura indicators + remaining rinshan tiles).

Non-tile fields are all public facts: `turn`, `phase`, `mustDiscard`, `claimable`,
`win`, `doras`. `drawnFrom` is metadata (wall vs rinshan — everyone saw whether a kan
just happened), not a tile identity.

All TableState arrays are **mutable and fold-fresh** (`hands: [TileId[], ...]`,
`live: TileId[]`, etc.) — a test can construct a surgically modified TableState
by hand; nothing is frozen at runtime (the codebase never freezes values; readonly
types are the convention).

Dead-wall geometry that matters to any hidden-tile surgery: after k kans, the dead
array is the original layout's tiles [k..13] followed by k moved live-tail tiles
(record.ts:174-180); flipped indicator ids are recorded in `doraIndicators`, so the
flipped/unflipped split of `dead` is computable by id membership, not by position.

### State generators available as precedent (all test-local by design)

dynamics.test.ts:1-17 pins the convention: "The generators are test-local by design"
— suites replicate rather than share drivers. Available patterns:

- **tsumogiri records** (record.test.ts / seatview.test.ts): `turns` draw+discard
  pairs cycling E→S→W→N, tile = `live[i]` from the frozen deal derivation
  (`dealHands(partitionWall(buildWall(seed)).live).live`); optional dangling draw.
  Cheap, fully predictable, but never produces melds, kans, or wins.
- **`playGreedy(seed)`** (dynamics.test.ts:125-143): deterministic greedy-call driver
  over `legalActions`, using core's own `createRng`/`nextInt`; wins filtered out; runs
  to ryuukyoku. Pinned facts: seeds 63/67/69 are the only ankan carriers under 100;
  the 0..99 corpus covers every call form (asserted, not statistical).
- **`playWinEager(seed)`** (dynamics.test.ts:168-183): mirror driver that takes any
  offered win. Pinned carriers (frozen-anchor convention — never regenerate; re-mine
  via the scratchpad scan on trajectory-shifting changes): seeds
  [100, 277, 360, 626, 731, 834, 876, 950] end in agari; 876/950 tsumo, the rest rons.
- **seed-67 pon fixture** (seatview.test.ts:95-99): 2-action prefix + pon by North —
  claim-window and mustDiscard states without a driver.
- `playRecord(seed, choices)` — fc-driven full-offer sampler; needs fc choice arrays.

### Randomness available for a hidden-tile permutation

`createRng(seed)` / `nextInt` / `shuffleInPlace` in rng.ts — core's own seeded,
deterministic kit; dynamics.test.ts already uses it inside tests so corpora are
"reproducible arithmetic, not fc sampling". A permutation seed can be an fc-generated
integer feeding `createRng`, keeping shrinking meaningful.

### Test house style (consistent across all 15 core suites)

- vitest + fast-check; `seedArb = fc.integer({min: 0, max: 0xffffffff})`; seat arb via
  map to `Seat`; expectations derived from frozen upstream contracts, never from the
  code under test; fixtures pinned with "never regenerate" comments.
- Property suites assert **self-evident invariants** when the generator drives through
  the code under test (dynamics.test.ts header) — relevant here: the equivalence
  property's expectation side is `seatView(original)`, i.e. the code under test on the
  other input; that is the nature of an equivalence/metamorphic property and matches
  the dynamics precedent (double-fold determinism is asserted the same way).
- Test file naming: one suite per concern, dotted aspect names exist
  (`legal.win.test.ts` splits win legality from `legal.test.ts`).
- purity.test.ts gate: test files may import only same-directory siblings +
  vitest/fast-check/node: — a new test file alongside the others satisfies it; tests
  import from `./index` (the barrel).

### Toolchain

`just test` → vitest over src/core (property tests). `just check` → svelte-check +
tsc. fast-check and vitest are already dependencies (every suite uses them). No build
or app-side surface is touched by a core test file.

## Constraints and assumptions surfaced

1. **Test-only ticket.** The AC names a property test, not new engine surface. The
   projection, barrel export, and doc pointers all exist. Zero runtime code should
   need to change; if the property finds a leak, that is a bug ticket against
   seatview.ts, not scope here.
2. **"Two TableStates that differ only in hidden tiles"** — the AC does not say the
   second state must be *record-reachable*. `seatView` is a pure total function over
   TableState, so a surgically permuted sibling state is a legitimate input; whether
   to also demand record-reachability is a Design decision.
3. **Vacuity risk** is the main test-quality hazard: a permutation that happens to be
   identity, or a "hidden" pool that is empty (e.g. full-hand fold with empty live and
   near-empty hands), proves nothing. Guards asserting the mutant actually differs are
   needed.
4. **Conservation must survive the surgery** — a mutant with duplicated/lost ids tests
   a state outside the engine's invariant; the surgery must be a bijection on the
   hidden pool, slot-for-slot.
5. **Flipped indicators live inside `dead`** — a dead-wall permutation must hold the
   flipped ids fixed (they are public) and permute only the unflipped remainder;
   membership via the `doraIndicators` ids, not positions.
6. **Performance envelope:** dynamics.test.ts already folds every prefix of 100 greedy
   games plus fc trajectories; a suite folding a handful of corpus games at every
   prefix × 4 seats is well inside the established budget.
7. **Cross-suite reuse is forbidden by convention**, not mechanism: `playGreedy`/
   `playWinEager`/`exposedTileIds` would be replicated test-locally, with comments
   citing their origin and pinned facts (the frozen-anchor rule).
