# T-001-01-02 vite-svelte-vitest-scaffold-and-justfile — Plan

Seven steps. Steps 1–5 build outward from package manifest to justfile, each with its own
verification so a failure localizes immediately. Step 6 is the AC run; step 7 is the
fresh-clone proof. Commits: one commit per logical unit where meaningful — here the scaffold
is one coherent artifact, so the working plan is a single scaffold commit after step 6, then
the fresh-clone verification against that commit (any fix it surfaces becomes a follow-up
commit). progress.md tracks deviations.

## Step 1 — Package manifest + install

Write `package.json` (scripts + exact-pinned devDeps per structure.md; `@tsconfig/svelte`
pinned to whatever its current latest resolves to at install time). Run
`flox activate -- npm install` (first install generates `package-lock.json`; later clones use
`npm ci` via the justfile guard).

**Verify:** install exits 0; `package-lock.json` exists; `flox activate -- npx vite --version`
reports 8.1.3; `git status` shows no `node_modules/` (gitignore working).

## Step 2 — Tool configs

Write `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `tsconfig.node.json` per
structure.md contracts.

**Verify:** `flox activate -- npx tsc -p tsconfig.node.json --noEmit` exits 0 (vite.config.ts
typechecks — proves the vitest/config type reference and plugin imports resolve).

## Step 3 — Source: core placeholder + smoke test, app placeholder + entry

Write `src/core/index.ts`, `src/core/index.test.ts`, `src/app/vite-env.d.ts`,
`src/app/main.ts`, `src/app/App.svelte`, root `index.html`.

**Verify (three independent probes, straight through npm scripts before the justfile exists):**
- `flox activate -- npm run test` → 1 file, 1 test passing.
- `flox activate -- npm run check` → svelte-check 0 errors, tsc clean.
- `flox activate -- npm run build` → `dist/index.html` produced.

## Step 4 — Single-file assertion

Not deferred to T-001-03-02 wholesale — that ticket owns the *offline/no-external-refs
acceptance*, but this ticket's AC says "emits dist/index.html **via vite-plugin-singlefile**",
so assert the plugin actually did its job:

**Verify:** `dist/` contains exactly one file (`index.html`); the HTML contains an inline
`<script type="module">` (not `src=`-referenced) and inline `<style>`; the placeholder text and
compiled component code are present in the file.

## Step 5 — justfile

Write the justfile: `_deps` guard + `dev`/`test`/`check`/`build` per structure.md.

**Verify:**
- `just --list` shows exactly the four public recipes.
- `just test`, `just check`, `just build` all exit 0 *through just* (guard passes through
  because node_modules is current — proves the fast path).
- Guard correctness: `rm -rf node_modules && just test` re-bootstraps via `npm ci` then passes
  (proves the fresh-clone path); run once more to confirm the stamp now short-circuits.

## Step 6 — `just dev` serves a page (the fourth AC leg)

Dev servers don't exit, so verify by probe: launch `just dev` in the background, poll
`http://localhost:5173/` until it answers, assert HTTP 200 and that the body contains the
`/src/app/main.ts` module script (i.e., it's *our* page, not a directory listing), then kill
the server.

**Verify:** 200 + expected body; server process cleanly terminated afterwards.

## Step 7 — Commit, then fresh-clone acceptance run

Commit the 13 files (message: `T-001-01-02: vite+svelte5+vitest+singlefile scaffold, justfile
dev/test/check/build`). Then the AC's own wording — *from a fresh clone* — executed literally,
per the T-001-01-01 precedent:

1. `git clone <repo> <scratchpad>/fresh-clone` and `cd` into it.
2. `just check` → exits 0 (this also exercises `_deps`/`npm ci` bootstrap from nothing).
3. `just test` → vitest passes.
4. `just build` → `dist/index.html` exists, single file, inline script.
5. `just dev` → serves (same background-probe technique as step 6).
6. Delete the scratch clone.

**Verify:** all four legs green from the clone. Any failure here is a real AC failure: fix in
the working tree, commit the fix, re-clone, re-run.

## Testing strategy summary

- **Unit tests:** exactly one (the core smoke test) — deliberate; this ticket's deliverable is
  pipeline, not logic. Real engine tests start T-001-02-01 on the idiom this test establishes.
- **Integration verification:** the AC run itself (steps 5–7) — the four recipes are the
  integration surface, and the fresh clone is the integration environment. No test framework
  wraps this; it's executed and recorded in progress.md/review.md.
- **Not tested here:** offline behavior of the built file and external-reference absence
  beyond step 4's inline-script check (T-001-03-02's AC); core→app import direction beyond
  construction (T-001-03-01's grep gate — trivially true today with zero imports in core).

## Failure contingencies

- **Version resolution surprise** (a pinned exact version unpublished/yanked): re-check
  `npm view <pkg> version`, adjust pin, document in progress.md.
- **svelte-check/TS friction** (e.g. base-config option conflicts): resolve within tsconfig,
  keep strict on, document deviation.
- **Port 5173 occupied during step 6:** Vite auto-increments; parse the actual port from its
  stdout instead of assuming.
- **`npm ci` slow/flaky network:** retry once; if the registry is unreachable, that blocks the
  fresh-clone leg only — record and stop rather than fake it.

## Step→commit map

| Commit | Contents |
| --- | --- |
| 1 (scaffold) | steps 1–6: all 13 files, verified locally through just |
| 2 (only if needed) | fixes surfaced by the step-7 fresh clone |
| 3 (docs) | progress.md final state + review.md (artifact-only commit) |
