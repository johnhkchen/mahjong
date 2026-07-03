# T-007-01-04 — flowers-decorative-and-size-gate — Design

## Decision 1: Where do the flower faces live?

**Chosen: extend `Tile.svelte`'s existing face system, widening its `id`
prop to accept a new `FlowerKind` literal union alongside `TileId | 'back'`.**

### Options considered

**A. Extend `Tile.svelte` (chosen).** Add `FlowerKind` as an 8-member string
union in the module context, a `FLOWERS` glyph/ink map beside `HONORS`, and
one more `{:else if flower}` branch in the face `{#if}` chain. The chip stays
the single source of truth for "what a tile face looks like," matching the
pattern every prior ticket (-01, -02, -03) already established: one file,
one `{#if}` chain, one branch per face family.

**B. Standalone `Flower.svelte` component, never imported.** Physically
guarantees "not wired into deal/draw" by construction — no import means no
call site, full stop. But it duplicates the chassis rect, viewBox, ivory
face inset, and `.tile`/`.chip`/`.glyph` styles verbatim (all of
`Tile.svelte`'s non-face plumbing), just to render 8 more faces on the
identical chip shape. That duplication is the kind of copy the codebase has
consistently avoided — every prior ticket reused the one chassis.

**C. A generic face-content-only sub-component, imported by `Tile.svelte`,
parameterized over kind.** Bigger refactor than this ticket calls for — none
of -01/-02/-03 needed to factor the chassis out, and doing so now (touching
every existing branch) raises regression risk on a ticket whose real job is
"add 8 faces + a size check."

### Why A over B

The "not wired into deal/draw" requirement is about the **engine boundary**,
not the **view file boundary**. `src/core/` already structurally cannot
produce a flower — `TileId` is `0..135`, `TileKind` is the fixed 34-member
union, `allTileIds()`/`buildWall()`/`deal.ts` have no seam for a 35th kind.
Widening `Tile.svelte`'s prop type doesn't touch any of that; it just makes
the component *capable* of rendering a flower chip if some future caller
(the Taiwan variant) constructs one. That capability-without-a-caller is
exactly what "prepay" means in the epic doc's own words. `Table.svelte`/
`App.svelte` will not be touched by this ticket — grep after implementation
must show zero new call sites passing a `FlowerKind` into `<Tile>`.

Option B's "physical guarantee" is worth less than it sounds: nothing stops
a future ticket from importing `Flower.svelte` into `Table.svelte` either,
so it provides no *more* real safety than A once you accept the actual
enforcement mechanism is "no caller exists yet, and a test proves the
render-content boundary." B's cost (duplicated chassis/styles) is real and
ongoing; A's cost (a wider prop type before there's a real second caller) is
paid once and matches the file's existing shape.

## Decision 2: Flower identifier notation

**Chosen: descriptive English string literals** — `'plum' | 'orchid' |
'chrysanthemum' | 'bamboo-flower' | 'spring' | 'summer' | 'autumn' |
'winter'` (the type named `FlowerKind`).

### Options considered

- **mpsz-adjacent notation** (e.g. `'1f'`...`'8f'`, mirroring how some
  physical rulesets number flower/season tiles). Rejected: even though `f`
  is outside the `[mpsz]` character class so it wouldn't match the existing
  `[1-9][mpsz]` regex today, it *reads* like a tile kind and invites a
  future accidental regex widening (e.g. someone generalizes the pattern to
  `[1-9][a-z]` for some unrelated reason) to suddenly start matching
  flowers. Descriptive names have zero chance of that class of collision,
  by inspection, forever.
