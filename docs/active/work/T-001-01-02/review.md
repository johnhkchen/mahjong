# T-001-01-02 vite-svelte-vitest-scaffold-and-justfile — Review

## What changed

One scaffold commit, `d37542c` ("T-001-01-02: vite+svelte5+vitest+singlefile scaffold,
justfile dev/test/check/build"), entirely additive — 13 files created, nothing modified or
deleted. (RDSPI artifacts land in a follow-up docs commit, same pattern as T-001-01-01.)

### Created

| File | Role |
| --- | --- |
| `justfile` | dev/test/check/build recipes → `flox activate -- npm run <x>`; private `_deps` guard runs `npm ci` iff `node_modules/.package-lock.json` is missing/stale; private `default` prints the list |
| `package.json` | scripts + 8 exact-pinned devDeps: svelte 5.56.4, vite 8.1.3, @sveltejs/vite-plugin-svelte 7.1.2, vite-plugin-singlefile 2.3.3, vitest 4.1.9, svelte-check 4.7.1, typescript 5.9.3, @tsconfig/svelte 5.0.8 |
| `package-lock.json` | committed; the fresh-clone reproducibility anchor (`npm ci`) |
| `index.html` | Vite entry; `#app` div → `/src/app/main.ts` |
| `vite.config.ts` | svelte + singlefile plugins; vitest `test` block (node env, `src/**/*.test.ts`) |
| `svelte.config.js` | `vitePreprocess()` for `lang="ts"` components + svelte-check |
| `tsconfig.json` | extends @tsconfig/svelte; strict; **allowJs/checkJs (see finding below)** |
| `tsconfig.node.json` | checks `vite.config.ts` (the `tsc` half of `just check`) |
| `src/core/index.ts` | placeholder `ENGINE_NAME` const; zero imports — purity invariant holds grep-verifiably |
| `src/core/index.test.ts` | smoke test proving the vitest→core wiring and the colocated-test idiom |
| `src/app/main.ts` | Svelte 5 `mount()` entry |
| `src/app/App.svelte` | throwaway placeholder view (T-001-03-01 replaces it); inline styles so the build proves CSS inlining |
| `src/app/vite-env.d.ts` | svelte + vite/client type references, deliberately scoped inside `src/app/` so core stays platform-free at the types level |

### Not changed (deliberately)

- `.gitignore` — already covered node_modules/dist/.vite/tsbuildinfo/coverage.
- Ticket frontmatter — untouched per workflow rules (lisa owns phase/status); the pre-existing
  unstaged ticket edits, `.lisa-layout.kdl`, and `board.svg` were left alone as in T-001-01-01.
- **No `deploy` recipe** — T-001-03-02 owns it (research.md settled this against CLAUDE.md's
  five-recipe table); a stub now would lie or bitrot.
- App.svelte does **not** import from core — the first core→app data flow is T-001-03-01's
  acceptance boundary; faking it early would blur that ticket.

## The one real finding (worth 30 seconds of reviewer attention)

**svelte-check 4.7.1 cannot resolve `.svelte` imports from `.ts` files unless `allowJs` is
effectively on.** The clean-room tsconfig from Structure failed `check`; bisecting the
official create-vite template's config against ours (both directions, in a scratch project)
isolated `allowJs`/`checkJs` as the only load-bearing difference — not the TS version (passes
on 5.9.3 and 6.0.2 alike), not vitePreprocess. Adopted the template's `allowJs + checkJs`
pair with a comment in `tsconfig.json` explaining why it can't be removed. Full bisection
narrative in progress.md. This is undocumented-behavior territory: if a future svelte-check
bump makes the flags unnecessary, the comment says how to find out.

## Key decisions (rationale in design.md)

- **Current majors everywhere except TypeScript 5.9.3** — TS 6.0.x is ~2 months old and Svelte
  tooling develops against 5.x; everything else is mutually compatible on latest (verified via
  peer-dep matrix before install).
- **Exact pins + committed lockfile** — T-001-01-01's charter-P3 precedent extended to npm.
- **Real smoke test over `passWithNoTests`** — proves module resolution/TS transform/include
  glob now, not during T-001-02-01's first real test.
- **Self-bootstrapping justfile** — a fresh clone's first `just check` runs `npm ci`
  automatically; up-to-date cost is one stat.

## Verification performed (test coverage)

- **Unit:** 1 vitest test (core smoke). Deliberately minimal — this ticket ships pipeline, not
  logic; real engine tests start next ticket on the idiom this one establishes.
- **Integration = the AC, run twice:** (1) in-repo through `just`: test/check/build green,
  dev probed over HTTP (200 + our module script), `_deps` guard proven both ways
  (`rm -rf node_modules` → auto `npm ci` → pass; then short-circuit). (2) **from a fresh clone
  of `d37542c`**: all four legs re-run and green, including the cold `npm ci` bootstrap and a
  programmatic single-file assertion. Scratch clone deleted after.
- **Beyond this AC (free preview of T-001-03-02):** the built `dist/index.html` contains
  *zero* `src=`/`href=` attributes — no external references at all — asserted programmatically
  on both builds.

### Coverage gaps

- **`just dev` verified by HTTP probe, not by a browser** — the page returns 200 and our
  module script tag, but no JS engine executed `mount()`. The build path exercises the same
  compile pipeline, so risk is low; first human `just dev` will close it.
- **Offline/filesystem-open behavior of the built file untested** — T-001-03-02's explicit AC.
- **Linux never executed** — same standing gap as T-001-01-01 (lockfile + flox lock cover four
  systems; first CI run will exercise them).

## Acceptance criteria status

- [x] Fresh clone: `just check` (svelte-check + tsc) exits clean — verified from an actual
  clone, including the from-nothing bootstrap.
- [x] `just test` runs vitest successfully — 1/1 passing, both environments.
- [x] `just build` emits `dist/index.html` via vite-plugin-singlefile — single file, JS+CSS
  inline, asserted programmatically.
- [x] `just dev` serves a page — HTTP 200 with our entry script, both environments.
- [x] All through the flox toolchain — every command ran via `flox activate`; host node (v26)
  and just (1.55) differ from the pins, so green runs prove flox was active.

## Open concerns for a human reviewer

1. **The `allowJs`/`checkJs` finding above** — sound per bisection, but it is empirically
   derived, undocumented upstream behavior; worth knowing it exists.
2. **Vite 8 / vitest 4 are young majors.** Peer ranges are explicit and everything passed, but
   if flakiness appears, version-pin rollback is the first lever (one-line diffs each).
3. **`checkJs: true` means any future JS inside `.svelte` files gets typechecked** — template
   behavior, chosen deliberately; flip to `false` if it ever fights us.
4. No TODOs, no known defects. T-001-02-01 (tile types) is unblocked; so are the rest of the
   E-001 chain's substrate assumptions (vitest idiom, purity grep gate, singlefile output).
