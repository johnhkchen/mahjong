# T-007-01-04 — flowers-decorative-and-size-gate — Review

## What changed

- **Modified: `src/app/Tile.svelte`** (+48/-4 lines) — added `export type
  FlowerKind` (8-member union: `plum | orchid | chrysanthemum |
  bamboo-flower | spring | summer | autumn | winter`), `FLOWER_INK`
  (`#8a5a3c`, one shared decorative ink distinct from every suit/honor ink),
  and a `FLOWERS: Record<FlowerKind, { glyph: string }>` map to the module
  context. Widened the component's public `id` prop from `TileId | 'back'`
  to `TileId | 'back' | FlowerKind`, added a `flower` derived
  (`typeof id === 'string' && id !== 'back' ? FLOWERS[id] : undefined`), and
  appended one `{:else if flower}` branch to the existing face `{#if}`
  chain — geometrically identical to the honors branch (`x=30 y=54
  font-size=40 stroke-width=0.75`), differing only in ink and glyph. The
  `.kind` accessibility span changed from `{kind ?? 'tile back'}` to
  `{kind ?? (id !== 'back' ? id : 'tile back')}` so a flower id's
  accessible name is its own identifier rather than falling through to
  `'tile back'`. Every existing branch, the chassis rects, and both the
  numeric-id and `'back'`-id code paths are untouched — confirmed by a full
  test run before any new test was added (564/564 green pre-flower-test,
  matching the pre-change baseline exactly).
- **Modified: `src/app/tile.ssr.test.ts`** (+53 lines, purely additive) —
  widened the `Tile` import to pull the new `FlowerKind` type; added
  `describe('flower faces — decorative only, never dealt', ...)` (4 new
  tests) placed immediately before the existing "full set at once" sweep.
  Zero existing blocks edited.
- **Modified: `scripts/verify-single-file.mjs`** (+6 lines) — added
  `SIZE_CEILING_BYTES = 300_000` and a `size-ceiling` rule using the file's
  existing `fail(rule, detail)` idiom, placed right after the `bytes`
  computation.
- **Untouched:** `src/core/` (verified empty via `git diff --stat -- src/core`
  right before commit — the two `shanten.*` diffs visible in the working
  tree belong to a concurrent sibling lisa thread and were never staged),
  `Table.svelte`/`App.svelte`/`ClaimPrompt.svelte` (also has an unrelated
  concurrent in-flight diff from another thread's mobile-layout ticket, not
  touched by this commit), `app.ssr.test.ts`, `drive.ts`/`drive.test.ts`,
  `package.json`, `vite.config.ts`. No new dependency.

Commit: `316f0a6` "T-007-01-04: decorative flower faces + single-file size
gate" (component + tests + script as one unit, matching this story's
established "component + contract tests as one commit" pattern).

## Acceptance criteria, checked

- **8 flower faces exist as original SVG assets, NOT wired into deal/draw**
  — yes. `FlowerKind`/`FLOWERS` live only in `Tile.svelte`'s module context;
  no call site anywhere in `src/app/` constructs a `FlowerKind` value (grep
  confirms `Table.svelte`/`App.svelte` reference only `TileId`/`'back'`).
  `src/core/` has zero flower concept — `TileKind` remains the fixed
  34-member union, `TILE_COUNT` remains 136, `allTileIds()`/`buildWall()`/
  `deal.ts` have no seam for an 8-flower addition. The capability exists;
  nothing calls it — the literal meaning of "prepay."
- **A test asserts no flower kind can appear in a folded/dealt hand under
  the Riichi ruleset** — yes, two ways: (1) `'never appears on any of the
  34 real kinds a folded/dealt hand can contain'` sweeps every `chipOf(kind)`
  for `kind` in `TILE_KINDS` (the exact enumeration `buildWall`/`deal.ts`
  ever draw from) and asserts none contains any flower glyph; (2)
  `'is disjoint from TILE_KINDS by identifier, not just by glyph'` checks
  the flower identifier set against every real kind string directly.
  Combined with the positive per-flower exclusivity test, this fully
  specifies the invariant: the only faces a real hand can ever render are
  the 34 real ones, and none of those 34 carry flower content.
