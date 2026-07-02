# T-002-01-04 — Progress: hand-record fold entrypoint

Tracking against plan.md. All steps completed in one pass; no deviations of substance.

## Completed

- [x] **Step 1 — `src/core/record.ts`**: `HandAction = never` (empty action vocabulary,
      widening is the extension point), `HandRecord { seed, actions }`, `TableState`
      (seat-indexed hands in draw order, post-deal `live`, `dead`, `doraIndicator`,
      mapped `dora`) documented as a derived view rather than a frozen contract, and
      `foldRecord` — the `RangeError` guard on a non-empty log (the step function for
      an empty vocabulary), then build → partition → deal → assemble with
      `dora: doraKindOf(kindOf(doraIndicator))`. Imports: `./tiles`, `./wall`,
      `./dora`, `./deal` — siblings only, purity-gate-safe comments.
- [x] **Step 2 — barrel**: `export * from './record'` appended to `src/core/index.ts`
      after `./deal`. `just check` green immediately after (0 errors, 0 warnings) —
      no `export *` collisions; AC (d) satisfied.
- [x] **Step 3 — properties + guard** in `src/core/record.test.ts`: empty-log fold
      deep-equals the explicit build → partition → deal → dora composition (AC a);
      "same seed → identical deal" named verbatim (AC b); "same record → same folded
      state" across repeated folds with fresh-array `not.toBe` checks (AC c); record
      not mutated; 136-tile conservation through the fold; non-empty-log RangeError
      guard via a single commented `as unknown as` cast.
- [x] **Step 4 — golden cross-check + golden test**: the mapped dora was hand-derived
      FIRST (id 24 → kind index 6 → `7m` → numbered cycle → `8m`), then a throwaway
      scratchpad script (`capture-fold-golden.ts`, not committed) folded seed 1 and
      compared every field against the hand-derived kind and the already-frozen
      deal/wall goldens: **ALL AGREE** (hands, live prefix `[100, 60, 14, 66]`, dead
      wall, indicator 24, kind `7m`, dora `8m`, plus an independent
      `doraKindOf(kindOf(24))` read). Golden test pinned with provenance comment.
      Golden-binds check performed: perturbed `'8m'` → `'9m'`, suite failed
      (1 failed / 50 passed), restored, suite green again.
- [x] **Step 5 — full verification**: `just test` → 8 files, **51 tests, all passing**
      (tiles, rng, wall, dora, purity, deal, record, app SSR; was 44 before this
      ticket). `just check` → svelte-check + tsc strict, 0 errors, 0 warnings.
      AC walk: (a) test 1 + golden, (b) test 2 verbatim, (c) test 3 verbatim,
      (d) barrel line + every test import resolving through `./index`. `git status`
      showed exactly record.ts, record.test.ts, index.ts plus this ticket's artifacts
      (and lisa's pre-existing ticket-frontmatter edits, untouched and unstaged).
- [x] **Step 6 — code commit**: `T-002-01-04: hand record type + fold entrypoint
      (foldRecord) as core's public contract` (f3681e1) — src/core/record.ts,
      src/core/record.test.ts, src/core/index.ts only, staged explicitly. Ticket
      frontmatter untouched (lisa owns phase/status); the artifacts commit follows
      once review.md exists.

## Deviations from plan

- None. Module shape, test names, golden procedure, and commit contents match
  structure.md/plan.md exactly. The golden needed no new capture machinery, as
  predicted — every array literal was reused from frozen goldens; only the dora kind
  was new, and both independent derivations agreed on the first run.

## Remaining

- Review phase (review.md), then the artifacts commit.
