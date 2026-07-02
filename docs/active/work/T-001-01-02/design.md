# T-001-01-02 vite-svelte-vitest-scaffold-and-justfile — Design

Six decisions, each grounded in research.md. The theme throughout: this ticket is the delivery
spine, so every choice optimizes for *reproducibility from a fresh clone* (charter P3) and for
being *unsurprising* to the tickets that land on it next.

## D1 — Scaffold provenance: hand-rolled minimal files, not `create-vite`

**Options.** (a) `npm create vite -- --template svelte-ts` then prune; (b) hand-write the
~10 canonical files directly; (c) SvelteKit.

**Choice: (b), hand-rolled.** The create-vite template ships demo baggage (counter component,
logo assets, demo CSS) that T-001-03-01 would delete anyway, and its flat `src/` layout fights
our mandated `src/core/`–`src/app/` split, so we'd rewrite most of it. The canonical file set is
small and well understood (research.md §conventions); writing it directly gives exact control
and no interactive-CLI friction in an autonomous session. **Rejected:** (a) more deletion than
creation; (c) SvelteKit is SSR/router-shaped apparatus for a one-file offline game — the
architecture doc explicitly deletes the server story, and singlefile output fights Kit's
multi-asset build.

## D2 — Versions: current majors everywhere, except TypeScript stays on 5.9.x

**Options.** (a) all-latest including TS 6.0.3; (b) all-latest with TS 5.9.3; (c) trail a major
behind across the board (vite 7, vitest 3...).

**Choice: (b).** The compatibility matrix (research.md) shows vite 8.1.3, svelte 5.56.4,
@sveltejs/vite-plugin-svelte 7.1.2, vitest 4.1.9, vite-plugin-singlefile 2.3.3, and
svelte-check 4.7.1 are mutually compatible on current majors — starting a greenfield spine a
major behind buys nothing except an early migration ticket. TypeScript is the exception:
6.0.x stabilized within the last ~2 months, and the Svelte language tooling develops and tests
against 5.x (svelte's own devDeps say `^5.5.4`; svelte-check's `>=5.0.0` peer range predates
6.0 and admits it *nominally*). The scaffold's job is a spine that never wobbles, so TS pins to
**5.9.3**. Revisiting TS 6 later is a two-line bump once svelte-language-tools declares
support. **Rejected:** (a) fresh-major risk in the one tool every other tool links against;
(c) unearned conservatism.

## D3 — Pinning: exact versions in package.json + committed package-lock.json, npm as PM

**Options.** (a) caret ranges + lockfile; (b) exact pins + lockfile; (c) pnpm/bun.

