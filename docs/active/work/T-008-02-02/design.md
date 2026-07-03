# T-008-02-02 — multi-hand-dynamics-suite — Design

Options, tradeoffs, chosen approach — grounded in research.md.

## Decision 1 — drive hands with a locally-duplicated bot self-play loop, not random-legal play

**Chosen**: a test-local `selfPlayHand(seed): HandRecord` — the same shape as
`selfplay.test.ts`'s `selfPlay` (discardPolicy/callPolicy over legalActions/seatView, the
same claim-window arbitration: consult each offer-holding seat once in offered order,
earliest non-draw answer wins) — copied, not imported, into the new suite file.

**Rejected: import `selfPlay` from `selfplay.test.ts`.** Test files import from `./index`
(core's barrel) or `./record` etc., never from each other's `.test.ts` — no such export
exists, and `selfplay.test.ts`'s own header states the doctrine directly: "the codebase
locks independent statements by test rather than sharing them," giving the concrete example
of THIS exact arbitration rule being stated three separate times already (`policy.test.ts`,
`drive.ts`, `selfplay.test.ts`). `game.test.ts` (T-008-02-01) already followed this doctrine
for the same reason. A fourth statement, here, is consistent with the established pattern,
not a deviation from DRY invented for this ticket.

**Rejected: `dynamics.test.ts`'s random-legal `playRecord`.** Random-legal play very rarely
reaches an agari end (that file's own win-carrier mining found only 8/1000 seeds do) and
never guarantees SOME outcome every hand — `foldGame` needs every intermediate hand to
actually END (`'agari'` or `'ryuukyoku'`) to fold cleanly; only bot self-play reliably
reaches an end every time (`selfplay.test.ts`'s own 40-seed corpus: 100% end rate, zero
stalls). `game.test.ts` design.md (T-008-02-01, Decision 7) already made and justified this
exact call for the single/two-hand mined case; this ticket generalizes it to N hands and a
much larger seed sample, so the same reasoning carries over unchanged.

## Decision 2 — chain hands via `handSeedOf`, driving each with the SAME bot policy, no game-level RNG

**Chosen**: `playGame(gameSeed, handCount): GameRecord` — for `handIndex` in `0..handCount-1`,
self-play `handSeedOf(gameSeed, handIndex)` to an ended `HandRecord`, push its `actions` onto
`hands`. Uses the REAL, already-tested `handSeedOf` (imported from `./index`) — only the
turn-by-turn bot loop is duplicated (Decision 1), not the seed derivation, which is pure math
already covered by `game.test.ts`'s own dedicated suite. No additional randomness is
introduced at the game level: exactly like a single hand, "same `gameSeed` in ⇒ same
`GameRecord` out" end to end, because every per-hand seed and every bot decision is a pure
function of state that has already been shown deterministic.

**Rejected: derive each next hand's seed from the PRIOR hand's ending state (e.g. hash the
final wall) instead of `handSeedOf(gameSeed, index)`.** Would silently create the "second
authority" problem `game.ts`'s own module header spends a paragraph warning against —
`handSeedOf` is the CONTRACT-FROZEN derivation (`design.md` Decision 1 in T-008-02-01); this
suite must exercise that real contract, not invent a parallel one.

## Decision 3 — hand-count bound: a fixed, documented budget, not a derived ceiling

**Chosen**: `HANDS_PER_GAME = 6`, a plain named constant with a comment explaining it is a
CHOSEN suite budget, not a proven ceiling (unlike `ACTION_BOUND`, which is real wall
arithmetic) — renchan is theoretically unbounded (a dealer could keep winning forever), so
no true ceiling exists to derive. 6 is picked empirically low enough to keep the corpus fast
(6 hands × ~40-seed corpus × 2 (byte-identical double-play) ≈ selfplay.test.ts's own 40-seed
corpus run 12×, well under its existing 60s explicit timeout) while high enough that a
6-hand corpus run over ~15-20 seeds reliably exhibits BOTH a renchan (dealer repeats) and a
rotation (dealer moves), the non-vacuity bar `selfplay.test.ts`/`dynamics.test.ts` both set
for their own corpora ("a zeroed tally must widen the corpus, never weaken the check").

**Rejected: play until some stopping condition (e.g. a score threshold, or "first
ryuukyoku").** No such condition exists anywhere in the engine (no round-wind/honba/hanchan
concept — research.md §2) — inventing one for this suite would be testing behavior `game.ts`
itself does not define, out of this ticket's scope (the ticket is about the EXISTING
`foldGame` fold, not about adding match-end semantics).

**Rejected: an unbounded loop with only `ACTION_BOUND`-style total-action tripwire.** Renchan
chains could in principle run long before a rotation occurs, and unlike a single hand's
`ACTION_BOUND` (derived from the wall's exact 136-tile arithmetic — a proven ceiling), there
is no analogous proof for "how many renchans can a real bot pair chain" — an unbounded loop
risks a slow or hanging suite on an unlucky seed with no principled bound to catch it. A
fixed hand count sidesteps needing that proof entirely.

## Decision 4 — invariants checked at EVERY hand boundary via `foldGame` on every prefix

**Chosen**: after building the full `handCount`-hand `GameRecord` (with a trailing `[]` for
the "just dealt" active hand, `game.test.ts`'s own convention), iterate every prefix length
`1..handCount` (each a valid `GameRecord` on its own — every included hand is ended, so
`foldGame`'s "only the last may be `'playing'`" guard is satisfied automatically) and assert
at each:
1. `scores` sum to exactly `4 * STARTING_SCORE` (conservation, restated as
   `25000` — the same literal `game.test.ts`/`settlement.ts` both already use, not
   re-imported since it is module-private in both).
2. `scores`/`dealer`/`seatWinds` are reproduced identically by folding the SAME prefix twice
   (fold purity, generalized from `game.test.ts`'s single-record `toEqual` check to every
   prefix, the `dynamics.test.ts` "assert at every log prefix" precedent applied one level
   up).
3. `dealer` for the ACTIVE hand at this prefix matches an INDEPENDENTLY computed expectation
   (Decision 5) derived from the previous prefix's own dealer plus the just-folded hand's
   real `TableState.win`.

**Rejected: only check final-state invariants (score sum, single top-level fold) once per
game.** Would miss a bug that only manifests mid-chain (e.g. a renchan that should have
carried the dealer but silently rotated after hand 3 of 6) — "every hand boundary" is the
AC's own wording, and `dynamics.test.ts`'s `expectConserved` precedent already established
per-prefix checking as this codebase's house style for exactly this class of invariant.

## Decision 5 — dealer/wind consistency: restate the renchan rule test-side, independently

**Chosen**: a small test-local `expectedNextDealer(prevDealer, state): Player` — literally
restates `game.ts`'s own rule (`state.phase === 'agari' && state.win!.winner === 0 ?
prevDealer : nextPlayer(prevDealer)`) as an independent function in the test file, and a
matching `expectedSeatWinds(dealer)` mirroring `windKindOf`/`seatWindsOf`. At each hand
boundary (Decision 4), the suite computes the expected dealer/winds THIS way from the
previous prefix's `foldGame(...).dealer` and the just-completed hand's own folded
`TableState`, and asserts it equals what `foldGame` on the LONGER prefix actually returns.

**Rejected: trust `foldGame`'s own returned `dealer` as ground truth and only check
downstream consequences (e.g. score sums).** This is circular for the exact invariant the
AC calls out by name ("dealer/wind bookkeeping stays consistent with each hand's recorded
outcome") — a bug IN the renchan/rotation branch itself would never be caught by a test that
only ever reads that branch's own output. `game.test.ts`'s mined fixtures already assert
concrete dealer values per scenario; this suite's job is to assert the RULE holds generally
across many real hands, which requires restating the rule, not re-reading its result. This
mirrors the codebase's "lock independent statements by test rather than sharing them"
doctrine (research.md §4) applied to a rule instead of an arbitration order.

## Decision 6 — byte-identical replay: rebuild the whole game twice, JSON-compare

**Chosen**: `playGame(gameSeed, HANDS_PER_GAME)` called twice per seed; assert
`JSON.stringify` equality of the two `GameRecord`s (`selfplay.test.ts`'s
`playTwiceChecked` precedent, generalized from one hand's `actions` to a whole
`hands` array — `GameRecord` is already JSON-shaped, same as `HandRecord`). Additionally,
fold each of the two independently-built records and assert the two `GameState`s (`scores`,
`dealer`, `seatWinds`) are deep-equal too — catching a hypothetical divergence that
`foldGame` itself introduces even from byte-identical input (belt-and-suspenders with the
existing per-prefix purity check in Decision 4, but stated once at the top level per game
rather than per prefix, to keep the assertion count proportional).

**Rejected: only compare final scores/dealer, not the full action log.** The AC explicitly
lists "scores, dealer, winds, action logs" as what must replay byte-identically — comparing
only derived facts would miss a determinism break in the RAW log (e.g. a claim-arbitration
tie resolving differently) that happens not to change the final score by coincidence.

## Decision 7 — corpus + fast-check property, both, the `selfplay.test.ts` dual-suite shape

**Chosen**: two `describe` blocks, mirroring `selfplay.test.ts`'s own structure exactly:
1. A deterministic `GAME_SEEDS` corpus (a contiguous small range, e.g. `0..19`) run in a
   plain loop, with explicit non-vacuity tallies (`renchanCount > 0`, `rotationCount > 0`,
   at least one game's final hand ends in each of `'agari'`/`'ryuukyoku'` across the corpus)
   — "a zeroed tally must widen the corpus, never weaken the check," restated.
2. An `fc.integer({ min: 0, max: 0xffffffff })` property over the full seed domain, `numRuns`
   kept small (e.g. 8, matching `selfplay.test.ts`'s own `numRuns: 10` for its full-domain
   sweep) with an explicit `{ timeout: 60_000 }`, asserting the SAME per-boundary invariants
   without the tallies (property runs assert universals, not corpus-specific non-vacuity).

**Rejected: fast-check only, no deterministic corpus.** `fast-check`'s shrinking makes a
failure locatable but its counterexample seed is not guaranteed stable across `fast-check`
version bumps the way a hand-picked literal corpus is — the codebase's own precedent
(`selfplay.test.ts`, `dynamics.test.ts`'s greedy/win corpora) always pairs a frozen
deterministic corpus (for pinned non-vacuity and stable CI) with a property sweep (for
breadth), never one alone for this class of suite.

**Rejected: corpus only, no fast-check.** The AC's own title names "fast-check" explicitly,
and a wider domain sample is exactly the gap `game.test.ts`'s review.md flagged as missing.

## File placement

New file `src/core/game.dynamics.test.ts` — module-scoped to `game.ts` (unlike the bare
`dynamics.test.ts`, which is cross-cutting over `record.ts`/`legal.ts`), the `X.property.test.ts`
naming family's sibling for "dynamics" rather than "property," matching this ticket's own
title (`multi-hand-dynamics-suite`) and the existing bare `dynamics.test.ts`'s precedent of
naming multi-invariant suites `*dynamics*` rather than `*property*`. No production code
changes — `game.ts`, `settlement.ts`, `record.ts` etc. are read-only dependencies.
