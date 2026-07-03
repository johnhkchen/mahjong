# T-007-02-01 — portrait-table-frame — Design

## The decision in one sentence

Re-template the existing wind-named grid areas into three full-width portrait bands —
West across the top, North | center | South in the middle, East (the player's zone)
across the bottom — as a **CSS-only edit to Table.svelte's style block**, with the
markup, DOM order, and both other components untouched.

## Options considered

### A. Media-queried dual layout (square ≥ breakpoint, portrait below) — rejected

Keep `aspect-ratio: 1` for wide viewports, add an `@media (max-width: …)` portrait
variant. Rejected because (1) research showed the square is *already* a fiction — `fr`
rows stretch past square the moment ponds fill, and the east cell overlaps at every
width where the hand wraps; it is not a good desktop layout worth preserving; (2) two
grids mean every future table change (thumb zone, wall display, seat rotation) is
designed and verified twice; (3) the vision is pocket-first ("offline, in your palm")
and the b28.dev attract-mode embed shows the same file — a phone-shaped frame *is* the
product's shape. Desktop gets the portrait frame centered at a max-width instead.

### B. Single portrait band grid, CSS-only (chosen)

Change `grid-template-areas` / `-columns` / `-rows` and the frame's sizing rules; touch
nothing else. Works because the areas are named by wind with the mapping living in one
place (the existing design anticipated exactly this kind of remap), and because the SSR
tests assert content/aria only — a style-block-only diff provably cannot break them.

### C. Restructure markup into explicit band wrappers — rejected

Wrapping seats into `<div class="top-band">`… would let flexbox do the bands, but every
markup edit risks the SSR slicing contract (`regionTokens` closes on the first `</ul>`
/ `</span>` after a label; document order East-before-South is asserted) for zero gain
over B. The grid already reaches every seat by area name.

### D. Keep the square, shrink tiles to fit — rejected

Tile scale is fixed in Tile.svelte (`font-size: 0.8rem`, rem-based deliberately), and
Tile.svelte is owned by the concurrent T-007-01-02 thread; also 82px side columns are
unreadable at any tile size a thumb can still tap (contradicts T-007-02-02's ≥44px
target direction).

## The chosen geometry

```css
.table {
  display: grid;
  grid-template-areas:
    'west west west'
    'north center south'
    'east east east';
  grid-template-columns: 1fr 7.5rem 1fr;
  grid-template-rows: auto 1fr auto;
  width: 100%;
  max-width: 26rem;
  min-height: min(60dvh, 30rem);
  box-sizing: border-box;      /* the 0.5rem border now counts inside width */
  padding: 0.4rem 0.2rem;
  /* felt colors, border, radius unchanged */
}
```

- **Top band (West)** and **bottom band (East)**: full-width rows sized `auto` (by
  content). East keeps its DOM-ordered stack — label, pond, melds, hand, drawn tile —
  now with the full 312px of content width, so a 13–14-tile hand row (~278–302px) fits
  unwrapped. The hand's thumb-zone treatment stays T-007-02-02's scope.
- **Middle band**: North pond | center stack | South pond. Center column fixed at
  7.5rem (120px) — wide enough for the dora chip, its label, the wall count, and the
  wrapped end-of-hand readouts; side columns get (312 − 120)/2 ≈ 96px ⇒ 4 tiles per
  pond row, 18–21 discards ≈ 5–6 rows ≈ 165px. The `1fr` middle row absorbs the
  frame's `min-height` slack, so a freshly dealt table still reads as a felt table
  rather than a collapsed strip, and the center sits mid-frame like a real one.
- **Left/right spatial metaphor survives**: North is still the left-hand opponent,
  South the right-hand one, West across the table — the counterclockwise parlor
  seating stays legible, just letterboxed into portrait.

Supporting rule changes (all in the same style block):

- Drop `aspect-ratio: 1` and `width: min(100%, 70dvh)` (replaced above).
- `.seat`, `.center` get `min-width: 0` — the standard grid-blowout guard so a long
  unbreakable child can never force a column wider than its track (this is the
  structural "overflow-x contained by construction").
- `.pond { max-width: 9.5rem }` → `max-width: 100%`: band ponds may use the band (a
  mid-hand pond of ≤ 14 discards is one glanceable row); the narrow middle columns
  constrain North/South ponds by track size instead of by a magic constant.
- `.center { margin: 12% }` → small fixed margin + padding: percentage margins resolve
  against the (now much narrower) column width and were tuned for the square.

Numbers check at 360×780 (fixed 19.2×26.88px tiles, from research): every band fits
in 312px of content width by construction; worst-case total frame height (two 2-row
full-width ponds + melds + a 6-row middle band + hand + drawn) ≈ 550px, comfortably
inside 780 with header, padding, and gaps — all four ponds + melds + dora + wall count
on screen at once, page need not even scroll.

## What deliberately does NOT change

- **Markup**: zero template edits ⇒ SSR body byte-identical ⇒ all `app.ssr.test.ts`
  assertions (landmarks, region slicing, document order) unaffected by construction.
- **Tile.svelte / ClaimPrompt.svelte / App.svelte**: untouched. App's `main` (1rem
  padding, centered column) already frames 328px of content at 360 wide; the fit math
  works within it, so the diff stays in one file. Tile.svelte is concurrently owned by
  T-007-01-02 — keeping hands off it is also a concurrency requirement.
- **No `overflow-x: hidden` backstop**: clipping would mask real regressions the next
  time someone widens a tile or a gap; the AC's "overflow-x contained" is satisfied by
  fitting (verified by measurement), with `min-width: 0` as the structural guarantee
  that no grid track can blow out the frame.
- **No new dependencies, no test changes**: vitest has no layout engine; verification
  is empirical (headless Chrome screenshots of the built single file at 360×780, boot
  and mid-hand via the app's own bot drive) plus the arithmetic above. No Playwright.

## Risks and their answers

- **Long end-of-hand text in a 120px center column** ("East (you) wins by tsumo",
  yaku names): all wrap-friendly (spaces, hyphens); worst word "ryuukyoku" ≈ 70px at
  0.8rem. Wraps, never blows out (`min-width: 0` guards regardless).
- **Desktop regression**: the square becomes a centered 416px portrait card. This is a
  deliberate identity choice (option A rationale), called out for the human reviewer.
- **`min-height: min(60dvh, 30rem)`** keeps boot aesthetics without ever forcing
  overflow on short viewports (60dvh of a 780px phone = 468px, well under budget; on
  any viewport it is 60% of *that* viewport).
- **svelte-check warning-cleanliness**: every selector kept in the style block still
  matches (no removed classes) — only property values change, so no unused-selector
  warnings can appear.
