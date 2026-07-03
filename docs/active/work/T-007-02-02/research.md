# T-007-02-02 — thumb-zone-hand-and-touch-targets — Research

## Ticket restated

Pin the concealed hand, the drawn tile, and the claim prompt into the bottom thumb
zone of the portrait viewport, with every discard/claim button a ≥44px touch target
and a 14-tile hand (13 sorted + the drawn) wrapping without horizontal scroll — while
the existing drive/SSR assertions (13/14 discard buttons, tap→discard) stay green.

## Where the three surfaces live today

### The hand + drawn tile — inside `src/app/Table.svelte` (east band)

- `Table.svelte:84-101`: the player's seat (`seat.you`, East) renders `ul.hand`
  with one `<li><button class="tap" aria-label="discard {kind}">…` per sorted hand
  tile, then — apart from the list, mirroring core's drawn-vs-13 separation —
  `span.drawn > button.tap` for the drawn tile when it's the player's turn.
- The east seat is the **full-width bottom band of the felt card** since
  T-007-02-01 (commit `97502b3`): `.table` is a 3-band portrait grid
  (`west/west/west`, `north/center/south`, `east/east/east`), rows `auto 1fr auto`,
  `max-width: 26rem`, `min-height: min(60dvh, 30rem)`. The east band already sits
  at the *bottom of the card* — but the card is centered in the viewport, not
  pinned to its bottom edge.
- Band order inside `.seat` (a centered flex column): wind label → pond → melds →
  hand → drawn. The player's own pond and melds sit *above* the hand in the same
  band.

### The claim prompt — `src/app/ClaimPrompt.svelte`, mounted in `App.svelte`

- `App.svelte:95-105`: conditionally rendered as a flow sibling *below* `<Table>`
  inside `main` whenever `prompt.length > 0 || win !== null` (and not the houtei
  dismissal). Appearing/disappearing shifts layout; it currently sits wherever the
  centered column puts it.
- `ClaimPrompt.svelte`: `aside.prompt[aria-label="call or pass"]` — optional
  "call on <tile>?" header, then `.buttons`: win button first, one `.call` per
  deduped claim choice (each shows its `uses` tiles), optional `.pass`.

### App shell — `src/app/App.svelte`

- `main`: flex column, `align-items/justify-content: center`, `gap: 1rem`,
  `min-height: 100dvh`, `padding: 1rem`. Header on top, then Table, then the
  prompt in flow. Nothing is anchored to the viewport bottom; on a tall phone the
  whole stack floats centered with dead space above *and below* — the hand is
  mid-screen, not in the thumb zone.

## Current touch-target geometry (the gap to close)

- `Tile.svelte:324-337`: the chip's em basis is `.tile { font-size: 0.8rem }`
  (component-scoped, **rem-fixed — it does not inherit**), chip = `1.5em × 2.1em`
  = **19.2 × 26.88 px**. This is the "settled chassis" every band was tuned around.
- `Table.svelte:265-271` `.tap`: `padding: 0; background: none; border: none` — the
  button's hit area IS the chip, ~19×27px. **Both dimensions fail 44px.**
- `ClaimPrompt.svelte` `.call`/`.pass`: `padding: 0.3rem 0.6rem`, font-size
  0.85rem, tile chips inline → roughly 34–38px tall. **Fails 44px height.**
- Width budget at 360px viewport: `main` padding 1rem×2 → table ≤ 328px; `.table`
  border 0.5rem×2 + padding 0.2rem×2 → **≈ 305px of usable band width**.
  Arithmetic: 14 × 44px = 616px — a 44px-wide-per-tile hand *must* wrap (2 rows of
  7 needs 7×44 + 6 gaps ≈ 320px > 305px; 6 per row ≈ 270px fits).

## Constraints that bind the design

1. **The hand must stay in `Table.svelte`.** `app.ssr.test.ts` renders `Table`
   *directly* with hand-authored folds and asserts `aria-label="your hand"`,
   13 (or post-chi 11) `aria-label="discard …"` buttons inside the `<ul>` slice,
   and the drawn-tile button (`:72-77`, `:123-133`, `:301-309`). Moving the hand
   markup up to `App.svelte` breaks those renders. Pinning must therefore work
   *through* the table card (CSS), not by relocating markup out of it.
2. **`regionTokens` slices by aria-label → first close tag** (`app.ssr.test.ts:34`):
   the hand region must remain a flat `<ul>…</ul>`, the drawn region closed by
   `</span>`. Wrapper elements *around* them are safe; nesting new `ul`s inside is
   not.
3. **`drive.test.ts` (tap→discard, tapClaim, settleWindow) is pure TS** over the
   drive seam — untouched by any CSS/markup change; it stays green by construction
   unless component *logic* changes (none is needed).
4. **Tile scaling can't be done from outside `Tile.svelte` without `:global`**:
   `.tile`'s rem-fixed font-size defeats inheritance, so a hand-only bigger chip
   needs either (a) a change inside `Tile.svelte` (em-basis or a size prop),
   (b) a `:global(.hand .tile)` override in Table, or (c) leaving the chip small
   and growing the *button* (padding/min-size — WCAG 2.5.5 counts the target, not
   the art). Tile.svelte is no longer contended (T-007-01-02/-04 committed).
5. **Single-file gate**: `scripts/verify-single-file.mjs` enforces one dist file
   ≤ 300,000 bytes; dist is currently 81,514 bytes — CSS-scale changes are noise.
6. **No layout engine in vitest**: geometry claims (pinned-to-bottom, ≥44px,
   no horizontal scroll) can only be *empirically* verified with the
   headless-Chrome harness pattern from T-007-02-01 progress.md — iframe the
   built `dist/index.html` at exactly 360×780 (direct `--window-size` is clamped
   on macOS) + a real-time auto-player; `--virtual-time-budget` cannot drive this
   app (it waits on human input).
7. **`index.html` viewport meta** is standard `width=device-width, initial-scale=1`;
   no `viewport-fit=cover` yet — relevant if the thumb zone wants
   `env(safe-area-inset-bottom)` for iOS home-indicator clearance.

## Adjacent facts

- The east band already *is* a full-width bottom band with the hand at its bottom
  edge — T-007-02-01's review explicitly hands this ticket "a stable full-width
  bottom band to build in" and names hand/prompt ergonomics as this ticket's scope.
- Pond tiles and opponent tiles are *not* touch targets — only hand tiles, the
  drawn tile, and prompt buttons are interactive. The 0.8rem chip scale elsewhere
  is out of scope.
- The `dismissed` houtei flag and `BOT_DELAY_MS` pacing in `App.svelte` are drive
  presentation logic — orthogonal, must not be disturbed.
- `.hand` already `flex-wrap: wrap; justify-content: center` — wrapping exists;
  what's missing is target size and bottom anchoring.
- Charter P4 ("feel and original art — mobile-first table") is the value axis;
  the definition-of-done user "finishes a real hand one-thumbed" depends on this.
- Worst-case hand width: 13 tiles + drawn while `mustDiscard` after calls shrinks
  the concealed count (11 post-chi) — 14 is the max simultaneous tap-tile count.
- `App.svelte` `main` is the only place viewport-level layout lives; `:global(html,
  body)` margin reset is already there.

## Verification levers already proven

- `just test` (24 files / 564 tests), `just check` (svelte-check + tsc),
  `just build` (+ single-file gate) — the committed gates.
- The scratchpad iframe-at-360×780 harness with auto-player: measured
  `scrollWidth`, per-region `getBoundingClientRect`, screenshots — the pattern to
  reuse for "hand rects in the bottom third, buttons ≥44px, scrollWidth = 360".
