# T-007-02-02 — thumb-zone-hand-and-touch-targets — Design

## The four decisions

The ticket decomposes into: (A) how the hand/drawn/prompt get *pinned* to the
viewport bottom, (B) how tap targets reach ≥44px, (C) how the tile chip scales in
just the tap zone, (D) how geometry gets verified. Each was weighed against the
research constraints — above all: **the hand markup cannot leave `Table.svelte`**
(SSR tests render Table directly) and vitest has no layout engine.

## A. Pinning — stretch the felt, reserve a console slot (chosen)

**Chosen:** `App.svelte`'s `main` stops centering vertically and becomes a
header / felt / console column: the table gets `flex: 1` (declared on `.table`
inside Table.svelte — its grid rows are already `auto 1fr auto`, so stretching the
card pushes the east band to the card's bottom, which is now the viewport's
bottom), and a new always-present `div.console` sits below the table with
`min-height: 3.5rem`, holding the conditionally-rendered `ClaimPrompt`.

- The hand + drawn tile land at the bottom of the felt, directly above the
  console; the prompt, when open, is the bottommost surface — prime thumb reach.
- The reserved `min-height` means a 1-row prompt appears **without moving the
  hand** — no tile jitter at claim windows. (A multi-row prompt — several chi
  variants — can still grow the console and nudge the table; rare and accepted.)
- At the tsumo point the drawn tile and the win button render in the *same* fold
  tick, so there is no sequential shift while aiming.
- iOS home-indicator clearance: `viewport-fit=cover` on the `index.html` meta +
  `padding-bottom: max(0.5rem, env(safe-area-inset-bottom))` on `main`.

**Rejected:**
1. *Move hand/drawn/prompt into a new `BottomConsole` component* — cleanest
   conceptual grouping, but `app.ssr.test.ts` renders `Table` directly with
   hand-authored folds and asserts the 13/11-button hand and drawn regions inside
   it; relocation breaks those renders. Disqualified by the AC itself.
2. *`position: fixed` overlay prompt above the hand* — jitter-free without
   reserving space, but brings z-order and occlusion risk (a tall claim stack
   covering the drawn tile at the one moment both surfaces are live), needs its
   width manually synced to the table's 26rem cap, and floats free of the felt
   card's visual language. The 3.5rem slot is cheaper than the complexity.
3. *Prompt in flow with no reserved slot* (status quo position, stretched
   layout) — every claim window would compress the felt's 1fr middle row and
   shift the hand up by the prompt's height; vertical jitter on the primary tap
   surface is exactly what P4's "feel" forbids.

## B. Target size — real 44px buttons, art scaled to ~36px (chosen)

**Chosen:** `.tap` (hand + drawn buttons in Table.svelte) gets
`min-width: 2.75rem; min-height: 2.75rem` (44px at default root size) with the
chip centered inside; the hand chip scales up to a **36×50.4px** face
(`--tile-scale: 1.5rem`, see C). The button is the target; the ~4px of button
beyond the chip on each side doubles as visual tile spacing, so `.hand` drops its
`gap` to 0 and relies on the button margin built into the 44px pitch.

Width arithmetic at 360px viewport: `main` side padding drops 1rem → 0.5rem, so
the table is 344px wide and the band's usable width ≈ 321px. Hand pitch 44px,
gap 0 → **7 tiles per row (308px)**; a 13-tile hand wraps 7+6, the drawn tile
sits apart on its own centered row below (its SSR `<span>` stays a sibling of the
`<ul>`, untouched). 14 simultaneous tap-tiles (11-tile post-chi hands included)
always fit with no horizontal scroll — by construction, plus `min-width: 0`
already guards the track.

Height arithmetic (worst realistic case): hand 2×50px + drawn row ~54px + label +
player pond ~54px + melds ≈ 260px east band; with west ~75, middle ~140, header
~30, console 56, gaps ~40 → ≈ 600px of 780 — fits, with slack for deep ponds.

Claim buttons: `.call`/`.pass` in ClaimPrompt.svelte get `min-height: 2.75rem`
and a padding bump; the tiles inside call buttons scale slightly
(`--tile-scale: 1rem`) so the choice art is legible without inflating the row.

**Rejected:**
1. *Padding-only targets at the 19px chip* — passes the letter of 44px but a
   19px tile face on a phone fails the teaching-first spirit (P4: a beginner must
   *read* the tile they're discarding); huge invisible halos also make perceived
   spacing lie about the real pitch.
2. *Chip scaled to the full 44px width* (`font-size ≈ 1.85rem`) — a 44×61.6px
   chip makes two hand rows + drawn ≈ 180px of tile art alone and only 6 fit per
   row (3 wrap rows); worse vertical economy for no target-size gain over the
   button-as-target approach.

## C. Scaling mechanism — a CSS custom property on the chip (chosen)

**Chosen:** `Tile.svelte`'s one rem-fixed rule becomes
`font-size: var(--tile-scale, 0.8rem)`. Custom properties inherit across Svelte
component boundaries, so Table sets `--tile-scale: 1.5rem` on `.hand` and
`.drawn`, ClaimPrompt sets `--tile-scale: 1rem` on `.call` — no `:global`, no new
prop, no markup change, every other chip on the felt (ponds, melds, dora, prompt
header) keeps the settled 0.8rem basis by the unchanged default.

**Rejected:** a `size` prop on Tile (plumbs presentation through markup and
touches many call sites); `:global(.tile)` overrides from Table (escapes style
scoping and couples Table to Tile's internal class name).

## D. Verification — committed gates + the proven scratchpad harness (chosen)

- `just test` / `just check` / `just build` (single-file gate; 81.5kB of 300kB
  ceiling — CSS deltas are noise) stay the committed gates; **zero test edits**,
  as in T-007-02-01.
- Geometry claims (hand/drawn/prompt rects in the bottom thumb zone at 360×780,
  every tap target ≥44px in both dimensions, `scrollWidth = 360` with a 14-tile
  hand) are verified empirically with T-007-02-01's harness pattern: iframe the
  built `dist/index.html` at exactly 360×780 in headless Chrome, auto-play to the
  states of interest, measure `getBoundingClientRect` on every
  `button.tap`/`.call`/`.pass` and the region containers. The tsumo-point and
  claim-window states come from the frozen drive.test.ts seeds (542630, 15).
- **No new committed test tooling** — same accepted gap as T-007-02-01, flagged
  again in review.

## Consequences

- Files touched: `Tile.svelte` (1 line), `Table.svelte` (style block + `flex: 1`;
  zero template changes), `App.svelte` (main layout + console wrapper div —
  the only markup change anywhere), `index.html` (viewport-fit). `src/core/`
  untouched; drive seam untouched; all SSR aria labels and region shapes
  untouched.
- Desktop/tall viewports: the felt stretches; the middle 1fr row absorbs slack,
  the hand stays glued to the bottom — the pocket-parlor identity from
  T-007-02-01 extends naturally (contents bottom-anchored instead of floating).
- The boot state (no drawn tile, no prompt) shows hand + empty console at the
  bottom — the resting posture already reads as "your seat is here."
