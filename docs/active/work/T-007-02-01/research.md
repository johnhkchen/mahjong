# T-007-02-01 — portrait-table-frame — Research

## The ticket in one sentence

Reflow the square `aspect-ratio: 1` felt grid in `Table.svelte` into a portrait phone
frame so that on a 360×780 viewport all four ponds, melds, the dora indicator, and the
wall count are readable at a glance with no horizontal scroll — while the SSR aria
landmarks/tests stay unchanged and svelte-check stays green.

## Where the layout lives — two style blocks, no logic

All table geometry is CSS inside two components; no TypeScript participates in layout.

### `src/app/Table.svelte` (312 lines) — the felt grid

The `.table` section is a 3×3 CSS grid with areas **named by wind, not screen edge**
(the mapping lives once in `grid-template-areas`, a deliberate single point of change):

```css
grid-template-areas:
  '. west .'
  'north center south'
  '. east .';
grid-template-columns: 1fr 2fr 1fr;
grid-template-rows: 1fr 2fr 1fr;
aspect-ratio: 1;
width: min(100%, 70dvh);
border: 0.5rem solid var(--felt-edge);   /* default content-box sizing */
```

Riichi seating is counterclockwise with the player (East) at the bottom: South right,
West top, North left. The corner cells are unused (`.`). Each `.seat` is a centered
flex column holding, in DOM order: wind label (+`you` mark), pond `<ul>`, melds `<ul>`
(if any), and — for East only — the 13-tile hand `<ul>` and the drawn-tile `<span>`.
The `.center` cell holds the dora indicator + label, the wall count (`N tiles left`),
and the hand-end readouts (ryuukyoku line / win summary). `.center` has `margin: 12%`
(a percentage margin, resolved against the *width* of its containing block).

Other layout-relevant rules: `.pond` is `flex-wrap: wrap` with `max-width: 9.5rem`
(152px) and `min-height: 1.6em` (empty-pond height reservation); `.melds` and `.hand`
are also wrapping flex rows; `.hand` has no width cap of its own.

### `src/app/App.svelte` — the page frame

`main` is a centered flex column: `gap: 1rem; min-height: 100dvh; padding: 1rem;
box-sizing: border-box`, containing `header` ("mahjong", ~20px tall), `<Table>`, and
`<ClaimPrompt>` (conditionally, in flow *below* the table). `:global(html, body)` has
`margin: 0` and the dark backdrop. `index.html` carries the standard
`width=device-width, initial-scale=1` viewport meta.

### `src/app/Tile.svelte` — fixed tile scale (DO NOT TOUCH — see Concurrency)

`.tile { font-size: 0.8rem }` — **rem, not em**, so container font-size does *not*
cascade into tile scale. The chip is `1.5em × 2.1em` of that = **19.2 × 26.88 px**
everywhere: ponds, melds, hand, dora, prompt. Any per-region tile scaling would
require editing Tile.svelte or `:global` overrides; at the fixed scale, a tile row
costs ~21.6px of width per tile (19.2 + 2.4 gap) and ~27px of height per row.

## Current geometry at 360×780 — how it actually fails

At 360px viewport width: `main` content = 328px, so `.table` = `min(328, 546)` = 328px
content + 16px of border = **344px total** (content-box), slightly wider than `main`'s
content box but still inside the 360px viewport — so there is **no horizontal scroll
today**; the failure is crowding and vertical overlap:

- Side columns (`1fr` of 328) are **82px wide** — north/south ponds fit only 3 tiles
  per row; 18 discards stack ~6 rows ≈ 160px inside a **164px-tall** middle row that
  also holds the center cell.
- The east cell (middle column of the bottom row) is **164px wide × 82px tall** and
  must hold the wind label, a pond, melds, the 13-tile hand (≈278px wide unwrapped —
  wraps to 2+ rows), and the drawn tile. Grid cells don't clip, so content overflows
  the square downward and collides with the border/prompt.
- `aspect-ratio: 1` is a weak preference: `fr` rows are `minmax(auto, fr)`, so filled
  ponds already stretch the "square" taller. The square is a fiction mid-hand.

So the ticket is not "fix a scroll bug" — it is "replace a desktop-square layout that
degrades into overlap on a phone with a frame designed for 360-wide portrait".

## The test contract — what must stay unchanged

`src/app/app.ssr.test.ts` (385 lines) is the whole rendering contract. Its header:
asserts *content and aria landmarks only, never classes or structure*. The load-bearing
mechanics for this ticket:

