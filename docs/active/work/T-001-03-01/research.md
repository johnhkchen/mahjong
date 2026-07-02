# T-001-03-01 — Research: Svelte empty-table view

Descriptive survey of what exists and the constraints that bound this ticket. No solutions
proposed here (that is design.md).

## 1. The ticket in one line

Replace the placeholder `src/app/` scaffold with a thin Svelte 5 view (runes
`$state`/`$derived`) that renders an empty, mobile-first mahjong table whose displayed
wall/tile count is *derived from* a `src/core/` seeded wall build — proving the core→app
boundary in the one direction the architecture allows.

Acceptance criterion: `just dev` renders an empty table whose displayed wall/tile count is
derived from a src/core/ seeded wall build (not hardcoded); `just check` is clean; import
direction is app→core only, with no app or DOM imports appearing in src/core/.

Dependency `T-001-02-01` (tiles) and `T-001-02-02` (rng + wall) are complete and committed
(61a30f2, b6366fd). The sibling ticket T-001-03-02 (single-file build + deploy recipe)
depends on this one and owns everything about `just build`/`just deploy` — build-output
concerns are explicitly *not* this ticket's scope.

## 2. What exists in `src/app/` today

Three files, all scaffold-grade:

| File | Contents |
| --- | --- |
| `src/app/main.ts` | Real and final-shaped: `mount(App, { target: document.getElementById('app')! })` using Svelte 5's `mount()`. Exports the app instance. |
| `src/app/App.svelte` | Pure placeholder: no `<script>` block at all — static `<main><h1>mahjong</h1><p>walking-skeleton scaffold — table view arrives in T-001-03-01</p></main>` plus a scoped `<style>`. It literally names this ticket as its replacement. |
| `src/app/vite-env.d.ts` | `/// <reference types="vite/client" />` ambient types. |

`index.html` (repo root) is the Vite entry: `<div id="app">` + module script pointing at
`/src/app/main.ts`, viewport meta already set (`width=device-width, initial-scale=1.0`).
There is no global stylesheet anywhere; the only CSS in the repo is the scoped block in
App.svelte. No component other than App exists.

## 3. What `src/core/` offers this ticket

Core is three modules re-exported through the barrel `src/core/index.ts`, whose header
comment states the consumption rule: "app code imports only from here."

- `buildWall(seed: number): TileId[]` (wall.ts) — "seeded permutation of all 136 tile ids",
  fresh mutable array per call, same seed → identical order forever (replay-contract
  frozen, golden-vector tested).
- `TILE_COUNT = 136`, `KIND_COUNT = 34`, `COPIES_PER_KIND = 4`, `TILE_KINDS`, and the full
  decode kit (`kindOf`, `copyOf`, `suitOf`, `rankOf`, classifiers) from tiles.ts.
- `type TileId = number` — exported as a type through the barrel (`export *` re-exports
  types), so app code can type props without touching core internals.
- Seed domain: canonical uint32, any JS number normalized `>>> 0`. Nothing anywhere in the
  repo picks a *default* seed for interactive use — that choice has no upstream decision.

Wall semantics that matter here: deal order, dead wall, and dora indicators are "positions
WITHIN this sequence, owned by later tickets" (wall.ts header). So for this ticket the
whole wall is undealt — an *empty table* shows 136 tiles in the wall, and the count must
come from the built array (e.g. `wall.length`), not the `TILE_COUNT` constant and not a
literal, to satisfy "derived from a seeded wall build (not hardcoded)".

## 4. Toolchain reality

- Deps (all exact-pinned devDeps, zero runtime deps): svelte 5.56.4,
  @sveltejs/vite-plugin-svelte 7.1.2, vite 8.1.3, vitest 4.1.9, fast-check 4.8.0,
  typescript 5.9.3, svelte-check 4.7.1, vite-plugin-singlefile 2.3.3, @tsconfig/svelte 5.0.8.
  **No DOM test environment (jsdom/happy-dom) and no component-testing library installed.**
- `vite.config.ts`: plugins `[svelte(), viteSingleFile()]`; vitest config inline —
  `environment: 'node'`, `include: ['src/**/*.test.ts']`. Note the glob covers `src/app/`
  too, though only core tests exist today (justfile comment says "vitest over src/core/",
  which is currently descriptive, not enforced).
- `svelte.config.js`: `vitePreprocess()` so `lang="ts"` components typecheck under
  svelte-check and build under Vite.
- `tsconfig.json`: strict, ES2022, bundler resolution, includes `src/**/*.ts` +
  `src/**/*.svelte`; `allowJs`/`checkJs` on (documented as required for svelte-check 4.7.1
  to resolve `.svelte` imports from `.ts`).
