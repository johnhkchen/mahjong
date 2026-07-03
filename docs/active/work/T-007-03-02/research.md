# T-007-03-02 — Research: meld exposure & hand-end reveal motion

## Ticket restated

Animate two moments so they read as events, not instantaneous pops:

1. **Meld exposure** — a claim (chi/pon/kan) lands: the meld appears beside the
   caller's seat, the claimed tile rotated sideways into it, and the source pond
   tile takes the claimed mark.
2. **Hand-end reveal** — the ryuukyoku line or the agari win-summary appears in
   the center card.

Constraints from the acceptance criteria: ~150–250ms, **CSS only**, honoring
`prefers-reduced-motion`; the existing meld and ryuukyoku SSR assertions stay
green; `svelte-check` passes.

## Where the two moments live today

Everything is in `src/app/Table.svelte` — the stateless presentational table
(one `table: TableState` prop in, markup out; every fact is a field read off the
fold).

### Meld exposure (Table.svelte:63–82, styles 243–265)

- `{#if table.melds[i].length > 0}` gates a `<ul class="melds" aria-label="{area} melds">`.
- Each meld is an **unkeyed** `{#each table.melds[i] as meld}` → `<li class="meld">`:
  the caller's `meld.own` tiles (keyed each by id), then — for claiming melds —
  a `<span class="claimed-tile" aria-label="claimed {kind} from {seat}">` holding
  the claimed `<Tile>`.
- `.claimed-tile` already carries the parlor convention **statically**:
  `transform: rotate(90deg); margin: 0 0.25em`. The ticket's "claimed tile
  rotating sideways" is precisely animating into this settled end state.
- The discarder's pond keeps the claimed tile counted (core's furiten posture):
  `{#if claimedAway.has(id)}` renders `<li class="claimed">`, styled
  `opacity: 0.45; transform: rotate(8deg)` (Table.svelte:53–61, 237–241). The
  claim event therefore has a *second* visible site: the pond tile switching
  branches to its dimmed, tilted mark.

### Hand-end reveal (Table.svelte:111–132, styles 290–316)

- Ryuukyoku: `{#if table.phase === 'ryuukyoku'}` → `<p class="ended" role="status">`,
  a **direct child** of `.center`.
- Agari: `{#if table.phase === 'agari' && table.win !== null}` →
  `<div class="win-summary" role="status">` containing its own `<p class="ended">`
  (winner sentence), the `.winning-tile` span, and the `.yaku` list.
- Both are children of the always-rendered `.center` info card. Note the selector
  asymmetry: the ryuukyoku `.ended` is `.center > .ended`; the win sentence's
  `.ended` is nested inside `.win-summary` — usable to target them separately
  with no markup change.

## Mount semantics — when DOM actually appears

`App.svelte` holds the authoritative record (`seed` + `$state` action log) and
re-folds on every append (`const table = $derived(foldRecord(...))`). Svelte 5's
diffing then determines what mounts:

- **Ponds and hands**: keyed `{#each ... (id)}` — existing tiles keep their DOM
  nodes across folds. A pond tile's claim swaps its `{#if}`/`{:else}` branch,
  which **destroys and recreates** that `<li>` → the `.claimed` li mounts fresh
  exactly at the claim.
- **Melds**: the unkeyed each diffs by index — existing meld `<li>`s update in
  place (same Tile ids → no remount); a *new* meld appends a fresh `<li>` that
  mounts exactly when the fold first contains it. The whole `<ul class="melds">`
  mounts on the first meld (its `{#if}` gate opens).
- **Hand-end blocks**: the phase flip mounts `.ended` / `.win-summary` once;
  they never remount afterward (phase is terminal for the hand).

So every element the ticket wants animated **mounts at its moment** — a pure-CSS
`@keyframes` animation on the element's class fires on insertion with zero
script and zero markup change. This is the load-bearing fact for design.

Boot state: `App.svelte` always folds a fresh deal (`actions: []`) — no melds,
phase `playing` — so nothing animates on first paint today. (A future restored
mid-hand record would replay its mount animations once on load; there is no
persistence yet.)

