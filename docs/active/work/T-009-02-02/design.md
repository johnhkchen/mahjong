# Design — T-009-02-02 riichi-dynamics-suite

## Decision 1: extend `game.dynamics.test.ts` in place, do not fork a new file

**Options considered:**
- (a) Extend `game.dynamics.test.ts` — add a pot-aware conservation check and a riichi
  non-vacuity/pot-carry describe block to the existing E-008 suite.
- (b) New file `game.riichi.dynamics.test.ts` mirroring `dynamics.test.ts`'s split
  (base dynamics suite + separate riichi-focused suite).

**Chosen: (a).** Research found the existing suite's conservation check is not just
incomplete but **actively wrong** today (`expected 99000 to be 100000`, a live failure)
— this is a bug-fix to an existing assertion, not a new concern bolted alongside an old
one. A fork would leave the broken assertion in place in one file while a parallel file
re-derives the correct one, which is worse than fixing it at the source. It also
contradicts this codebase's own stated preference (T-009-01-04's ticket text, quoted
verbatim in the ticket header): "extending the existing dynamics/agreement suites rather
than forking them." `dynamics.test.ts` itself followed this pattern — riichi properties
landed as a new `describe` block in the same file, not a new file — and
`game.dynamics.test.ts` is that same file's game-level counterpart.

**Rejected (b)** because the split in `dynamics.test.ts` exists for a documented reason
(pre-riichi fixtures vs. riichi-eager corpus, different builders) that does not apply
here: `game.dynamics.test.ts` already has exactly one corpus-building path
(`playGame`/`selfPlayHand`), already produces riichi declarations without modification,
and there is no separate "non-riichi" driver to keep isolated from a "riichi" one.

## Decision 2: fix the conservation check at its one definition site, not per-test

`expectValidBoundary` is the single function both the deterministic-corpus test and the
fast-check property test call (via `walkGame`) to check every hand boundary. Fixing the
formula there — `scores.reduce(+) + pot === 4 * STARTING_SCORE` — fixes both call sites
simultaneously and keeps the "one assertion, restated once" discipline the file already
follows (`nextExpectedDealer`/`expectedSeatWinds` are each defined once, called from both
suites). No alternative considered — duplicating the fix per test would violate the
file's own established pattern for zero benefit.

## Decision 3: add a dedicated pot-carry assertion, independent of the conservation sum

**Options considered:**
- (a) Rely solely on the fixed conservation sum (scores + pot = 100000) to implicitly
  prove the carry rule is correct.
- (b) Add a second, independent assertion inside `expectValidBoundary` that restates the
  carry rule directly — `state.pot` at a fresh boundary must equal 0 if the just-ended
  hand was `'agari'`, or that hand's own `state.pot` if `'ryuukyoku'` — and compares it
  against the actual `GameState.pot`.

**Chosen: (b).** The AC names "pot carries" as its own clause, distinct from "points +
pot conserved" — the ticket wants the carry rule itself under test, not just a downstream
consequence of it. A conservation-sum-only check cannot distinguish "pot carried
correctly" from "pot silently reset and money instead leaked/duplicated in `scores`" if
`foldGame`'s settlement application also had a matching sign error (unlikely given
T-009-01-01/04 already cover settlement itself, but the whole point of this file's
"restate independently, don't read the branch under test" doctrine — stated in its own
header — is to not lean on that assumption). This is directly analogous to
`dynamics.test.ts`'s own `carriedPot` computation, generalized one level: same formula
(`phase === 'agari' ? 0 : pot`), applied to the ended `TableState` at each game-level
boundary rather than a single folded hand.

**Rejected (a)** because it would leave exactly the gap Decision 3's own reasoning above
identifies, and because the sibling single-hand suite already sets the precedent of
asserting the carry rule as its own fact, not just via the sum.

## Decision 4: track riichi incidence in the deterministic-corpus test only

**Options considered:**
- (a) Add a non-vacuity tally (count of hand boundaries whose just-ended hand's action log
  contains a `'riichi'` action) to the fixed-`GAME_SEEDS` corpus test, mirroring
  `dynamics.test.ts`'s `riichiBearing` tally exactly.
- (b) Add the same tally to the `fc.property` full-seed-domain test instead, or to both.

**Chosen: (a).** The fixed 20-seed corpus is deterministic and already independently
confirmed (research.md probe) to produce riichi in 83/120 hands — asserting `> 0` there
is a real, always-reproducible check with a fixed corpus, exactly the pattern
`dynamics.test.ts`'s own non-vacuity checks use (never over the randomized fast-check
domain, where a check `> 0` could occasionally be vacuously satisfied by luck on one seed
sample and says nothing reproducible about the harness). The fast-check property test's
existing job — 8 random seeds proving no stalls and conservation holds across the full
`uint32` domain — is unrelated to proving riichi occurs; folding a non-vacuity assertion
into it would conflate "structural property holds everywhere" with "this specific
behavior is exercised," which the file already keeps separate (byte-identical replay and
corpus non-vacuity are already their own describe blocks, not folded into the property
test).

**Rejected (b)** for the reason above, and because it adds risk of intermittent failure
(if an unlucky 8-sample draw contained zero riichi hands) with no compensating benefit —
the deterministic corpus already proves the harness exercises riichi reliably.

## Decision 5: where exactly the two new checks live inside `expectValidBoundary` /
the corpus `it`

