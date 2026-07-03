# T-008-02-02 — multi-hand-dynamics-suite — Structure

File-level changes, module boundaries, public interface. The blueprint, not code.

## 1. Files touched

| File | Change |
|---|---|
| `src/core/game.dynamics.test.ts` | NEW — the whole suite |

No other file changes. `game.ts` (`GameRecord`, `GameState`, `Player`, `foldGame`,
`handSeedOf`), `record.ts` (`foldRecord`, `HandAction`, `TableState`), `policy.ts`
(`discardPolicy`, `callPolicy`), `seatview.ts` (`seatView`), `legal.ts` (`legalActions`),
`deal.ts` (`SEAT_COUNT`, `Seat`) are all read-only dependencies, imported from `./index`.

## 2. `src/core/game.dynamics.test.ts` internal organization

Top-of-file comment block, same voice as `dynamics.test.ts`/`selfplay.test.ts`: this suite
is the multi-hand generalization of E-006's determinism/termination harness, states which
invariants it owns (score conservation, byte-identical multi-hand replay, per-hand
termination without stalling, dealer/wind consistency with each hand's recorded outcome —
the AC's own four clauses), and names its two doctrine debts explicitly: the bot-driving
loop is a FOURTH statement of the claim-arbitration rule (not shared/imported, per
`selfplay.test.ts`'s stated policy), and `expectedNextDealer` is an INDEPENDENT restatement
of `game.ts`'s renchan rule (not a read of `foldGame`'s own branch).

**Imports** (all from `./index`, no cross-`.test.ts` imports):
- types: `HandAction`, `HandRecord`, `TableState`, `Seat`, `GameRecord`, `GameState`,
  `Player`
- values: `SEAT_COUNT`, `LIVE_WALL_SIZE`, `DEAL_SIZE`, `foldRecord`, `legalActions`,
  `seatView`, `discardPolicy`, `callPolicy`, `foldGame`, `handSeedOf`
- `fc` from `fast-check`, `describe`/`expect`/`it` from `vitest`

**Constants.**
- `FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE` and `ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 *
  SEAT_COUNT + 2` — re-stated verbatim from `selfplay.test.ts` (the per-hand bound the local
  self-play loop still needs internally).
- `HANDS_PER_GAME = 6` — design.md Decision 3's chosen budget, comment explains it is a
  suite-level choice, not a proven ceiling (unlike `ACTION_BOUND`).
- `STARTING_SCORE = 25000` — re-stated (module-private in both `game.ts` and
  `settlement.ts`; this file re-states it a third time, same "duplicated small constant"
  precedent `windKindOf`/`ROUND_WIND` already set across `record.ts`/`settlement.ts`/
  `game.ts`).
- `GAME_SEEDS = Array.from({ length: 20 }, (_, i) => i)` — the deterministic corpus
  (design.md Decision 7).

**The per-hand bot driver** (design.md Decision 1, copied from `selfplay.test.ts`'s
`selfPlay`, trimmed to return only what this suite needs):
```ts
function selfPlayHand(seed: number): HandRecord
```
Identical shape/body to `selfplay.test.ts`'s `selfPlay`: loop `foldRecord` → `legalActions`;
at a claim-window/houtei point consult each offer-holding seat's `callPolicy` once in
offered order, take the earliest non-draw answer, else the stale-window draw; otherwise
`discardPolicy` at the turn seat; assert every chosen action is `legal.includes(chosen)`;
trip `ACTION_BOUND` into a thrown Error, never a hang. Returns `{ seed, actions }` once
`state.phase === 'agari'` or the offered set empties.

**The multi-hand chain driver** (design.md Decision 2):
```ts
function playGame(gameSeed: number, handCount: number): GameRecord
```
For `handIndex` in `0..handCount-1`: `selfPlayHand(handSeedOf(gameSeed, handIndex)).actions`,
collected into `hands`. Returns `{ seed: gameSeed, hands }` — every hand ended (no trailing
`[]`; boundary tests append `[]` themselves per prefix, structure §3 below).

**The independent dealer/wind restatement** (design.md Decision 5):
```ts
function nextExpectedDealer(prevDealer: Player, endedState: TableState): Player
function expectedSeatWinds(dealer: Player): readonly [WindKind, WindKind, WindKind, WindKind]
```
`nextExpectedDealer`: `endedState.phase === 'agari' && endedState.win!.winner === 0 ?
prevDealer : ((prevDealer + 1) % SEAT_COUNT) as Player` — `game.ts`'s own rule, retyped by
hand, not imported. `expectedSeatWinds`: the same `windKindOf`/rotation arithmetic
`game.ts` keeps private, restated (four-element array, `dealer`'s slot is `'1z'`).

**Prefix-boundary invariant checker** (design.md Decision 4), the suite's core assertion,
called once per prefix length for every game built:
```ts
function expectValidBoundary(gameSeed: number, hands: readonly (readonly HandAction[])[], prevDealer: Player): Player
```
Given the ENDED hands up to and including the new one (`hands` here is a prefix that is all
real/ended — never trailing-`[]`) and `prevDealer` (the PREVIOUSLY-checked prefix's own
`Player`, threaded by the caller, starting at `0` for the first hand — never re-derived from
`foldGame`, keeping the whole walk independent of the rotation logic under test):
1. Independently folds just the newest hand's own ended `TableState` via `foldRecord({ seed:
   handSeedOf(gameSeed, hands.length - 1), actions: hands[hands.length - 1] })` — using the
   real, already-tested `foldRecord`/`handSeedOf` directly, NOT through `foldGame` (so this
   check never depends on the rotation bookkeeping it is verifying).
2. Folds `{ seed: gameSeed, hands: [...hands, []] }` via `foldGame` (the trailing `[]` makes
   the newest hand the settled "previous" hand and exposes its consequences as the fresh
   `'playing'` active hand, `game.test.ts`'s own convention) — call the result `state`.
3. Asserts `state.scores.reduce((a, b) => a + b, 0) === 4 * STARTING_SCORE`.
4. Asserts folding the identical `GameRecord` object a second time is `toEqual` (purity, per
   prefix).
5. Asserts `state.dealer === nextExpectedDealer(prevDealer, <step 1's TableState>)`.
6. Asserts `state.seatWinds` equals `expectedSeatWinds(state.dealer)`.
Returns `state.dealer` (the caller's next `prevDealer`, threading the walk forward across
prefixes without re-deriving it from scratch each time).

## 3. Test organization

1. **`describe('multi-hand dynamics: corpus')`** — one `it` looping `GAME_SEEDS`: build
   `playGame(seed, HANDS_PER_GAME)` once; walk `expectValidBoundary` over every prefix
   length `1..HANDS_PER_GAME` starting from `prevDealer = 0`; tally `renchanCount`/
   `rotationCount`/end-phase-per-final-hand across the corpus; assert both tallies `> 0` and
   both `'agari'`/`'ryuukyoku'` occur among final hands (non-vacuity, design.md Decision 7).
   Explicit `{ timeout: 60_000 }`.

2. **`describe('multi-hand dynamics: byte-identical replay')`** — one `it` looping
   `GAME_SEEDS`: build the game TWICE independently (`playGame` called twice per seed),
   assert `JSON.stringify` equality of the two `GameRecord`s, and assert `foldGame` on each
   (with a trailing `[]`) produces deep-equal `scores`/`dealer`/`seatWinds` (design.md
   Decision 6). Reuses the already-built corpus games from test 1 is NOT done — this test
   re-drives independently on purpose, to actually exercise "two separately-built runs
   agree," not "the same object folds twice."

3. **`describe('multi-hand dynamics: property over the full seed domain')`** — an
   `fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {...}),
   { numRuns: 8 })`, `{ timeout: 60_000 }` on the `it`: build one game, walk
   `expectValidBoundary` over every prefix exactly as test 1 (no tallies — property runs
   assert the universal, not corpus non-vacuity), and assert the final hand's action count
   stays under the internal `ACTION_BOUND` (the per-hand termination half of the AC's
   "reaches each next hand without stalling," restated as an explicit assertion rather than
   only the internal trip-throw).

## 4. What this suite deliberately does NOT add

No round-wind/honba/hanchan-end concept (out of scope, unchanged from T-008-02-01 — research
§9). No mutation/throw matrix (that is `dynamics.test.ts`'s and `game.test.ts`'s guard-tests'
job, already covered for the single-hand and mined-fixture layers respectively). No new
`game.ts` exports — everything this suite needs is already public.
