# T-007-01-04 — flowers-decorative-and-size-gate — Research

## Ticket

Author the 8 flower tiles (梅蘭菊竹 + 春夏秋冬) as decorative-only SVG assets that
prepay the committed Taiwan 16-tile variant, and add a ~300KB single-file
ceiling proving the full art pack still ships as one lean file. Depends on
T-007-01-02 (pin/sou) and T-007-01-03 (man) — both `phase: done` and already
merged into the working tree.

## What exists today

### The engine's tile domain is closed and fixed

`src/core/tiles.ts` defines exactly 34 `TileKind`s (`buildKinds()`: 1m-9m,
1p-9p, 1s-9s, 1z-7z) and `KIND_COUNT = 34`, `TILE_COUNT = 136`
(`KIND_COUNT * COPIES_PER_KIND`). `allTileIds()` returns `[0..135]`, the only
input `buildWall(seed)` (`src/core/wall.ts:15-17`) ever shuffles. `deal.ts`
takes its 52 deal tiles and 70 draw tiles strictly from that same 122-tile
live-wall slice (`partitionWall` splits 136 into 122 live + 14 dead). There is
no code path, type, or seam anywhere in `src/core/` that could introduce a
136th+ tile — the wall size, kind count, and `TileKind` union are all
compile-time/const-level closed. This is why the acceptance criterion ("no
flower kind can appear in a folded/dealt hand") is provable two ways: (1)
type-level — `FlowerKind` (to be introduced) is a disjoint string-literal
union from `TileKind`, never unioned into it; (2) runtime/content-level — a
render sweep of every kind core can ever deal must never contain a flower
glyph.

`foldRecord` (`src/core/record.ts`, used throughout `app.ssr.test.ts`) is the
"folded hand" — table state derived by folding a seed + action list through
the pure engine, per CLAUDE.md's architectural invariant. Every "dealt hand"
in tests is `foldRecord({ seed, actions }).hands[seat]`, always `TileId[]`,
always resolved through `kindOf()` into one of the 34 `TileKind`s.

### The chip renderer: `src/app/Tile.svelte`

One presentational leaf, already carrying all settled art (T-007-01-01
chassis/honors/backs, T-007-01-03 man, T-007-01-02 pin/sou — all three are
`phase: done` and present in the working tree; `just build` currently
succeeds at 80,973 bytes / gzip 27.84 kB). Structure:

- Module-context (`<script module>`, lines 1-157): static face-art tables —
  `HONORS` (glyph+ink map), `SUIT_INK`, `MAN_RANKS`, `PIN`/`SOU`/`RED` ink
  constants, `PIN_LAYOUTS`/`SOU_LAYOUTS` (coordinate literals per rank), plus
  small `coin()`/`stick()` builder helpers and `Coin`/`Stick` types.
- Instance script (159-176): `let { id }: { id: TileId | 'back' } = $props()`.
  Derives `kind` (`kindOf(id)` if `id` is a `TileId` number, else `null`),
  `suit`, `rank`, `honor`.
- Markup (179-279): one `<svg class="chip" viewBox="0 0 60 84" aria-hidden>`.
  Chassis rect (under-body, `#b9a97e`) always renders. Face rect (`#f6f1e4`,
  ivory) or back rect (`#31588f`) renders per `id === 'back'`. Inside the
  face, an `{#if honor}...{:else if kind === '5z'}...{:else if suit==='m'}
  ...{:else if suit==='p'}...{:else if kind==='1s'}...{:else if suit==='s'}
  {/if}` chain picks exactly one face branch per kind. Each numbered-suit
  branch is a small `{#each LAYOUT[rank] as ...}` over the module-context
  coordinate tables.
- The `.kind` span (278): `<span class="kind">{kind ?? 'tile back'}</span>` —
  visually-hidden (clip-path), the chip's accessible name AND the literal text
  every SSR test regexes for (`>([1-9][mpsz])<` pattern in both
  `tile.ssr.test.ts` and `app.ssr.test.ts`). This is the single most
  load-bearing contract in the file: exactly one tile-looking token per real
  kind, never leaked twice, never on the wrong kind.

Every prior ticket in this file's history threaded a new face branch through
this same `{#if}` chain without touching the `.kind` derivation, the chassis
rects, or any existing branch. The header comment (170) enumerates the
invariant explicitly: "must never emit a `[1-9][mpsz]` text node... nor an
English wind word."

### Test contract: `src/app/tile.ssr.test.ts`

Real Svelte SSR (`render(Tile, {props})`) against content only — never
classes, geometry, or colors, so art stays redrawable (explicit house
doctrine in the file header and repeated in every prior review.md). Pattern
per prior ticket: one `describe` block per face family, each asserting (a)
positive — the family's signature glyph/shape count appears on its own
kinds, (b) negative — it appears nowhere else, sweeping the full 34-member
`TILE_KINDS` both directions. A final `describe('the full set at once')`
sweeps all 34 chips + back and checks the token multiset equals
`TILE_KINDS` exactly (line 177-183) — this is the closest existing analogue
to "nothing extra can appear in a dealt hand," and the natural place to
extend for flower-exclusion, OR a new sibling assertion, since flowers are
not part of `TILE_KINDS` and must not perturb that sweep's cardinality.

### The size gate: `scripts/verify-single-file.mjs`

Runs post-build (`npm run build` = `vite build && node
scripts/verify-single-file.mjs`, see `package.json`). Five rules today:
`one-file` (dist/ holds exactly `index.html`), `non-trivial` (>10,000 bytes),
`sanity-anchors` (leading doctype + `#app` mount), `no-references` (fails on
ANY `src=`/`href=` attribute — deliberately stricter than
"no-external-references," per the file's own header comment), `no-css-fetch`
(no remote `url()` in CSS). No upper bound exists yet. Each rule is a
standalone `if` + `fail(rule, detail)` block; `fail()` logs `[rule]` and
`process.exit(1)`. The final line logs byte count via `statSync(htmlPath)
.size` on success — that same `bytes` local is exactly what a new
`upper-bound` rule would compare against a constant.

Confirmed by running `flox activate -- npm run build` during research:
current `dist/index.html` is **80,973 bytes** (gzip 27.84 kB) with the full
34-kind pack (chassis + honors + man + pin + sou) already inlined — this is
the baseline the flower faces + gate will build on. T-007-01-03's review.md
recorded 77,852 B as its own checkpoint (+327 B over -01); the current
80,973 B reflects -02's pip/sou landing since. Both -02 and -03 are `phase:
done` and merged into the working tree already, so there is no unmerged
concurrent-edit risk for this ticket (unlike -03's review.md concern #4,
which no longer applies).

## Constraints and assumptions surfaced

1. **`src/core/` must stay untouched.** E-007's epic doc is explicit:
   "View-only epic: src/core/ must stay untouched." Flower kinds, if typed
   at all, belong in `src/app/`, not `src/core/tiles.ts`. The 34-member
   `TileKind` union is not to be widened.
2. **Flowers must not be wired into deal/draw.** Epic doc, verbatim: "Flowers
   ... are drawn as DECORATIVE assets only and are NOT dealt while the
   ruleset is Riichi ... do not wire them into deal/draw." No caller in
   `Table.svelte`/`App.svelte` may construct or pass a flower identifier
   today; the 8 faces exist as reachable-but-uncalled code, the literal
   meaning of "prepay."
3. **No new runtime dependency, no framework in core** — consistent with all
   prior tickets in this story; flowers are original inline SVG, same as
   every other face.
4. **Content-only test doctrine** carries forward: assert glyphs/shape
   counts, not geometry or color.
5. **~300KB is headroom, not a squeeze.** Current build is ~81KB; 8 more
   text-glyph-style faces (following the honors/man precedent, the cheapest
   existing pattern) will add on the order of 1-2KB. The gate is a
   regression tripwire against the pack ever silently ballooning (e.g. from
   embedding raster assets or fonts later), not a tight budget for this
   ticket's own addition.
6. **Notation choice for flower identifiers is unconstrained by any existing
   type** — `FlowerKind` does not exist yet anywhere in the codebase (`grep
   -rn flower src/` returns nothing). Whatever shape is chosen must not
   collide with the `[1-9][mpsz]` token regex both SSR test files use to
   detect "tile-looking" text, since a flower must never be mistakable for a
   real dealt tile in any test or in accessibility text.
7. **Taiwan 16-tile flower semantics (seat-matching bonus draws, replacement
   draws) are explicitly out of scope** — this ticket is Riichi-ruleset art
   only; the owner's committed direction (memory:
   `owner-taiwan-16-tile-direction`) is a *future* post-DoD variant. No
   scoring, matching, or replacement-draw logic belongs here.

## Open questions carried to Design

- Where do the 8 flower faces render from: a widened `Tile.svelte` (`id: TileId
  | 'back' | FlowerKind`) extending the existing `{#if}` chain, or a separate
  standalone component never imported by `Table.svelte`/`App.svelte`?
- What identifier/notation represents a flower kind, and what is its
  accessible `.kind`-equivalent label?
- Visual treatment: reuse the honors' single-glyph-on-ivory pattern (cheapest,
  most consistent with existing art system) vs. a more distinct botanical
  illustration (higher fidelity to Taiwan-parlor feel, more bytes/risk).
- Exact shape of the "no flower kind in a folded/dealt hand" test: type-level
  disjointness, full-sweep content assertion, or both.