1. `regionTokens(body, label, closeTag)` slices from `aria-label="…"` to the first
   `closeTag`. Ponds/hand/melds close on `</ul>`; "drawn tile"/"winning tile" close on
   `</span>` — the tile's hidden kind token must stay the first `>1x<` text before the
   first `</span>` after the label. **Any markup restructuring risks this; pure CSS
   changes cannot.**
2. Document order is asserted: the active-seat marker must precede the string `South`
   (East renders first), and each wind word appears exactly once. The `SEATS` loop
   order (E, S, W, N) must not change.
3. `just check` = svelte-check + tsc. Unused CSS selectors are svelte-check warnings,
   not errors, but the repo is warning-clean — removed selectors must be pruned.

`app.ssr.test.ts` renders through `svelte/server` — **no layout engine exists in the
test suite**. Nothing in vitest can measure overflow or on-screen-ness. There is no
Playwright/puppeteer dependency (`package.json` devDependencies: svelte, vite, vitest,
fast-check, wrangler, typescript only), and adding one would be a new dependency.

## Verification infrastructure available

- `just dev` (Vite dev server), `just test`, `just check`, `just build` (single-file
  `dist/index.html` + `scripts/verify-single-file.mjs`).
- The built `dist/index.html` is fully self-contained and runs from `file://`. The app
  boots on seed 1 and the `$effect` drive loop plays bots at 250ms/action — so a
  headless-browser screenshot taken after N seconds of virtual time shows a real
  mid-hand table (ponds filling, melds possible) without any test scaffolding.
- macOS host: system Chrome (if installed) supports `--headless --screenshot
  --window-size=360,780`; availability must be probed at implement time. Fallback:
  arithmetic verification (all widths are computable — tile scale is fixed px) plus
  the dev server for the human reviewer.

## Concurrency & neighbors (Lisa runs sibling threads on this branch)

- **`src/app/Tile.svelte` has uncommitted changes owned by T-007-01-02 (phase:
  implement)** — pip faces on the chassis. This ticket must not touch Tile.svelte, and
  any commit must `git add` only its own files (Table.svelte, App.svelte if needed,
  this work dir). `src/core/shanten.*` changes are likewise foreign (T-005/T-006 work).
- **T-007-02-02 (thumb-zone-hand-and-touch-targets) depends on this ticket**: it will
  pin the hand + drawn tile + claim prompt into the bottom thumb zone with ≥44px
  targets. This ticket therefore only needs the *frame* right — hand/prompt stay in
  flow at current scale; their ergonomics are explicitly the successor's scope.
- Dependency T-007-01-01 (SVG tile chassis) is `done` — the 19.2×26.88px chip and its
  hidden kind token are settled facts to build on.

## Width/height arithmetic at 360×780 (the fixed facts a design must satisfy)

- Usable width inside `main`: 328px; a full-width band inside the table border ≈
  312–328px depending on box-sizing → **14–15 tiles per pond row** in a full-width
  band; a 13–14-tile hand row is ≈ 278–302px → fits unwrapped.
- A narrow side column of ~96–110px fits **4–5 tiles per row**; a long pond (18–21
  discards) is then 4–6 rows ≈ 110–165px tall.
- Height budget: header ~20 + main padding 32 + gaps ~32 + table border 16 leaves
  ~680px for bands. Worst-case bands (two full-width ponds at 2 rows + melds, a middle
  band of two 5–6-row ponds beside the center stack, hand + drawn) total ≈ 450–550px.
  Portrait fits with room; the square provably cannot.

## Assumptions surfaced

- "Portrait phone frame" is a *reflow of the one layout*, not a second media-queried
  layout — the vision is pocket-first ("offline, in your palm") and the b28.dev cover
  embeds this same index.html. Whether desktop keeps a square is a Design decision.
- The AC's "no horizontal scroll (overflow-x contained)" reads as *fits by
  construction*, not as `overflow-x: hidden` masking; Design should decide whether a
  containment backstop is also wanted.
- The AC's on-screen list (ponds, melds, dora, wall count) notably *excludes* the hand
  and prompt — consistent with T-007-02-02 owning the bottom zone.
- Empty-state aesthetics (a freshly dealt table shouldn't collapse into a thin strip)
  are unstated but real: `min-height` on the frame or the middle band is the available
  lever since content alone is small at boot.
