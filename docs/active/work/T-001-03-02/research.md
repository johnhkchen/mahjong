# T-001-03-02 — Research: single-file offline build + deploy recipe

Descriptive map of what exists today that this ticket touches. No solutions here.

## 1. The ticket in one line

Prove the single-file compile target end-to-end (one self-contained `dist/index.html`,
zero external references, boots from `file://` with no network) and add a `just deploy`
recipe targeting Cloudflare static that can be *validated* (e.g. wrangler dry-run)
without standing up the live pipeline.

## 2. Scope fences (from the epic, E-001)

Explicitly **out of scope** for this ticket:

- **Live CI/CD wiring** to mahjong.b28.dev — "the deploy recipe exists but standing up
  the Cloudflare pipeline is its own later play under P3" (E-001 §scope).
- **Service worker + web app manifest** — offline *caching* is a later epic; this ticket
  only proves the artifact itself is network-free once loaded. Architecture.md §4 pins
  the eventual shape (~20-line SW, no Workbox/vite-plugin-pwa) but E-001 excludes it.
- All gameplay, art, AI.

In scope: the build's single-file guarantee, its verification, and the deploy recipe.

## 3. Build system as it stands

- **`vite.config.ts`** — `svelte()` + `viteSingleFile()` plugins; vitest config inline
  (`environment: 'node'`, includes `src/**/*.test.ts`). No `build.*` overrides at all —
  the singlefile plugin's defaults are doing everything.
- **`index.html`** (authoring shell) — minimal: charset, viewport, `<title>mahjong</title>`,
  `<div id="app">`, one `<script type="module" src="/src/app/main.ts">`. No favicon link,
  no manifest link, no external fonts. Nothing to inline except what Vite emits.
- **`svelte.config.js`** — `vitePreprocess()` only.
- **`package.json` scripts** — `build: "vite build"`. No post-build steps anywhere.
- **Pinned deps** (all devDependencies, npm-locked): vite 8.1.3,
  vite-plugin-singlefile 2.3.3, svelte 5.56.4, @sveltejs/vite-plugin-svelte 7.1.2,
  typescript 5.9.3, vitest 4.1.9, fast-check 4.8.0, svelte-check 4.7.1.
  **wrangler is absent** — not a devDependency, not in flox, not global (`which wrangler`
  fails inside and outside `flox activate`).

### Current build output (canary from T-001-03-01, re-verified now)

`dist/index.html` exists (37,087 bytes, built 2026-07-02 12:41). Inspection:

