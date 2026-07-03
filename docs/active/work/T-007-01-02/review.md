# T-007-01-02 — pin-sou-numbered-faces — Review

## What changed

- **Modified: `src/app/Tile.svelte`** (+~200 lines, module script + template) —
  the interim p/s faces (latin numeral over a small mark) are replaced by real
  pip art on the settled chassis:
  - **Pin 1p–9p**: cash coins — one ring-stroked `<circle>` per coin with an
    ivory square hole `<rect>` punched over it — in the traditional
    arrangements (grand single, stack, diagonal, 2×2, quincunx, 2×3,
    diagonal-over-quad, 2×4, 3×3), driven by a `PIN_LAYOUTS` literal table.
    Dominant ink is the established pin blue (`#2e5aa0`, ring `#1f3f73`); the
    established red accents the visual center of 1p/3p/5p/7p-diagonal/9p.
  - **Sou 2s–9s**: bamboo sticks — one rounded `<rect>` per stick with an ivory
    joint `<line>` at the waist — in the traditional stacks/grids from a
    `SOU_LAYOUTS` table; 8s is the two-gable "mountain" (eight sticks tilted
    ±35° about their own centers, no defs/ids). Green `#2e7d4f` (edge
    `#1f5737`); red accents on the 5s center, 7s lone top, 9s middle row.
  - **1s**: a hand-placed flat geometric sparrow on a bamboo perch (tail
    feathers, ellipse body, head, red beak, ivory eye — 8 shapes, suit
    palette), per design.md Decision 5. Its body is the set's only `<ellipse>`.
  - No `<text>` node exists in any p/s face — the kind-token contract holds by
    construction, stronger than the old separate-nodes discipline. The hidden
    `.kind` span, chassis, honors, haku, man faces, and back are untouched;
    the now-unused `.rank` CSS selector was removed (svelte-check would flag
    it); `SUIT_INK` kept (man's 萬 reads from it), comment updated.
- **Modified: `src/app/tile.ssr.test.ts`** (+5 tests, `pip faces` describe) —
  coin count == N on every Np; rect count == 2 (chassis) + N on every Ns
  (N ≥ 2); `<ellipse>` exactly once on 1s and zero elsewhere across all 34
  kinds; no `<text` on any p/s chip; all 34 chip bodies pairwise distinct
  (the AC's "distinct original faces", asserted directly).
- **Untouched**: `src/core/` byte-for-byte; Table/App/ClaimPrompt; deps,
  config, CSS beyond the one dead selector.

Commits: `a3e745e` (component + tests), plus the RDSPI artifacts commit.

## Mid-flight deviation (documented in progress.md)

T-007-01-03 (man faces) landed and committed (`d4d49ff`) between this ticket's
Research and Implement. The R/D/S/P artifacts describe the m branch as still
interim; in reality this ticket built on -03's settled man faces. Scope was
unaffected — only the p/s branch was replaced — and `src/app/` was verified
clean against HEAD before editing, so the diff contains only this ticket's
work. One planned test ("m keeps interim numerals for -03") was dropped as
obsolete; -03's own `man faces` suite covers that ground.

## Acceptance criteria, checked

- All 1p–9p and 1s–9s render distinct original SVG pip faces on the chassis —
  **yes**: 18 data-driven/hand-drawn faces, original compositions in the house
  palette (pip arrangements are centuries-old public-domain convention; no
  commercial set's artwork or color assignment copied), and the 34-way
  distinctness test proves "distinct" mechanically.
- SSR tests still resolve those kinds via the preserved kind token — **yes**:
  the token-multiset sweep and app.ssr.test.ts pass with zero edits; the
  hidden `.kind` span mechanism is untouched.
- svelte-check green — **yes**: 0 errors, 0 warnings (plus tsc).
- No new dependency — **yes**: pure template + literals.
- Core untouched — **yes**: staged paths audited; nothing under `src/core/`.

`just test`: 24 files / 564 tests green. `just build`: self-contained
dist/index.html, 80,973 bytes (gzip 27.84 kB) — +3.4 KB over the 77,525 B
-01 baseline with both -02 and -03 aboard; no ceiling concern (-04 owns that).

## Test coverage

- **Strong**: pip multiplicity (a 7p is provably seven coins), the bird's
  identity and exclusivity, text-free p/s faces (no token can ever leak),
  34-way distinctness, and the inherited chassis/token/wind-word/man-face
  contracts running unchanged over the new art.
- **Deliberately absent** (content-only doctrine): coordinates, colors beyond
  what element counts imply, rotation angles, whether the 8s gables visually
  read as ∧/∨, bird proportions. The rect-count test does pin "chassis = 2
  rects" and "coin hole = rect / stick = rect" as a structural contract —
  documented in design.md Decision 2 as deliberate; a future chassis rect
  moves that constant.

## Open concerns for a human eye

1. **The 1s bird is the ticket's one aesthetic gamble.** It is deliberately
   flat/geometric; if a `just dev` eyeball says it reads as a blob rather than
   a bird, the designed fallback (single large stalk) slots into the same
   branch — only the ellipse-marker test would need a pivot.
2. **8s gable legibility at 1.5em.** Eight tilted 6.5×16 sticks at final render
   size may read as texture rather than two chevrons. Alternative if playtest
   dislikes it: straight 2×4 columns (some real sets do this) — a table-only
   change, tests unaffected.
3. **Red-accent balance** (1p/3p/5p/7p/9p centers, 5s/7s/9s) follows broad
   tradition but is a house choice; trivially tunable in the layout tables.
4. **Small-pip crowding**: 7p/8p/9p coins at r 6.5 with a 4.55-unit hole are
   near the resolution floor at 1.5em width — legible in the SVG, worth one
   zoomed-out look on the live felt.

No TODOs left in code; no known limitations beyond the above.
