# T-008-03-01 — score-breakdown-screen — Progress

Tracks execution against plan.md. All 8 steps completed, in order, no deviations from
the plan's shape (one small scope note in Step 7, below).

## Step 1 — refactor `pricedReadingsOf`/`bestBaseOf` — DONE

`pricedReadingsOf` → `pricedReadingCandidatesOf` (returns `PricedReading[]`, not
`number[]`); added `bestReadingOf`; `bestBaseOf` is now a one-line wrapper. Verified:
`settlement.test.ts` + `settlement.property.test.ts` green with zero test-file changes
(122 tests), proving `settlementOf`'s observable behavior is byte-for-byte unchanged.

## Step 2 — new types/constants — DONE

`LimitName`, `YakuLine`, `ScoreBreakdown` exported; `STARTING_SCORE_DISPLAY` added.
Verified: `just check` (svelte-check + tsc) clean, 189 files, 0 errors.

## Step 3 — `scoreBreakdownOf` implementation — DONE

Implemented per structure.md, calling Step 1's `bestReadingOf` plus the existing
`tenpaiFlagsOf`/`notenBappuOf`/`ronDeltas`/`tsumoDeltas`/`limitNameOf`.

## Step 4 — `scoreBreakdownOf` test suite — DONE

Added to `settlement.test.ts`, reusing every existing fixture (PINFU_HAND_13,
MANGAN_CAP_HAND_13, TSUUIISOU_HAND_13, the Fixture-6 reading-selection hand,
TENPAI_HAND/NOTEN_HAND) — no new hand construction. 8 new `it`s covering: non-limit
ron detail (yaku+han per name, dora, fu, points, scores), dealer-rate ron, the mangan
cap (`limitName: 'mangan'`, `fu: null`), yakuman (both dealer-ness), the reading-
selection regression (honitsu+ryanpeikou, not chiitoitsu, not the union), all five
ryuukyoku tenpai-count splits, and the playing-phase guard. All pass; `just test` on
`settlement.test.ts` alone: 24/24.

**Note on the yaku-order assertions**: plan.md flagged uncertainty about
`readingYakuOf`'s exact output order and suggested "run once and read the real order"
if needed. Ran once: the order matched the natural expectation (`pinfu, tanyao,
iipeikou` for the closed-ron fixture; `honitsu, ryanpeikou` for Fixture 6) on the first
try, so no `expect.arrayContaining` fallback was needed — the tests assert exact
arrays (sorted alphabetically for the two-plus-yaku cases, to keep the assertion
robust against a future evaluation-order change in `standardYakuOf` that doesn't
change WHICH yaku fire).

## Step 5 — `HandEnd.svelte` — DONE

New stateless component, `{ table: TableState }` prop, calls `scoreBreakdownOf`
internally, renders nothing while `phase === 'playing'`. `just check` clean.

## Step 6 — wire into `Table.svelte` — DONE

Removed the inline `{#if phase === 'ryuukyoku'}`/`{#if phase === 'agari' && win !==
null}` blocks and their CSS (`.ended`, `.win-summary`, `.yaku`, the `reveal-rise`
keyframes/animation rule — all moved into `HandEnd.svelte`'s own scoped styles).
Added `<HandEnd {table} />` in `.center`. `just check` clean.

**Manual browser verification**: not performed as an interactive click-through — this
sandboxed session has no headless-browser/Playwright tooling available (checked:
`package.json` has no `playwright`/`puppeteer` dependency, and none is installed
globally). `just dev` was started and confirmed serving (`200` on `/?seed=542630`),
but the win screen only appears after the client-side bot-driving `$effect` plays out
the seeded hand, which needs real DOM interaction to observe. Substituted: the SSR
test suite (Step 7) renders `HandEnd` through the REAL Svelte compiler
(`svelte/server`'s `render`, the same mechanism `just dev`'s production build uses)
against real folded win/ryuukyoku states reached via mined action sequences — this is
the project's own established substitute for browser verification in this file
(`app.ssr.test.ts`'s header: "the view renders through the real Svelte compiler").
Flagged in review.md as an open concern for a human to click through once.

## Step 7 — `app.ssr.test.ts` updates — DONE

- `'hand-end view (SSR)'`: yaku-list assertion now sources names+han from
  `scoreBreakdownOf(won).yaku`, not `won.win!.yaku`. Added: a dora-line test (this
  fixture's `doraHan` is 1, not 0 as plan.md's placeholder text guessed before running
  it — the test asserts the real value, 1, and that the line renders), a points-line
  test (fu/han/points all present in the `aria-label="points line"` text), and a
  four-seat-scores test (each score present in the `aria-label="scores"` list, sum
  conserved at 100000).
- `'wall-exhausted table view (SSR)'`: added tenpai/noten line assertions per seat and
  a bappu-scores conservation check (sum = 100000) — per plan.md's preference for the
  sum-invariant over duplicating shanten logic in the test.
- Added a new `describe('no hand-end region while playing (SSR)', ...)` confirming
  `HandEnd` renders no yaku/points/scores region on the freshly dealt boot.
- **Deviation from plan.md's Step 7 wording**: plan.md suggested adding the
  playing-phase assertion inline in the existing mid-hand describe block; it landed
  instead as its own small describe block for clarity (one assertion, one clear
  home) — no behavioral difference, purely a file-organization choice made while
  writing the test.

Result: `app.ssr.test.ts` 36/36 passing (was 31 before this ticket; 5 net new `it`s,
one `it` rewritten to source from the new breakdown instead of the old union).

## Step 8 — full verification — DONE

`just check` (189 files, 0 errors) → `just test` (31 files, 798 tests, all passing) →
`just build` (single-file build, `verify-single-file: OK`, 91089 bytes). All green, in
that order, on the final diff.

## Deviations from plan.md overall

None beyond the two noted above (Step 6's substituted verification method, Step 7's
describe-block placement) — both are process notes, not scope or behavior changes.
Every file touched matches structure.md's table exactly; no additional files were
created or modified.
