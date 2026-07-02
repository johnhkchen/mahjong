# T-004-01-04 — call-dynamics-property-suite — Plan

Ordered steps over one file (`src/core/dynamics.test.ts`). Two commits planned
(structure.md ordering: drivers+invariants must land together; mutation matrix can
follow). Verification gate for every step: `just test` (and `just check` before each
commit). The suite under edit is the deliverable — "tests for the tests" means each
property must be demonstrably non-vacuous, so several steps include a deliberate
sanity probe (temporarily break an expectation, watch it fail, revert) noted below as
*probe*.

## Step 0 — Baseline

Run `just test` and record the count/runtime (expected: 175 tests, ~1.7s per -03
review). This is the regression floor.

## Step 1 — Drivers (playRecord rewrite, greedy corpus)

1. Add `MAX_MELDS`, `ACTION_BOUND` (with the D1 arithmetic comment), `CHOICE_MAX`.
2. Rewrite `playRecord`: delete `drawsAndDiscards`, one choice per action over the
   full offered set, stop on empty set or exhausted choices, throw past
   `ACTION_BOUND`.
3. Add `isCall`, `playGreedy` (createRng/nextInt stream; calls preferred when
   offered), `GREEDY_CORPUS_SEEDS` (provisional 0..49), module-level `greedyCorpus`.
4. Rewrite `gameArb` / `fullGameArb` per structure §3 (choice arrays sized by
   ACTION_BOUND; dangle keyed off `offered[0].type === 'draw'`).
5. Rewrite the charter comment.

**Verify:** file compiles; scratchpad probe — drive `playGreedy` over seeds 0..49 and
print per-form action tallies (chi/pon/daiminkan/ankan/shouminkan) and max game
length. This empirically fixes N for the coverage assertion (grow the range if a form
is missing — shouminkan is the one at risk) and confirms ACTION_BOUND is never
approached legally. Old exact-count tests now fail — expected mid-step state.

## Step 2 — Invariant suites re-stated

1. Widen `allZones` with the melds zone; extract `expectConserved(record)`; add the
   corpus conservation `it`.
2. Termination: replace the exact-140 test with the end-state-shape `it` and the
   identities `it` (`countTypes` helper; draws+kans === FULL_TURNS, discards ===
   draws+kans+chi/pons, ponds total === discards, melds total === chi+pon+
   daiminkan+ankan). Add the corpus termination+coverage `it` (every call form
   present — the frozen N from step 1).
3. Determinism: keep the double-fold property over the new gameArb, add melds
   freshness assertion and the corpus determinism `it`.

**Verify:** `just test` fully green. *Probes:* (a) temporarily drop the melds zone
from `allZones` — conservation must fail (proves claim-bearing games are actually
generated); (b) temporarily make `playGreedy` skip shouminkan — coverage must fail.
Revert both.

**Commit 1:** `T-004-01-04: dynamics generator samples full call vocabulary —
six-zone conservation, kan-aware termination identities, greedy corpus`.

## Step 3 — Mutation matrix

1. Generalize seat bump to all seven action types (rebuild-with-seat switch).
2. Restrict type flip to draw/discard indexes (`fc.pre`).
3. Add claim-tile retarget, uses retarget (both with the fc.pre accidental-legality
   filter, discard-retarget precedent).
4. Add stale-window shift (prefix + offered draw, claim as mutant).
5. Widen the append-after-ryuukyoku mutant menu with claim forms.
6. Confirm duplicate operator needs no code change (claims/kans double-throw via
   closed window / melded-away uses); update its comment.

**Verify:** `just test` green; fc runs give each new operator its 100 default runs.
*Probe:* fc.pre acceptance — if claim-bearing indexes are too rare for operators 3–4
(fc.pre starves), bias the source arb by filtering generated records to those
containing claims (`fc.pre(record has a claim)` is acceptable; gameArb's uniform
sampling makes claims common per D1, so starvation is unlikely — measure, don't
assume).

## Step 4 — Dead-wall-exhaustion anchors

1. Mirror `FOUR_KAN_SEED`, `FOUR_KAN_GEOMS`, `fourKanChain()`,
   `fifthKanWindowRecord()` from legal.test.ts verbatim (frozen, never regenerate;
   comment marks the mirror).
2. Directed `it`: fifth-kan daiminkan mutant — unoffered AND throws
   `'no rinshan tile remaining'` (assert on the message, not just RangeError, since
   several guards could fire).
3. Directed `it`: seed-1004 haitei ankan mutant (`uses: [55, 52, 53, 54]`) —
   unoffered AND throws `'on an empty live wall'`.

**Verify:** `just test` green; message-level assertions pin WHICH guard fired.

## Step 5 — Budget, polish, gates

1. Runtime check against the step-0 baseline; added wall-clock target ≤ ~2s. Dials in
   trim order (design D6): corpus N, conservation numRuns, fullGame numRuns.
2. `just check` (svelte-check + tsc) and `just build` clean.
3. Re-read the AC line by line against the suites (traceability listed in review.md).

**Commit 2:** `T-004-01-04: illegal-claim mutation matrix — wrong tiles/seat, stale
window, dead-wall exhaustion anchors`.

## Testing strategy summary

- **Property tests** (fc): conservation at every prefix, termination end-state +
  identities, double-fold determinism, seven mutation operators — all over
  call-bearing random-legal trajectories.
- **Directed tests**: greedy-corpus termination/coverage/conservation/determinism
  (deterministic, fc-free), two exhaustion anchors with message-pinned throws.
- **Non-vacuity**: corpus coverage assertion (every call form must appear — a
  regression that stops generating calls fails loudly), exact identities instead of
  inequalities, step-2/3 probes during implementation.

## Risks and contingencies

- **Engine bug surfaced by the widened space** — stop, document in progress.md,
  surface in review.md; do NOT patch record.ts/legal.ts silently (design D6).
- **fc.pre starvation** in claim-dependent operators — mitigation in step 3.
- **Runtime blowout** from O(n²) prefix folding over longer call games — dials in
  step 5; conservation stays the only every-prefix property under fc.
- **Greedy corpus misses a form even at larger N** — fall back to widening the
  policy (e.g., prefer kans over other calls) before reaching for hand-built
  records; document whichever N/policy is frozen.
