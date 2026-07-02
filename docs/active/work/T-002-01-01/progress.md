# T-002-01-01 — Progress: dora indicator → dora kind mapping

Implementation log against plan.md. All steps executed in order; no deviations of
substance.

## Step 1 — `src/core/dora.ts` ✅

Created as shaped in structure.md §2: header comment stating the rule (three cycles,
wraparounds, winds/dragons separate), single import (`suitOf` + `TileKind` type from
`./tiles`), single export `doraKindOf`. Arithmetic exactly per design Option 1:
`(n % 9) + 1` same suit for numbered; `(n % 4) + 1`z for winds; `((n - 4) % 3) + 5`z for
dragons; `as TileKind` casts on the three template-string returns as anticipated.
Header kept free of import-shaped quoted strings (purity-gate comment quirk noted in
plan.md risks).

## Step 2 — barrel ✅

`export * from './dora'` appended to `src/core/index.ts`. No name collisions.

## Step 3 — `src/core/dora.test.ts` ✅

All six planned `it` blocks, imported from `'./index'`:

1. totality over all 34 `TILE_KINDS` (Set membership) — AC clause,
2. five pinned wraparounds 9m→1m, 9p→1p, 9s→1s, 4z→1z, 7z→5z — AC clause, with
   comments naming the two classic traps (North wraps to East, not a dragon; chun
   wraps to haku),
3. full 34-entry literal table with `satisfies Record<TileKind, TileKind>`, transcribed
   from the rule statement per the plan's independence discipline (marked "never
   regenerate by running the code"),
4. bijectivity (image size 34),
5. cycle-group closure via kindIndexOf bands (winds 27–30, dragons 31–33) + suit
   preservation + no fixpoints,
6. successor rule for ranks 1–8 across m/p/s.

The table and the arithmetic agreed on first run — no re-derivation needed.

Minor deviation from the structure.md import list: the test also imports the
`NumberedSuit` type (for the successor-rule loop). Cosmetic only.

## Step 4 — full gate ✅

- `just test`: **6 test files passed, 32 tests passed** (was 5 files / 25 tests before
  this ticket; dora.test.ts adds 6, plus purity.test.ts now covers the new files within
  its existing assertions). Includes the purity gate passing over `dora.ts` (only
  `./tiles`) and `dora.test.ts` (only `./index` + vitest).
- `just check`: svelte-check 146 files, **0 errors, 0 warnings**; tsc node config clean.

## Step 5 — commit ✅

Single commit containing `src/core/dora.ts`, `src/core/dora.test.ts`,
`src/core/index.ts`, and `docs/active/work/T-002-01-01/` (research/design/structure/
plan/progress/review). Pre-existing working-tree modifications to
`docs/active/tickets/T-002-01-01.md` / `T-002-01-02.md` deliberately left unstaged
(Lisa owns ticket frontmatter).

## Remaining work

None. All acceptance criteria met:

- [x] Property test asserts totality over all 34 TILE_KINDS — dora.test.ts block 1
      (plus the full-table block subsuming it).
- [x] Wraparound cases pinned: 9m→1m, 9p→1p, 9s→1s, 4z→1z, 7z→5z — dora.test.ts block 2.
- [x] Exported from `src/core/index.ts` — barrel line; tests exercise it via `./index`.
- [x] `just test` green — 6/6 files, 32/32 tests.
