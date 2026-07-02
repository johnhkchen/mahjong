# T-001-03-01 — Review: Svelte empty-table view

Self-assessment and handoff. All acceptance criteria met and evidenced (progress.md);
two code commits (`7b69285`, `0323718`) plus this artifacts commit. No core runtime
module was touched.

## What changed

| File | Change | Summary |
| --- | --- | --- |
| `src/app/App.svelte` | rewritten (placeholder → real) | State owner: `let seed = $state(1)` (walking-skeleton seed, commented as such) → `const wall = $derived(buildWall(seed))` → `<Table {wall} />`. Global body reset + page chrome. First `lang="ts"` script in the repo. |
| `src/app/Table.svelte` | new | Stateless presentational table. One prop: `wall: readonly TileId[]` (type-only core import). 3×3 CSS grid, riichi orientation (East/you bottom, South right, West top, North left), center shows `wall.length` — the only number source. Scoped felt styling, custom properties, no assets, no media queries. |
| `src/app/app.ssr.test.ts` | new | First app test. SSR-renders App via `svelte/server` (no DOM env, zero new deps) and asserts: count in markup equals an *independently computed* `buildWall(1).length`; four wind labels exactly once; `aria-label="mahjong table"` landmark. Asserts content only — Table's internals stay refactorable. |
| `src/core/purity.test.ts` | new | Permanent boundary gate for the CLAUDE.md invariant / AC clause 3: every core runtime module may import only `./sibling` specifiers (forbids bare packages and `../app` in one rule); core test files additionally get an explicit tooling allowlist (vitest, fast-check, node:). Scans via `import.meta.glob` raw imports. Includes an anti-silent-pass guard (scan must find the four known modules). |
| `docs/active/work/T-001-03-01/*` | new | RDSPI artifacts. |

Deliberately untouched: `main.ts` (already final-shaped), `index.html`, all core runtime
modules, all config (vite/svelte/tsconfig/justfile), `package.json` — **zero new
dependencies**.

## Test coverage

Suite grew 3 files/20 tests → **5 files/26 tests**, all green; `just check` 0 errors.

Covered:
- **Derivation, not decoration** (the AC's heart): the SSR test computes the expected
  count from core independently and finds it in real compiled-component output; grep
  confirms no `136`/`TILE_COUNT` anywhere in `src/app/`. A broken wall build cannot
  render a correct count.
- **Boundary, both directions**: purity gate (core side, negative-checked live — a
  planted `import 'svelte'` in wall.ts fails it by name) + typechecked barrel-only
  imports (app side). This AC clause is now a regression gate every future ticket
  inherits, not a review-time observation.
- **Engine regression**: existing 20 core tests untouched and green.

Gaps (known, accepted):
- **No client-side mount/hydration test** — the SSR test exercises compile + render, not
  `mount()` in a browser. `main.ts` is unchanged code, and T-001-03-02's AC (open the
  built file, see the table) covers the browser path end-to-end. A DOM environment was
  deliberately not added (design §3).
- **No visual/layout assertions** — grid orientation and felt styling are judged by eye
  (`just dev`); no visual-regression tooling exists in this repo. The seat *orientation*
  (East bottom, counterclockwise) is encoded in one `grid-template-areas` string and
  documented, but only humans verify it looks right.
- **Purity regex is source-text, not AST** — it scans raw source and deliberately also
  fires on quoted specifiers in comments (fail-loud; it caught its own doc comment during
  development). Exotic forms it might miss (multiline `import(`, `require`) don't exist
  in this ESM-only, TS-only codebase.

## Open concerns for a human reviewer

1. **Boot-seed coupling (low):** `BOOT_SEED = 1` appears in App.svelte (as `$state(1)`)
   and in app.ssr.test.ts. If the app's seed changes the test names the one place to
   update, but nothing *mechanically* links them. Extracting a shared constant felt like
   apparatus for a value the game-start ticket will replace wholesale; flagging the
   judgment call.
2. **`seed` is `$state` that nothing yet mutates** — svelte-check is clean with it (no
   unused-mutation warning at these pins), and the ticket context explicitly asks for the
   runes path. If a future toolchain upgrade starts warning, the fix is the game-start
   ticket making seed genuinely dynamic, which is the plan anyway.
3. **justfile comment drift (cosmetic):** `just test` is described as "vitest over
   src/core/" but the glob was always `src/**` and now app tests exist. One-word comment
   fix, left for whichever ticket next touches the justfile to avoid an unrelated-file
   commit from this one.
4. **The `node:` allowlist entry in purity.test.ts is currently unused** (the fs approach
   was swapped for `import.meta.glob` — see progress.md deviation). Kept as legitimate
   future test-tooling surface; delete if it offends.

## Notes downstream

- **T-001-03-02 (single-file build):** courtesy canary already run — `just build` emits
  one self-contained `dist/index.html` (37.08 kB / 14.72 kB gzip, JS+CSS inlined by the
  singlefile plugin). That ticket still owns verifying no-network boot and the deploy
  recipe.
- **Future table tickets** (deal, discard pond): extend `Table.svelte`'s props — the
  component was shaped as the growth point (design §2); the `aria-label="mahjong table"`
  landmark is the stable hook for any future DOM-level tests.
- **Attract-mode / b28.dev embed:** the seed → derived-wall runes path in App.svelte is
  the exact slot where the action-log fold lands later (`$derived(fold(seed, actions))`).

## Critical issues

None. No security surface (no input, no network, no storage yet), no data risk, no
contract changes to core. The one live wire: **seed 1's wall order is contract-frozen**
(rng golden vectors) — anyone "fixing" the rng stream breaks not just stored logs but
this ticket's SSR expectations too, and wall.test.ts will say so first.
