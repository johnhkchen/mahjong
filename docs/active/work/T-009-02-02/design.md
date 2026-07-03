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
