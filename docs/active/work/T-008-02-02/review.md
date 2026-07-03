# T-008-02-02 — multi-hand-dynamics-suite — Review

Self-assessment and handoff. What a human reviewer needs without reading every diff.

## What changed

| File | Change |
|---|---|
| `src/core/game.dynamics.test.ts` | NEW (~300 lines) — the multi-hand dynamics suite |

No other file was touched. One commit: `8f58930`. `game.ts`, `record.ts`, `policy.ts`,
`seatview.ts`, `legal.ts`, `deal.ts`, `settlement.ts` are read-only dependencies, imported
from `./index`, byte-unchanged by this ticket. The repo also carries unrelated in-flight
changes from sibling Lisa threads (`docs/active/tickets/*.md` frontmatter, `docs/active/
work/T-008-01-*`, `T-008-02-01`, `T-008-03-01` untracked directories) — none of it touched
or committed by this ticket's work, per the concurrency model (file locking is the safety
net, not cross-thread coordination).

## Design summary (see design.md for full rationale)

- **Bot self-play, not random-legal play, drives every hand.** `foldGame` needs every
  included hand to actually END; `dynamics.test.ts`'s random-legal driver reaches an end far
  too rarely to chain reliably (its own win-carrier mining found 8/1000). `selfPlayHand` is
  a direct, non-imported port of `selfplay.test.ts`'s `selfPlay` — the codebase's own stated
  doctrine ("lock independent statements by test rather than sharing them"), now a fourth
  restatement of the claim-arbitration rule.
- **`playGame` chains hands via the real `handSeedOf`,** introducing no new randomness at
  the game level — every per-hand seed and every bot decision was already shown
  deterministic elsewhere, so "same `gameSeed` in ⇒ same `GameRecord` out" follows.
- **`HANDS_PER_GAME = 6` is a chosen budget, not a derived ceiling** — renchan has no true
  bound (a dealer could win forever), unlike `ACTION_BOUND`'s real wall arithmetic. Sized
  empirically: fast enough (~9s total for all three suites) and long enough that a 20-seed
  corpus reliably exhibits both a renchan and a rotation.
- **Dealer/wind consistency is checked by an INDEPENDENT restatement of `game.ts`'s own
  renchan rule** (`nextExpectedDealer`/`expectedSeatWinds`), never by reading `foldGame`'s
  own returned `dealer` as ground truth — otherwise a regression in that exact branch could
  never be caught. This mirrors the same "lock independent statements" doctrine applied to a
  rule instead of an arbitration order.
- **Every hand boundary is checked**, not just the final state: for each built game, every
  prefix length `1..HANDS_PER_GAME` is folded (with a trailing `[]` exposing the newly-
  settled dealer) and asserted for score-sum conservation, fold purity, and dealer/wind
  consistency — the `dynamics.test.ts` "assert at every prefix" precedent, one level up.
- **Corpus (20 seeds, deterministic, tallied) + `fc.integer` property (full domain,
  `numRuns: 8`), both** — mirrors `selfplay.test.ts`'s own dual-suite shape exactly. The
  corpus asserts non-vacuity (`renchanCount > 0`, `rotationCount > 0`, both `'agari'` and
  `'ryuukyoku'` occur as final-hand outcomes); the property asserts the same per-boundary
  invariants universally plus an explicit `ACTION_BOUND` check per hand (the AC's "reaches
  each next hand without stalling," made an explicit assertion rather than only an internal
  trip-throw).

## Test coverage

3 tests in `game.dynamics.test.ts`, all green (`npx vitest run src/core/game.dynamics.test.ts`,
~9s):

- **Corpus** (1 test, 20 seeds × 6 hands = 120 hand-plays): walks every hand boundary of
  every corpus game, non-vacuity-tallied.
- **Byte-identical replay** (1 test, 20 seeds × 2 independent builds × 6 hands = 240
  hand-plays): `JSON.stringify` equality of two independently-built `GameRecord`s per seed,
  plus deep-equal `foldGame` output on both.
- **Full-domain property** (1 test, `fc.integer` over `[0, 2^32)`, `numRuns: 8` × 6 hands =
  48 hand-plays): the same per-boundary invariants as the corpus, universally, plus an
  explicit `ACTION_BOUND` bound per hand.

All four AC clauses are covered: conservation (every boundary, both suites), byte-identical
replay (dedicated suite, scores/dealer/winds/action-logs all compared), termination
("without stalling" — `selfPlayHand`'s internal `ACTION_BOUND` trip plus the property
suite's explicit per-hand assertion, and `HANDS_PER_GAME` hands are always produced, never
fewer), dealer/wind consistency (every boundary, independent restatement, both suites).

**Gaps, acknowledged:**
- `HANDS_PER_GAME = 6` is a fixed budget; no test drives an arbitrarily long renchan chain
  (e.g. 20+ consecutive dealer wins) to see whether `foldGame`'s loop or this suite's own
  driver degrades — judged out of scope (no engine concept of a match/hanchan length exists
  to test against; see design.md Decision 3).
- The property suite's `numRuns: 8` is modest next to `selfplay.test.ts`'s single-hand
  `numRuns: 10` — proportionate given each property run here does 6× the hand-play work of
  a single-hand run, but a future ticket touching `foldGame`'s core loop should consider
  widening this rather than assuming today's `numRuns` stays sufficient.
- No test exercises a `handCount` other than the fixed `HANDS_PER_GAME` (e.g. a 1-hand or a
  20-hand game via this suite's own driver) — `game.test.ts`'s existing mined fixtures
  already cover the 1-hand and 2-hand cases directly, so this was judged non-duplicative
  scope, but it means this suite's own boundary-walking code path is only exercised at
  exactly one chain length across every seed.

## Open concerns

None blocking. `just check` is clean (188 files, 0 errors). `just test` is green (31 files,
786 tests — 783 pre-existing + 3 new), full suite runtime ~11s (up from ~3.3s pre-ticket;
the new suite itself accounts for ~9s of that, run in isolation — acceptable per plan.md's
own timing-check step, well under any suite's explicit 60s timeout, but flagged here in case
a future ticket wants to trim `HANDS_PER_GAME`/corpus size/`numRuns` if overall CI time
becomes a concern).

No production code was touched — this ticket is purely additive test coverage over the
already-shipped, already-reviewed `game.ts` (T-008-02-01).
