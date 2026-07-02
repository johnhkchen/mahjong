# T-001-03-01 — Design: Svelte empty-table view

Decisions for the empty-table view, grounded in research.md. Four questions matter: where
the wall→view state lives, how the table is composed, how the AC's two machine-checkable
clauses get verified, and what the boot seed is.

## 1. State shape: component-local runes, wall derived from seed

**Decision:** `App.svelte` owns `let seed = $state(1)` and
`const wall = $derived(buildWall(seed))`; the displayed count is `wall.length`.

Options considered:

- **(a) Component-local runes in App.svelte** — chosen. The ticket context names
  `$state`/`$derived` explicitly; a seed-in, wall-out derivation is the exact miniature of
  the architecture's "table state is a fold over the record" shape (seed is the record so
  far — no actions exist yet). When the action log arrives, `$derived(fold(seed, actions))`
  replaces `$derived(buildWall(seed))` in place.
- **(b) A `.svelte.ts` state module** (shared runes) — rejected: nothing shares this state
  yet; a state module with one consumer is apparatus, and the thin-view rule says don't.
- **(c) Static computation in module script / no runes** — rejected: works today (seed
  never changes) but fails the ticket's explicit runes requirement and would need rework
  the moment seed selection or dealing arrives.

`wall.length`, not `TILE_COUNT`, feeds the display: per research §7, the strict reading of
"not hardcoded" is that a broken wall build must not still show 136. The test asserts the
number *and* its provenance (see §3).

## 2. Composition: App shell + presentational Table

**Decision:** two components. `App.svelte` = state owner (seed → wall) and page chrome;
new `Table.svelte` = stateless presentational component taking
`{ wall: readonly TileId[] }` as a prop and rendering the empty table (four seats + center
wall count).

- **(a) Everything in App.svelte** — rejected, narrowly. It is one file fewer, but it
  conflates "the page" with "the table": the b28.dev cover embeds the table in attract
  mode, post-hand review renders a table from a replay fold, and the next rules tickets
  (deal, discard pond) all grow the *table*, not the page. Giving the table its own
  component now — props in, markup out, no state — sets the boundary those tickets extend
  and mirrors the core→app contract one level up: Table consumes derived data, never
  builds it.
- **(b) App + Table** — chosen. Still thin: Table is pure presentation, App is ~15 lines
  of script.
- **(c) App + Table + Seat/CenterDisplay children** — rejected: decomposition ahead of
  need; an empty table has nothing for a Seat component to render but a label.

Layout inside Table: CSS grid, 3×3 — seats at the four edge midpoints (bottom = East/you,
right = South, top = West, left = North, the standard counterclockwise riichi seating),
center cell shows the wall count. Mobile-first: portrait-oriented, `aspect-ratio: 1`,
`width: min(100vw - 2rem, 70vh)`-style sizing so it fits a phone screen without scrolling;
system fonts; felt-green palette via CSS custom properties on the table root. No tile art
(empty table renders no tiles — research §5.4), no external assets (single-file
discipline), no media queries needed at this fidelity.

## 3. Verification: SSR smoke test + core-purity boundary test

The AC has three clauses; two are machine-checkable and currently unenforced (research §6).

**Decision A — SSR smoke test (`src/app/app.ssr.test.ts`), no new dependencies.**
Svelte 5 ships `render()` in `svelte/server`, which produces markup as a string with no
DOM. Vitest shares `vite.config.ts`, so vite-plugin-svelte compiles `.svelte` imports in
tests, and vitest's node/SSR module pipeline gets the server-compiled component. The test
renders `App` and asserts the wall count in the markup equals `buildWall(seed).length`
computed independently from core — proving the displayed number is derived, not typed.

- **(a) SSR render, zero new deps** — chosen. Exercises the real component through the
  real compiler; costs nothing at runtime (tests never ship).
- **(b) happy-dom/jsdom + client-side mount** — rejected: adds a dependency and a second
  vitest environment to prove the same string appears; closer to a browser, but "does it
  paint" is already a human criterion (`just dev`) and T-001-03-02 re-proves boot from the
  built file.
