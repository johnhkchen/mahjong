# T-001-03-01 — Plan: Svelte empty-table view

Ordered, independently verifiable steps implementing structure.md. Two code commits + one
artifacts commit, matching the repo's established pattern. Working tree contains unrelated
lisa-touched files (`docs/active/tickets/*.md` modifications, untracked `.lisa-layout.kdl`,
`board.svg`) — every commit stages *only* this ticket's files, by explicit path.

## Step 0 — Baseline (no commit)

Run `just test` and `just check` before touching anything, to attribute any pre-existing
failure correctly.

- **Verify:** both pass (expected: 3 core test files green; svelte-check + tsc clean).
- If baseline is broken, stop and reassess — that is not this ticket's mess to bury.

## Step 1 — De-risk the SSR test assumption (no commit)

Design §3 flagged the one open risk: `svelte/server` `render()` of a `.svelte` import
inside vitest (node env, plugin 7.1.2, vitest 4.1.9). Retire it *first*, before writing
the real view, with a throwaway probe: a minimal test that SSR-renders the *current
placeholder* App.svelte and asserts any known substring ("mahjong").

- **Verify:** probe passes → delete the probe, proceed as designed.
- **If it fails:** apply the documented fallback (plain-TS markup helper + direct test),
  record the deviation in progress.md *before* writing Table/App, since it changes their
  internal shape slightly (helper extraction) though not their public contracts.

## Step 2 — The view: Table.svelte, then App.svelte

Write `src/app/Table.svelte` (stateless: `wall: readonly TileId[]` prop, 3×3 grid, four
wind seats with East-bottom orientation, center count from `wall.length`, scoped felt
styling) and rewrite `src/app/App.svelte` (`lang="ts"` script: `let seed = $state(1)` with
the skeleton-seed comment, `const wall = $derived(buildWall(seed))`, header + `<Table
{wall} />`, `:global` body reset). Exactly per structure.md §2–3; `main.ts` untouched.

- **Verify:**
  - `just check` clean (svelte-check now type-checks two real components; tsc unchanged).
  - `just dev` — server starts; load the page and confirm by eye: empty felt table, four
    wind labels oriented East-bottom, center reads wall · 136 tiles. (The count *value*
    also gets machine-checked in step 3; this step confirms it *renders*.)
  - `just test` still green (no tests touched yet — guards against accidental core edits).
- **Commit 1:** `T-001-03-01: empty table view — seed → derived wall → seats + count`
  staging exactly `src/app/App.svelte src/app/Table.svelte`.

## Step 3 — Tests: SSR smoke + core purity gate

Write `src/app/app.ssr.test.ts` (three assertions per structure.md §4: count derived from
an independent `buildWall(1).length`, four wind labels, aria landmark) and
`src/core/purity.test.ts` (directory scan; runtime modules `^\./`-only specifiers; test
files additionally allowed `vitest`/`fast-check`/`node:` builtins; non-empty-scan guard).

Negative-check the purity gate before trusting it: temporarily add `import 'svelte'` to a
core module, confirm the test fails, revert. (Momentary, uncommitted; this is the only way
to know the regex actually bites.)

- **Verify:**
  - `just test` — all suites green, including 2 new files; purity negative-check performed
    and reverted.
  - `just check` clean (new test files are inside tsconfig's `src/**/*.ts` include).
  - Sanity: `git diff` shows zero changes under `src/core/` runtime modules.
- **Commit 2:** `T-001-03-01: SSR smoke test + core import-purity gate` staging exactly
  `src/app/app.ssr.test.ts src/core/purity.test.ts`.

## Step 4 — Acceptance sweep (no code)

Walk the AC clause by clause and record evidence in progress.md:

1. *"`just dev` renders an empty table whose displayed wall/tile count is derived from a
   src/core/ seeded wall build (not hardcoded)"* — dev-server check from step 2 + SSR test
   proving derivation (count asserted against an independent core computation; no `136`
   literal or `TILE_COUNT` in the display path — confirm by grep over `src/app/`).
2. *"`just check` is clean"* — command output.
3. *"import direction is app→core only, with no app or DOM imports appearing in
   src/core/"* — purity test (core side) + grep showing app's only core-facing imports are
   the barrel (`../core`); no `src/core` file references `app` (also enforced by the
   `^\./`-only rule).

Also run `just build` once as a *courtesy canary* for T-001-03-02 (not this ticket's AC —
result noted in review.md either way, build fixes out of scope unless trivially caused by
this ticket's code).

## Step 5 — Artifacts + review

Write `progress.md` (final state: steps completed, deviations if any, AC evidence) and
`review.md` (changes, coverage, open concerns per the workflow's review phase).

- **Commit 3:** `T-001-03-01: add RDSPI artifacts (research/design/structure/plan/progress/review)`
  staging exactly `docs/active/work/T-001-03-01/`.

## Testing strategy summary

| Concern | Mechanism | Type |
| --- | --- | --- |
| Count is derived, not hardcoded | `app.ssr.test.ts` asserts markup count == independent `buildWall(1).length`; grep confirms no literal in display path | integration (component through real compiler) |
| Table renders seats/landmark | `app.ssr.test.ts` label + aria assertions | integration |
| Core stays pure (AC clause 3) | `src/core/purity.test.ts` fs-scan gate, negative-checked once | static invariant test, permanent |
| Types across the boundary | `just check` (svelte-check over both components, `readonly TileId[]` prop) | typecheck |
| Actually paints in a browser | `just dev` + human eyes (step 2) | manual, per AC wording |
| Existing engine untouched | existing core suites still green; `git diff` on `src/core/` runtime empty | regression |

Not tested, deliberately: CSS/layout correctness (no visual-regression tooling in this
repo, empty table is judged by eye), client-side hydration/mount (no DOM env by design
choice §3; `main.ts` mount path is unchanged code), single-file build behavior
(T-001-03-02's AC).

## Risks & contingencies

- **SSR probe fails (step 1):** documented fallback path; costs ~20 minutes and a
  progress.md deviation note; public contracts unchanged.
- **svelte-check surprises on runes/props syntax:** fix forward within step 2 — the AC
  requires clean check, so nothing merges around it.
- **Purity regex misses an import form:** the negative check in step 3 catches the common
  case; exotic forms (require, import assertions) don't exist in this codebase and the
  scan guard + review note keep it honest.
- **Concurrent lisa threads on the same branch:** commits stage explicit paths only;
  lock-serialized commits per the workflow doc — no rebase gymnastics anticipated.
