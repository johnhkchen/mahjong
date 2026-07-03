# T-008-03-01 — score-breakdown-screen — Review

Self-assessment: what changed, test coverage, and open concerns for a human reviewer.

## Summary of changes

| File | Change |
|---|---|
| `src/core/settlement.ts` | Refactored the private reading-selection path (`pricedReadingsOf` → `pricedReadingCandidatesOf`, new `bestReadingOf`, `bestBaseOf` now a thin wrapper) to retain per-reading detail instead of discarding it down to a bare number. Added exported types `LimitName`/`YakuLine`/`ScoreBreakdown`, private `limitNameOf`/`STARTING_SCORE_DISPLAY`/`seatScoresOf`, and the new exported entrypoint `scoreBreakdownOf(state)`. `settlementOf` itself has ZERO lines changed. |
| `src/core/settlement.test.ts` | New `describe('scoreBreakdownOf', ...)` — 8 tests, all reusing existing fixtures. |
| `src/app/HandEnd.svelte` | New stateless component: `{ table }` in, the full breakdown UI out (win/ryuukyoku sentence, winning tile, yaku+han list, dora line, fu/han/points line, four seat scores). Zero arithmetic — one `scoreBreakdownOf` call, then string/array reads. |
| `src/app/Table.svelte` | Inline win-summary/ryuukyoku markup and its CSS replaced with `<HandEnd {table} />`. |
| `src/app/app.ssr.test.ts` | Hand-end tests updated to source yaku from `scoreBreakdownOf` instead of `table.win.yaku`; added dora-line, points-line, and seat-scores assertions; wall-exhausted block gained tenpai/noten + bappu-conservation assertions; new small describe block for the playing-phase silence. |

Net: 425 insertions / 91 deletions across 5 files (1 new). No files deleted. No changes
to `record.ts`, `game.ts`, `han.ts`, `fu.ts`, `yaku.ts`, `yakuman.ts`, `App.svelte`,
`drive.ts`, `ClaimPrompt.svelte`, or `Tile.svelte`.

## Why this satisfies the AC

