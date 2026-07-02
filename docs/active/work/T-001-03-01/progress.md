# T-001-03-01 — Progress

Final state: **all plan steps complete**, all acceptance criteria evidenced, two code
commits landed. One in-flight fix (not a plan deviation in kind, only in mechanism) is
documented below.

## Step log

| Plan step | Status | Outcome |
| --- | --- | --- |
| 0 — Baseline | ✅ | `just test` 20/20 green (3 files), `just check` 0 errors before any change. |
| 1 — SSR de-risk probe | ✅ | Throwaway test SSR-rendered the placeholder App via `svelte/server` `render()` under vitest 4.1.9 / plugin 7.1.2 — passed first try. Probe deleted; **no fallback needed**, design's primary path holds. |
| 2 — View | ✅ | `Table.svelte` (stateless, `wall: readonly TileId[]` prop, 3×3 grid, East-bottom/S-right/W-top/N-left, center count from `wall.length`) + `App.svelte` rewrite (`let seed = $state(1)`, `const wall = $derived(buildWall(seed))`, header + `<Table {wall} />`, `:global` body reset). `just check` clean; dev server verified serving the shell and compiling `main.ts` (HTTP 200). Commit `7b69285`. |
| 3 — Tests | ✅ (one fix) | `app.ssr.test.ts` (count derived from independent `buildWall(1).length`, four winds exactly once, aria landmark) + `purity.test.ts`. Negative check performed: `import 'svelte'` appended to wall.ts → gate failed with `./wall.ts imports 'svelte'` → reverted → green. 26/26 tests, check clean. Commit `0323718`. |
| 4 — Acceptance sweep | ✅ | Evidence below. Courtesy `just build` canary: single `dist/index.html`, 37.08 kB, JS+CSS inlined — good news for T-001-03-02. |
| 5 — Artifacts | ✅ | This file + review.md; artifacts commit. |

## Deviation (mechanism, not design)

**purity.test.ts reads sources via `import.meta.glob(…, { query: '?raw' })` instead of
`node:fs`/`node:path`** (structure.md §5 specified an fs scan). Two forces:

1. The fs version failed `just check`: `@types/node` is not installed, so `node:fs`,
   `node:path`, and `import.meta.dirname` don't typecheck. Plan promised zero new deps.
2. Vite's raw glob import runs in the same vitest pipeline, is typed by the already-present
   `vite/client` ambient types, and needs *no* imports beyond vitest — strictly fewer
   moving parts.

Behavior is identical (same specifier regex, same rules, same non-empty-scan guard,
negative check re-run after the switch and it still bites). Side effect: the
`node:` allowlist entry in `TEST_ONLY_ALLOWED` is currently unused but kept — node
builtins remain a legitimate future test-tooling need.

**Bonus finding:** the gate's first run failed on *itself* — its own doc comment contained
`from '…'` examples the regex matched. Kept the fail-loud behavior deliberately (a comment
that reads like a forbidden import fails the gate rather than teaching the regex to skip
comments) and documented it in the test.

## Acceptance criteria evidence

1. **"`just dev` renders an empty table whose displayed wall/tile count is derived from a
   src/core/ seeded wall build (not hardcoded)"** — dev server starts and serves
   (step 2); SSR test proves the rendered markup's count equals an independently computed
   `buildWall(1).length`; `grep -rn "136\|TILE_COUNT" src/app/` → **no matches**: the
   only number source is `wall.length`.
2. **"`just check` is clean"** — `svelte-check`: 144 files, 0 errors, 0 warnings; `tsc -p
   tsconfig.node.json` clean.
3. **"import direction is app→core only, with no app or DOM imports appearing in
   src/core/"** — app's only core-facing imports are the barrel (`../core`) in exactly
   three places (App value import, Table type-only import, SSR test); core side enforced
   *permanently* by `purity.test.ts` (runtime modules: `^\./`-only specifiers — forbids
   bare packages and `../app` in one rule), negative-checked live.

## Commits

- `7b69285` — `T-001-03-01: empty table view — seed → derived wall → seats + count`
  (App.svelte rewritten, Table.svelte new)
- `0323718` — `T-001-03-01: SSR smoke test + core import-purity gate`
  (app.ssr.test.ts, purity.test.ts new)
- (this commit) — RDSPI artifacts

Staged by explicit path throughout; unrelated lisa-touched files (ticket frontmatter,
`.lisa-layout.kdl`, `board.svg`) left untouched.

## Final verification snapshot

- `just test`: **5 files, 26 tests, all green** (was 3/20 at baseline; +2 files, +6 tests).
- `just check`: **0 errors, 0 warnings**.
- `git diff src/core/` runtime modules: **empty** — the engine was consumed, never edited.
- `just build` (courtesy, out of AC): single self-contained `dist/index.html`, 37.08 kB
  (14.72 kB gzip), no external references reported by singlefile plugin.
