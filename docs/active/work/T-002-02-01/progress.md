# T-002-02-01 — Progress: render dealt hand on table

Running log of plan execution. Final state: **all steps complete**, code committed as
`625298d`.

## Step log

- **Step 0 — Baseline** ✅ `just test`: 8 files / 51 tests green; `just check`: 150
  files, 0 errors — matches plan's expected starting state exactly.
- **Step 1 — Tile.svelte** ✅ Created per structure §2: `id: TileId` prop, `kindOf`
  decode, `suitOf`-keyed face color, chip styling, reskin-point header comment.
  Verified: `just check` clean (151 files) with the component not yet imported.
- **Step 2 — Table.svelte** ✅ Prop swap (`wall` → `table: TableState`), sorted-hand
  `$derived` via public `kindIndexOf(kindOf(id))` copy-sort, east-seat
  `<ul aria-label="your hand">` of keyed `<Tile>`s, center rewritten (indicator Tile
  in an `aria-label="dora indicator"` block + visible label + `live.length` "tiles
  left"), hand-row CSS, header comment updated. Verified as planned: `just check`
  reported **exactly one error, in App only** (unknown `wall` prop) — Table itself
  clean.
- **Step 3 — App.svelte** ✅ `buildWall` → `foldRecord`; derivation is now
  `$derived(foldRecord({ seed, actions: [] }))` with a comment tying it to the
  record-is-authoritative invariant; `<Table {table} />`. Boot seed + its comment
  untouched. Verified: `just check` fully clean. (Plan's non-gating `just dev`
  eyeball was skipped in this autonomous run — flagged in review.md as the one open
  visual concern; the CSS risk was pre-mitigated with flex-wrap per design §9.)
- **Step 4 — app.ssr.test.ts** ✅ Rewritten per structure §5: tile-token multiset
  test (13 hand kinds + indicator kind, exact), aria-region test, placeholder-
  replaced test; winds-once and table-landmark tests kept; `BOOT_SEED` sync-point
  comment kept; all expectations fold-derived. `just test`: 8 files / **53 tests**
  green (51 − 1 removed + 3 added — plan's predicted count).
  **Perturb-restore performed**: rendering `hand.slice(1)` (12 tiles) made the
  multiset test fail; restore → green. The extraction regex demonstrably binds.
- **Step 5 — Full gate + commit** ✅ `just test` (53) ∧ `just check` (0/0) ∧
  `just build` → `verify-single-file: OK — dist/index.html is self-contained
  (39354 bytes)`. Committed `625298d` containing exactly the four planned files.
- **Step 6 — this artifact** ✅, proceeding to Review.

## Deviations from plan

1. **`toSorted` fallback taken** (plan risk register, pre-authorized): first full-gate
   run failed `just check` with "Property 'toSorted' does not exist … lib es2023" (the
   project's tsconfig lib predates it; vitest ran it fine at runtime, node has it —
   the gap is type-level only). Applied the register's exact fallback — copy-and-
   `.sort()` on both sides of the multiset comparison — rather than widening tsconfig
   (config changes are out of this ticket's scope). Gate green on re-run.
2. **Visual eyeball via `just dev` not performed** (step 3's non-gating verify) —
   autonomous session; carried as an open concern to review.md rather than silently
   claimed.

No other deviations: file set, ordering, verification checkpoints, and even the
intermediate error signatures (step 2's App-only mismatch) matched the plan.

## Suite numbers

| Gate | Before | After |
| --- | --- | --- |
| `just test` | 8 files / 51 tests | 8 files / 53 tests |
| `just check` | 0 errors / 0 warnings | 0 errors / 0 warnings |
| `just build` | single-file OK | single-file OK (39,354 bytes, gzip ~15.6 kB) |

## Commits

- `625298d` — T-002-02-01: render dealt hand + dora indicator on the table via the
  core fold (`src/app/Tile.svelte` new; `src/app/Table.svelte`, `src/app/App.svelte`,
  `src/app/app.ssr.test.ts` modified; +124/−24). Core untouched, as the plan's
  red-flag check requires — `git status` showed no `src/core/` diffs throughout.
