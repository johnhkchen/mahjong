# Research: T-009-01-04 riichi-property-suite

## Ticket ask

"Properties hold over random legal sequences containing riichi: every post-riichi
discard equals that turn's drawn tile, points + pot always sum to 4×25000, offered
riichi actions always fold and non-offered ones throw, re-folds are deeply equal, and
every game still terminates." Extends the existing dynamics/agreement suites — the
ticket text explicitly says "rather than forking them" — so no new test file.

Depends on T-009-01-01 (riichi declaration/lock/stick, `phase: done`), T-009-01-02
(yaku family + uradora pricing, `done`), T-009-01-03 (furiten completion, `done`) — all
landed. The riichi mechanic itself is complete; this ticket is pure test coverage.

## What "the dynamics/agreement suites" are

Grep for "agreement"/reading each file's header resolves the two suite names precisely:

- **`legal.ts`'s own header**: "the agreement suite (legal.test.ts)" — `legalActions`
  (offered) cross-checked against `foldRecord` (folds): every offered action folds,
  everything outside throws. `legal.win.test.ts` is a second, narrower agreement suite
  (win offers specifically) — not named by the ticket, out of scope here.
- **`dynamics.test.ts`**: "the turn-loop property suite: dynamics over RANDOM-LEGAL
  trajectories" — conservation, termination, fold determinism, "mutated sequences
  throw," all driven by generators that sample from `legalActions`' own offered set.
  Sibling `game.dynamics.test.ts` is the MULTI-HAND generalization (drives whole
  `GameRecord`s across hand boundaries) — the AC's five clauses are all single-hand
  facts (a post-riichi discard, one hand's points+pot, one hand's re-fold, one hand's
  termination), so `dynamics.test.ts` is the right home, not its multi-hand sibling.

Both files already know about riichi in small ways (T-009-01-01 threaded it through
when it landed): `dynamics.test.ts`'s `withSeat`/`countTypes`/`isCall` already handle
the `'riichi'` action type, and `legal.test.ts` has a whole `describe('riichi offers
(T-009-01-01)', ...)` block of MINED, DIRECTED fixtures. Neither file has a **corpus
of randomly-driven games that actually decide to declare riichi** — the gap this
ticket fills.

## Why no existing driver reaches riichi non-vacuously

