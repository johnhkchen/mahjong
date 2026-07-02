# T-004-01-04 — call-dynamics-property-suite — Progress

## Completed

- **Step 0 — baseline**: 175 tests, tests-time ~1.74s, all green.
- **Step 1 — drivers**: `playRecord` rewritten over the full offered set;
  `drawsAndDiscards` deleted; `ACTION_BOUND` (174, with the ≤172-action arithmetic in
  its comment), `CHOICE_MAX` (19 — fc.nat(13) would have made every offer index ≥14,
  i.e. all post-draw kan offers, unreachable through the modulo), `MAX_MELDS`,
  `isCall`, `playGreedy`, `GREEDY_CORPUS_SEEDS`, module-level `greedyCorpus`,
  `gameArb`/`fullGameArb`/`corpusGameArb`/`anyGameArb`, charter comment rewritten.
- **Step 1 probe (corpus N)**: tallied greedy play over seeds 0..199 —
  totals {chi 1289, pon 551, shouminkan 50, daiminkan 16, ankan 4}; ankan carriers
  are seeds 63/67/69/161 only. **N frozen at 100** (covers all five forms); noted in
  the corpus comment. Probe file deleted.
- **Step 2 — invariants**: six-zone `allZones` (melds' `own` added), shared
  `expectConserved`, corpus conservation sweep; termination re-stated as the closed
  end shape + `expectEndIdentities`; corpus termination/identities/coverage test;
  determinism over `anyGameArb` with melds freshness + claim-bearing records.
- **Step 2 probes**: (a) melds zone dropped from `allZones` → both conservation
  tests fail (claims demonstrably present in both trajectory sources); (b)
  shouminkan filtered out of `playGreedy`'s offered set → coverage test fails
  naming the form. Both reverted.
- **Step 3 — mutation operators**: seat bump generalized to all seven forms
  (`withSeat`); type flip restricted to draw/discard indexes; discard tile retarget
  kept; claim-tile retarget, uses retarget (offered-set fc.pre filter), stale-window
  shift added; duplicate unchanged in code with the claim/kan reasoning documented;
  append-after-ryuukyoku menu widened to all seven forms.
- **Step 4 — exhaustion anchors**: `FOUR_KAN_SEED`/`FOUR_KAN_GEOMS`/`fourKanChain`/
  `fifthKanWindowRecord`/`dealtLive`/`dealtDead`/`tsumogiriRecord` mirrored from
  legal.test.ts (marked frozen/never-regenerate); fifth-kan daiminkan mutant pinned
  to 'no rinshan tile remaining' (with the offered-pon non-vacuity check); seed-1004
  haitei ankan mutant pinned to 'on an empty live wall'.
- **Step 5 — gates**: `just test` 199/199 green (tests-time ~1.86s, +~0.12s over
  baseline — well inside the ~2s budget; no dials needed); `just check` 0 errors;
  `just build` single-file OK.

## Deviations from the plan

1. **Choice consumption is per DECISION POINT, not per action** (refines design D1):
   forced single-offer points (claimless pre-draw draws) auto-play without consuming
   a choice. Rationale: fast-check biases generated arrays short; consuming choices
   on forced draws would have halved effective game depth for a given array and
   broken the old "choices are decisions" semantics for no coverage gain. The
   ACTION_BOUND-sized choices array still can never be exhausted by a legal game
   (decisions ≤ actions ≤ 172), so fullGameArb's totality argument is unchanged.
2. **The plan's discard identity was wrong, and the suite caught it** (plan step 2
   wrote "discards === draws + kans + chi/pons"): an ankan/shouminkan ABSORBS the
   drawn tile of the draw preceding it — its rinshan re-fills the `drawn` slot — so
   closed-kan forms add no discard obligation of their own. The correct identity,
   now asserted and documented: **discards === draws + daiminkans + chi/pons**.
   First real fruit of the widened generator: the initial run failed on both the
   random-full-game property and the greedy corpus with a 76 ≠ 77 off-by-one,
   exactly one closed kan per failing game. Engine behavior is CORRECT — this was
   a spec-of-the-test bug; record.ts/legal.ts untouched, per design D6.
3. **greedy policy prefers kans over other calls** (design D2 said "calls
   preferred", kans-first was its named fallback): implemented kans-first from the
   start since ankan scarcity was predictable; even so, ankan needed N=100 (greedy
   pons eat copies before concealed quads assemble — see the corpus comment).
4. **One commit for the suite, not two**: the rewrite is one file whose sections
   are interdependent (drivers feed both invariants and mutation operators);
   splitting would have manufactured a non-green intermediate state.
5. **Incident, resolved**: a probe cleanup `git checkout` momentarily reverted the
   uncommitted rewrite; restored immediately from the session's file state and
   re-verified green (probe (a)'s failure evidence was captured before the revert).

## Remaining

Nothing — all plan steps complete, all gates green. Review phase next.
