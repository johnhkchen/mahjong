# T-008-01-01 — fu-calculation — Progress

## Deviation from plan.md's step split

plan.md sequenced five steps (scaffold → dispatcher → tests → barrel export →
verification pass) as four separate commits. In practice `fu.ts` was authored as
one coherent pass — the helpers, the attribution/max-fu logic, and the public
`fuOf` dispatcher are mutually referential enough (the pinfu overrides read the
same `raw` accumulator the set/meld/pair fu loops build) that splitting the file
into a "helpers only, no export" commit followed by a "dispatcher" commit would
have produced an intermediate commit with dead code and no way to verify it
independently — against the spirit of plan.md's own "each step... verified
independently where possible" rule, since step 1 alone has nothing to check
beyond `tsc`. Collapsed to two commits instead: (1) the module + its test suite
together (steps 1–3, since the fixtures are what actually verify the helpers),
(2) the barrel export (step 4). Step 5 (final verification) folds into commit 2,
per plan.md's own fallback ("no separate empty commit for a clean verification
pass") — nothing surfaced to fix.

## What was done

- `src/core/fu.ts` — new module, `fuOf(ctx: WinContext): number`, the sole export.
  Implements base/menzen/tsumo fu, the set-fu table (open/closed × simple ×
  terminal-honor for triplets and kans), unconditional pair-value fu (dragon/seat
  /round wind, additive for double wind), the wait-attribution max-fu resolution
  (design.md §2) covering tanki/kanchan/penchan/shanpon/ryanmen, the pinfu-shape
  20-tsumo/30-ron fixed exception, the open kuipinfu-ron-30 convention, chiitoitsu's
  fixed 25, and the kokushi-throws guard. Round-up-to-10 applied once at the end of
  the standard-form path.
- `src/core/fu.test.ts` — new suite, 15 tests across 8 `describe` blocks, one per
  AC bullet plus the wait-attribution-ambiguity fixture called out in design.md §2
  (not itself an AC bullet, but the design decision it validates is load-bearing:
  a naive "prefer run absorption" implementation would silently under-price a
  tanki wait that coincides with a possible ryanmen reading of the same
  decomposition). Every expected number is hand-derived in a comment before the
  assertion, per `yaku.test.ts`'s house style.
- `src/core/index.ts` — added `export * from './fu'`, one line, at the file's tail
  (after `yakuman`, matching structure.md's placement).

## Verification run

- `npx vitest run src/core/fu.test.ts` — 15/15 passed on the first run (every
  hand-derived fixture number matched the implementation's output; no fixture
  needed correction after seeing a failure).
- `npm run test` (full suite) — 592/592 passed, 26 files, no regressions.
- `npm run check` (svelte-check + tsc) — 0 errors, 0 warnings across 180 files.
- Grepped `fu.ts` for `svelte`/DOM imports and for its export surface: zero DOM
  imports, exactly one exported symbol (`fuOf`), matching design.md §7.

## Deviations from design/structure beyond the commit split

None. The `runContainsAtEdge`/named kanchan-vs-penchan classifier structure.md
sketched was simplified away during implementation: both wait types score
identically (+2), so `attributionDelta` just returns `WAIT_FU` for either case via
`completesRyanmen(...) ? 0 : WAIT_FU` rather than naming the sub-case — the
kanchan/penchan distinction is documented in `completesRyanmen`'s own doc comment
and in the test fixture comments instead, per plan.md's "blueprint, not code"
framing (structure.md is not a literal contract).

## Remaining for later tickets (not this ticket's scope)

- T-008-01-02 (han-values-and-dora-counting) and T-008-01-03
  (payment-tables-and-noten-bappu) are the next consumers — neither is touched
  here, per the ticket's explicit "no han, no points here" scope.
- No caller yet picks "the best-scoring decomposition" across `decomposeAgari`'s
  multiple readings (analogous to how `yakuOf` unions `standardYakuOf` across
  readings) — `fuOf` operates on one reading, same as `standardYakuOf`. That
  aggregation is implicitly future scoring-epic work, not named by any open
  ticket yet; flagged in review.md.