- **`verify-single-file.mjs` enforces a ~300KB upper bound that `just
  build` passes with the full pack inlined** — yes. `dist/index.html` is
  81,514 bytes (gzip 28.05 kB) with all 34 real faces + 8 flowers inlined,
  well under the 300,000-byte ceiling. The rule was sanity-checked to
  actually fire (temporarily set to 50,000, confirmed `FAIL [size-ceiling]`
  + exit 1, then restored and re-verified `300_000` is what's committed).

## Test coverage

- **Strong:** flower-glyph exclusivity across the 8 flower kinds
  (positive+negative), flower-glyph and flower-identifier exclusion against
  the full 34-member `TILE_KINDS` (the never-appears-in-a-dealt-hand
  guarantee), and a chassis-shape sanity check (one aria-hidden SVG, ivory
  face) — all inherited chassis/honor/man/pip tests re-verify unchanged
  behavior for free, since the widened prop type and new derived are
  additive to every existing branch.
- **Deliberately absent (house doctrine, consistent with every prior
  ticket in this file):** geometry, exact ink hex, stroke width, font
  stack — content-only tests keep the art redrawable.
- **No integration/property test added**, and none was needed: no
  `Table.svelte`/`App.svelte` call site exists to integration-test (this
  ticket deliberately creates none), and 8 fixed literal glyphs are not a
  combinatorial space for `fast-check` to explore.
- **The size gate has no persisted automated test** (consistent with its
  four pre-existing rules — `verify-single-file.mjs` is a post-build script
  with no vitest harness in this repo, verified by running the real build,
  not by a unit test around the script itself). The sanity check that the
  new rule actually fires was a manual, non-persisted step per plan.md.

## Open concerns for a human eye

1. **Visual quality is unverified by automation** (same class of concern
   every prior ticket in this file has flagged): the single shared ink
   (`#8a5a3c`) across all 8 flowers, and whether a single glyph-on-ivory
   face reads as "decorative/bonus" versus "a fifth suit" at a glance, is a
   design judgment for `just dev` + an owner look, not something content
   tests can verify. Design.md flags this as an intentional first pass —
   the ticket's job is "decorative asset that prepays the variant," not
   the final art fidelity call; a later ticket that actually wires the
   Taiwan 16-tile variant in is the natural point to reconsider full
   illustrated flower faces if the owner wants more visual distinction
   from the honors family.
2. **`FlowerKind`/`FLOWERS` are currently dead code from the type system's
   perspective** — nothing constructs a `FlowerKind` value anywhere in the
   tree yet (by design: "decorative-only... not wired into deal/draw").
   `svelte-check`/`tsc` don't flag this as unused because it's an exported
   type and a component-reachable branch, not an unreferenced local, but a
   reviewer should confirm this is the intended shape of "prepay" rather
   than premature code.
3. **Concurrency on this branch**: while implementing, two sibling lisa
   threads had unrelated in-flight changes in the same working tree
   (`Table.svelte` for a mobile-layout ticket, `shanten.ts`/
   `shanten.test.ts` for a shanten ticket). Neither was touched, staged, or
   included in this ticket's commit (`git diff --stat -- src/core` was
   empty at commit time; only the three files above were staged). Worth a
   glance that this ticket's commit doesn't need to be rebased awkwardly
   against whichever of those lands next — the diff here doesn't overlap
   either file at all, so no merge conflict is expected.
4. **No Taiwan 16-tile scoring/matching/replacement-draw logic** — entirely
   out of scope per the epic doc and this ticket's own acceptance criteria;
   flagging only so a reviewer doesn't mistake the flower art landing here
   for that variant being playable. It is not; `src/core/` still deals
   exactly 136 tiles across 34 kinds.

Build size ledger: 81,514 B (gzip 28.05 kB) — 541 B over the pre-flower
baseline (80,973 B), 218,486 B of headroom under the 300,000 B ceiling.
No TODOs left in code.