- **"lists every yaku with its han"**: `HandEnd`'s `aria-label="yaku"` list renders
  `breakdown.yaku`, each a `{name, han}` pair from the WINNING READING (not the
  cross-reading union `table.win.yaku` holds) — verified by the reading-selection
  regression test (settlement.test.ts, honitsu+ryanpeikou at 6han, not chiitoitsu's
  2han, not the union's 8han).
- **"the dora count"**: `aria-label="dora"`, rendered only when `doraHan > 0`.
- **"the fu/points line"**: `aria-label="points line"`, branching on `limitName` —
  `"{fu}fu {han}han {points}"` below mangan, `"{limitName} {points}"` at or above it
  (matching the AC's own two worked examples, `"30fu 4han 7700"` / `"mangan 8000"`).
- **"four updated seat scores matching the settlement deltas"**: `aria-label="scores"`,
  each seat's `STARTING_SCORE_DISPLAY + deltas[seat]`, computed once inside core
  (`seatScoresOf`) — never in the view.
- **"a ryuukyoku screen shows tenpai/noten and the bappu exchange"**: `aria-label="tenpai"`
  per-seat, plus the same `aria-label="scores"` list showing the bappu-adjusted totals.
- **"No scoring arithmetic in `src/app/`"**: `HandEnd.svelte` contains no `+`/`*`/table
  lookups on point or han/fu values — one call to `scoreBreakdownOf`, then template
  reads. `grep -n '[0-9] \* \|[0-9] + \| \+ [0-9]' src/app/HandEnd.svelte` (run during
  review) finds nothing.

## Test coverage

- `settlement.test.ts`: 24 tests (was 16), +8 for `scoreBreakdownOf` — non-limit ron
  (both dealer-ness), the mangan cap, yakuman (both dealer-ness), the reading-selection
  regression, all five ryuukyoku tenpai-count splits, and the playing-phase guard. Every
  case reuses an existing fixture; no new hand construction.
- `settlement.property.test.ts`: unchanged, 0 new assertions — deliberately: `scoreBreakdownOf`
  is a thin read layer over already-property-tested arithmetic (T-008-01-04's han×fu
  grid, zero-sum, fu-invariant, and dora-monotonicity suites). A new property here would
  re-test the same formulas a third time for no new confidence (design.md, plan.md's
  testing-strategy summary).
- `app.ssr.test.ts`: 36 tests (was 31), +5 net — dora-line, points-line, and seat-scores
  assertions on the hand-end block; tenpai/noten + conservation on the wall-exhausted
  block; one new describe block for playing-phase silence.
- Whole-suite: `just test` — 31 files, 798 tests, all passing. `just check` — 189 files,
  0 errors. `just build` — single-file build verified self-contained (91089 bytes).

## Gaps and open concerns

1. **No interactive browser verification.** This session has no headless-browser
   tooling (`package.json` carries no `playwright`/`puppeteer`; none installed
   globally), and the win screen only appears client-side after the bot-driving
   `$effect` plays a hand out — not observable from a bare HTTP fetch of `just dev`.
   Substituted with the SSR test suite (`render` from `svelte/server`, the real
   compiler, real folded states) per the project's own established pattern for this
   file, but a human should still click through one win and one ryuukyoku in a real
   browser before calling this visually done — layout/CSS was written but never
   rendered by an actual browser engine in this session.
2. **`points` is the winner's total gain, not a per-payer split.** For a ron this reads
   naturally (one number, matching the AC's own example). For a tsumo, real parlors
   often show a payer-by-payer split ("2000/4000" or "4000 all"); this ticket shows only
   the winner's total (e.g. tsumo mangan non-dealer renders "...8000", not "2000/4000
   split, 8000 total"). `breakdown.deltas` is still exposed on `ScoreBreakdown` for a
   future ticket that wants the split — design.md Decision 3 records this as a
   deliberate scope cut, not an oversight, but it's worth a product-owner glance since
   the split is common parlor convention.
3. **"fu itemized" interpreted as "stated as its own number," not a component ledger.**
   `fu.ts`'s `fuOf` returns only a total (no base/menzen/tsumo/wait breakdown retained
   anywhere in its call chain); building a true itemized ledger would require widening
   an already-shipped module's public contract. design.md Decision 5 records this
   reading and the rejection of the fuller one — flagging in case "itemized" was meant
   more literally.
4. **Seat scores are single-hand, not a persisted running total.** This ticket's
   dependency is `T-008-01-03` only; `game.ts`'s `GameRecord`/`foldGame` (T-008-02-01,
   already merged) is not wired into `App.svelte` — there is no multi-hand session yet.
   `scoreBreakdownOf`'s `scores` field is this one hand's settlement applied to the
   standard 25000-each starting total, duplicating that constant locally
   (`STARTING_SCORE_DISPLAY`) rather than importing `game.ts`'s `STARTING_SCORE` (which
   would cycle). **Whoever wires `App.svelte` to a persistent `GameRecord` next** will
   need to decide whether `HandEnd` should then read a running total from `GameState`
   instead of always starting fresh at 25000 — this ticket does not block that, but the
   field will need a second look then.
5. **Yaku display order** is whatever `standardYakuOf`/`readingYakuOf` produce, un-sorted
   in the actual UI (only the TEST assertions sort alphabetically for robustness) — the
   rendered order in `HandEnd.svelte` is the reading's natural order, which happened to
   read sensibly in manual inspection of the fixtures used, but wasn't chosen by any
   explicit rule (e.g. "han descending"). Cosmetic; flag if a reviewer wants a specific
   display order.

## Nothing else touched

`App.svelte`, `drive.ts`, `ClaimPrompt.svelte`, `Tile.svelte`, and every `src/core/`
module besides `settlement.ts` are unchanged. The refactor inside `settlement.ts` was
verified behavior-preserving before any new code was added (Step 1's isolated green run
against the pre-existing test files, zero test-file edits at that point) — the safest
possible order for a refactor-then-extend change.