- `just check` = `svelte-check --tsconfig ./tsconfig.json && tsc -p tsconfig.node.json
  --noEmit`; `just dev` = `vite` dev server; `just test` = `vitest run`. All recipes gate
  on the flox `_deps` reinstall check; no new deps means no lockfile churn.

## 5. Architectural constraints that bind this ticket

From CLAUDE.md invariants, `docs/knowledge/architecture.md`, and the epic E-001:

1. **Import direction is one-way**: `core/` never imports `app/`, Svelte, or the DOM; the
   view is swappable *because* of this. The AC makes the direction itself a deliverable.
   Today nothing *enforces* it — core files happen to be clean (tiles.ts and rng.ts are
   import-free; wall.ts imports only sibling core modules), but there is no test, lint, or
   check that would catch a violation. The repo has no ESLint; the only automated gates are
   vitest and svelte-check/tsc.
2. **Thin view**: architecture.md §6 — `src/app/` is "a thin view in Svelte 5 (components +
   runes `$state`/`$derived`)"; state is (eventually) a fold over the action log, "so
   re-render is cheap: the table DOM is small". The ticket context names the runes
   explicitly, so the wall→count path should demonstrably run through them.
3. **Seeded determinism**: "Randomness is seeded; full hands must be deterministically
   simulatable." The view must pass a seed into `buildWall` — there is no unseeded path —
   but *which* seed the app uses at boot is undecided upstream (no game-start ticket
   exists yet).
4. **Mobile-first (P4)**: charter P4 is "Mobile-first table, discard pond, riichi-stick and
   call animations, tile sorting" — this ticket advances P4 only as far as "mobile-first
   table"; pond/animations/tile art are later. **Original tile art only** is a standing
   rule, but an *empty* table renders no tiles, so no art decision is forced here.
5. **Single-file target discipline**: everything must survive `vite-plugin-singlefile`
   inlining (T-001-03-02 proves it) — i.e. no external asset references, fonts, or fetches
   from the view. System fonts and inline CSS are the existing idiom (current App.svelte).
6. **Epic scope fence** (E-001): "empty-table view" is in scope; deal-to-hand logic, tile
   art beyond placeholder, service worker/manifest are out.

## 6. Testing idiom and verification reality

- Core test style (tiles.test.ts, rng.test.ts, wall.test.ts): import from `./index` (the
  barrel, doubling as public-API checks), vitest `describe/it/expect`, fast-check
  properties with explicit seed-domain arbitraries, golden vectors for frozen contracts.
- There are **no app tests and no DOM environment**. Options for machine-verifying "the
  displayed count is derived from the wall" are constrained by: vitest runs in node;
  svelte 5 ships a server renderer (`svelte/server` `render()`) that works without a DOM;
  vite-plugin-svelte compiles `.svelte` imports inside vitest via the shared vite config.
  Whether SSR-rendering App in a node test actually works with this exact pin set
  (plugin 7.1.2 + vitest 4.1.9) is unverified — a design/implement-time risk to retire.
- "`just dev` renders" is a human-eyes criterion; nothing in the toolchain can click a
  browser. Any automated proxy (SSR snapshot, markup assertion) is supplementary.

## 7. Constraints & assumptions surfaced

- **Default seed is a new de-facto decision.** Whatever literal the view boots with becomes
  the "skeleton seed"; it carries no replay obligation yet (no logs exist) but should be
  visibly arbitrary and trivially replaceable when a game-start ticket arrives.
- **`$derived(buildWall(seed))` allocates a fresh 136-array per seed change** — irrelevant
  at this scale (one derivation per boot), but consistent with "re-render is cheap".
- **`wall.length` vs `TILE_COUNT`**: the AC's "not hardcoded" reads most strictly as: the
  displayed number must flow from the built wall array, so a broken/missing wall build
  could not still display 136.
- **Working tree hygiene**: lisa has touched ticket frontmatter files, and untracked
  `.lisa-layout.kdl`/`board.svg` exist; commits must stage only this ticket's files
  (established pattern from both prior tickets).
- Both prior tickets follow the pattern: code commit(s) with `T-xxx:` prefix, then one
  artifacts commit.

## 8. Files this ticket will plausibly touch (inventory, not commitment)

- Modified: `src/app/App.svelte` (placeholder replaced).
- New: possibly additional `src/app/*.svelte` component(s); possibly test file(s) if design
  chooses automated verification; `docs/active/work/T-001-03-01/*`.
- Untouched: `src/core/*` runtime modules (this ticket only *reads* core), `main.ts`
  (already final-shaped), `index.html`, vite/svelte/tsconfig/justfile (no config change
  needed — tsconfig and vitest globs already cover any new app files).
