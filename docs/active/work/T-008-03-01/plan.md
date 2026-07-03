# T-008-03-01 — score-breakdown-screen — Plan

Ordered, independently verifiable steps. Each is small enough to commit atomically.

## Step 1 — `settlement.ts`: refactor `pricedReadingsOf`/`bestBaseOf` to retain reading detail

Change `pricedReadingsOf` → `pricedReadingCandidatesOf` (returns `PricedReading[]` instead
of `number[]`); add `bestReadingOf`; make `bestBaseOf` a one-line wrapper over it. No new
exports yet — this step is pure internal refactor.

**Verify**: `just test` (or `flox activate -- vitest run src/core/settlement.test.ts
src/core/settlement.property.test.ts`) stays green with zero test-file changes — proves
`settlementOf`'s observable behavior is bit-for-bit unchanged. This is the safety net for
every later step: if this step alone doesn't pass, nothing downstream is trustworthy.

## Step 2 — `settlement.ts`: add `limitNameOf`, `STARTING_SCORE_DISPLAY`, exported types

Add `LimitName`, `YakuLine`, `ScoreBreakdown` type exports and the `limitNameOf`/
`STARTING_SCORE_DISPLAY` private helpers (structure.md §"settlement.ts" steps 1, 2, 6).
No behavior yet — types and constants only, so this compiles standalone.

**Verify**: `just check` (svelte-check + tsc) passes — proves the new types are
well-formed and don't collide with existing exports (barrel re-export from
`src/core/index.ts` is automatic via `export * from './settlement'`, already present).

## Step 3 — `settlement.ts`: add `scoreBreakdownOf`

Implement the function per structure.md's step 7, calling the Step 1 helpers.

**Verify**: nothing yet (no test written) — this step is implementation only, verified in
Step 4.

## Step 4 — `settlement.test.ts`: `scoreBreakdownOf` test suite

New `describe('scoreBreakdownOf', ...)` block, reusing every existing fixture builder
(`ronState`/`tsumoState`/`ryuukyokuState`, `PINFU_HAND_13`/`MANGAN_CAP_HAND_13`/
`TSUUIISOU_HAND_13`/`TENPAI_HAND`/`NOTEN_HAND`, the Fixture-6 reading-selection hand) —
no new hand construction needed, since every han/fu/limit case the breakdown must expose
correctly is already pinned by `settlementOf`'s own fixtures. Cases:

1. **Fixture 1 (30fu/4han non-dealer ron)**: `scoreBreakdownOf(state)` returns
   `yaku` containing exactly `{pinfu:1, tanyao:1, iipeikou:1}` (order per
   `standardYakuOf`'s own determinism, asserted as a set via `toEqual(expect.arrayContaining(...))`
   plus a length check, OR pinned to the exact order this run produces — decide by
   running once and reading the real order, since `readingYakuOf`'s order is
   deterministic but not documented here), `doraHan: 1`, `han: 4`, `fu: 30`,
   `limitName: null`, `points: 7700`, `deltas: [-7700, 7700, 0, 0]` (matches
   settlementOf's own existing assertion), `scores: [17300, 32700, 25000, 25000]`.
2. **Same fixture, dealer ron**: `points: 11600`, `scores: [36600, 13400, 25000, 25000]`.
3. **Mangan cap (Fixture 3)**: `limitName: 'mangan'`, `fu: null`, `han: 4` (still
   reported — the total han is meaningful even though fu is suppressed), `points: 8000`.
4. **Yakuman (Fixture 4, tsuuiisou ron)**: `limitName: 'yakuman'`, `fu: null`,
   `doraHan: 0`, `yaku: [{name: 'tsuuiisou', han: 13}]`, `points: 32000` (non-dealer) /
   `48000` (dealer).
5. **Reading selection (Fixture 6)**: `yaku` reflects the honitsu+ryanpeikou reading
   (`[{name:'honitsu',han:3},{name:'ryanpeikou',han:3}]`), NOT chiitoitsu and NOT the
   3-name union — `han: 6`, `limitName: 'haneman'`, `fu: null`, `points: 12000`. This is
   THE regression fixture proving the breakdown didn't reintroduce the union bug.
6. **Ryuukyoku, each tenpai count (Fixture 7's five cases)**: `tenpai` matches the
   fixture's seat pattern, `deltas` matches settlementOf's existing five assertions,
   `scores` is `25000 + delta` per seat (e.g. 1-tenpai: `[28000, 24000, 24000, 24000]`).
7. **Guard**: `scoreBreakdownOf(baseState())` (phase `'playing'`) throws `RangeError`.

**Verify**: `just test` green, including this new describe block.

## Step 5 — `src/app/HandEnd.svelte`: new component

Write the component per structure.md's markup/script blueprint, importing
`scoreBreakdownOf` from `'../core'`.

**Verify**: `just check` passes (Svelte + TS compile clean). No behavioral test yet — this
step is markup-only; SSR assertions come in Step 7.

## Step 6 — `src/app/Table.svelte`: wire in `HandEnd`, remove inline win-summary markup

Per structure.md's "Table.svelte — structural change." Move the CSS rules for
`.win-summary`/`.yaku`/`.winning-tile`/`reveal-rise` into `HandEnd.svelte`; leave
`Table.svelte`'s remaining CSS (`.ended` still used for other status lines? — check:
`.ended` class is used only by the moved blocks per the current file read, so it can move
in full) untouched otherwise.

**Verify**: `just dev`, load the app, play (or seed-pin via `?seed=`) a hand to a tsumo/ron
ending and to a wall-out ryuukyoku, visually confirm the breakdown renders where the old
one-line summary used to (manual, per the "UI changes: test in a browser" project
convention) before moving to the automated SSR pass in Step 7.

## Step 7 — `app.ssr.test.ts`: update hand-end/ryuukyoku describe blocks

- `'hand-end view (SSR)'`: keep the win-sentence and winning-tile assertions (now
  rendered by `HandEnd`, same `aria-label`s); change the yaku-list assertion to source
  names from `scoreBreakdownOf(won).yaku.map(y => y.name)` instead of `won.win!.yaku`,
  and add new assertions for the `aria-label="dora"` line (present/absent per
  `doraHan`), the `aria-label="points line"` text, and the `aria-label="scores"` list
  (four entries, each `25000 + delta`).
- `'wall-exhausted table view (SSR)'`: add tenpai/noten and bappu-score assertions using
  `scoreBreakdownOf(exhausted)` (the existing fixture is an all-tsumogiri game, so
  compute the expected tenpai pattern from `NOTEN_HAND`/`TENPAI_HAND`-style reasoning —
  actually reuse the real folded state's own shanten via a fresh call, asserting
  self-consistency: `scoreBreakdownOf(exhausted).tenpai[seat]` equals whatever
  `shanten(...) === 0` says for that seat, computed inline in the test the same way
  settlement.ts computes it — OR, simpler, just assert the sum of `scores` is `4 ×
  25000` and each `score - 25000` matches one of the five noten-bappu split values,
  which needs no per-seat shanten recomputation in the test at all). Prefer the simpler
  sum-invariant assertion — it doesn't require the test to duplicate shanten logic.
- Add a new `it` confirming `HandEnd` renders nothing (`role="status"` region absent)
  when `table.phase === 'playing'` (the existing dealt-table/mid-hand describe blocks
  already implicitly cover this; make it explicit with one assertion in the mid-hand
  block: `expect(body).not.toContain('aria-label="scores"')`).

**Verify**: `just test` green (this is a vitest suite, run via the same command as core
tests) and `just check` green.

## Step 8 — full-suite verification and commit

Run `just check && just test && just build` once, end to end, confirming the singlefile
build still produces `dist/index.html` (the build step catches any accidental
non-inlineable import or circular-dependency mistake the earlier steps might have missed).
Commit.

## Testing strategy summary

- **Unit-level (settlement.test.ts)**: exhaustive reuse of existing fixtures — the new
  `scoreBreakdownOf` suite is additive, asserting MORE detail about states
  `settlementOf` already has regression coverage for. No new hand construction.
- **Integration (app.ssr.test.ts)**: SSR-render real folded records through the real
  Svelte compiler, asserting the new `aria-label` regions and their content — the
  existing pattern for every prior UI ticket in this codebase.
- **Manual (Step 6)**: one visual pass in the dev server per the project's "test the UI
  in a browser" convention, since `just test`/`just check` verify correctness, not visual
  layout.
- Nothing here needs a new property test: `scoreBreakdownOf` is a thin read layer over
  already-property-tested arithmetic (T-008-01-04's grid/zero-sum/fu-invariant suite) —
  duplicating those properties at this layer would test the same formulas a third time
  for no new confidence.
