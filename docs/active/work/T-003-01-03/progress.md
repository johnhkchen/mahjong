# T-003-01-03 — Progress: turn-loop-property-suite

## Completed

- **Step 0 — baseline**: 81 tests green, ~0.5s test time (~1s wall) before this
  ticket. Budget reference recorded.
- **Step 1 — generator + conservation** (`c3d95ab`): created
  `src/core/dynamics.test.ts` with `playRecord` (legalActions-driven walk, hard
  142-action bound, foldRecord as the only state-advancer), `allZones`, `gameArb`
  (seed + up to 70 choice ints + optional dangling draw), and the conservation
  property: every prefix of a random-legal game folds to a five-zone partition
  (hands/ponds/drawn/live/dead) of exactly 136 distinct tile ids, `numRuns: 50`.
- **Step 2 — determinism** (`2a2ca9d`): double-fold `toEqual` deep equality over
  `gameArb` records plus top-level freshness spot-checks.
- **Step 3 — termination** (`3941461`): `fullGameArb` (exactly 70 choices) plus the
  property that every driven game stops at exactly 140 actions in ryuukyoku with
  empty live, null drawn, empty offered set, and 70 pond tiles.
- **Step 4 — mutation matrix** (`466a58e`): `keyOf`, `assertMutantThrows` (mutant
  absent from the offered set AND the fold throws RangeError), five operator `it`s:
  seat bump, type flip, tile retarget (fc.pre-filtered against still-legal
  retargets), duplicate, append-after-ryuukyoku.
- **Step 5 — cross-checks**: `just check` green (0 errors, 0 warnings); purity gate
  passes with the new file scanned; AC traceability done in review.md.
- **Step 6 — timing gate**: 89 tests, ~0.95s test time / ~0.6s vitest wall duration
  across repeated runs — well under the ~2.5s target. No dial changes; conservation
  stays at `numRuns: 50` (the documented dial), everything else at fc's default 100.

## Verification performed beyond green runs

- **Tamper check (uncommitted)**: removing `state.dead` from `allZones` made the
  conservation property fail on the first fc run — the partition assertion is live,
  not vacuous. File restored from the committed state afterwards.
- **Non-vacuity of mutation properties**: fc's built-in rejection-ratio guard bounds
  `fc.pre` discards; all five operators completed their full run counts.

## Deviations from plan

- **Step 1's tamper spot-check was performed after step 4** rather than during
  step 1 (same check, later timing). During it, restoring the file via
  `git checkout` reverted the then-uncommitted step-4 edits, which were re-applied
  verbatim and committed as `466a58e`. No content was lost.
- **Four-zone literal assertion folded into the five-zone one**: design §4 planned
  an additional explicit four-zone check at pre-draw prefixes; at those prefixes
  `drawn` is null and contributes nothing to `allZones`, so the five-zone flatten
  *is* the literal four-zone form — asserting it twice would compare identical
  arrays. Documented in the `allZones` doc comment instead.
- **Mutation structured as one `it` per operator** (the plan's stated default) — a
  failure names the operator, matching the throw-matrix style of record.test.ts.

## Remaining

- Nothing. Artifacts committed with review.md as the final step.
