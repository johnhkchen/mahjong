# T-007-01-04 — flowers-decorative-and-size-gate — Plan

## Steps

### Step 1 — `Tile.svelte`: flower type + face data

Add `FlowerKind` (exported), `FLOWER_INK`, `FLOWERS` to the module context
(after `MAN_RANKS`, per structure.md). No behavior change yet — pure data,
unreachable until step 2.

**Verify:** `flox activate -- npm run check` (svelte-check + tsc) still
green; no runtime change, so no test run needed yet.

### Step 2 — `Tile.svelte`: widen prop, add `flower` derived, render branch, `.kind` span

Widen `id`'s type, add the `flower` derived, append the `{:else if flower}`
branch to the face chain, update the `.kind` span expression, amend the
header comment. All per structure.md's exact snippets.

**Verify:**
- `flox activate -- npm run check` green (the prop-type widening and new
  derived must type-check; the `.kind` span's new ternary must satisfy
  svelte-check).
- `flox activate -- npm run test` green — this step touches nothing existing
  tests assert on: numeric `id` behavior is untouched, `id === 'back'`
  behavior is untouched. Existing `tile.ssr.test.ts` and `app.ssr.test.ts`
  suites must show zero regressions before any new test is added, proving
  the widening is additive-only.
- Manual spot check: temporarily render one flower id (e.g. in a scratch
  `it.skip`-free ad hoc check, or just trust step 3's new assertions) — not
  required as a separate gate since step 3 covers this immediately after.

### Step 3 — `tile.ssr.test.ts`: flower face tests

Add the `describe('flower faces — decorative only, never dealt', ...)`
block per structure.md, widen the `Tile` import to pull `type FlowerKind`.

**Verify:** `flox activate -- npm run test` — new block green, all prior
blocks in the file (chassis contract, honors, back, man, pip) still green,
`app.ssr.test.ts` and every other suite unaffected (sanity: full `npm run
test` run, not just this file, to catch any accidental cross-file
regression from the widened import or prop type).

This is the step that actually proves the acceptance criterion's test
requirement — "a test asserts no flower kind can appear in a folded/dealt
hand under the Riichi ruleset" is satisfied by the second and third `it`
blocks in that describe (glyph-level and identifier-level disjointness
against `TILE_KINDS`, the exact domain `buildWall`/`deal.ts` draw from).

### Step 4 — `scripts/verify-single-file.mjs`: size ceiling rule

Add the `SIZE_CEILING_BYTES = 300_000` constant and the `size-ceiling` rule
per structure.md, placed after the existing `bytes` computation.

**Verify:**
- `flox activate -- npm run build` — must print `verify-single-file: OK` and
  a byte count comfortably under 300,000 (research.md's baseline was 80,973
  B pre-flowers; expect roughly 81-83 KB post-flowers given 8 small
  text-glyph faces).
- Sanity-check the rule actually fires when it should, without leaving a
  temporary regression in the tree: locally set `SIZE_CEILING_BYTES` to
  something below the current byte count, confirm `npm run build` fails
  with `[size-ceiling]` and a nonzero exit code, then restore `300_000`
  before committing. This is a manual one-off check, not a persisted test —
  `verify-single-file.mjs` has no unit-test harness in this repo (it's a
  post-build script, not a vitest suite), consistent with how its four
  existing rules are unverified by any test file today.

### Step 5 — Full verification pass

Run the complete gate in ticket-acceptance order:
1. `flox activate -- npm run check` (svelte-check + tsc)
2. `flox activate -- npm run test` (full vitest suite)
3. `flox activate -- npm run build` (vite build + verify-single-file, size
   ceiling included)
4. `git diff --stat -- src/core` must be empty (core untouched, matching
   every prior ticket's self-audit habit noted in -03's review.md)

### Step 6 — Commit

One commit for the component + test + script changes together (matching
this story's established pattern of "component + contract tests as one
unit" from -03's commit `d4d49ff`), since all three files serve the single
acceptance criterion and splitting them buys no independent-revert value.

## Testing strategy

- **Unit/SSR (vitest + real Svelte SSR):** the four new `it` blocks in
  `tile.ssr.test.ts` are the primary verification surface — positive
  glyph-per-flower-kind, negative glyph-and-identifier exclusion against
  `TILE_KINDS`, and a chassis-shape sanity check (one SVG, aria-hidden,
  ivory face) mirroring the pattern every prior face family used.
- **No new integration test needed.** `app.ssr.test.ts`/`drive.test.ts`
  exercise `Table.svelte`/`App.svelte`, which never construct a flower id —
  nothing there changes, and adding one would test a code path this ticket
  deliberately does not create (no flower rendering call site in the table
  view).
- **No property test needed.** Flower faces are 8 fixed literal glyphs, not
  a combinatorial space; `fast-check` (already a devDependency, used
  elsewhere per `shanten.property.test.ts`) has nothing to generate here.
- **The size gate is verified by running the real build**, not a unit test
  of the script — consistent with how the script's existing four rules are
  verified today (by `just build`/`npm run build` succeeding or failing, not
  by a vitest suite around `verify-single-file.mjs`).
- **Regression coverage for `src/core`:** none needed beyond the `git diff
  --stat` self-audit — there is no code change there to test.

## Rollback / deviation handling

If step 4's byte count comes in unexpectedly high (e.g. font-stack bloat
inflates `<style>` in a way research didn't anticipate), the fallback is to
re-derive the actual number from a real build rather than adjust the
ceiling — 300,000 is the ticket's own stated number, not a guess to be
loosened. Document any such deviation in `progress.md` before proceeding,
per RDSPI phase rules.
