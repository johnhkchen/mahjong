# T-007-01-04 — flowers-decorative-and-size-gate — Progress

## Completed

All 5 plan steps executed as designed; no deviations.

1. **`src/app/Tile.svelte`** — added `export type FlowerKind` (8-member
   union: `plum | orchid | chrysanthemum | bamboo-flower | spring | summer |
   autumn | winter`), `FLOWER_INK` (`#8a5a3c`), and `FLOWERS` glyph map to
   the module context, right before the pip-ink constants. Widened the
   component's `id` prop to `TileId | 'back' | FlowerKind`, added the
   `flower` derived, appended one `{:else if flower}` branch to the face
   `{#if}` chain (identical geometry to the honors branch — `x=30 y=54
   font-size=40 stroke-width=0.75`, only ink and glyph differ), and changed
   the `.kind` span to `{kind ?? (id !== 'back' ? id : 'tile back')}` so a
   flower id's accessible name is its own identifier (e.g. `plum`) rather
   than falling through to `'tile back'`. Amended the header invariant
   comment to name the new branch. Zero changes to any existing branch,
   the chassis rects, or the numeric/`'back'` id paths.
2. **`src/app/tile.ssr.test.ts`** — widened the `Tile` import to
   `import Tile, { type FlowerKind } from './Tile.svelte'`. Added
   `describe('flower faces — decorative only, never dealt', ...)` (4 new
   `it` blocks) immediately before `describe('the full set at once', ...)`:
   glyph-exclusivity across the 8 flower kinds, glyph-exclusion against all
   34 real `TILE_KINDS`, identifier-exclusion against `TILE_KINDS` (the exact
   pool `buildWall`/`deal.ts` draw from), and a chassis-shape sanity check.
   Purely additive — zero existing blocks touched.
3. **`scripts/verify-single-file.mjs`** — added `SIZE_CEILING_BYTES =
   300_000` and a `size-ceiling` rule, placed right after the existing
   `bytes` computation, using the same `fail(rule, detail)` idiom as the
   file's four existing rules.

## Verification run

- `flox activate -- npm run check` — 177 files, 0 errors, 0 warnings (run
  twice: once after the `Tile.svelte`-only change, once after all three
  files landed).
- `flox activate -- npm run test` — 24 files / 568 tests passed (564
  baseline + 4 new flower tests). Ran once before adding the new test block
  (564/564, confirming the widening alone was non-regressive) and once
  after (568/568).
- `flox activate -- npm run build` — `dist/index.html` is 81,514 bytes
  (gzip 28.05 kB), `verify-single-file: OK`. Baseline pre-flowers was 80,973
  B (see research.md); the 8 new faces cost 541 bytes raw, comfortably
  under the 300,000-byte ceiling (headroom, not a squeeze — matches
  design.md's expectation).
- **Size-ceiling rule sanity check**: temporarily set the constant to
  `50_000`, re-ran `node scripts/verify-single-file.mjs` directly against
  the existing `dist/`, confirmed `FAIL [size-ceiling] ... over the
  50000-byte single-file ceiling` and exit code 1, then restored `300_000`.
  Confirmed via `grep` that the restored file reads `300_000` before
  committing.
- `git diff --stat -- src/core` — empty. `src/core/` is byte-for-byte
  untouched by this ticket.

## Deviations from plan

None.

## Noted but out of scope (concurrent work, not mine)

The working tree has unrelated in-flight changes from sibling lisa threads
on this branch (per the RDSPI workflow's concurrency model — multiple
threads share the branch, coordinated via file locking at commit time):
`src/app/Table.svelte` (a mobile-layout ticket) and `src/core/shanten.ts` /
`src/core/shanten.test.ts` (a shanten-related ticket), plus several
untracked `docs/active/work/T-006-*` and `docs/active/tickets/*` diffs from
other tickets' lisa phase-transitions. None of these are touched, staged,
or committed by this ticket — only `src/app/Tile.svelte`,
`src/app/tile.ssr.test.ts`, and `scripts/verify-single-file.mjs` are staged
for this ticket's commit.

## Commit

One commit, component + test + size-gate script together (matching -03's
"component + contract tests as one unit" pattern), scoped to exactly the
three files above.
