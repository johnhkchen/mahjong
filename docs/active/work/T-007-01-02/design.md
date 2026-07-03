# T-007-01-02 — pin-sou-numbered-faces — Design

## The decision in one paragraph

Replace the interim p/s branches in Tile.svelte with data-driven pip faces: two
module-level layout tables (rank → pip placements, precomputed for all nine ranks
each) rendered by `{#each}` loops — coins for pin, bamboo sticks for sou — plus
one hand-authored geometric bird for 1s. Each coin is exactly one `<circle>`
(ink fill, darker ring stroke) with an ivory square-hole `<rect>` — the classic
cash-coin silhouette; each bamboo stick is exactly one `<rect>` (rounded, green,
darker stroke) with an ivory joint `<line>`. Faces use the established suit inks
with traditional red accents (center/middle pips on 5p, 5s, 7s, 9s and odd-pin
centers). No `<text>` node appears in any p/s face — the token contract holds by
construction. The hidden `.kind` span, chassis, honors, back, and the m interim
branch are untouched. Tests extend `tile.ssr.test.ts` with pip-multiplicity,
text-free-face, and all-34-distinct assertions in the established content-only
style.

## Decision 1 — data tables + `{#each}`, not 18 markup branches, not components

- **Chosen: precomputed layout constants in the module script.**
  `PIN_LAYOUTS: Record<Rank, Coin[]>` and `SOU_LAYOUTS: Record<Rank, Stick[]>`
  (2s–9s; 1s is its own branch), where a Coin is `{cx, cy, r, ink}` and a Stick
  is `{x, y, h, ink, tilt?}`. The template gains two `{#each}` branches. The
  arrangement logic (rows/columns/diagonals) runs once at module load in plain
  helper functions — legible as data, ~60 lines total, one file.
- **Rejected: eighteen literal SVG branches.** ~300 lines of near-duplicate
  markup in the template; every art tweak touches nine places.
- **Rejected: PinFace/SouFace child components.** The chassis doctrine is one
  presentational leaf; child components add files and props for zero boundary
  value — the faces share the chassis's coordinate space and palette.
- **Rejected: `<defs>`/`<use>` for the repeated coin/stick.** Banned by the
  chassis design (Decision 2 there): ~40 chips per table are independent inline
  SVGs; shared ids collide. Pips repeat inline; the bundle cost is one template.

## Decision 2 — the pip vocabulary fixes the test contract

The elements are chosen so semantic assertions stay content-only:

- **Coin = one `<circle>` + one `<rect>` hole.** Circle: fill = pip ink, stroke =
  a darker shade, stroke-width ~1.5 (the ring). Rect: a small ivory square
  (`#f6f1e4`, side ≈ 0.65r) centered on the coin — the punched square hole of a
  Chinese cash coin, very much the Taiwan-parlor look, and it makes even the
  plainest face unmistakably a *coin*, not a dot. Test: circle-count of `Np`'s
  chip == N. (No other element on a pin face is a circle.)
- **Stick = one `<rect>` + one `<line>` joint.** Rect: rounded (rx ≈ half width),
  fill = pip ink, hairline darker stroke. Line: a short ivory crossing line at
  the stick's waist — the bamboo joint that makes a bar read as bamboo. Test:
  rect-count of `Ns`'s chip == 2 (chassis: under-body + face) + N for N ≥ 2.
  8s's tilted sticks are the same rect with a `transform="rotate(…)"` — still one
  rect each, so the count holds.
- **No `<text>` in any p/s face.** Pure shapes cannot form a `[1-9][mpsz]` token;
  assert `<text` absent outright — a stronger, simpler guarantee than -01's
  "separate nodes" discipline, and it pins that the interim numerals are gone.
- **1s bird marker: `<ellipse>`.** The bird's body is the only ellipse in the
  whole tile set — a clean identity assertion without classes or geometry.

## Decision 3 — layouts: the public-domain conventions, sized to the 46×66 face

Center column x=30; art inset ≈ x 8–52, y 8–72. Coin radius shrinks with count
(1p ≈ 16 down to 9p ≈ 6.5); stick size likewise. Arrangements (all centuries-old
convention, no set copied):

- **Pin**: 1p one grand coin; 2p stacked pair; 3p falling diagonal; 4p 2×2;
  5p quincunx; 6p 2×3; 7p diagonal-of-3 over a 2×2 quad; 8p 2×4; 9p 3×3.
