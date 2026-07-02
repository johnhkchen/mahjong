# T-001-02-01 tile-types-and-identities — Progress

## Status: complete

All 8 plan steps executed in order; code committed as `61a30f2`. Two small deviations, both
documented below with rationale. Nothing remains.

## Step-by-step record

### 1. `src/core/tiles.ts` created ✅

~100 lines, exactly the structure.md interface: types (`Suit`/`NumberedSuit`/`Rank`/
`NumberedKind`/`HonorKind`/`TileKind`/`CopyIndex`/`TileId`), constants (`KIND_COUNT=34`,
`COPIES_PER_KIND=4`, `TILE_COUNT` derived as their product, frozen `TILE_KINDS` built by
generation loops), encoding (`kindIndexOf`, `tileId`, `kindOf`, `copyOf`, `allTileIds`),
accessors/predicates (`suitOf`, `rankOf`, `isHonor`, `isTerminal`, `isSimple`). Zero import
statements. Doc comments cover the id encoding contract, the no-runtime-validation boundary
rule, and canonical mpsz order.

**Deviation (trivial):** the internal reverse index is a `ReadonlyMap<TileKind, number>`
rather than structure.md's `Record<TileKind, number>` — a one-expression build from
`TILE_KINDS` with the same O(1) lookup; `Record` would have needed a cast or a
reduce-with-assertion. Same shape to every consumer (it's private either way).

### 2. Barrel rewritten, smoke test deleted ✅

`src/core/index.ts` is now the 3-line barrel (purity-invariant comment +
`export * from './tiles'`); `ENGINE_NAME` and `src/core/index.test.ts` are gone.

### 3. `src/core/tiles.test.ts` created ✅

8 `it` blocks (structure.md's group 3 split into round-trips + copies-per-kind for failure
legibility), importing through `'./index'`. Exhaustive loops over all 34 kinds / 136 ids /
both encoding directions; the canonical 34-element sequence pinned literally; classification
partition asserted per-kind.

### 4. `just test` ✅

```
Test Files  1 passed (1)
     Tests  8 passed (8)
```

Only `tiles.test.ts` in the run — smoke test confirmed gone. First-try green.

### 5. `just check` ✅

```
svelte-check: COMPLETED 133 FILES 0 ERRORS 0 WARNINGS
tsc -p tsconfig.node.json --noEmit: clean
```

No svelte-check surprises (none predicted — no config or `.svelte` changes).

### 6. Purity grep + build sanity ✅ (one refinement)

First pass, the plan's naive case-insensitive content grep:

```
$ grep -rniE "svelte|document|window|navigator|localStorage" src/core/
src/core/index.ts:1:// src/core/ is the pure engine: ... zero DOM/Svelte/platform
```

One hit — the barrel's own purity *comment* saying the word "Svelte". Not an import; the AC
concerns imports. **Deviation/refinement:** the canonical gate is an import-statement grep,
which is both stricter about what it checks and free of prose false-positives:

```
$ grep -rnE "^\s*(import\b|export .+ from)" src/core/
src/core/index.ts:3:export * from './tiles'
src/core/tiles.test.ts:1:import { describe, expect, it } from 'vitest'
src/core/tiles.test.ts:2:import {
$ grep -rnE "^\s*(import\b|export .+ from)" src/core/ | grep -iE "svelte|dom"
(no output, exit 1)
```

Complete import inventory of `src/core/`: `./tiles` (barrel), `vitest` + `./index` (test
file), and `tiles.ts` imports nothing. No DOM, no Svelte, no platform, no app imports —
AC clause 3 verified, not just verifiable.

Build sanity: `just build` → `dist/index.html 23.44 kB │ gzip: 9.57 kB`, singlefile inlining
both bundles, ✓ built. (Slightly smaller than the scaffold build — dead placeholder code
gone; app doesn't import core yet, so tiles.ts is correctly tree-shaken out of the bundle.)

### 7. Code committed ✅

`61a30f2` — 4 files changed, 205 insertions(+), 11 deletions(-): `tiles.ts` +
`tiles.test.ts` created, `index.ts` rewritten, `index.test.ts` deleted. Staged exactly the
four ticket files; the pre-existing unrelated working-tree items (modified ticket
frontmatter, untracked `.lisa-layout.kdl`, `board.svg`) were left untouched, per plan.

### 8. Artifacts ✅

This file, then review.md; artifacts committed as the closing docs-only commit (two-commit
precedent from T-001-01-01/-02).

## Deviations summary

1. `ReadonlyMap` instead of `Record` for the private reverse index (step 1) — simpler
   construction, identical behavior, private either way.
2. Purity-grep command sharpened from content-grep to import-statement-grep (step 6) after
   the content grep false-positived on the invariant comment itself. The stricter command is
   recorded above as the repeatable gate.

## Acceptance criteria status

- [x] Vitest test enumerates exactly 34 kinds and 136 distinct tile ids — test 1 (plus the
  canonical-sequence and 4-copies tests going beyond the letter of the AC); 8/8 passing.
- [x] `just check` clean — 0 errors, 0 warnings across 133 files.
- [x] No DOM or Svelte imports in `src/core/`, grep-verified — full import inventory above.