Client rendering: `main.ts` mounts client-side; SSR exists only in the vitest
suite (`svelte/server` render). `$effect` never runs in SSR (App.svelte:78).

## Existing motion in the codebase

**None.** `grep` for `transition|animation|@keyframes|prefers-reduced-motion`
across `src/app/` finds nothing. This ticket establishes the app's first motion
pattern. Sibling T-007-03-01 (draw/discard-to-pond motion) is still at phase
`research` with no work directory — there is no shared animation vocabulary to
reuse, and no dependency edge between the siblings, so this ticket must stand
alone (both touch `Table.svelte`; the DAG treats that as lisa's lock problem,
not ours).

Related pacing already exists in **App.svelte**: `BOT_DELAY_MS = 250` — one
forced action per tick. Any animation ≤250ms completes within one pacing tick,
so consecutive bot actions never overlap a running reveal. The ticket's
150–250ms window aligns with this deliberately.

## The tests that must stay green

`src/app/app.ssr.test.ts` renders through the real Svelte SSR compiler and
asserts **content, counts, and aria labels only — never classes or structure**
(stated in its header comment). The assertions this ticket must not break:

- `meld display (SSR)` (seed-3 chi): `east melds` region tokens `['1p','3p','2p']`,
  `aria-label="claimed 2p from north"`, north pond complete with
  `aria-label="claimed 2p"`, exactly one melds region, 11-tile hand + turn marker.
- `hand-end view (SSR)`: winner sentence (whitespace-collapsed), `winning tile`
  region, yaku names, no `aria-current`, bot-ron variant.
- `wall-exhausted table view (SSR)`: `ryuukyoku` text, `0 tiles left`, no
  `aria-current`.

Since these match text and aria attributes, a **style-only** change cannot touch
them; even added classes would pass, but zero markup change makes SSR output
byte-identical — the strongest possible guarantee for "SSR assertions stay green."

CSS itself never appears in `render()` output (Vite extracts component styles),
so the animation cannot be asserted via SSR; verification is `svelte-check`
(flags unused CSS selectors — a misspelled selector fails the gate) plus the
compiled `dist/index.html` (styles are inlined by `vite-plugin-singlefile`, so
the built file can be grepped for the keyframes and the media query).

## Toolchain & gates

- `just test` — vitest over `src/` (core property tests + app SSR tests).
- `just check` — `svelte-check` + `tsc`. svelte-check's `css-unused-selector`
  warning is the main CSS-facing gate.
- `just build` — single-file `dist/index.html`; T-007-01-04 added a size gate on
  it. A few hundred bytes of CSS is negligible against it.
- Working tree already carries other threads' modifications (ticket frontmatter,
  `src/core/shanten.*`) — commits for this ticket must stage only
  `src/app/Table.svelte` and `docs/active/work/T-007-03-02/`.

## Downstream consumer

T-007-03-03 (`sort-to-tap-mapping-guard`) depends on this ticket and on 03-01:
it pins that animations/transitions never remap taps. This ticket adds no
transitions to the *hand* (the tap surface) at all — melds and the center card
carry no `ontap` wiring — so it creates no new tap-mapping surface, but the
guard ticket will still want the invariant stated in review.md.

## Constraints & assumptions surfaced

- "CSS only" (sibling 03-01 spells it out: no animation library, no new
  dependency). Svelte's `transition:` directives are runtime-JS-driven and
  unnecessary here; plain `@keyframes` in the component `<style>` suffices.
- `prefers-reduced-motion`: the settled end states (rotate(90deg), opacity .45,
  visible summary) must hold with **no motion** under reduce — i.e. animations
  are additive-only, gated behind `@media (prefers-reduced-motion: no-preference)`.
- Timing budget ~150–250ms per the criteria, ≤ the 250ms bot tick.
- `aria-current`/`role="status"` semantics must be untouched — `role="status"`
  on the hand-end blocks already gives screen readers the announcement; motion
  is purely visual on top.
