# T-007-02-01 — portrait-table-frame — Progress

## Completed

- **Step 1 — style-block reflow of `src/app/Table.svelte`**: done exactly per
  structure.md. `git diff` confirmed zero template changes — `.table` re-templated to
  the three portrait bands (`west/west/west`, `north/center/south`, `east/east/east`),
  columns `1fr 7.5rem 1fr`, rows `auto 1fr auto`, `width: 100%`, `max-width: 26rem`,
  `min-height: min(60dvh, 30rem)`, border-box + padding + row-gap; `aspect-ratio: 1`
  and the `70dvh` width removed; `.seat`/`.center` got `min-width: 0`; `.center`
  swapped `margin: 12%` for a small padding and `align-self: center`; `.pond`
  `max-width` 9.5rem → 100%.
- **Step 2 — regression gates**: `just test` → 24 files, 564 tests, all green, no test
  edits. `just check` → svelte-check 177 files, 0 errors, 0 warnings; tsc clean.
- **Step 3 — build + empirical 360×780 verification**: `just build` → self-contained
  `dist/index.html` (81.1 kB). System Chrome headless was available. Verification ran
  via a scratchpad harness that iframes the built file at exactly 360×780 (direct
  `--window-size=360` is clamped wider by headless Chrome on macOS — the iframe is the
  trustworthy viewport) and measures real geometry:
  - **Boot**: `documentElement.scrollWidth = 360` (no horizontal overflow), table
    328px wide at x=16, height 468 (the min-height presence), dora + wall count
    centered.
  - **Deep mid-hand** (the harness auto-plays the human seat tsumogiri and passes
    prompts while the app's own 250ms bot drive acts; state reached: 42 discards
    across ponds of 11/11/10/10, one South meld, wall at 29):
    `scrollWidth = 360`, `scrollHeight = 780` — no scrolling in either axis — and
    every pond rect, the melds rect, the dora rect, and the wall-count text measured
    fully inside the 360×780 frame simultaneously. Screenshot captured
    (scratchpad `midhand-real.png`) showing all bands legible at once.
- **Step 4 — commit**: `97502b3` "T-007-02-01: portrait table frame — felt grid
  reflowed into phone bands", staged as `src/app/Table.svelte` only (sibling Lisa
  threads' uncommitted work in `Tile.svelte` / `src/core/` untouched).

## Deviations from plan

- **Virtual-time screenshots don't work for this app** (plan Step 3 as written): the
  drive waits on the *player* — seat 0 is human, so no amount of virtual time fills
  ponds, and `--virtual-time-budget` also fails to advance the bot chain. Replaced
  with: a hanging-subresource trick to keep headless Chrome alive in real time +
  `--timeout`, and an auto-player in the harness (click drawn tile / pass prompts).
  Same evidence, stronger state (real 42-discard hand). No repo impact — all harness
  files live in the session scratchpad.
- The probe's own `allWithin360` convenience boolean had a bug (nulls in the array);
  the per-rect numbers were used directly instead. No bearing on the code under test.

## Remaining

- Review phase (review.md) and the artifacts commit — next.
