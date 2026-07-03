# Progress — T-011-02-03: window-legibility-regression-suite

## Step 0: land T-011-02-01's pending implementation — done
- Verified `just check` green on the inherited working tree.
- Committed T-011-02-01's code (`41a0c15`) and its RDSPI artifacts (`e04bfe1`) as
  two catch-up commits, crediting the ticket correctly (plan.md Step 0). Ticket
  frontmatter files (all four `phase` bumps) stayed unstaged, per this repo's own
  convention (never committed by an implementing agent).

## Step 1: `drive.test.ts` — done
Added two `windowOutcome` unit cases: `ron` beating the player's `pon` (matches the
mined fixture below verbatim) and `ron` beating the player's own `ron` (atamahane,
synthetic — design.md Decision 5). `npx vitest run src/app/drive.test.ts`: 77/77
green (75 existing + 2 new).

## Step 2: `app.terminology.coverage.ssr.test.ts` — done
Added two rows to the existing `describe('outcome notice', ...)` block, both
terminologies, following the file's own hand-built-`WindowOutcome` convention
exactly. `npx vitest run src/app/app.terminology.coverage.ssr.test.ts`: 32/32 green
(28 existing + 4 new: 2 cases × 2 terminologies).

## Step 3: mine-verify the interactive fixture — done
Scratchpad scan (core seeds 1..50000, the exact `forcedAction`/`discardPolicy`/
`riichiPrompt`/`settleWindow` functions the real driver uses) found core seed 85
(game seed `2654435812`): at 78 actions, the player's only offer is a pon on tile 82
(3s) while South (seat 1) holds a ron on the same tile — `settleWindow` picks the
ron (rons outrank pons). Verified against the REAL mounted App in a throwaway test
file (`_scratch.pon-ron.tap.svelte.test.ts`, deleted after confirming): DOM aria-
label `"pon 3s with 3s 3s"`, notice reads South/ron/pon, hand-end screen renders
alongside the still-live notice, and clicking "next hand" clears it. Nothing from
the scratch file shipped.

## Step 4: `window-outcome-notice.tap.svelte.test.ts` — done
- Added `TERMINOLOGIES`, wrapped all three scenarios (the existing pass-case and
  win-case, plus the new pon/ron fixture) in a `for (const terminology of
  TERMINOLOGIES)` loop, each its own `describe(`${terminology} terminology`, ...)`.
- **Deviation from plan.md**: the shared `step()` driver's riichi-decline lookup
  originally used the hardcoded selector `[aria-label="not yet"]` — this breaks
  under `zh-hant` because `RiichiPrompt`'s decline button's aria-label is itself
  `term('notYet')`, not a static string (plan.md didn't anticipate this since the
  file's existing coverage never ran under a second terminology before). Fixed by
  switching the selector to the stable class `.riichi .pass`. Not a scope change —
  a bug in the test harness itself, caught immediately by the first zh-hant run and
  fixed in the same file.
- `npx vitest run src/app/window-outcome-notice.tap.svelte.test.ts`: 6/6 green (3
  scenarios × 2 terminologies).

## Step 5: `claim-window-race.tap.svelte.test.ts` — done
Wrapped the file's single `it` in the same terminology loop; notice/aria-label
assertions now read `windTerm(2)`/`callTerm('pon')`/`callTerm('chi')` instead of
hardcoded English (`'West'`/`'pon'`/`'chi'`); the DOM-structural remount assertions
(`isConnected`, `className`, `!==`) are unchanged. No riichi prompt is reached by
this fixture's own five-round tsumogiri walk, so the `.riichi .pass` fix from Step 4
wasn't needed here. `npx vitest run src/app/claim-window-race.tap.svelte.test.ts`:
2/2 green (1 scenario × 2 terminologies).

## Step 6: full-suite gate — done
- `just test`: 40 files, 959 tests, green (948 baseline + 11 new: 2 in drive.test.ts,
  4 in the SSR file, 3 net-new in window-outcome-notice [6 total − 3 that existed
  before doubling], 1 net-new in claim-window-race [2 total − 1 existing]). Reran
  `game.dynamics.test.ts` in isolation once more — passed (the pre-existing
  full-seed-domain flake from research.md did not fire this run; not fixed, out of
  scope, flagged in review.md).
- `just check`: 202 files, 0 errors/warnings.
- `just build`: `dist/index.html` 106.25 kB / gzip 34.77 kB — `verify-single-file`
  OK. No production code changed in this ticket, so size is expected unchanged from
  the T-011-02-01 baseline modulo normal churn; confirmed still well under gate.
- `grep -rn "DEFECT" src/`: one hit, the historical narrative comment in
  `claim-window-race.tap.svelte.test.ts`'s own file header (documents what the
  ORIGINAL characterization ticket did — not a live marker on any assertion). No
  real markers remain anywhere.

## Deviations from plan.md, summarized
1. The `.riichi .pass` selector fix (Step 4) — a test-harness bug plan.md's own
   Step 3 verification pass should have caught but didn't test riichi specifically;
   caught and fixed within the same step, no scope change.
2. No other deviations. The atamahane (ron-vs-ron) interactive fixture was
   deliberately never attempted (design.md Decision 5, not a deviation — the plan
   never scheduled it).
