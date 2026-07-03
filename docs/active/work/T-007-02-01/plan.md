# T-007-02-01 — portrait-table-frame — Plan

## Steps

### Step 1 — Reflow `Table.svelte`'s style block (the whole code change)

Apply the structure.md blueprint in one edit:

- `.table`: portrait `grid-template-areas` (west band / north–center–south / east
  band), columns `1fr 7.5rem 1fr`, rows `auto 1fr auto`, `row-gap: 0.4rem`,
  `width: 100%`, `max-width: 26rem`, `min-height: min(60dvh, 30rem)`,
  `box-sizing: border-box`, `padding: 0.4rem 0.2rem`; delete `aspect-ratio: 1`.
- `.seat`: add `min-width: 0`.
- `.center`: add `min-width: 0`, `align-self: center`; `margin: 12%` → `margin: 0;
  padding: 0.5rem 0.25rem`.
- `.pond`: `max-width: 9.5rem` → `max-width: 100%`.
- Template lines: untouched (verify with `git diff` — no `+`/`-` outside `<style>`).

Verify: `git diff src/app/Table.svelte` shows style-block-only changes.

### Step 2 — Regression gates

- `just test` — all vitest suites (core + SSR) green, zero modifications to tests.
- `just check` — svelte-check + tsc clean (no unused-selector warnings).

Both must pass before any visual verification; a red gate here means Step 1 leaked
outside the style block.

### Step 3 — Build + empirical viewport verification (the AC itself)

1. `just build` → `dist/index.html` (single-file check runs in the build).
2. Probe for headless Chrome on this mac (`/Applications/Google Chrome.app/…`).
3. If present, from the scratchpad:
   - **Boot shot**: `chrome --headless --screenshot=boot.png --window-size=360,780
     --hide-scrollbars dist/index.html` — expect the portrait frame with all four
     wind seats, dora, wall count, hand.
   - **Mid-hand shot**: same with `--virtual-time-budget=20000` — the 250ms bot drive
     has folded ~60+ actions; expect filling ponds (and possibly melds/claim prompt).
     Inspect both PNGs (Read tool): four ponds + melds + dora indicator + wall count
     simultaneously on screen; nothing clipped at the 360px right edge.
   - **Overflow number**: scratchpad `harness.html` iframes `dist/index.html` at
     360×780, polls the inner `document.documentElement.scrollWidth` into the DOM;
     `chrome --headless --dump-dom --allow-file-access-from-files harness.html`
     must report scrollWidth ≤ 360.
4. If Chrome is absent: fall back to the design's fixed-pixel arithmetic (tile scale
   is rem-fixed; every band width is computable) and flag the manual-verify gap in
   review.md.

Acceptance mapping: this step is the AC's "verified on a 360×780 portrait viewport"
clause; Step 2 is its "SSR aria landmarks/tests unchanged and svelte-check green"
clause.

### Step 4 — Commit the code

Single atomic commit, explicit path staging only (sibling threads own uncommitted
changes in `Tile.svelte`, `src/core/`):

```
git add src/app/Table.svelte
git commit -m "T-007-02-01: portrait table frame — felt grid reflowed into phone bands"
```

(+ the repo's Co-Authored-By trailer.)

### Step 5 — progress.md, review.md, artifact commit

Write `progress.md` (steps completed, deviations if any), then `review.md` (change
summary, test coverage assessment, open concerns — including the desktop-becomes-
portrait-card identity decision for the human reviewer). Commit the work directory as
`T-007-02-01: RDSPI artifacts — research through review`, matching repo convention.

## Testing strategy

- **Unit/SSR tests: none added, none changed.** The suite has no layout engine; the
  ticket's invariant ("markup unchanged") is *enforced* by the existing SSR suite
  passing without edits — that is the strongest available automated signal.
- **Integration/visual: empirical, not committed.** Headless-Chrome screenshots +
  scrollWidth harness against the real built artifact at the AC's exact viewport,
  driven by the app's own deterministic seed-1 bot loop (no mocks, no scaffolding).
- **Worst-case reasoning, not testing:** late-hand pond depth (5–6 rows in the middle
  band) is covered by design arithmetic; the mid-hand screenshot samples a real state
  but cannot exhaust states. Flag in review.md.

## Rollback / deviation rules

The change is one style block in one file — `git checkout src/app/Table.svelte`
reverts fully. If visual verification exposes a mis-tuned constant (center column
width, min-height, padding), adjust the constant within the Step-1 shape and re-run
Steps 2–3; a deviation that requires touching markup or another file means stop,
document in progress.md, and reassess against design.md's rejected options.
