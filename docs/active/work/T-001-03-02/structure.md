# T-001-03-02 — Structure: file-level blueprint

Config-and-tooling ticket: **zero changes under `src/`**. Two new files, three modified.
Shapes below are the blueprint, not final code.

## Files created

### 1. `wrangler.jsonc` (repo root, new)

Assets-only Workers config — no worker script, no bindings.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "mahjong",
  "compatibility_date": "<implement-day>",
  "assets": { "directory": "./dist" }
  // mahjong.b28.dev custom-domain routing is wired by the CI/CD pipeline play
  // (out of scope per E-001) — no routes/domains block until then.
}
```

Notes:
- JSONC (not TOML) — schema-completable, matches current wrangler docs default.
- `assets.directory` is `./dist`, which contains exactly `index.html` post-build; the
  gate (below) guarantees that shape before any deploy can happen.
- `$schema` line only if the shipped schema path exists at the pinned version (checked
  during Implement; dropped silently if not — it's editor sugar, not behavior).
- `.wrangler/` scratch dir is already gitignored (pre-existing entry).

### 2. `scripts/verify-single-file.mjs` (new; new `scripts/` directory)

Post-build gate, plain Node (runs on the flox-pinned node 24), `// @ts-check` header for
editor/CI-free type safety, zero dependencies (`node:fs`, `node:path` only — no
package.json changes needed for it to run).

Internal organization — small top-level constants + one check list, so failures read as
a named rule, not a stack trace:

```
DIST = resolve(repo, 'dist')
html = read DIST contents; assert exactly ['index.html']        // rule: one-file
src  = read index.html text
assert src.length > 10_000                                      // rule: non-trivial
assert /<!doctype html>/i present, 'id="app"' present           // rule: sanity-anchors
assert no /\b(src|href)\s*=\s*["']/ matches                     // rule: no-references
assert no /url\(\s*["']?https?:/ matches                        // rule: no-css-fetch
on failure: print rule name + offending excerpt, exit 1
on success: print one line with byte size (build-log breadcrumb), exit 0
```

Boundary decisions:
- The `no-references` regex is deliberately attribute-shaped and total (any `src=`/
  `href=` fails, even relative — design §Decision 3 rationale). If a future ticket
  legitimately needs an attribute (e.g. manifest link when the PWA epic lands), it
  loosens the rule *in that ticket* with its own reasoning; fail-loud beats allowlist.
- Not wired into any tsconfig (`tsc -p tsconfig.node.json` still covers only
  `vite.config.ts`); `@ts-check` is the agreed level of rigor (design §Decision 3.A).
  `src/**` vitest glob is untouched — this never runs under `just test`.

## Files modified

### 3. `package.json`

- `"build"`: `"vite build"` → `"vite build && node scripts/verify-single-file.mjs"`.
- New scripts (canonical commands live here, justfile stays a shim):
  - `"deploy"`: `"wrangler deploy"`
  - `"deploy:check"`: `"wrangler deploy --dry-run"`
- New devDependency: `wrangler` at the exact version `npm install -D --save-exact`
  resolves during Implement (recorded in progress.md).

### 4. `package-lock.json`

Mechanical result of the wrangler install. Committed together with package.json so the
justfile `_deps` staleness check (`node_modules/.package-lock.json -nt package-lock.json`)
triggers `npm ci` for other clones.

### 5. `justfile`

Two new public recipes, both through the existing `_deps` + `flox activate` pattern,
placed after `build` to keep the list in lifecycle order:

```just
# ship the one file to Cloudflare static (mahjong.b28.dev) — requires CF auth
deploy: build
    flox activate -- npm run deploy

# validate the deploy (wrangler dry-run) — no auth, no network account state
deploy-check: build
    flox activate -- npm run deploy:check
```

- Both depend on `build`, so the single-file gate always runs before wrangler touches
  `dist/` — an invalid artifact can never reach a deploy attempt.
- Passing fix (flagged by T-001-03-01 review §3): `test` recipe comment "vitest over
  src/core/" → "vitest over src/ (property tests, scoring tables, app SSR)".
- `deploy` recipe comment mirrors CLAUDE.md's command list wording.

## Files deliberately untouched

- **Everything under `src/`** — no runtime, no test changes. Existing 26 tests are the
  regression net; the SSR test remains the render-correctness proof.
- `vite.config.ts`, `svelte.config.js`, `index.html`, both tsconfigs — the build already
  produces the right artifact (research §3); this ticket adds enforcement around it, not
  build behavior.
- `.gitignore` — `dist/` and `.wrangler/` entries already present.
- `docs/knowledge/*` — the Workers-vs-Pages decision is recorded in this ticket's
  design.md; promoting it into architecture.md is a knowledge-doc edit outside a task
  ticket's remit (Lisa/vend own knowledge curation).
- Untracked `board.svg`, `.lisa-layout.kdl`, ticket frontmatter — not ours.

## Module boundaries and interfaces

- **Public contract of this ticket** = three commands: `just build` (now self-verifying),
  `just deploy-check` (offline validation), `just deploy` (the pipeline's future entry
  point). Everything else is internal arrangement.
- `scripts/` is a new top-level home for repo tooling that is neither runtime (`src/`)
  nor task-runner glue (justfile). Boundary rule going forward: scripts here are
  invoked *by* package.json scripts, never imported by `src/`.
- The core purity gate (`src/core/purity.test.ts`) is unaffected — `scripts/` is outside
  its scan (it globs `src/core`), and nothing new imports anything.

## Ordering of changes

1. `scripts/verify-single-file.mjs` + package.json `build` chain — the gate lands first
   and is proven against the current build (and negatively, by hand-breaking a copy).
2. wrangler devDependency + `wrangler.jsonc` + package.json deploy scripts — then
   `deploy:check` dry-run is run as the AC evidence.
3. justfile recipes + comment nit — thin shims over now-proven npm scripts.
4. Manual `file://` smoke + evidence capture — needs the final artifact, so last.

Steps 1–3 are each independently committable and verifiable; plan.md sequences them
with per-step verification and commit messages.
