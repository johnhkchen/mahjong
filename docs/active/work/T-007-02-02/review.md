# T-007-02-02 — thumb-zone-hand-and-touch-targets — Review

## What changed

**One commit (`197abf3`), five files, 69+/19−; one markup change in the whole
ticket.**

- `src/app/Tile.svelte` (style, 1 rule): the chip's em basis became
  `font-size: var(--tile-scale, 0.8rem)` — a CSS-only scale seam; the default
  keeps ponds, melds, dora, and the win summary at the settled size.
- `src/app/Table.svelte` (style only, zero template edits): `.table` gained
  `flex: 1 1 auto` so the felt fills App's column and the east band bottoms out
  into the thumb zone; `.hand` scales its chips to 36×50.4px
  (`--tile-scale: 1.5rem`) with `gap: 0` (the button pitch is the spacing);
  `.drawn` scales the same; `.tap` became a centered inline-flex with
  `min-width/min-height: 2.75rem` (44px) + `touch-action: manipulation` — the
  button is the ≥44px target, hand and drawn both.
- `src/app/ClaimPrompt.svelte` (style only): `.call`/`.pass` gained
  `min-height: 2.75rem`, bigger padding, `touch-action: manipulation`; call
  buttons show their tiles at `--tile-scale: 1rem`.
- `src/app/App.svelte`: `main` stopped centering — header / stretched felt /
  bottom console column, side padding 0.5rem (buys 7 tiles per row at 360px),
  `padding-bottom: max(0.5rem, env(safe-area-inset-bottom))`. The one markup
  change: an always-rendered `div.console` (min-height 4.25rem, 26rem cap) now
  wraps the previously bare `{#if}<ClaimPrompt/>{/if}` — condition, props, and
  handlers verbatim. Drive wiring, `$effect` loop, and all script code untouched.
- `index.html`: viewport meta gained `viewport-fit=cover` (iOS safe-area).

**Created:** the six RDSPI artifacts here. **Deleted:** nothing. **Untouched:**
`src/core/`, `drive.ts`, every test file, all component templates except the
console wrapper.

## Acceptance criteria — verified

Measured, not eyeballed — headless-Chrome harness iframing the built
`dist/index.html` at exactly 360×780 with a live auto-player (the T-007-02-01
pattern; JSON + screenshot in the session scratchpad):

- **Hand + drawn + prompt in the bottom thumb zone**: hand bottom edge y=682 of
  780 in every state measured (boot, 14-tile, deep 40-discard); drawn button
  bottoms at the same 682; the prompt renders at y 704–770 — the bottommost
  tap surface.
- **≥44px touch targets**: every discard button ≥ 44 × 50.4px (13 at boot, 14
  with the drawn tile up, 11+ post-claim by the same `.tap` rule); every claim
  button ≥ 48px tall.
- **14-tile hand wraps, no horizontal scroll**: 7+6 rows + the drawn on its own
  row; `documentElement.scrollWidth = 360` at boot, mid-turn, prompt-open, and
  deep states (`scrollHeight = 780` too — no scroll in either axis).
- **Drive/SSR assertions green unmodified**: `just test` 24 files / 568 tests,
  zero test edits (13/14 discard-button and tap→discard assertions included);
  the harness also observed tap→discard in the real DOM (pond 0→1, hand 13).
- `just check` 0 errors / 0 warnings; `just build` single-file gate OK at
  82,071 bytes (300kB ceiling).

## Test coverage assessment

- The unmodified SSR suite remains the committed regression net — correct for a
  change that is ~95% CSS; the console wrapper is invisible to every region
  slice (`regionTokens` anchors on aria-labels, not structure).
- **Gap (accepted, same as T-007-02-01, flagged again):** no *committed* test
  measures geometry — vitest has no layout engine. The thumb-zone/44px/no-scroll
  evidence lives in the session harness + this record. Two tickets in a row have
  now hand-built the same harness; a checked-in headless-viewport smoke script
  is worth a ticket if a third layout ticket appears.
- **Gap (bounded):** the prompt was measured at one naturally-occurring one-row
  chi window; multi-row windows (several chi variants + pon + kan) were not
  measured — by design they grow the console beyond its 4.25rem floor and may
  nudge the hand once (rare, accepted in design.md §A).

## Open concerns for a human reviewer

1. **The centered-float identity is gone on all viewports** (deliberate,
   design.md §A): tall desktop windows now pin the hand/console to the window
   bottom with the felt stretched. Coherent with the pocket-first product and
   T-007-02-01's portrait card; a desktop-specific layout remains future work.
2. **Tuning constants**: `--tile-scale: 1.5rem` (hand chip), `2.75rem` targets,
   `4.25rem` console (sized to the *measured* 66px one-row prompt — if
   ClaimPrompt's padding/typography changes, this constant should be re-measured),
   `0.5rem` main side padding (the 7-per-row budget: 7×44=308px of ≈321px band).
3. **`flex: 1 1 auto` on `.table`** is inert outside a flex column (b28.dev
   attract-mode embed unaffected), but any future App-layout rework should know
   the felt's stretch comes from this line.
4. **`touch-action: manipulation`** kills double-tap zoom on the tap surfaces
   only — deliberate (fast repeated taps are the game's input), but pinch-zoom
   on the rest of the page is untouched.
5. **Harness quirks worth remembering**: same as T-007-02-01 — iframe-at-360
   (direct `--window-size` clamps on macOS), hanging-subresource + `--timeout`
   to keep real time flowing, auto-player for the human seat. New this ticket:
   the harness ends early by removing the hanging `<img>` once all measurements
   land (18s instead of 65s).

## TODOs / known limitations

- None in shipped code; no TODO comments introduced. The action-log contract,
  drive seam, and all component interfaces are untouched — this was a
  presentation-layer change with one structural wrapper div.
