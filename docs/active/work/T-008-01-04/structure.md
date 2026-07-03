# T-008-01-04 — scoring-property-grid — Structure

File-level changes, module boundaries, ordering. Blueprint, not code.

## Files modified

### `src/core/settlement.ts`

- Add `export` to `baseOf`, `roundUp100`, `ronDeltas`, `tsumoDeltas` (four one-word
  diffs, in place, no signature or logic change).
- Extend the module header comment with one sentence noting these four are now the
  tested public seam for the grid suite (matches the existing header's own style of
  naming which later ticket consumes what).
- No other change. `bestBaseOf`, `pricedReadingsOf`, `readingYakuOf`, `hanOfNames`,
  `winOf`, `windKindOf`, `tenpaiFlagsOf`, `notenBappuOf`, `settlementOf` stay exactly as
  they are, including staying private where they already are.

### `src/core/index.ts`

- No change. It already barrels `export * from './settlement'`, so the four newly
  exported names become available via `./index` automatically — the han.ts/fu.ts
  precedent for how every scoring module's public names reach test files.

## Files created

### `src/core/settlement.property.test.ts`

New file, sibling to `settlement.test.ts` (matching `shanten.test.ts` /
`shanten.property.test.ts`'s existing split: fixture suite in one file, property/grid
suite in another, both testing the same module). Sectioned as follows, top to bottom:

1. **Header comment** — states the file's scope (grid + property crown, AC-referenced),
   names the exported seam it uses (`baseOf`/`roundUp100`/`ronDeltas`/`tsumoDeltas`) and
   the "independently-stated expected table, never derived from a first run" convention,
   matching every sibling scoring test file's header style.

2. **Shared local helpers** (duplicated per file, the established convention):
   - `h()` mpsz sugar (byte-identical copy from settlement.test.ts / shanten.property.
     test.ts).
   - A trimmed `buildWinner`/`buildMelds`/`buildTenpaiParts` toolkit, copied and pared
     down from `shanten.property.test.ts` (only the parts needed to build a complete
     winning hand with real melds — no shanten-specific pieces like `minusOneArb`/
     `perturbedArb`/`randomHand13Arb` since this file never needs a NON-winning hand).
   - A leaner ended-`TableState` walker (Decision 4): `endedStateOf(seed): TableState`,
     structurally the same per-step loop as `selfplay.test.ts`'s `selfPlay` (fold, read
     `legalActions`, arbitrate claim windows via `callPolicy` in offered order, else
     `discardPolicy` at the turn seat, re-fold), but returning only the terminal
     `TableState` — no claims tally, no record, no double-play check. A `throw` past a
     generous action bound (reuse `selfplay.test.ts`'s `ACTION_BOUND` formula, duplicated
     locally per convention) guards non-termination the same way.

3. **§A — the han×fu base-points grid** (Decision 2): one `describe('baseOf — the han×fu
   base-points grid')` block. A hand-authored `const EXPECTED_BASE` table (nested
   structure or flat list of `{han, fu, base}` triples) transcribed from research.md §3 /
   -03's research.md §3 — every tier: han 1-4 at fu steps 20/30/40/50/60/70/80/90/100/110
   (the formula `fu * 2^(2+han)`, capped at 2000 — including at least one cell per han
   value that DOES exceed 2000 raw, to exercise the cap, and at least one that does not),
   han 5 flat 2000 (fu irrelevant — assert at two different fu values to prove fu is
   ignored), han 6-7 flat 3000, han 8-10 flat 4000, han 11-12 flat 6000, han 13/14/26 the
   yakuman stacking tier (8000 × ⌊han/13⌋, so han=13 → 8000, han=14 → 8000 still — floor
   — han=26 → 16000, the double-yakuman-stacking case). One `it()` per row, iterating the
   table (the `hanOf` STANDARD_YAKU_NAMES table-test precedent), asserting
   `baseOf(han, fu) === base`.

