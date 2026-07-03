# T-007-01-01 — svg-tile-chassis-honors-backs — Progress

## Completed

- **Step 1 — Tile.svelte rewritten to the chassis.** Prop widened to
  `id: TileId | 'back'`; module-context `HONORS` (東南西北 ink / 發 green / 中 red)
  and `SUIT_INK` lookups; one root `<span class="tile">` holding the aria-hidden
  SVG chassis (full-bleed under-body `#b9a97e`, inset ivory face `#f6f1e4` — or the
  indigo `#31588f` back panel) with four face branches: back / honor kanji / haku
  frame (5z, stroked empty rect) / interim numbered (rank `<text>` + separate suit
  mark: 萬 text for m, coin circle for p, bamboo rect for s). Visually-hidden
  `.kind` span renders `{kind ?? 'tile back'}` — the accessible name and the SSR
  token. Old text-face CSS (`.suit-*`, padding/border chip) deleted; chip sized
  `1.5em × 2.1em` on a self-set `0.8rem` em basis (the old footprint width).
  - One deviation from the first cut, caught immediately: the shared lookups live
    in `<script module>`, which cannot see instance-script imports — the
    `NumberedSuit`/`TileKind` type imports moved into the module block.
- **Step 2 — existing contract proven.** `just check`: 0 errors, 0 warnings
  (176 files). `just test`: 23 files / 548 tests green — including the decisive
  `app.ssr.test.ts` (token multiset, `</span>`-sliced regions, wind-words-once,
  meld/prompt labels) with zero edits to it. No triage needed.
- **Step 3 — `src/app/tile.ssr.test.ts` added** (the chassis contract, 5 groups /
  8 tests): one token per chip for all 34 kinds; one aria-hidden SVG + ivory face
  per face chip; no English wind words from any chip; each honor kanji on its kind
  only; 5z = frame with no glyph; back = svg + zero tokens + "tile back" text;
  full-set sweep (34 chips + back → exactly the 34 kinds once each).
  `just test`: 24 files / 556 tests green. `just check` green (177 files).
- **Step 4 — full gate.** `just build` green: `dist/index.html` self-contained at
  **77,525 bytes** (gzip 26.66 kB) — the -04 ceiling baseline. `git diff src/core/`
  shows only other lisa threads' shanten work; this ticket staged nothing outside
  `src/app/Tile.svelte`, `src/app/tile.ssr.test.ts`, and this work directory.
- **Step 5 — committed** (explicit paths only, never `git add -A` on the shared
  branch): the component rewrite + contract test as one commit, per plan.

## Remaining

Nothing — all plan steps executed. Review phase follows.

## Deviations from plan

Only the module-script import fix noted above (an ordering detail inside Step 1,
not a design change). Glyph metrics (`y=54` kanji baseline, font sizes 40/34/18)
went in as structure.md specified; the cosmetic-nudge risk flagged in plan.md was
not exercised — visual tuning, if any, belongs to the owner's playtest pass.
