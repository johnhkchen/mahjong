# T-008-01-04 — scoring-property-grid — Plan

Ordered, independently verifiable, atomically committable steps.

## Step 1 — export the four pure functions from settlement.ts

Add `export` to `baseOf`, `roundUp100`, `ronDeltas`, `tsumoDeltas` in
`src/core/settlement.ts`. Add one sentence to the module header noting the new tested
surface.

**Verify**: `just check` (tsc/svelte-check pass — no signature changed, so this cannot
break any existing caller); `just test` (existing suite, 659 tests, stays green — pure
export addition, zero behavior change).

**Commit**: "Export baseOf/roundUp100/ronDeltas/tsumoDeltas from settlement.ts
(T-008-01-04)".

## Step 2 — the han×fu base-points grid (structure.md §A) + roundUp100 boundary table (§B)

New file `src/core/settlement.property.test.ts`. Header comment. `EXPECTED_BASE` table
(han 1-13+, representative fu steps per han, ~40-50 rows) transcribed by hand from
research.md §3, each row commented with which tier it exercises (formula/cap/mangan/
haneman/baiman/sanbaiman/yakuman single/yakuman double). Loop asserting `baseOf(han, fu)
=== base` per row, each as its own `it()`. Separate small `describe` for `roundUp100`
boundary values.

**Testing strategy**: unit/table-driven, no fast-check. This step alone is a complete,
runnable file.

**Verify**: `just test` — new file's tests pass; run in isolation first
(`npx vitest run src/core/settlement.property.test.ts`) to confirm before the full suite.

**Commit**: "Add settlement.property.test.ts: han×fu base-points grid (T-008-01-04)".

## Step 3 — dealer-ness × ron/tsumo payment-split table (structure.md §C)

Add the `ronDeltas`/`tsumoDeltas` table-driven `describe` to the same file: base-point
sample × dealer-ness × ron/tsumo, asserting full 4-tuples.

**Testing strategy**: unit/table-driven, no fast-check, same style as Step 2.

**Verify**: `npx vitest run src/core/settlement.property.test.ts`, then `just test`.

**Commit**: "Add ronDeltas/tsumoDeltas payment-split table to settlement.property.test.ts
(T-008-01-04)".

## Step 4 — local generator infrastructure: `h()`, winner-builder toolkit, `endedStateOf`

Add the three local helper groups (structure.md's "Shared local helpers"): `h()` copied
verbatim; the trimmed `buildWinner`/`buildMelds`/`buildTenpaiParts` toolkit adapted from
`shanten.property.test.ts` (drop shanten-only pieces); `endedStateOf(seed)` adapted from
`selfplay.test.ts`'s `selfPlay` (drop the record/claims-tally/double-play machinery,
return only the final `TableState`). No test bodies yet in this step — just the helpers,
plus one throwaway smoke assertion per helper (later folded into or replaced by Steps 5-7's
real properties) to confirm each compiles and runs before building properties on top.

**Testing strategy**: this step is infrastructure; its own correctness is proven by the
properties in Steps 5-7 actually passing (a broken `endedStateOf` would make Step 5 fail
immediately with a thrown error, not a silent wrong answer — matching the "reference
self-test" precedent in shanten.property.test.ts, which pins its own generator's
well-formedness before trusting it).

**Verify**: `npx vitest run src/core/settlement.property.test.ts` (file still parses and
existing suites from Steps 2-3 still pass); a quick manual/temporary log of
`endedStateOf(0).phase` while developing (removed before commit) to sanity-check it
reaches an ended phase.

**Commit**: none yet — folded into Step 5's commit (infrastructure with no standalone
test value doesn't need its own atomic commit; Steps 5-7 are what actually exercise it).

## Step 5 — zero-sum conservation property (structure.md §D)

Add the `fc.assert(fc.property(fc.integer(...), seed => ...))` zero-sum block using
`endedStateOf`.

