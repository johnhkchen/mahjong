# T-002-02-01 — Review: render dealt hand on table

Self-assessment and handoff. The first visible game state: the app folds a seeded
record through core's public entrypoint and the table shows the player's dealt hand
and the dora indicator.

## What changed

One code commit, `625298d` (`T-002-02-01: render dealt hand + dora indicator on the
table via the core fold`), +124/−24 across four `src/app/` files. **Zero core
changes** — everything needed was already public through the barrel.

| File | Change | Summary |
| --- | --- | --- |
| `src/app/Tile.svelte` | created (~48 lines) | Presentational leaf: `id: TileId` in, chip out — mpsz kind text (`7m`) on a light tile-shaped face, per-suit text color. Header comment marks it as the single reskin point for the future original-tile-art ticket. |
| `src/app/App.svelte` | modified (±6) | Derivation swapped from `buildWall(seed)` to `foldRecord({ seed, actions: [] })` — the app's authoritative state is now literally a hand record, the view a fold of it (the CLAUDE.md keystone, now the app's data flow). Boot seed 1 + comment untouched. |
| `src/app/Table.svelte` | modified (+~55/−15) | Prop contract: `wall: readonly TileId[]` → `table: TableState` (one prop that grows with core's derived view). East seat gains `<ul aria-label="your hand">` of 13 keyed `<Tile>`s, display-sorted by public `kindIndexOf(kindOf(id))` copy-sort (core assigns sorting to presentation). Center placeholder ("136 / tiles in the wall") replaced by the indicator Tile in an `aria-label="dora indicator"` block + `live.length` "tiles left". Seats/grid otherwise untouched. |
| `src/app/app.ssr.test.ts` | rewritten (~55 lines) | See coverage below. |

Ticket frontmatter untouched (lisa's); artifacts committed separately.

## Acceptance criteria — status

- **(a) app.ssr.test.ts asserts the 13 dealt tiles + dora indicator, placeholder
  replaced** — ✅ the multiset test extracts every tile-looking token
  (`/>([1-9][mpsz])</g`) from the SSR body and requires it to equal *exactly* the 13
  fold-derived hand kinds + the indicator kind (containment and nothing-extra in one
  assertion); a separate test asserts the live-remaining count is present and
  "tiles in the wall" is gone.
- **(b) All table data via the core fold, no engine logic in src/app/** — ✅ App's
  only derivation is `foldRecord`; Table reads fields off `TableState`; the only
  app-side computations are the display sort (via public accessors — deliberately not
  the private id arithmetic) and `.length`. Nothing re-derives wall/deal/dora facts.
- **(c) `just check` + `just build` with the single-file gate** — ✅ 0 errors /
  0 warnings; `verify-single-file: OK` (39,354 bytes, one self-contained index.html).

`just test`: 8 files / 53 tests green (51 before).

## Test coverage

- **Tile-token multiset** (AC a): exact multiset equality, all expectations derived
  by calling `foldRecord`/`kindOf` inside the test — no tile literal typed into an
  assertion. **Perturb-restore performed**: hiding one hand tile failed the test;
  restored green — the extraction regex demonstrably binds to the markup.
- **Aria regions**: `your hand`, `dora indicator`, plus the kept `mahjong table`
  landmark — regions are named, never structurally located.
- **Placeholder replaced**: presence of fold-derived `70 tiles left`, absence of the
  old label.
- **Winds exactly once** (kept): guards the seat loop as the east cell grew.
- **Static gates**: svelte-check/tsc strict clean; core purity gate unaffected
  (no core diffs).

Coverage gaps, considered and accepted: no assertion of the hand's *sorted display
order* (presentation choice, not AC; asserting token order would encode DOM/source
order — structure the test idiom forbids). No isolated Tile/Table component tests
(the SSR test exercises the full App → Table → Tile chain with real fold data; the
components have no logic the chain misses). No visual/layout tests (no DOM
environment in the suite — SSR strings only, per project convention).

## Design decisions a reviewer should weigh

1. **Whole `TableState` as Table's prop** — later tickets extend core's derived view
   and Table's render sites with zero App churn; the cost is Table being coupled to
   the (explicitly non-frozen) state shape. Narrow props rejected in design §2.
2. **mpsz text chips, no art** — the engine's own notation as the tile face until the
   art ticket lands; unicode mahjong glyphs rejected (inconsistent rendering +
   original-art trajectory). `Tile.svelte` is the one seam art replaces.
3. **Center keeps a count** — the *live remaining* count (70, real riichi table
   furniture from the same fold) replaces the pre-partition 136 placeholder. A
   reviewer reading AC "replaced" strictly as "indicator only" should look at design
   §6 for the rationale.
4. **Opponents unchanged** — `table.hands[1..3]` exist but render nothing new; hidden-
   hand presentation (tile backs) is deliberately left to a later slice (design §7).

## Open concerns / TODOs

- **Visual layout unverified by eye** (the one true gap): the non-gating `just dev`
  eyeball was skipped in this autonomous run. 13 chips at `0.8rem` in the east cell
  of a `min(100%, 70dvh)` square should fit one row on desktop and wrap gracefully
  (flex-wrap) on narrow screens, but nobody has *looked*. First `just dev` after this
  ticket should glance at the bottom seat; any fix is CSS-only.
- The multiset regex depends on tile text rendering as a bare `>7m<` text node; if a
  future Tile revision wraps each character in elements, the test fails loudly (good)
  but needs its extraction updated alongside.
- `hand` is recomputed (sort) whenever the fold changes — trivially fine at 13 tiles;
  no memo concerns.
- tsconfig `lib` predates ES2023 (`toSorted` rejected by svelte-check, runtime has
  it) — worked around with copy-`.sort()`; a toolchain ticket could modernize `lib`
  deliberately rather than per-file.

## Critical issues for human attention

None. Core is untouched; the app's public behavior grew exactly one visible feature;
every AC has a passing executable check; the one unchecked dimension (visual layout)
is cosmetic and CSS-isolated.