- **(c) No app test; manual verification only** — rejected: leaves "derived, not
  hardcoded" as a claim in a doc. The epic's whole point is rigor as the exhibit.

**Known risk:** the pin set (plugin 7.1.2 / vitest 4.1.9 / svelte 5.56.4) SSR-compiling
`.svelte` inside vitest is unverified (research §6). Fallback if it fails at implement
time: extract the seat/count markup into a plain-TS helper tested directly — documented as
a deviation in progress.md. Option (b) is the second fallback, requiring a dep-add.

**Decision B — boundary test (`src/core/purity.test.ts`), encoding "no app or DOM imports
in src/core/" as a permanent invariant.** A node-environment vitest test reads every
non-test `.ts` file in `src/core/` (fs access is fine — tests never ship) and asserts
every `import`/`export ... from` specifier matches `^\./` same-directory relative form: no
bare package imports (svelte, vite, anything), no `../` escapes (which forbids `../app`
specifically). Test files are exempt from the bare-import rule (they import vitest,
fast-check) but not the `../` rule.

- **(a) vitest fs-scan** — chosen: zero deps, runs on every `just test`, and turns the
  AC's boundary clause from a review-time observation into a regression gate every later
  ticket inherits.
- **(b) ESLint + import plugin / dependency-cruiser** — rejected: new tooling, new config
  surface, for one rule; the repo deliberately has no linter yet.
- **(c) Grep in review only** — rejected: not durable; the invariant is named in CLAUDE.md
  as "do not violate", which deserves an executable form.

App→core direction needs no separate check: core-side purity plus TypeScript's import
graph (app imports `../core/index` and it typechecks) covers it; the SSR test importing
`buildWall` from the barrel additionally exercises the sanctioned path.

## 4. Boot seed: literal `1`

**Decision:** `let seed = $state(1)` with a one-line comment marking it as the arbitrary
walking-skeleton seed, replaced when a game-start ticket owns seed selection.

- **(a) Literal 1** — chosen: seed 1 already has a frozen golden vector in wall.test.ts,
  so the wall the first human ever sees on the dev server is the exact wall the contract
  freeze pins — a nice, free cross-check. Visibly arbitrary, trivially replaceable.
- **(b) `Date.now()`-derived** — rejected: introduces nondeterminism into the one demo the
  determinism invariant is supposed to exhibit, for no benefit on an empty table.
- **(c) Seed via URL param** — rejected: real feature (replay entry point), belongs to the
  action-log/replay tickets, not the skeleton.

## 5. What the view displays

Content decisions, kept to what an empty table honestly has:

- Four seat labels with wind names (East marked as the player seat visually, e.g.
  stronger contrast) — establishes orientation for every later table ticket.
- Center: the wall count, labeled ("wall · 136 tiles" shape), sourced from `wall.length`.
- A minimal header with the app name stays (continuity with current placeholder), but the
  table is the page.
- Global reset (`:global` margin/background on body) lives in App.svelte's style block —
  no global stylesheet file for two rules.

## 6. What this design does *not* do

- No dealing, hands, discard pond, dora display — wall positions are later tickets'
  semantics (wall.ts header).
- No tile rendering, hence no tile art decision.
- No service worker, manifest, or build work (T-001-03-02).
- No `main.ts` changes — it is already final-shaped.
- No vitest/tsconfig/justfile config changes — existing globs cover the new files.

## 7. Consequences

- New permanent invariant gate: `purity.test.ts` will fail any future core ticket that
  imports a package into core — intended, and cheap to loosen deliberately if core ever
  gains a sanctioned dependency (it shouldn't).
- `src/app/` gains its first test; the justfile's "vitest over src/core/" comment becomes
  slightly stale (test glob was always `src/**`) — worth a word in review.md, not a
  recipe change.
- Table.svelte's `wall` prop is typed `readonly TileId[]` — the first cross-boundary type
  reuse; core's barrel is the import path, per its header rule.
