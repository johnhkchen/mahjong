# T-001-01-02 vite-svelte-vitest-scaffold-and-justfile — Progress

Status: **complete** — all plan steps executed, all four AC legs verified locally through just
and again from a fresh clone of the scaffold commit.

## Step log

- [x] **Step 1 — package manifest + install.** `package.json` written with exact pins
  (@tsconfig/svelte resolved to 5.0.8 at install time, as the plan allowed).
  `flox activate -- npm install` clean, 0 vulnerabilities; lockfile generated;
  `npx vite --version` → 8.1.3 through flox; `git status` confirms `node_modules/` ignored.
- [x] **Step 2 — tool configs.** `vite.config.ts`, `svelte.config.js`, `tsconfig.json`,
  `tsconfig.node.json` written; `tsc -p tsconfig.node.json --noEmit` clean on first run.
- [x] **Step 3 — source files.** All six written. `npm run test` → 1 file / 1 test passing.
  `npm run check` initially **failed** — two deviations resolved, see below. `npm run build`
  → `dist/index.html`.
- [x] **Step 4 — single-file assertion.** `dist/` contains exactly one file; inline
  `<script type="module">` and `<style>`; **zero** `src=`/`href=` attributes anywhere in the
  output (stronger than planned — the T-001-03-02 no-external-refs check happens to already
  pass); placeholder text present; 23.4 kB raw / 9.6 kB gzip.
- [x] **Step 5 — justfile.** `just --list` shows exactly dev/test/check/build; all three
  batch recipes pass through just (fast path). Guard proven both ways:
  `rm -rf node_modules && just test` re-bootstrapped via `npm ci` and passed; the next
  invocation short-circuited (~2 s total, all of it svelte-check itself).
- [x] **Step 6 — `just dev` probe.** Backgrounded, polled: HTTP 200 on :5173, body contains
  the `/src/app/main.ts` module script; server killed and confirmed dead.
- [x] **Step 7 — commit + fresh-clone acceptance.** Scaffold committed as `d37542c`
  (13 files). Cloned into scratchpad; from the clone: `just check` clean (and this run
  exercised the full `npm ci` bootstrap from nothing), `just test` 1/1 passing, `just build`
  single fully-inline file (asserted programmatically), `just dev` served HTTP 200 with our
  module script (Vite auto-bumped to :5174; probe parsed the real port per the plan's
  contingency). Scratch clone deleted; no stray dev processes.

## Deviations from plan/structure

1. **`vite-env.d.ts` gained a `svelte` types reference** (structure.md listed it; the first
   written version omitted it). Restored to the two-line form. Mechanical fix.
2. **`tsconfig.json` gained `allowJs: true, checkJs: true` — the real finding of this
   ticket.** `npm run check` failed with *"Could not find a declaration file for module
   './App.svelte'"* on the structure.md tsconfig. Debugged against ground truth: scaffolded
   the official `create vite` svelte-ts template in scratch, confirmed it passes, then bisected
   its tsconfig options one at a time against ours. Result: svelte-check 4.7.1 resolves
   `.svelte` imports from `.ts` files **only when `allowJs` is effectively on** (either flag
   alone passes — `checkJs` implies `allowJs` — removing both is the only failing
   combination). Not TypeScript-version-related (template passes on both TS 6.0.2 and our
   5.9.3) and not vitePreprocess-related (both tested explicitly). Adopted the template's
   `allowJs + checkJs` pair with an explanatory comment in the tsconfig; `checkJs` also
   matches template behavior of typechecking JS inside `.svelte` files. A transient
   `allowArbitraryExtensions: true` added mid-debug was removed once bisection cleared it.
3. **No other deviations.** Versions resolved exactly as pinned; no contingencies from the
   plan's failure list were needed beyond the dev-port auto-increment case, which the plan
   anticipated.

## Commits

| Commit | Contents |
| --- | --- |
| `d37542c` | steps 1–6: all 13 scaffold files, verified through just |
| (none) | step 7 surfaced no fixes — fresh clone passed as committed |
| (pending) | RDSPI artifacts incl. this file + review.md |

## Remaining

Nothing. Review phase (review.md) follows.
