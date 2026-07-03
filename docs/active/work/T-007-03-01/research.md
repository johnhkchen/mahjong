# T-007-03-01 — draw-and-discard-to-pond-motion — Research

## Ticket restated

Make each draw arriving and each discard travelling to the pond legible via cheap
CSS-only motion (~150–250ms, CSS transitions only, no animation library, no new
dependency), disabled under `prefers-reduced-motion`; SSR output unchanged
(transitions are client-only) and svelte-check passes.

## Where draws and discards render today

All of it is `src/app/Table.svelte` — the stateless presentational table (one
`table: TableState` prop in, markup out; every fact is a field read off the fold).

### The player's draw — `Table.svelte:95-101`

- `span.drawn` renders via `{#if table.turn === 0 && table.drawn !== null}`,
  *apart* from the sorted 13-tile hand (mirroring core's drawn-vs-hand split).
  It **appears** when the player's draw folds in and **disappears** when the
  discard folds (either the drawn tile itself or a hand tile — tedashi swaps the
  drawn tile into the hand and the whole `{#if}` block unmounts).
- Opponents' draws are concealed information and **never render** — the only
  visible signal of a bot draw is the wall counter (`{table.live.length} tiles
  left`, `Table.svelte:110`) ticking down. "Each draw arriving" can only mean
  the player's drawn tile; there is no bot-draw element to animate.

### Discards to the pond — `Table.svelte:52-62`

- Each seat's pond is `ul.pond` with `{#each table.ponds[i] as id (id)}` — keyed
  by physical `TileId`, one `<li><Tile/></li>` per discard, **appended at the
  end** in discard order ("the order IS the pond's meaning"). A new discard is a
  fresh `<li>` insertion; nothing reorders.
- A claimed-away discard stays in the pond `<li class="claimed">` (opacity 0.45 +
  rotate 8deg, `Table.svelte:238-241`) — the class *changes* on an existing li
  when a claim folds. Animating that mark is sibling ticket T-007-03-02's scope
  (meld exposure), but any `transition` we put on `.pond li` will incidentally
  cover it.
- The hand `ul.hand` (`Table.svelte:84-92`) is also keyed `(id)`; a discard
  *removes* an li from the hand (or unmounts `.drawn`). Keyed removal destroys
  the node immediately — pure CSS cannot animate an exit, and the hand/pond are
  separate keyed lists, so a tile "travelling" between them is two DOM nodes,
  not one moved node. Cross-list FLIP is not reachable with CSS only.

## How the DOM actually updates

- `App.svelte:24-25`: authoritative state is the growing action log; the table
  re-derives by `foldRecord` after every append. Svelte 5 keyed `{#each}` diffs
  by key, so unchanged pond tiles keep their DOM nodes; each new discard is
  exactly one inserted element. Insertion-triggered styling is the mechanism
  that fits.
- **Pacing**: `App.svelte:42` `BOT_DELAY_MS = 250` — the drive effect appends one
  forced action per 250ms tick, precisely so "ponds and the wall counter land
  visibly, action by action". A motion of ≤250ms completes before the next
  action folds; the ticket's 150–250ms band nests inside this rhythm. Discards
  land at most one per 250ms; there is no burst case to defend against.
- **The app is client-mounted, not hydrated**: `main.ts` mounts `App` into
  `#app`; `svelte/server`'s `render()` is used *only* by the SSR tests. `$effect`
  never runs in SSR (`App.svelte:78`). At mount the fold is the fresh deal —
  ponds empty, no drawn tile — so insertion-styling cannot fire a spurious
  full-table animation on load.

## The CSS mechanism — feasibility verified

CSS `transition` alone does not fire on element *insertion* (the first style
pass has no "from" state). The pure-CSS way to give an inserted element a
transition is **`@starting-style`** (CSS Transitions L2): the before-first-paint
style that the transition runs *from*. Client-only, zero markup change, zero JS,
zero dependency — exactly the AC's "transitions are client-only" shape.

- **Spike (this session, project toolchain)**: `svelte@5.56.4` compiles a nested
  `@starting-style { … }` block inside a scoped rule with correct scoping
  (`.pond.svelte-hash li:where(.svelte-hash)` keeps the at-rule nested intact)
  and **zero warnings**. Feasibility is not a risk.
- Browser support: Chrome/Edge 117+, Safari 17.5+, Firefox 129+ (all shipped
  2023–2024). Unsupported browsers degrade to tiles appearing instantly — the
  exact pre-ticket behavior, and the same behavior reduced-motion users get.
- `prefers-reduced-motion`: no motion CSS exists anywhere in the app today
  (grep: no `transition`, `animation`, or `prefers-reduced-motion` in
  `src/app/*.svelte`). The established gate pattern is the media query
  `@media (prefers-reduced-motion: no-preference) { … }` wrapping the motion
  rules — opt-in, so reduced-motion and legacy browsers share the no-op path.

## Constraints that bind the design

1. **SSR assertions must stay green** (`app.ssr.test.ts`): tests match aria
   labels, tile-kind text tokens (`>1z<`), counts, and document order — "never
   classes or structure". Pure `<style>` additions change only the scoping hash
   on class attributes, which no test reads. Adding/removing *elements* around
   `.pond li`/`.drawn` would risk the `regionTokens` slice bounds
   (`aria-label` → first `</ul>`/`</span>`); style-only changes cannot.
2. **`drive.test.ts` (960 lines) is pure TS over the drive seam** — untouched by
   CSS. Tap→discard mapping is guarded further by sibling T-007-03-03.
3. **`src/core/` byte-for-byte untouched** (epic constraint). This ticket is
   view-only CSS in `src/app/`.
4. **No new runtime dependency; CSS transitions only, no animation library**
   (epic Context & Constraints, verbatim). Svelte's own `transition:`/`animate:`
   directives are JS-driven runtime animations — inside the letter of "no new
   dependency" but outside "CSS transitions only".
5. **Single-file gate**: `scripts/verify-single-file.mjs`, dist ≤ 300,000 bytes
   (currently ~81.5KB per T-007-02-02 research) — a few CSS rules are noise.
6. **No layout engine in vitest**: motion is not unit-testable here; the AC
   accordingly demands only that existing checks stay green plus svelte-check.
   Empirical eyes-on verification uses the headless-Chrome iframe harness
   pattern proven in T-007-02-01/-02 (`dist/index.html` at 360×780 with the
   auto-player), or `just dev`.
7. **Timing budget**: stay within 150–250ms *and* ≤ `BOT_DELAY_MS` (250ms) so a
   pond entrance settles before the next action folds.

## Sibling boundaries (scope fence)

- **T-007-03-02** owns meld-exposure motion (claimed tile rotating into the
  meld) and hand-end reveal (ryuukyoku/agari). The `.pond .claimed` mark and
  `.win-summary` are its surfaces.
- **T-007-03-03** owns the sort-to-tap correctness guard (display-sorted hand
  still discards the tapped exact `TileId` through any animated path); it
  depends on this ticket and -02 landing first.
- This ticket: the **drawn-tile entrance** and the **pond-tile entrance** (all
  four seats' ponds — the player's discard and the bots' land the same way).

## Adjacent facts

- Charter P4 (feel) is the value axis; epic E-007 "Done looks like" names
  "sees draws/discards … animate smoothly (~150–250ms, no jank)".
- `Tile.svelte` is a presentational leaf (chip art only) — motion belongs to the
  *placement* contexts in `Table.svelte`, not the chip.
- `.pond` reserves `min-height: 1.6em` so first discards don't jump the grid —
  entrance motion should likewise avoid layout-shifting neighbors (animate
  `opacity`/`transform`, the compositor-only properties; never width/margin).
- The pond is `flex-wrap: wrap` — a new li can wrap to a new row; on the row
  itself neighbors shift by normal flex flow (pre-existing behavior, not ours).
- Verification levers: `just test` (SSR + drive + core), `just check`
  (svelte-check + tsc), `just build` (single-file gate).