- Exactly one file in `dist/`.
- Grep for `(src|href)="…"` attributes: **zero matches** — no external script/link/img
  references at all. The one `<script type="module" crossorigin>` is fully inline
  (Vite's modulepreload polyfill prelude followed by the app bundle); CSS is inlined by
  the singlefile plugin.
- So the *artifact* already satisfies the inline-everything half of the AC; what does not
  yet exist is any **gate** that keeps it true (nothing fails if a future change emits a
  second chunk or an external ref) and the **no-network boot** proof.

## 4. Toolchain / command conventions

- **`justfile`** is the flox entry point: `dev`, `test`, `check`, `build` — each runs
  `flox activate -- npm run <script>` after a `[private] _deps` recipe that runs `npm ci`
  iff `node_modules/.package-lock.json` is older than the lockfile. Header comment:
  "Canonical commands live in package.json scripts; this file is the flox entry point."
  **There is no `deploy` recipe** despite CLAUDE.md's command list advertising one — this
  ticket closes that gap.
- **flox manifest** (`.flox/env/manifest.toml`) pins only `nodejs 24.16.0` and
  `just 1.54.0`. All JS tooling arrives via npm + lockfile. Pattern precedent: node-side
  tools are npm devDependencies, not flox packages.
- CLAUDE.md command list promises: `just deploy` — "ship the one file to Cloudflare
  static (mahjong.b28.dev)".

## 5. Deploy target facts

- Architecture.md: "Deploy that one file to **Cloudflare static** at `mahjong.b28.dev`",
  and CLAUDE.md stack section says "Workers static assets or Pages" — the precise
  Cloudflare product is *not yet decided* in the knowledge docs; that decision lands in
  this ticket's Design.
- No wrangler config exists (no `wrangler.toml`/`wrangler.jsonc` anywhere).
- No Cloudflare credentials are assumed present; the AC explicitly wants validation
  "without requiring the live pipeline" — i.e. no auth, no zone, no DNS.
- The b28.dev cover will embed the same `index.html`; embed/CSP work is zone-level and
  explicitly survives either platform choice (architecture.md §the-one-file).

## 6. App code relevant to a `file://` boot

- `src/app/main.ts` — `mount(App, { target: document.getElementById('app')! })`. No
  `fetch`, no dynamic `import()`, no asset URLs anywhere in `src/app/` or `src/core/`.
- `App.svelte` — `$state(1)` seed → `$derived(buildWall(seed))` → `<Table {wall} />`;
  pure computation, no network, no localStorage yet.
- `Table.svelte` — presentational, scoped CSS, no external assets, no `url()` in styles.
- Inline `<script type="module">` executes fine from `file://` (no cross-origin fetch is
  involved when the module is inline); nothing in the bundle requests anything, so
  network-disabled boot is expected to work — but it has never actually been *verified*.
  T-001-03-01's review names that exact gap: "T-001-03-02 … still owns verifying
  no-network boot and the deploy recipe."

## 7. Existing test surface (what a new gate would sit beside)

- 5 vitest files / 26 tests, all under `src/**`: core property tests (tiles, rng, wall),
  `src/core/purity.test.ts` (import-purity gate), `src/app/app.ssr.test.ts` (SSR-renders
  App, asserts derived wall count + seat labels — this is the current "the empty table
  renders" proof, DOM-free).
- vitest `include` is `src/**/*.test.ts` — a test over `dist/` would sit *outside* that
  glob today and would also depend on a prior build having run; no precedent exists for
  artifact-level tests. No browser automation deps (no playwright/puppeteer/jsdom).
- `just check` = svelte-check + `tsc -p tsconfig.node.json` (covers `vite.config.ts`;
  any new `.mjs`/`.ts` node-side script would want a home in one of the tsconfigs or
  deliberate exclusion).

## 8. Repo hygiene notes

- Untracked `board.svg` (repo root) and `.lisa-layout.kdl` predate this ticket and are
  unrelated — leave untouched. `dist/` is already git-ignored? — **check**: no `.gitignore`
  entry was inspected yet; `git status` does not list `dist/`, so it is ignored.
- Ticket frontmatter files under `docs/active/tickets/` show as modified (Lisa's phase
  bookkeeping) — do not touch.
- Prior-ticket flagged nit (T-001-03-01 review §concerns): justfile's `test` comment says
  "vitest over src/core/" but the glob is `src/**` — "left for whichever ticket next
  touches the justfile". This ticket touches the justfile.

## 9. Constraints and assumptions surfaced

1. **Single file is a compile target, not authoring format** (CLAUDE.md invariant) — any
   verification must run against `dist/`, not constrain `src/`.
2. **Determinism/no-server invariants** are untouched by this ticket; risk surface is
   config + tooling only. No `src/core/` or `src/app/` runtime changes appear necessary.
3. **Pinned toolchain**: anything new (wrangler) must arrive pinned — npm lockfile is the
   established mechanism for JS tools.
4. **Validation without auth**: whatever wrangler invocation "validates" the deploy must
   not require `CLOUDFLARE_API_TOKEN` or a real account — needs a dry-run-shaped command.
5. **No-network render check**: no headless browser exists in the toolchain; the AC's
   "opening it from the filesystem with the network disabled renders the empty table" has
   no automated precedent in this repo. How much of that becomes automated gate vs.
   documented manual smoke is a Design decision.
6. Vite 8 emits ES2023-ish output by default (`build.target` default "baseline-widely-available");
   no explicit target is set — fine for modern browsers, noted only as context.

## 10. Open questions carried into Design

- Workers static assets vs. Pages as the Cloudflare product (must pick one to write a
  config that dry-runs).
- Where the single-file gate lives: post-build script chained in `npm run build`, a
  separate `just` recipe, or a vitest file outside the current include glob.
- Whether `just deploy` itself should be the real deploy (with a sibling dry-run recipe)
  or parameterized — and what exactly "validates" means for the AC evidence.
- How to honestly verify the `file://` no-network boot given no browser automation.