**Choice: (b).** The lockfile alone already freezes a fresh clone's tree (`npm ci`), so caret
ranges would be *mostly* harmless — but exact pins make `package.json` self-documenting, make
upgrades deliberate diffs rather than side effects of a re-lock, and match the precedent
T-001-01-01 set for the toolchain on charter-P3 grounds (its review: "upgrades should be
deliberate manifest edits, not catalog drift"). npm is the only PM pinned in the flox
environment (11.13.0 rides with node 24.16.0). **Rejected:** (a) weaker documentation for equal
effort; (c) an unpinned second package manager contradicts the whole point of T-001-01-01.

Dev-dependencies only — nothing here ships at runtime except what Vite inlines from `svelte`.
The eight packages: `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-singlefile`,
`vitest`, `svelte-check`, `typescript`, `@tsconfig/svelte` (the maintained tsconfig base the
Svelte team keeps aligned with compiler needs — hand-rolling those compiler flags is how subtle
svelte-check/tsc disagreements are born).

## D4 — "`just test` runs vitest successfully": one real smoke test over a real core module

**Options.** (a) `passWithNoTests: true`, zero test files; (b) a floating `.test.ts` asserting
`true`; (c) a minimal `src/core/index.ts` placeholder export plus a test that imports it.

**Choice: (c).** `passWithNoTests` proves vitest *launches*, not that the test→core wiring
works — the first real engine test (T-001-02-01) would then be the first time module
resolution, TS transform, and the include-glob are exercised, which is exactly the debugging
this ticket exists to front-load. A test importing a real module from `src/core/` proves the
full path and establishes the colocated-test idiom (CLAUDE.md: "vitest over src/core/") that
every later scoring/shanten test follows. The placeholder export is one honest constant
(`ENGINE_NAME`), trivially replaced when tile types arrive. The ticket says "empty src/core/
and src/app/ *boundaries*" — the boundary is the deliverable; a one-line placeholder module is
scaffolding within it, not scope creep. **Rejected:** (a) proves the least; (b) proves import
machinery of nothing.

Vitest config lives in `vite.config.ts` (`test:` block with a `vitest/config` type reference)
— one config file, no drift between build and test pipelines. Environment `node` (core is pure
TS, zero DOM by invariant — a DOM environment would *mask* violations of that invariant);
include glob `src/**/*.test.ts`, which today matches only core and stays correct if app-side
tests ever appear.

## D5 — Build/check wiring: singlefile always on; check = svelte-check + tsc over two tsconfigs

`vite-plugin-singlefile` registers only build-phase hooks, so it's applied unconditionally —
no mode-switching in the config. Its default `useRecommendedBuildConfig` already forces the
settings a one-file artifact needs (inline assets, no CSS code-split, no chunking); we take the
defaults rather than restating them.

`just check` maps CLAUDE.md's "svelte-check + tsc" onto the standard two-context split:
`svelte-check --tsconfig ./tsconfig.json` covers `src/` (both `.svelte` and `.ts`, using the
`@tsconfig/svelte` base), and `tsc -p tsconfig.node.json --noEmit` covers the node-context
config file (`vite.config.ts`) that the app tsconfig deliberately excludes. Both run strict.
svelte-check runs with default severity (errors fail, warnings report) — "exits clean" per the
AC means exit 0; tightening to `--fail-on-warnings` is a policy knob left for when there's real
app code to have opinions about.

## D6 — justfile shape: thin flox wrappers over npm scripts, with a self-bootstrapping deps guard

**Options.** (a) recipes invoke tools directly (`flox activate -- vite`); (b) canonical
commands live in `package.json` scripts, justfile recipes are `flox activate -- npm run <x>`;
(c) like (b) plus an automatic `npm ci` bootstrap guard.

**Choice: (c).** Scripts-in-package.json is the ecosystem-standard home for tool invocations
(editors, CI, and humans in an activated shell all find them); the justfile's job is the flox
entry and the fresh-clone guarantee. The AC says "from a fresh clone: `just check` exits clean"
— with no `node_modules`, that requires recipes to self-bootstrap. A private `_deps` recipe
runs `npm ci` iff `node_modules/.package-lock.json` (npm's own install stamp) is missing or
older than `package-lock.json`; every public recipe depends on it. Cost when up to date: one
stat. **Rejected:** (a) duplicates commands outside npm's ecosystem conventions; (b) makes
every fresh clone fail its first `just` invocation with a missing-module error — flunks the AC
as written.

Recipes shipped: `dev`, `test`, `check`, `build` (the ticket's four) plus the private `_deps`.
**No `deploy`** — research.md establishes T-001-03-02 owns it; shipping a stub now would either
lie or bitrot.

## Placeholder app (what `just dev` serves, what `just build` inlines)

Root `index.html` → `src/app/main.ts` (Svelte 5 `mount()`) → `src/app/App.svelte` rendering a
single labeled placeholder line and nothing else. Styling inline in the component — no CSS
file to orphan when T-001-03-01 replaces the view. The entry lives *inside* `src/app/` so the
import-direction invariant (app→core only) has its home from day one; `App.svelte` deliberately
does **not** import from core yet — the first core→app data flow is T-001-03-01's acceptance
criterion, and faking it early with the placeholder constant would blur that ticket's boundary.

## Risks accepted

- **Vite 8 / vitest 4 are themselves young majors** (unlike TS, nothing else links against
  their internals from our side; peer ranges are explicit; the blast radius of a regression is
  a version pin rollback).
- **`npm ci` needs the registry once per clone** — inherent to any JS bootstrap; the committed
  lockfile makes the result identical everywhere.
- **Freshness stamp (`-nt`) granularity** — if someone hand-edits `package-lock.json` within
  the same filesystem-timestamp tick as an install, the guard could miss it; `npm ci` run
  manually recovers. Accepted as a non-problem in practice.