4. **§B — `roundUp100`** its own tiny `describe`: a handful of boundary values (already-
   round numbers, just-over, just-under a hundred boundary — e.g. 100→100, 101→200,
   199→200, 7680→7700, 11520→11600 reusing the AC's own fixture numbers as a cross-check
   against settlement.test.ts) confirming the ceiling-to-100 behavior directly.

5. **§C — dealer-ness × ron/tsumo payment split** (Decision 3): one `describe('ronDeltas /
   tsumoDeltas — the payment split grid')`. A hand-authored table over a representative
   base-point sample (400, 1000, 1920, 2000, 3000, 4000, 6000, 8000 — chosen to hit every
   rounding shape: exact hundreds, non-hundreds needing roundUp100, and one value at each
   named tier) × winner-is-dealer ∈ {true, false} × mode ∈ {ron, tsumo}. For ron: compute
   `winner`/`discarder` as arbitrary distinct seats (e.g. winner 0 or 1, discarder the
   other) and assert the full 4-tuple. For tsumo: assert the full 4-tuple across all four
   seats (dealer-pays vs non-dealer-pays, depending on whether winner is seat 0).

6. **§D — zero-sum conservation over random ended hands** (Decision 4): one
   `describe('settlementOf — zero-sum conservation')` wrapping a single
   `fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}), seed => { const state =
   endedStateOf(seed); const deltas = settlementOf(state); expect(deltas.reduce((a,b)=>a+b,
   0)).toBe(0) }), {numRuns: ~50, timeout: 60_000})`. No additional assertions in this
   block — the property is exactly the AC's own wording, nothing more.

7. **§E — fu invariants** (Decision 5): three `it()`s (or one `describe` with three
   `fc.assert` calls) driven by a shared `winContextArb` (built from the trimmed
   builder toolkit, over `decomposeAgari`'s real output, both tsumo and ron sources,
   meld counts 0-4, seatWind/roundWind fixed or varied — variation is not load-bearing
   for fu, so fixed values keep the arbitrary simpler):
   - fu is a multiple of 10 or exactly 25 (all forms).
   - `standardYakuOf(ctx).includes('pinfu')` ⟹ `fuOf(ctx)` is 20 (tsumo) / 30 (ron).
   - `decomposition.form === 'chiitoitsu'` ⟹ `fuOf(ctx) === 25`.

8. **§F — the dora-gate monotonicity property** (Decision 6): one `describe('dora is
   additive, never a gate')`. Builds a winning hand (Decision 5's toolkit), wraps it in
   two `TableState`s differing only in `doras` (`[]` vs one extra dora kind drawn from
   the hand's own held tiles, via the `ronState`/`tsumoState`-style builder duplicated
   locally from settlement.test.ts), and asserts the winning seat's `settlementOf` delta
   at the richer-dora state is `>=` the delta at the dora-less state.

## Ordering

1. `settlement.ts` — the four exports (five-minute change, unblocks everything else).
2. `settlement.property.test.ts` §A/§B — the pure-formula grid (no generator
   infrastructure needed, fastest to get green, proves the export works).
3. §C — payment split (same style, still no generator infrastructure).
4. Local helpers (`h()`, trimmed builder toolkit, `endedStateOf`) — needed by §D-F.
5. §D — zero-sum (uses only `endedStateOf`, not the winner-builder toolkit).
6. §E — fu invariants (uses the winner-builder toolkit).
7. §F — dora-gate monotonicity (uses the winner-builder toolkit plus a small
   TableState-builder duplicated from settlement.test.ts).
8. `just check` + `just test` full run.

## No other files touched

`fu.ts`, `han.ts`, `yaku.ts`, `yakuman.ts`, `agari.ts`, `record.ts`, `shanten.ts`,
`selfplay.test.ts`, `shanten.property.test.ts`, `settlement.test.ts` — all read-only
references for this ticket, none modified. `docs/active/tickets/T-008-01-04.md`'s
frontmatter is not touched (Lisa's job, per the workflow rules).