**Testing strategy**: fast-check property, `numRuns` ~50, `{timeout: 60_000}` (the
selfplay.test.ts precedent — folding a whole hand per generated seed is the same cost
shape as that file's own heaviest suite). If this fails, the failure names the seed
directly (fast-check's own shrinking) — no additional debug scaffolding needed.

**Verify**: `npx vitest run src/core/settlement.property.test.ts` in isolation first
(this is the slowest new block — confirm its wall-clock time is reasonable, adjust
`numRuns` down if the combined file exceeds a few seconds); then `just test`.

**Commit**: "Add settlement.property.test.ts: zero-sum conservation over random ended
hands (T-008-01-04)".

## Step 6 — fu invariants (structure.md §E)

Add the `winContextArb` (built from the Step 4 toolkit) and the three fu-invariant
`fc.assert` blocks: multiple-of-10-or-25, pinfu 20/30, chiitoitsu 25.

**Testing strategy**: fast-check properties, `numRuns` ~150-250 (shanten.property.
test.ts's band for hand-shaped generators — no engine folding here, just
`decomposeAgari`+`fuOf`+`standardYakuOf` calls, so this is cheap per run and can afford
more samples than Step 5's full-hand-fold property).

**Verify**: `npx vitest run src/core/settlement.property.test.ts`; confirm the pinfu
clause's filter (`standardYakuOf(ctx).includes('pinfu')`) is actually hit a nonzero
number of times across `numRuns` (an `it()`-local counter asserted `> 0` at the end, the
`selfplay.test.ts` non-vacuity-tally precedent) — a property whose guard is never
satisfied proves nothing.

**Commit**: "Add settlement.property.test.ts: fu invariants — multiple-of-10, pinfu
20/30, chiitoitsu 25 (T-008-01-04)".

## Step 7 — dora-gate monotonicity property (structure.md §F)

Add the `ronState`/`tsumoState`-style local `TableState` builder (duplicated from
settlement.test.ts, trimmed to what this property needs) and the monotonicity property:
same win, `doras: []` vs `doras: [heldKind]`, winner's delta magnitude is non-decreasing.

**Testing strategy**: fast-check property using the Step 4 toolkit for the hand, `numRuns`
~100-150. Non-vacuity guard: assert the richer-dora case's delta is STRICTLY greater in
at least one sampled run (else the generator might only ever be picking dora kinds the
hand doesn't hold, making the property vacuously `>=` via equality every time) — an
`it()`-local counter of strict-increase occurrences, asserted `> 0`.

**Verify**: `npx vitest run src/core/settlement.property.test.ts`; `just test` (full
suite); `just check`.

**Commit**: "Add settlement.property.test.ts: dora-gate monotonicity property
(T-008-01-04)".

## Step 8 — barrel/export sanity + final full-suite pass

No production code change expected (index.ts already barrels `settlement.ts`'s exports).
Confirm `baseOf`/`roundUp100`/`ronDeltas`/`tsumoDeltas` are importable from `./index`
exactly like every other scoring primitive (a one-line assertion already implicit in
Steps 2-3's imports — this step is just the final full-repo check, not new test content).

**Verify**: `just check` (svelte-check + tsc, full repo) and `just test` (full suite,
expect 659 + new test count, all green). If either fails, fix before proceeding — no
step here is allowed to land red.

**Commit**: none (verification-only step; if any fixups are needed they get their own
small commit at this point, named for whatever was actually wrong).

## Testing strategy summary

| Layer | Technique | Why |
|---|---|---|
| han×fu base-points (§A) | table-driven, exhaustive | small closed domain, exact values, per-cell failure naming (design.md Decision 2) |
| roundUp100 boundaries (§B) | table-driven | same |
| payment split (§C) | table-driven | same, smaller domain (design.md Decision 3) |
| zero-sum conservation (§D) | fast-check over seeds | domain (all reachable game states) too large to enumerate; reuses the engine's own legal-play generator (design.md Decision 4) |
| fu invariants (§E) | fast-check over constructed winning hands | domain (all winning hand shapes) too large to enumerate; deterministic-by-construction generator, no rejection loop (design.md Decision 5) |
| dora-gate monotonicity (§F) | fast-check over constructed winning hands | same shape as §E (design.md Decision 6) |

No integration test beyond what §D already is (§D IS the integration test — real
folded game states end to end through `settlementOf`). `just check` gates types; `just
test` gates behavior. Every property/table block is independently runnable and
independently useful — a regression in any one clause fails exactly that block, never
the whole file opaquely.
