# T-001-01-02 vite-svelte-vitest-scaffold-and-justfile — Research

## Ticket

Stand up the Vite + Svelte 5 + TypeScript + vitest + vite-plugin-singlefile scaffold with empty
`src/core/` and `src/app/` boundaries, driven by justfile `dev`/`test`/`check`/`build` recipes.

Acceptance: from a fresh clone, `just check` (svelte-check + tsc) exits clean, `just test` runs
vitest successfully, `just build` emits `dist/index.html` via vite-plugin-singlefile, and
`just dev` serves a page — all through the flox toolchain.

## Current repo state (what exists)

There is **no application code or JS tooling yet**. No `package.json`, no lockfile, no
`node_modules/`, no `src/`, no `justfile`, no `vite.config.*`, no `tsconfig.*`, no
`svelte.config.*`, no `index.html`. The repo is docs + process infrastructure:

- `docs/knowledge/` — vision, charter, architecture, workflow definitions.
- `docs/active/` — epic E-001, stories S-001-01..03, tickets, work artifacts, PM docs.
- `.flox/` — the committed environment from T-001-01-01 (see below).
- `.lisa/`, `.vend/`, `.lisa.toml`, `START_HERE.md` — orchestration infra, not build inputs.
- Untracked `board.svg` and `.lisa-layout.kdl` at root — pre-existing, not this ticket's files
  (T-001-01-01's review explicitly left them alone).

`.gitignore` (repo root) is already pre-seeded for exactly this ticket's outputs:
`node_modules/`, `dist/`, `.vite/`, `*.tsbuildinfo`, `coverage/`, plus flox transient dirs and
`.wrangler/`. No edits should be needed to keep the scaffold's build products out of git.
Notably it does **not** ignore `package-lock.json` — a lockfile can be committed.

## Toolchain substrate (T-001-01-01, done)

`.flox/env/manifest.toml` pins exactly: **nodejs 24.16.0** (bundles npm 11.13.0 transitively)
and **just 1.54.0**, resolved in the committed `manifest.lock` for four systems
(aarch64/x86_64 × darwin/linux). Verified working from a fresh clone in that ticket's review.
Host node (v26) and just (1.55) differ from the pins, so any exact-version observation proves
flox is the active toolchain. CLAUDE.md's contract: just recipes run *through* the flox
environment; "if a just recipe is missing, run tools inside `flox activate -- <cmd>`". npm
registry access from inside `flox activate` works (verified during this research via
`npm view`).

## Architectural constraints that bind this scaffold

From `docs/knowledge/architecture.md` and CLAUDE.md invariants:

- **Two concerns**: `src/core/` — pure framework-agnostic TypeScript, zero DOM/Svelte imports,
  property-tested with vitest, "big in tests, never ships them"; `src/app/` — thin Svelte 5 view
  (runes `$state`/`$derived`). Import direction app→core only (T-001-03-01 makes this an
  explicit acceptance check: grep over `src/core/` finds no DOM/Svelte imports).
- **Single-file compile target**: Vite + `vite-plugin-singlefile` inlines JS/CSS/SVG into one
  self-contained `dist/index.html`. No code-splitting, no vendor chunks. The single file is a
  compile target, not the authoring format.
- **`just test` runs vitest over `src/core/`** (per CLAUDE.md's command table); `just check`
  is svelte-check + tsc; `just build` is vite build; `just dev` is the Vite dev server.
- No service worker / manifest yet (explicitly out of E-001 scope), no deploy pipeline.

## Scope boundaries with sibling tickets

- **T-001-02-01** (depends on this one): first real `src/core/` content — tile types — with a
  vitest test enumerating 34 kinds / 136 ids. So this ticket ships vitest *wired and running*,
  but real engine tests arrive next ticket. "just test runs vitest successfully" must hold with
  an essentially empty core.
- **T-001-02-02**: seeded PRNG + wall build + the first *property* test. Property-testing
  library choice (e.g. fast-check) is not named anywhere in the docs; nothing in this ticket's
  AC requires installing one.
- **T-001-03-01**: the real empty-table Svelte view rendering from a core-dealt wall. So this
  ticket's `src/app/` needs only a minimal placeholder view — enough for `just dev` to "serve a
  page" and `just build` to have something to inline — not a table.
- **T-001-03-02**: single-file *verification* (no external refs, opens offline) **and the
  `just deploy` recipe**. Deploy is therefore *out of scope here* despite appearing in
  CLAUDE.md's command list; this ticket's AC and title name only dev/test/check/build.

## Ecosystem reality (checked against the npm registry today, 2026-07-02)

Latest stable versions and their compatibility, queried through the flox toolchain:

| Package | Latest | Peer/engine notes |
| --- | --- | --- |
| vite | 8.1.3 | engines node `^20.19.0 \|\| >=22.12.0` — node 24.16.0 OK |
| svelte | 5.56.4 | no peers; its own devDeps use TS `^5.5.4` |
| @sveltejs/vite-plugin-svelte | 7.1.2 | peers: svelte `^5.46.4`, vite `^8.0.0` — matches both |
| vite-plugin-singlefile | 2.3.3 | peers: vite `^5.4.21 \|\| ^6 \|\| ^7 \|\| ^8` — OK |
| vitest | 4.1.9 | peers: vite `^6 \|\| ^7 \|\| ^8` — OK |
| svelte-check | 4.7.1 | peers: svelte `^4 \|\| ^5`, typescript `>=5.0.0` |
| typescript | 6.0.3 | **very fresh major** (6.0.x stabilized within the last ~2 months; latest 5.x is 5.9.3; svelte's own repo still develops against 5.x) |

Everything on the list is mutually compatible on its current major. The one flagged risk is
TypeScript 6.0.x: svelte-check's `>=5.0.0` peer range admits it, but the Svelte language
tooling ecosystem demonstrably develops and tests against 5.x. Version selection is a Design
decision, not settled here.

## Conventions the scaffold must fit (from the standard svelte-ts Vite shape)

The canonical Vite + Svelte + TS project (what `npm create vite -- --template svelte-ts`
produces) uses: root `index.html` as the Vite entry, `vite.config.ts`, `svelte.config.js` with
`vitePreprocess` (required for `lang="ts"` in components and for svelte-check to resolve the
preprocessor), `tsconfig.json` (+ a node-context tsconfig for vite.config), `src/main.ts`
mounting the root component via Svelte 5's `mount()`, `src/vite-env.d.ts` for Vite client
types. svelte-check reads the tsconfig and checks `.svelte` + `.ts`; plain `tsc --noEmit`
covers what svelte-check's TS pass may skip in config files, and CLAUDE.md's `just check`
names *both* explicitly.

## Assumptions and open questions carried into Design

1. **npm as the package manager** — it ships pinned inside the flox node (11.13.0); no other
   PM is pinned or mentioned anywhere. Lockfile commit expected for the fresh-clone guarantee.
2. **"Runs vitest successfully" with an empty core** needs either a trivial placeholder test or
   vitest's `passWithNoTests` — a Design choice.
3. **Version pinning strategy** (exact vs caret in package.json) — T-001-01-01 chose exact pins
   for the toolchain on charter-P3 grounds; whether the same logic extends to npm deps (where
   the lockfile already freezes resolution) is a Design choice.
4. **How just recipes enter flox**: `flox activate -- <cmd>` per CLAUDE.md; recipes must work
   from a fresh clone where `.flox/run` doesn't exist yet (T-001-01-01 verified activation
   handles that).
5. **Placeholder app content** must be obviously throwaway (T-001-03-01 replaces it) while
   proving the pipeline: a mounted Svelte component with a line of text suffices.
6. Network access to the npm registry is available in this environment (needed once for
   `npm install`; afterwards the committed lockfile + registry give any fresh clone the same
   tree).
