# T-007-03-03 — sort-to-tap-mapping-guard — Research

## The ticket in one sentence

Pin E-007's one named correctness risk with a test: the player's hand renders
display-sorted while the record keeps draw order, and a tap on the visually-sorted
position must discard **that position's exact TileId** — including across the
keyed-each reorders that the epic's new motion work rides on.

## The tap→discard chain as it exists

Four links, three of them already tested:

1. **Display sort** — `src/app/Table.svelte:17-19`. The one computation the
   stateless view owns: `hand = $derived([...table.hands[0]].sort((a, b) =>
   kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b))))`. A **copy**-sort (spread
   first): `table.hands[0]` — the record's draw-order truth — is never mutated.
   Core explicitly assigns sorting to the view (deal.ts: "never sorted; sorting
   is presentation").
2. **Keyed each + closure** — `Table.svelte:85-91`. `{#each hand as id (id)}`
   renders one `<li>` per sorted tile; each holds a
   `<button class="tap" aria-label="discard {kindOf(id)}" onclick={() => ontap?.(id)}>`.
   The key is the **TileId itself** — physical ids are unique (136 distinct
   ints), so reconciliation moves DOM nodes per tile, never repurposes a node
   for a different tile. The closure captures the loop binding `id`.
   The drawn tile is a separate surface (`Table.svelte:95-101`): its own button
   passes `table.drawn` directly — no sort involved.
3. **Owner wiring** — `src/app/App.svelte:44-47`. `tap(tile)` calls
   `tapDiscard(offered, PLAYER, tile)` and appends the result iff non-null.
   Legality lives entirely here; Table renders buttons unconditionally and an
   illegal tap is the caller's no-op (Table.svelte:10-12 comment).
4. **The seam selector** — `src/app/drive.ts:233-243`. `tapDiscard` returns the
   element of `offered` with `type === 'discard' && seat === player && tile ===
   tile`, or null. Never constructs an action.

Links 3–4 are pinned hard in `src/app/drive.test.ts:552-591` ("tapDiscard"
suite): identity (`toBe`) with legalActions output, doctored-list rejection,
wrong-turn/ended rejection. Link 1's *output* is partially visible to
`app.ssr.test.ts:123-127` (13 tiles in the hand region), but no test anywhere
asserts sorted **order**, and link 2 — the closure wiring from a rendered
button back to its exact id — is tested by **nothing**: SSR output contains no
event handlers, and the repo has no client-render test at all.

## What "the animated reorder/transition path" concretely is

The two sibling tickets this one depends on added CSS-only motion:

- T-007-03-01: `transition` + `@starting-style` on `.pond li` and `.drawn`
  (Table.svelte:409-431). **Deliberately nothing on `.hand li`** — its design
  cut "tedashi merge pops" and left hand-insertion motion, if ever, to this
  ticket's conversation (T-007-03-01 review.md §Interactions item 2).
- T-007-03-02: `@keyframes` on `.meld`, `.claimed-tile`, `.pond .claimed`,
  `.center > .ended`, `.win-summary`. Its review states explicitly for this
  ticket's author: "this ticket adds *no* motion to any tap surface — nothing
  on `.hand`, `.tap`, or `.drawn`, and no Svelte transition/animate directives
  anywhere" (T-007-03-02 review.md item 5).

So the "keyed transitions" of the ticket's Context are not `transition:`
directives — none exist. The moving parts on the tap surface are:

- **Svelte's keyed-each DOM reconciliation** when `hand` changes: a tedashi
  removes one id and merges the former drawn id in at its sorted slot (every
  surviving `li` may shift position); a claim removes two ids at once. This is
  the only mechanism that can remap a rendered button relative to its tile —
  CSS animations are paint-only and cannot re-bind a click.
- The **drawn button's mount/unmount** (`{#if}` at Table.svelte:95), which
  T-007-03-01 animates. It never joins the sorted list while drawn.

The risk the guard must survive into the future: someone re-keys the each (by
index, or unkeyed) or adds FLIP-style `animate:` directives while restyling —
either could decouple the button a user sees at position k from the id its
closure reports, or (unkeyed) repurpose nodes so per-tile motion misfires.

## Fixture reality (probed, seed 1 — the shared anchor seed)

`foldRecord({seed: 1, actions: [{type: 'draw', seat: 0}]})` — the
`afterEastDraw` state drive.test.ts already anchors on:

- raw hand (draw order): `64:8p 53:5p 95:6s 45:3p 86:4s 118:3z 50:4p 8:3m
  36:1p 46:3p 49:4p 11:3m 82:3s` — **differs from sorted order** (the AC's
  fixture requirement is met by the boot seed itself).
- sorted: `8:3m 11:3m 36:1p 45:3p 46:3p 50:4p 49:4p 53:5p 64:8p 82:3s 86:4s
  95:6s 118:3z`. Note `50:4p` **before** `49:4p`: the sort is stable and the
  4p copies keep hand order, so ids are NOT numerically ordered — an assertion
  on exact ids at duplicate-kind positions distinguishes physical copies that
  aria-labels (kind-only) cannot.
- duplicate kinds present (3m×2, 3p×2, 4p×2): exact-TileId teeth.
- drawn: `100:8s`. After tedashi of sorted[0] (`8:3m`): every li shifts left
  one slot and `100:8s` merges at sorted position 11 — a maximal keyed
  reorder, reachable by appending the real tapDiscard element and refolding.
- After that discard `turn === 1`, `drawn === null`: hand buttons still render
  (taps become the owner's no-op) so post-reorder mapping stays assertable.

## Test infrastructure reality

- `vite.config.ts`: vitest `environment: 'node'`, include `src/**/*.test.ts`.
  Svelte compiles in tests via the same `svelte()` plugin (the SSR suites
  import `.svelte` components through `svelte/server`).
- **No DOM environment exists**: no jsdom, no happy-dom in node_modules (
  verified), no testing-library. All app tests are SSR string assertions
  (`app.ssr.test.ts`, `tile.ssr.test.ts`) or pure-TS seam tests
  (`drive.test.ts`).
- Vitest supports per-file environment override via the
  `// @vitest-environment jsdom` docblock — the global `node` setting need not
  change for other files.
- Svelte 5 client API available for tests: `mount(Component, {target, props})`
  + `flushSync()`; passing a `$state` proxy as `props` makes later mutation
  reactive. Runes outside `.svelte` files require the `.svelte.ts`/
  `.svelte.test.ts` filename convention for the plugin to transform them (to
  verify empirically — fallback is a tiny `.svelte.ts` helper).
- Svelte 5 uses delegated events attached at the mount target; jsdom's
  `element.click()` bubbles and reaches them (standard pattern).
- `just check` = svelte-check over src (rune-aware, covers `.svelte.ts`) +
  `tsc -p tsconfig.node.json` (config files only) — a rune-bearing test file
  is svelte-check's to type-check, not plain tsc's.

## Constraints that bind the design

- **Epic**: "no runtime dependency was added" — the dist single file and its
  size gate. A devDependency used only by vitest never ships; the epic's
  Done-looks-like measures `dist/index.html`. Still, the repo's precedent is
  zero DOM-test deps, and T-007-03-02's review declined a *headless browser*
  class for animation probing — any new dev-dep needs explicit justification
  in design.
- **core untouched**: this ticket is view/test-side only; `src/core/` is
  byte-frozen for the epic.
- **AC verbatim**: (a) a hand whose draw order differs from sorted order,
  (b) tapping the visually-sorted position discards that position's exact
  TileId, (c) the animated reorder/transition path preserves the mapping,
  (d) `drive.test.ts` tap→discard stays green.
- Working tree note: `src/core/shanten.*` and many ticket files carry
  uncommitted changes from concurrent lisa threads (`git status`) — commits
  from this ticket must stage only its own files.

## Assumptions surfaced

- "Visually-sorted position" ≡ DOM document order of `.hand` buttons: the hand
  `ul` is a flex row (wrap) with no `order`/RTL/`transform` repositioning, so
  document order IS visual order. A DOM-level test cannot see pixel positions;
  this equivalence is the honest testable claim and holds for the current CSS.
- Existing suites (568 tests) currently green on the shared branch — to verify
  before and after.