- **Sou**: 2s stacked pair; 3s one-over-two; 4s 2×2; 5s quincunx; 6s 2×3;
  7s one-over-2×3; 8s two facing gables (∧ over ∨, four tilted sticks per gable
  pair — the "mountain" eight); 9s 3×3.

Exact coordinates are implementation detail (structure.md sketches them; tests
never pin them), tuned so no pip crosses the face's rounded corners or hairline.

## Decision 4 — color: established inks, sparing traditional red accents

Dominant ink stays the suit's established color — p `#2e5aa0` blue, s `#2e7d4f`
green — so suits keep their at-a-glance identity from the interim faces and the
teaching UI. Red (`#a03c2e`, the established red) accents where tradition puts
emphasis: the center coin of 1p, 3p, 5p; the middle coin of 7p's diagonal; the
center coin of 9p; the center stick of 5s; the lone top stick of 7s; the middle
row of 9s; the bird's beak/crest on 1s. Ring/stroke shades are fixed darker
tones of each ink (p ring `#1f3f73`, s stroke `#1f5737`, red's `#7a2b20`) — flat
derived constants, no color math at runtime. Green does not appear on pin faces
and blue not on sou faces: two-ink faces stay calm at 1.5em wide.

- **Rejected: full traditional multicolor pins (blue/green/red mixed per rank).**
  Real sets disagree with each other anyway; at this render size a three-color
  3×3 is noise, and copying any one set's exact color assignment is exactly the
  provenance smell we avoid.

## Decision 5 — 1s: a geometric bird, not a stalk, not the interim face

- **Chosen: a minimal geometric bird on a bamboo perch.** Ellipse body + circle
  head + triangle beak (red) + two rectangle tail feathers + ivory eye dot +
  one vertical stick below as the perch (the same stick vocabulary, tying the
  bird to its suit). ~7 flat shapes, same palette — deliberately stylized so it
  reads as intentional flat design, not failed realism ("badly drawn 發 is worse
  than none" applies; geometry is the mitigation).
- **Why a bird at all:** every learning resource and real set the player will
  ever cross-reference shows 1s as the bird. Teaching-first (P4) says don't
  create a mismatch on the one tile famous for being confusing.
- **Rejected: a single large bamboo stalk.** Safest to draw, but it invites the
  exact beginner error the bird prevents — misreading 1s as "some bamboo" and
  miscounting. Falls back here only if playtest damns the bird.
- **Rejected: keeping the interim numeral for 1s only.** A lone latin numeral in
  an otherwise pip-art suit is worse than either option.

## Decision 6 — scope fence

The m branch (numeral + 萬) stays byte-identical — T-007-01-03 owns it. Chassis
rects, honors, haku, back, `.kind` span, prop API, CSS: untouched except that the
now-unused parts of the interim branch (`.rank` text node for p/s, the small
p/s marks) disappear. `SUIT_INK` stays (m still uses it; p/s inks move into the
pip tables or stay referenced from them — implementation's choice, no contract).
No Table/App/ClaimPrompt edits; nothing under `src/core/`.

## Testing strategy

Extend `src/app/tile.ssr.test.ts` with a `pip faces` describe:

1. **Coin multiplicity**: for ranks 1–9, `chipOf(`${r}p`)` contains exactly r
   `<circle` occurrences.
2. **Stick multiplicity**: for ranks 2–9, `chipOf(`${r}s`)` contains exactly
   2 + r `<rect` occurrences.
3. **The bird**: `chipOf('1s')` contains `<ellipse`; no other kind in TILE_KINDS
   does.
4. **Text-free pip faces**: no `<text` in any p/s chip (m keeps its numerals for
   now — asserted still present, so -03 inherits a pinned starting point).
5. **All 34 faces distinct**: the 34 chip bodies are pairwise distinct strings.

Existing suites run unchanged: the 34-kind token sweep already proves the new
faces emit no stray tokens; app.ssr.test.ts proves the table-level contract.
`just check` for types, `just build` for single-file integrity and a size
reading against -01's 77,525-byte baseline (expected growth: a few KB of
template; the layout tables are code, not assets).

## Risks

- **The bird is the only aesthetic gamble.** Mitigated by geometric minimalism,
  the suit palette, and an explicit fallback (stalk) already designed.
- **8s tilted sticks** must not poke outside the face inset — rotation about
  each stick's own center, coordinates chosen with margin; eyeball at `just dev`.
- **Rect-count contract** couples the test to "chassis = exactly 2 rects." That
  is already true and settled by -01; if a future chassis change adds a rect,
  the sou assertion moves with it — acceptable, documented here.
