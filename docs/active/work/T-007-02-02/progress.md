# T-007-02-02 — thumb-zone-hand-and-touch-targets — Progress

## Completed

- **Step 1 — Tile scale seam**: `Tile.svelte` `.tile` font-size →
  `var(--tile-scale, 0.8rem)`. Default preserves every existing chip size.
- **Step 2 — Table tap zone** (style block only, `git diff` hunks all >line 116):
  `.table` += `flex: 1 1 auto`; new `.hand` rule (`--tile-scale: 1.5rem`,
  `gap: 0`); `.drawn` += `--tile-scale: 1.5rem`; `.tap` += inline-flex centering
  + `min-width/min-height: 2.75rem` + `touch-action: manipulation`.
- **Step 3 — Prompt targets**: `.call/.pass` += `min-height: 2.75rem`, padding
  `0.4rem 0.8rem`, `touch-action: manipulation`; `.call` += `--tile-scale: 1rem`.
- **Step 4 — Pinned column**: `App.svelte` main → `justify-content: flex-start`,
  `gap: 0.5rem`, padding `1rem 0.5rem max(0.5rem, env(safe-area-inset-bottom))`;
  the ticket's one markup change — always-rendered `div.console`
  (min-height, flex, 26rem cap) wrapping the untouched `{#if}<ClaimPrompt/>`;
  `index.html` viewport meta += `viewport-fit=cover`.
- **Gates**: `just test` 24 files / 568 tests green, zero test edits (count grew
  564→568 from a sibling thread's uncommitted shanten property tests — not ours);
  `just check` 177 files, 0 errors, 0 warnings + tsc clean; `just build` →
  self-contained dist/index.html 82,071 bytes (of the 300kB ceiling).
- **Step 5 — empirical 360×780 verification** (scratchpad harness, the
  T-007-02-01 iframe pattern + auto-player; full JSON in scratchpad
  `results2.json`, screenshot `thumbzone-boot.png`):
  - **Boot**: 13 tap buttons, min target **44 × 50.4px**, hand wraps **7+6**,
    hand bottom edge y=682 of 780 (bottom eighth), `scrollWidth = 360`,
    `scrollHeight = 780` — no scroll either axis.
  - **14-tile state** (player mid-turn, drawn up): **14** tap buttons, all
    ≥ 44 × 50.4px; drawn button 44×53 bottoming at y=682; no horizontal scroll.
  - **Tap→discard live**: harness clicked the drawn button — pond count 0→1,
    hand still 13 buttons (the drive.test.ts fact observed in the real DOM).
  - **Claim window** (chi offer encountered in play): prompt renders in the
    console at y 704–770 — the bottommost surface; every prompt button ≥ 48px
    tall; **hand rect byte-identical before/at prompt** (the no-jitter claim).
  - **Deep state** (40 discards): `scrollWidth = 360`, `scrollHeight = 780`,
    hand still pinned at bottom 682.
- **Step 6 — commit `197abf3`**: exactly the five planned paths
  (`Tile/Table/ClaimPrompt/App .svelte` + `index.html`), 69 insertions /
  19 deletions; sibling threads' uncommitted work untouched.

## Deviations from plan

- **Console slot 3.5rem → 4.25rem**: the first harness run measured the one-row
  prompt at 66px — taller than the planned 56px slot — so the prompt's arrival
  nudged the hand up 11px. Re-sized the slot to the measured prompt height
  (4.25rem = 68px); the re-run shows the hand rect *unchanged* when the window
  opens. This is exactly the failure mode the design's "reserved slot" chose to
  prevent; the constant was wrong, the shape was right.
- The prompt-geometry measurement used a naturally-occurring chi window during
  auto-play (seed 1 live drive) rather than the seed-15 SSR anchor — the app
  hardcodes seed 1, and a real window is the stronger evidence anyway.

## Remaining

- Review phase (review.md) and the artifacts commit — next.