- **The kanji glyphs themselves as the discriminant** (`'梅' | '蘭' | ...`).
  Rejected: harder to read/type in TypeScript unions and in test code
  (though the glyphs themselves are exactly what render — see Decision 3);
  keeping the *identifier* in English and the *glyph* as data in the face
  map (mirroring `HONORS`' `{ glyph, ink }` shape exactly) is more
  consistent with how `HONORS`/`MAN_RANKS` already separate identifier from
  rendered glyph.
- **Numbered `flower-1`..`flower-8`.** Rejected: opaque: forces every
  reader to cross-reference which index is 梅 vs 蘂 vs 春; the descriptive
  name is self-documenting at every call site and in every test failure
  message.

## Decision 3: Visual treatment

**Chosen: same single-glyph-on-ivory pattern as honors** — one engraved
kanji character (梅蘭菊竹春夏秋冬) per face, ink-colored, no background
illustration.

### Options considered

- **Single glyph, honors-style (chosen).** Cheapest in bytes (a handful of
  `<text>` elements, same font stack, same engraving stroke technique
  already proven three times over in this file), lowest new-code risk
  (zero new coordinate tables, zero new shape primitives), and visually
  coherent with the rest of the pack — flowers read as "the same family of
  chip, a different face," which is correct: they're still ivory-chassis
  tiles in this pack, just decorative ones.
- **Botanical/seasonal illustrations** (an actual drawn plum blossom spray,
  an orchid stem, etc., in the spirit of a real Taiwan flower tile). More
  faithful to the physical referent, but meaningfully more bytes per face
  (closer to the 1s bird's hand-drawn multi-shape composition than to a
  single glyph) and more design risk across 8 faces in one ticket. The
  ticket's job is "decorative-only asset that prepays a future variant and
  proves the size gate" — not the final word on flower art fidelity. Nothing
  stops a later ticket from upgrading these 8 faces to full illustrations
  once the Taiwan variant ticket actually wires them in and an owner review
  can weigh in on the fuller composition; the glyph version is intentionally
  the cheap, correct-for-now placeholder given the "prepay" framing, not
  the last art pass.
- **Mixed: illustrate only 1s-style the four seasons, glyph the four
  flowers (or vice versa).** Rejected for inconsistency with no clear
  benefit — an asymmetric visual treatment across the 8 decorative tiles
  reads as unfinished, not as a deliberate distinction.

### Ink color

One consistent ink for all 8 — `#8a5a3c` (a warm amber-brown), distinct from
every suit ink (`m` red, `p` blue, `s` green) and every honor ink (winds'
dark neutral, haku's blank frame, hatsu green, chun red — note `#8a5a3c`
does not collide with hatsu's `#2e7d4f` or chun's `#a03c2e`). A single
shared ink (rather than 8 distinct colors, or a flowers/seasons 2-color
split) keeps the "this whole family is decorative, not a suit" read
immediate and consistent, and requires zero new design judgment calls per
face beyond picking the one color.

## Decision 4: The "no flower kind in a folded/dealt hand" test

**Chosen: two complementary assertions, both in `tile.ssr.test.ts`** (not
`src/core/`, since core stays untouched and has no flower concept to test
against):

1. **Type/enumeration-level disjointness.** A test iterates
   `TILE_KINDS` (the exact 34-member domain `buildWall`/`deal.ts` ever draw
   from — see Research) and confirms none of `FLOWER_KINDS`'s 8 identifiers
   or glyphs equals or appears embedded in a real kind string. Since
   `TileKind` and `FlowerKind` are disjoint TypeScript unions with no shared
   values by construction, this also documents *why* the guarantee holds:
   `TILE_KINDS` is the literal enumeration of everything `foldRecord`
   can ever place into a hand, and it is checked against the flower
   identifiers directly, not against some derived subset.
2. **Content-level render sweep.** Render all 34 `chipOf(kind)` (the exact
   sweep the file's existing "full set at once" describe block already
   performs) and assert none contains any of the 8 flower glyphs
   (梅蘭菊竹春夏秋冬) as a substring — symmetric to how -03 proved 萬
   appears on man kinds and nowhere else. This is the strongest practical
   guarantee: even if a future edit accidentally shared a helper or copy-
   pasted a flower glyph into a numbered-suit branch, this test fails
   immediately. Combined with the reverse per-flower positive/negative sweep
   (each flower glyph appears on its own flower id and nowhere among the
   other 7 flowers or the 34 real kinds), this fully specifies "no flower
   kind can appear in a folded/dealt hand under the Riichi ruleset": the
   only faces a folded/dealt hand can ever render are the 34 real ones, and
   none of those 34 ever contain flower content.

### Rejected: a `src/core/` test

Rejected outright — core has no flower type and must stay untouched;
importing a flower concept into `src/core/*.test.ts` would either require
adding it to core (violates the epic's view-only constraint) or awkwardly
hard-coding glyphs in a core test file with no source of truth. The
`app`-level test is the correct boundary: it exercises the real rendered
output of everything the engine can produce, which is the actual claim
being verified.

## Decision 5: The size gate

**Chosen: add one more rule to `verify-single-file.mjs`** — `bytes <=
300_000` fails with rule name `size-ceiling`, placed after the existing
`bytes` computation at the bottom of the file (the only place `bytes` is
already in scope), reusing the same `fail(rule, detail)` idiom as every
other rule. No configuration file, no environment variable — a single
`const SIZE_CEILING_BYTES = 300_000` constant, consistent with the file's
existing style of inline constants (e.g. the `10_000` non-trivial floor).

No alternative was seriously considered: the ticket names the exact
mechanism (`verify-single-file.mjs` enforces a ~300KB upper bound), and the
file's existing rule-per-check structure is the obvious extension point.

## What this ticket does NOT do (explicitly out of scope)

- No wiring into `Table.svelte`, `App.svelte`, `deal.ts`, `wall.ts`, or any
  `src/core/` file.
- No flower-matching / bonus-draw / replacement-draw game logic.
- No illustrated (multi-shape) flower art — glyph-on-ivory only, per
  Decision 3.
- No change to any existing face branch, the chassis rects, the `.kind`
  span's existing behavior for real kinds, or any existing test.
