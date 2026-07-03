# T-008-02-01 — game-record-and-continuation-fold — Review

Self-assessment and handoff. What a human reviewer needs without reading every diff.

## What changed

| File | Change |
|---|---|
| `src/core/game.ts` | NEW (182 lines) — `Player`, `GameRecord`, `GameState` types; `STARTING_SCORE`/`GOLDEN_RATIO_32` constants; private `playerOfSeat`/`seatOfPlayer`/`nextPlayer`/`windKindOf`/`seatWindsOf` helpers; exported `handSeedOf` and `foldGame` |
| `src/core/game.test.ts` | NEW (~600 lines) — full test suite, see below |
| `src/core/index.ts` | MODIFIED — one line, `export * from './game'`, appended last |

No other file was touched. `record.ts`, `settlement.ts` (as it stood at the start of this
ticket — see "Concurrent work" below), `deal.ts`, and `yaku.ts` are read-only dependencies,
byte-unchanged by this ticket. Two commits: `682538d` (scaffold + `foldGame`), `dc5c803`
(barrel export + tests) — scoped by explicit `git add <path>`, never `-A`.

## Design summary (see design.md for full rationale)

- **No stored per-hand seed.** `GameRecord = { seed, hands: readonly (readonly
  HandAction[])[] }` — every hand's seed is derived via `handSeedOf(gameSeed, index)`,
  never persisted alongside the actions, so there is no second authority that could
  disagree with the derivation (the same discipline `record.ts` applies to draw/tsumo
  tiles and ron winners).
- **`handSeedOf` is provably collision-free**, not just empirically unlikely: `((gameSeed
  >>> 0) ^ Math.imul(handIndex + 1, 0x9e3779b1)) >>> 0` is a composition of two bijections
  on `Z/2^32Z` (odd-multiplier `Math.imul`, then XOR by a constant), so it is injective in
  `handIndex` for every fixed `gameSeed` — a mathematical guarantee, spot-checked by a
  `fast-check` property over 20 sampled game seeds × 500 hand indices each.
- **No change was needed to `record.ts`/`settlement.ts`.** The key research finding:
  engine `Seat` is already dealer-relative (seat 0 is always "this hand's dealer" by
  construction), so seat-wind yakuhai already scores correctly regardless of which
  persistent player occupies seat 0 in a given hand. This ticket adds exactly the missing
  layer above: which player IS seat 0 for hand *h*, given hand *h-1*'s outcome.
- **`foldGame`** walks hands left to right, threading a `dealer: Player` (renchan on a
  dealer win, rotate by one otherwise — no dealer-tenpai-ryuukyoku carve-out, matching the
  AC's own narrower wording), remapping each hand's `settlementOf` deltas from engine
  `Seat` to persistent `Player` via the dealer that was current for THAT hand, and
  returning `dealer`/`seatWinds`/`table` for the ACTIVE (last) hand — never a prediction
  of the hand after it.
- Round wind stays East throughout (no hanchan round-transition logic) — explicitly out of
  scope per the ticket's own text.

## Test coverage

19 tests in `game.test.ts`, all green (`npx vitest run src/core/game.test.ts`):

- **`handSeedOf`** (4 tests): determinism, hand-verified spot arithmetic (including the
  "flips only the low bit" case exploiting the odd multiplier), the injectivity guarantee
  sampled via `fast-check` (20 game seeds × 500 hand indices, zero collisions), and the
  negative/non-integer guard.
- **`foldGame`** (13 tests) exercised through REAL bot-driven hands — a locally-duplicated
  self-play driver (the `selfplay.test.ts` "don't share test statements" precedent), with
  game seeds mined offline (a throwaway, deleted script) for: a single-hand base case +
  fold purity, a dealer win (renchan), a non-dealer win (rotation), a ryuukyoku (rotation),
  and a two-real-hand composition (renchan carrying the dealer into hand 1, then hand 1's
  non-dealer win rotating it). Every expected `scores` value is the real, already-tested
  `settlementOf` output (captured during mining) added through the by-hand dealer mapping
  — this suite verifies the remapping/accumulation/rotation arithmetic, not
  `settlementOf`'s own correctness (covered by `settlement.test.ts`).
- **Guards** (2 tests): empty `hands`, and a non-last hand still `'playing'`.

**Gaps, acknowledged:**
- Only ONE two-hand composition scenario is tested (renchan then rotation). A
  renchan-then-renchan-again chain, or a rotation-then-renchan chain, is not separately
  covered — the underlying loop logic is identical per iteration (the same `dealerWon`
  branch runs each time), so this is judged low-risk, but a future ticket touching this
  logic should widen the mined corpus rather than assume it stays covered.
- No property-based test drives `foldGame` itself end-to-end over random multi-hand
  sequences (unlike `selfplay.test.ts`'s full-domain property sweep for single hands) —
  mining a real multi-hand corpus at that scale was judged disproportionate to this
  ticket's scope (bookkeeping/rotation logic, not new engine mechanics). The mined
  fixtures exercise every branch of `foldGame`'s loop at least once, which is the coverage
  bar the ticket's AC asks for.

## Open concerns

**Concurrent work on the branch, not part of this ticket.** During this session,
`src/core/settlement.ts` and a new `src/core/settlement.property.test.ts` were modified/
added by what appears to be a sibling Lisa thread working ticket `T-008-01-04`
(`settlement.ts`'s new header comment names it directly, and exports three previously-
private helpers for that suite). `settlement.property.test.ts` currently fails (101/105
sub-tests, reproducible even with none of this ticket's changes applied — confirmed via
`git stash`, which does not stash untracked files). **This is unrelated to
T-008-02-01** — `settlementOf`'s public behavior this ticket depends on is unchanged, and
`game.ts`/`game.test.ts` never touch fu/han/settlement internals. Left entirely untouched,
per the concurrency model in `rdspi-workflow.md` ("agents do not need to coordinate with
each other" — file locking, not this agent, is the safety net). **Flagged for whoever owns
T-008-01-04's thread; not a blocker for this ticket's own review.**

No other open concerns. `just check` is clean (187 files, 0 errors); `game.test.ts` is
green in isolation and within the full suite (aside from the unrelated failure above).
