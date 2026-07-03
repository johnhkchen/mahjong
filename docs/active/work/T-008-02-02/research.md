# T-008-02-02 — multi-hand-dynamics-suite — Research

Descriptive map of what exists. No proposals here.

## 1. The ticket's own words

AC: "A fast-check/dynamics suite drives multi-hand games across seeds: total points equal
4 × 25000 after every settlement, the same GameRecord replays byte-identically (scores,
dealer, winds, action logs), every game reaches each next hand without stalling, and
dealer/wind bookkeeping stays consistent with each hand's recorded outcome." Context calls
this "the scored extension of E-006's determinism/termination harness" — E-006 (done) is
the competent-bot-table epic; its harness is `selfplay.test.ts` (single hand, all four
seats botted) and `dynamics.test.ts` (turn-loop properties over one hand). This ticket
raises both one level, to `game.ts`'s multi-hand fold.

## 2. `src/core/game.ts` — the module under test (T-008-02-01, done, `phase: done`)

- `GameRecord = { seed: number; hands: readonly (readonly HandAction[])[] }` — one action
  log per hand played so far, including the active (possibly still-`'playing'`) hand as the
  last element. No per-hand seed is stored.
- `handSeedOf(gameSeed, handIndex): number` — `((gameSeed >>> 0) ^ Math.imul(handIndex + 1,
  0x9e3779b1)) >>> 0`. Provably injective in `handIndex` for a fixed `gameSeed` (composition
  of two bijections on `Z/2^32Z`) — already covered by dedicated unit + property tests in
  `game.test.ts`. This ticket does not need to re-test `handSeedOf` itself.