- `dynamics.test.ts`'s own `gameArb`/`playRecord` samples the FULL offered set
  UNIFORMLY by index (`legal[choices[c++] % legal.length]`). A riichi offer is a small
  fraction of a typical offered set (14 discards + ≤ a few riichi offers + tsumo +
  kans), so riichi gets chosen only by chance — exactly the same problem `winCorpus`
  solved for win offers (T-005-02-04's own finding: "static tsumogiri hands measured
  ZERO wins in 300 seeds").
- `dynamics.test.ts`'s `playGreedy` explicitly EXCLUDES riichi from its notion of
  "call" (`isCall`'s own comment: "riichi ... is a declare-and-DISCARD, not a call —
  excluded here") and is a pure call-density driver; it was never going to reach
  tenpai deliberately.
- `dynamics.test.ts`'s `playWinEager` is win-eager, not tenpai-eager — it takes a win
  the instant one is offered, which (since a win requires the hand already be
  complete) usually means the driver never lingers at a TENPAI, non-winning point long
  enough to weigh a riichi declaration against ordinary tsumogiri.
- `legal.test.ts`'s `prefixArb`/`tsumogiriRecord` builds pure tsumogiri-only prefixes
  (every discard is the just-drawn tile, hand shape never improves by choice) — most
  seeds never reach tenpai this way, and even the ones whose EXISTING riichi-offer
  fixtures were mined (`RIICHI_SEED = 100` in `record.test.ts`) only ever probe ONE
  offer at ONE turn, never fold the riichi into a continuing trajectory.
- `settlement.property.test.ts`'s own `endedStateOf` DOES use real bots
  (`discardPolicy`/`callPolicy`) to drive to a real ended state, and its §D conservation
  test ("every random seed folds to an ended TableState whose four deltas sum to
  zero") is now the STALE, pre-riichi invariant the module's own header (`settlement.ts`
  lines 53-66) explicitly documents as broken by riichi sticks — but `policy.ts`'s
  `discardPolicy` never emits a `'riichi'` action (grep confirms zero references to
  `'riichi'` in `policy.ts`), so that driver's random corpus never carries a pot either,
  and the stale check passes VACUOUSLY with respect to riichi. `settlement.property.
  test.ts` is not one of the two files this ticket is scoped to touch (see "what's in
  scope" below) — its own staleness is a fact worth noting in review.md, not a fix
  this ticket owns.

## `dynamics.test.ts`'s own declared generator doctrine (a real constraint)

The file's header states outright: "The generators are test-local by design: bots (the
future runtime consumer of random play) are a later epic with their own shape." This
suite deliberately never imports `policy.ts` (`discardPolicy`/`callPolicy`) — its three
existing drivers (`playRecord`, `playGreedy`, `playWinEager`) are all MECHANICAL: rng
sampling, a fixed greedy rule ("kan first, else any claim, else whatever"), or "win
first, else rng." A new riichi-eager driver needs to reach tenpai reliably enough for
a small corpus to be non-vacuous, WITHOUT reaching for `discardPolicy` — the file's own
declared boundary. `shanten` (already core vocabulary, imported directly by
`legal.ts`'s own `riichiOffers`) is available as a MECHANICAL primitive: a
shanten-minimizing discard choice is arithmetic, not "AI judgment," and stays inside
the file's stated doctrine the way `playGreedy`'s "kan first" rule already is a
mechanical heuristic, not a bot.

`game.dynamics.test.ts` and `settlement.property.test.ts` DO import `discardPolicy`/
`callPolicy` (both post-date `policy.ts`, and both drive toward a REALISTIC ended state
for a different purpose — multi-hand chaining, settlement pricing). Those two files are
not this ticket's target (see above), so their precedent does not license bots inside
`dynamics.test.ts`.

## The riichi/pot mechanics a corpus and its properties must respect

- `record.ts`'s `applyRiichi` (line 1057) locks the seat, and `applyAction`'s
  `'discard'` case (line 1199) enforces forced tsumogiri by THROWING if a locked
  seat's discard tile isn't `state.drawn` — so a corpus built exclusively from
  `legalActions` (as every existing driver here is) can never itself violate the lock;
  the property test's job is to make this a POSITIVE, restated assertion over real
  trajectories (not just "it didn't throw"), and to add the NEGATIVE mutation (a
  locked seat's discard rewritten as a fresh riichi throws — not currently exercised
  anywhere).
- `RIICHI_STICK = 1000` (`record.ts` line 130) moves from `scoresIn[seat]` bookkeeping
  into `state.pot` (mutated in place, `applyRiichi`'s tail) on every declaration.
  `foldRecord({ seed, actions })` with no explicit `RiichiContext` — the form every
  suite in this repo uses — defaults to `scoresIn: [25000,25000,25000,25000], potIn: 0`
  (`record.ts` line 141's own comment: "the same assumption settlement.ts's own
  [STARTING_SCORE_DISPLAY] uses"). `settlement.ts`'s `scoreBreakdownOf` independently
  hardcodes `STARTING_SCORE_DISPLAY = 25000` and computes `scores[i] = 25000 +
  deltas[i]` — NOT reading `state.scoresIn` — so the two conventions agree exactly for
  a single hand folded with the default context, which is what every property test in
  scope here uses.
- `settlement.ts`'s own header (lines 53-66) states the corrected invariant directly:
  an agari's deltas sum to `potIn` (0, so deltas sum to exactly 0 — the winner's delta
  already absorbed the WHOLE pot via `deltas[winner] += state.pot`); a ryuukyoku's
  deltas sum to `-RIICHI_STICK * sticksThisHand` (money sitting in the unclaimed pot,
  not yet in any score) — "scores plus the pot are conserved exactly at 4 x
  STARTING_SCORE... game.ts threads potIn/pot hand-to-hand for precisely this reason."
  `game.ts` (line 195) is the one place that ALREADY states the "pot carried into the
  next hand" rule precisely: `pot = state.phase === 'agari' ? 0 : state.pot` — an
  agari's pot is fully claimed (0 carries forward), a ryuukyoku's whole `state.pot`
  carries. This is exactly the single-hand-scoped restatement the AC's "points + pot
  always sum to 4×25000" clause needs; `scoreBreakdownOf(state).scores.reduce(sum) +
  (state.phase === 'agari' ? 0 : state.pot)` is provably `4 * 25000` for every ended
  state under the default fresh context, and is a DIFFERENT (corrected) claim than
  `settlement.property.test.ts`'s existing "deltas sum to zero" check.
- `legal.ts`'s `riichiOffers` (line 188) and `record.ts`'s `applyRiichi` (line 1057)
  are two independent restatements of the SAME five guards (not locked, closed hand,
  ≥1000 points, live wall non-empty, resulting hand tenpai) — this is why "offered
  riichi actions fold, non-offered ones throw" is a real, non-tautological property:
  a drift between the two restatements is exactly what it would catch.

## Existing house idioms this ticket should reuse, not reinvent

- **The "eager driver + frozen/mined corpus" shape**: `playGreedy`+`GREEDY_CORPUS_SEEDS`,
  `playWinEager`+`WIN_CARRIER_SEEDS` — a small deterministic seed range, corpus built
  once at module scope, non-vacuity asserted directly (never an fc statistic, per both
  files' own stated discipline: "a zeroed tally must widen the corpus, never weaken the
  check").
- **`assertMutantThrows`** (`dynamics.test.ts` line 430) — the generic negative-mutation
  helper every "mutated sequences throw" test already uses (splice a mutant into a
  legally-reachable prefix, assert absent from `legalActions` AND thrown by the fold).
  A riichi-specific mutant is one more operator in this same family, not a new
  mechanism (`tile retarget`/`uses retarget` are the closest precedent: build a mutant
  from a real corpus action, `fc.pre`-filter out the rare cases where it happens to
  stay legal, assert the throw).
- **`anyGameArb`** (`dynamics.test.ts` line 325) is the shared `fc.oneof(gameArb,
  corpusGameArb)` arbitrary EVERY mutation property already samples from. Widening it
  with a third `fc.oneof` arm drawing from a new riichi corpus strengthens every
  existing consumer (seat bump, type flip, tile retarget, duplicate, ...) for riichi
  actions specifically, and also strengthens the EXISTING "fold determinism over
  random play" test (line 392) for free — that test already asserts exactly the AC's
  "re-folds are deeply equal" clause, just not yet over riichi-bearing records.
- **Per-file duplication, never a shared test-utils import** — both files' headers
  and multiple internal comments ("Mirrored into dynamics.test.ts", the `keyOf`
  function duplicated verbatim in both `legal.test.ts` and `dynamics.test.ts`) state
  this is the established convention. A driver needed in both files gets written
  twice, trimmed to what each file needs.

## What's in scope vs. explicitly not

- In scope: `src/core/dynamics.test.ts`, `src/core/legal.test.ts` — the two files the
  ticket names.
- Not in scope: `settlement.property.test.ts`'s stale §D check (noted above as a real
  but separate gap — flagged for review.md, not fixed here, since the ticket's own
  text scopes this to "dynamics/agreement," and `settlementOf`/`scoreBreakdownOf` are
  already directly, thoroughly fixture-tested for riichi/uradora by T-009-01-02); no
  production code changes are anticipated (`record.ts`/`legal.ts`/`settlement.ts` are
  all `phase: done` on their own tickets) — this is a pure test-file ticket unless
  implementation surfaces an actual bug, in which case fixing it would be documented
  as a deviation the same way T-009-01-03's review.md documented its ordering-bug find.