`expectValidBoundary` already returns `state.dealer` to thread `walkGame`'s loop; it
gains the fixed conservation line and the new pot-carry assertion, both inline, no new
helper needed beyond a small `expectedPotCarry(endedState)` restated function
(mirrors `nextExpectedDealer`'s existing shape: one-line pure function, TableState in,
expected value out, never touching `foldGame`'s own code path). The riichi tally is
scoped to the existing `'multi-hand dynamics: corpus'` `it` block (which already has
access to `prefix[len-1]`, the just-ended hand's action log, inside its loop) — no new
`describe` block, since `dynamics.test.ts`'s own riichi suite is a separate `describe`
only because its OTHER riichi-specific properties (discard-equals-drawn-tile,
lock-related) don't apply at game level; the two additions here belong with the existing
corpus-level checks they extend.

## Non-goals

No change to `game.ts`, `record.ts`, `settlement.ts`, or `policy.ts` — confirmed correct
by research and by the single-hand suite's own passing tests. No new fixtures, no new
driver function, no widened corpus.

## Repair (2026-07-04) — three more decisions, expanded scope

### Decision 6: fix `settlement.property.test.ts` by correcting its stated law, not by
freezing `state.pot` out of the check

**Options considered:**
- (a) Change the assertion to `deltas.reduce(+) + unclaimedPot === 0` (`unclaimedPot` is 0
  for `'agari'`, `state.pot` for `'ryuukyoku'`) — the same law this ticket's original pass
  applied at game level, restated at the single-hand property level `endedStateOf` already
  operates at.
- (b) Change `endedStateOf`'s driver to suppress riichi declarations (e.g. filter riichi
  out of `legalActions` before calling `discardPolicy`), preserving the old "always
  exactly zero" law by construction.
- (c) Skip/weaken the property to only sample non-riichi-bearing seeds.

**Chosen: (a).** `settlement.ts`'s own module header (read in research, lines 53-66)
already states this exact corrected law in prose — this is applying documented,
already-decided doctrine to a test that predates it, not a new design choice. (b) would
make the property test stop exercising riichi-bearing hands at all, silently narrowing
coverage exactly where a real invariant (the pot-aware conservation law) needs proving —
worse than doing nothing, since it would look green while testing less. (c) is the
"weaken the check" anti-pattern this codebase's own test-file headers explicitly warn
against (`selfplay.test.ts`'s corpus doc comment: "Zeroed by a policy/legal change? Widen
the corpus... never weaken the check" — the same doctrine applies here by analogy).

### Decision 7: re-mine `selfplay.test.ts`'s anchors in place; re-anchor seed 13 to a
different seed rather than reframe its assertions

Seed 25 only gained a `'riichi'` yaku entry — a pure re-pin, no design choice. Seed 13 is
the real decision: its new trajectory (ends via plain ron at action 107, winner shifted
to seat 1) no longer exercises the scenario the test's own title and comment name — "a
houtei ron folded OUT of ryuukyoku (the ended→ended transition)."

**Options considered:**
- (a) Re-pin seed 13 to its own new facts (ron, winner 1, `yaku: ['riichi']`), keep the
  seed number, drop or rewrite the houtei-specific title/comment since it no longer
  applies.
- (b) Scan the full seed domain for a different seed that still produces a houtei ron
  under the new riichi-eager bots, and re-anchor the test's seed to that one, keeping the
  scenario intact.
- (c) Delete the anchor entirely, reasoning the scenario is already covered by
  `drive.test.ts`'s dedicated fixture-driven houtei carve-out test.

**Chosen: (b), landed on seed 356** (scanned 0-499 via an instrumented temporary test,
removed before commit; no hit inside the original 0-39 corpus range, first hit at 356:
`ron, winner 0, from 2, yaku: ['houtei'], length 147` — the closest match to seed 13's
old shape, and stable across the run). This is a corpus/anchor-widening move, not a
weakened check — the same "widen, don't weaken" doctrine as Decision 6, applied to a
named-seed anchor instead of a property's sample count. (a) would silently drop this
anchor's entire reason for existing (proving the ended→ended houtei carve-out is reached
via real self-play, not just a hand-constructed fixture) while leaving a misleading title
in place. (c) was rejected: `drive.test.ts`'s test is deliberately constructed
(hand-picked action sequence) to prove the state-level mechanism works at all; this
anchor's distinct value is proving a *real, unmodified self-play driver* reaches that same
mechanism unassisted — losing it would be a silent coverage regression, exactly what the
repair note ("reconcile, don't revert") warns against.

### Decision 8: `drive.test.ts`'s BOT-rons-the-player anchor — pure re-pin

Length (73) and every win field except `yaku` are unchanged; the fix is adding `'riichi'`
ahead of `'ittsuu'` in the expected array (yaku order follows `yakuOf`'s own union order,
confirmed by the instrumented re-run, not asserted independently here — no design
question, just the mined fact).

## Non-goals (repair)

No change to `policy.ts`, `settlement.ts`, `record.ts`, or `game.ts` in this repair either
— all four failures are stale test-side expectations, confirmed root-caused to
T-009-02-01's `discardPolicy` change, never to a settlement/pot bug. `app.controls.svelte.test.ts`,
the repair note's fourth item, needed no change — verified already green (research.md).