- `foldGame(record): GameState` — walks `record.hands` left to right. For each ended hand
  (`phase !== 'playing'`): folds it via `foldRecord({ seed: handSeedOf(seed, index), actions
  })`, adds `settlementOf(state)`'s four deltas into running `scores` (indexed by `Player`,
  remapped from engine `Seat` via `playerOfSeat(dealer, seat)`), then decides the next
  hand's dealer — repeats (`renchan`) iff `state.phase === 'agari' && state.win!.winner ===
  0`, otherwise rotates by exactly one `Player`. The LAST hand, if still `'playing'`, stops
  the loop without a score update or rotation decision for it. Throws `RangeError` if
  `hands` is empty, or if a NON-last hand is still `'playing'`.
- `Player = 0 | 1 | 2 | 3` — a persistent identity, distinct from engine `Seat` (dealer-
  relative, resets every hand). `playerOfSeat`/`seatOfPlayer`/`nextPlayer`/`windKindOf`/
  `seatWindsOf` are module-private.
- `STARTING_SCORE = 25000`, `GOLDEN_RATIO_32` are module-private constants (not exported).
- Round wind is frozen East throughout (`ROUND_WIND = '1z'` in both `record.ts` and
  `settlement.ts`, duplicated) — no hanchan East→South round transition exists anywhere in
  the engine. `foldGame` never reads or writes a round-wind or honba concept; neither field
  exists on `GameState`.

## 3. `settlement.ts` — the per-hand payout `foldGame` consumes

`settlementOf(state: TableState): SeatDeltas` returns four numbers that **always sum to
zero** — `ronDeltas`/`tsumoDeltas` move points from payer(s) to winner (net zero by
construction), `notenBappuOf` splits a fixed 3000-point pot symmetrically (gains and losses
computed from the same pot, `gain * tenpaiCount === loss * (4 - tenpaiCount) === 3000`, so
the sum is zero for every tenpai count 1/2/3, and it returns all-zero for 0 or 4 tenpai).
`foldGame` remaps these four deltas through `playerOfSeat(dealer, seat)`, which is a
bijection on `{0,1,2,3}` for any fixed `dealer` — summing a zero-sum vector after permuting
its indices is still zero. **Conservation of the running score total is therefore an
algebraic consequence of `settlementOf`'s own zero-sum guarantee plus the bijective remap,
not a new invariant `foldGame` must separately prove** — but it is exactly the kind of fact
a coding regression (a remap typo, a double-add, a dropped seat) would break silently, which
is why the AC still asks for it to be exercised end to end.

## 4. `selfplay.test.ts` — the single-hand, all-four-bots driver (E-006's determinism harness)

`selfPlay(seed): SelfPlayEnd` drives ONE hand from a seed to `'agari'`/`'ryuukyoku'`,
consulting `discardPolicy`/`callPolicy` (from `policy.ts`) over `seatView`/`legalActions`,
with the cross-seat arbitration re-stated locally (consult each offer-holding seat once at
a claim window, in offered order; earliest non-draw answer wins). Every chosen action is
asserted to be a **reference member** of the offered set (`legal.includes(chosen)`), and the
action count is capped at `ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 * SEAT_COUNT + 2` — a
tripped bound throws (non-terminating loop), never hangs. `playTwiceChecked(seed)` drives
the SAME seed twice and asserts `JSON.stringify` equality of the two produced `HandRecord`s
— the determinism half of the harness. A `CORPUS_SEEDS = 0..39` deterministic sweep plus a
`fc.integer` property sample (`numRuns: 10`) over the full `[0, 2^32)` domain both assert
this, with explicit non-vacuity tallies (`phases` contains both `'agari'` and `'ryuukyoku'`,
`claims > 0`, both win forms occur) — **the codebase's stated policy: a zeroed tally must
widen the corpus, never weaken the check**. The module header explicitly frames this as "the
THIRD statement" of the arbitration rule (policy.test.ts, drive.ts, here) — **the codebase
locks independent statements by test rather than sharing them**, a doctrine this ticket's
suite inherits directly (it will be a fourth/fifth statement, at the multi-hand level).

`selfPlay`/`playTwiceChecked` are NOT exported from `policy.ts` or anywhere in the barrel —
they are test-local, and `game.test.ts` already duplicates a similar shape locally rather
than importing from `selfplay.test.ts` (T-008-02-01 design.md Decision 7 states this
explicitly: "the codebase locks independent statements by test rather than sharing them").

## 5. `dynamics.test.ts` — the single-hand turn-loop property suite (the other E-006 harness half)

Covers RANDOM-LEGAL play (not bot-driven) at the single-hand level: tile conservation across
six zones (hands/melds/ponds/drawn/live/dead) at every log prefix, structural termination
identities (`draws + kans === FULL_TURNS - live.length`, etc.), fold determinism
(`foldRecord` twice ⇒ deep-equal, fresh arrays), and a large "mutated sequences throw"
matrix. Its `expectConserved`/`expectEndIdentities`/`ACTION_BOUND` shapes are the direct
one-hand precedent for what this ticket's suite states at the multi-hand level (score
conservation instead of tile conservation, a hand-count bound instead of an action-count
bound). This file's random-legal generator (`playRecord` sampling `legalActions` by index)
is NOT what `foldGame`'s hands need — `foldGame` requires hands that actually REACH an ended
`TableState` for `settlementOf` to apply; `selfPlay`'s bot-driven approach is the only
existing driver that reliably reaches `'agari'`/`'ryuukyoku'`, matching what `game.test.ts`
already chose (design.md Decision 7 explicitly rejected random-legal in favor of bots for
exactly this reason).

## 6. `game.test.ts` — the existing mined-fixture unit suite (what this ticket does NOT redo)

Already covers, via hand-picked mined `gameSeed`s (offline script, not committed): a
single-hand base case + fold purity, dealer-win renchan, non-dealer-win rotation, ryuukyoku
rotation, and ONE two-real-hand composition (renchan then rotation). Its own review.md
names the exact gap this ticket exists to close: *"No property-based test drives `foldGame`
itself end-to-end over random multi-hand sequences... mining a real multi-hand corpus at
that scale was judged disproportionate to this ticket's scope... a future ticket touching
this logic should widen the mined corpus."* T-008-02-02 is that future ticket.

## 7. Naming/placement conventions observed

Property/dynamics suites are named either bare (`dynamics.test.ts`, cross-cutting over
`record.ts`+`legal.ts`) or module-prefixed (`settlement.property.test.ts`,
`shanten.property.test.ts`, `shanten.property.test.ts`). `selfplay.test.ts` is its own
top-level concept name (not `record.selfplay.test.ts`). No file currently exists testing
`game.ts` beyond `game.test.ts`.

## 8. Toolchain facts

`fast-check@4.8.0`, `vitest@4.1.9`. Existing property suites bound `numRuns` explicitly
(10–60 depending on per-run cost) and set explicit `{ timeout: 60_000 }` on suites whose
per-run cost is a full hand or more (`selfplay.test.ts` does this on both its corpus test
and its property test). `just test` runs `vitest run` (all files); `just check` runs
`svelte-check` + `tsc`. Current state: 30 test files, 783 tests, all green, ~3.3s wall time.

## 9. Open questions / constraints surfaced

- No round-wind/honba/hanchan-length concept exists anywhere in the engine — a "game" here
  is an unbounded chain of hands with no built-in end condition. The suite must impose its
  OWN hand-count bound (there is no engine constant to reuse, unlike `ACTION_BOUND` which is
  derived from real wall arithmetic).
- Renchan is theoretically unbounded (a dealer could keep winning indefinitely) — the
  hand-count bound must be a suite-level choice, not a derived fact, and must be documented
  as such (mirroring `ACTION_BOUND`'s "headroom" reasoning, but honestly labeled as a chosen
  budget rather than a proven ceiling).
- `foldGame`'s renchan/rotation rule (`design.md` Decision 5) is worth restating
  independently in test code per the codebase's "lock independent statements" doctrine,
  rather than trusting `foldGame`'s own branch — this is what would catch a regression in
  that exact branch.
