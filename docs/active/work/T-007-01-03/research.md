# T-007-01-03 — man-numbered-faces — Research

## The ticket in context

Draw the 9 character (man) faces — 1m–9m as engraved kanji numerals with the 萬
mark — on the SVG chassis T-007-01-01 established. Depends on T-007-01-01 (merged:
commit `2933dba`, artifacts `b323351`). Sibling T-007-01-02 (pin/sou pip faces,
same dependency, no work dir yet as of this session) covers the other 18 numbered
kinds; combined, all 34 kinds become original art. Story S-007-01
(original-tile-art-pack) also holds T-007-01-04 (size ceiling). Advances P4
(legibility/feel) and E-007.

## Where the man face lives today

**`src/app/Tile.svelte` (~115 lines)** is the single presentational leaf: one
physical tile in (`id: TileId | 'back'`), one chip out. Its internals after
T-007-01-01:

- **Module context** (lines 1–22): `HONORS` map (kind → engraved kanji + ink;
  5z deliberately absent) and `SUIT_INK: Record<NumberedSuit, string>` — the
  established per-suit palette: `m: '#a03c2e'` (red), `p: '#2e5aa0'` (blue),
  `s: '#2e7d4f'` (green).
- **Instance script** (24–41): derives `kind` (`kindOf(id)` for numbers, null for
  `'back'`), `suit` (`suitOf(kind)`), `honor` lookup.
- **Template** (43–81): one `<svg viewBox="0 0 60 84" aria-hidden="true">` per
  chip. Chassis = full-bleed under-body rect (`#b9a97e`, rx 9) + inset face rect
  (`x=3 y=2 w=54 h=74 rx=6`, ivory `#f6f1e4`, hairline `#c9bfa6` stroke) — the
  bottom strip of under-body reads as the tile's thickness. Branches: back panel |
  honor kanji `<text>` (x=30, baseline y=54, font-size 40, fill+stroke same ink,
  stroke-width 0.75 — the engraving treatment) | 5z empty frame | **interim
  numbered face** (lines 66–77): rank numeral `<text>` (x=30, y=40, fs 34,
  `SUIT_INK[suit]`, ASCII digit `kind[0]`) over a small per-suit mark — for `m`,
  a 萬 `<text>` at x=30, y=68, fs 18, red. Rank and mark are separate text nodes
  *by doctrine*: no SVG text may ever form a `[1-9][mpsz]` token.
- **Sibling kind token** (line 80): visually-hidden `.kind` span carrying the mpsz
  kind (or "tile back") — the chip's accessible name and the SSR tests' `>1z<`
  match. Hidden via clip-path pattern, never `display:none`.
- **Styles** (83–114): `.glyph`/`.rank` share the serif CJK stack
  (`'Hiragino Mincho ProN', 'Noto Serif CJK TC', 'Noto Serif TC', serif`,
  weight 700); chip is 1.5em × 2.1em on a 0.8rem context (5:7, no distortion).

The component's own header comment states the handoff contract: *"T-007-01-02/-03
replace only the interim numbered branch; the chassis, honors, and back are
settled here."*

## The tests that constrain this ticket

**`src/app/tile.ssr.test.ts`** (8 tests) — the chassis contract, rendered through
real `svelte/server` SSR. Pinned behaviors this ticket must keep true:

- *Token exactness*: every one of the 34 kinds emits exactly one `>([1-9][mpsz])<`
  token (the hidden span), and nothing else in the chip forms one.
- *One aria-hidden SVG per chip, ivory `#f6f1e4` face present* on every face chip.
- *No English wind words* (East/South/West/North) from any chip — guards Table's
  four-winds-exactly-once assertion.
- *Honor kanji exclusivity*: each of 東南西北發中 appears on its kind and no other
  (none of the kanji numerals 一–九 nor 萬 collide with these — 南≠萬, 西≠四).
- *5z frame is glyph-free*; back emits chassis but zero tokens; 34-chips+back
  sweep yields exactly the 34 kinds once each.

House doctrine (stated in the file header): content only, never classes or
geometry, so the art stays redrawable.

**`src/app/app.ssr.test.ts`** — app-level multiset + region assertions over the
same token regex; passed unchanged through -01 and must again. **`drive.test.ts`**
exercises the app seam (the AC's "SSR/drive tests green"). Nothing anywhere
asserts on the *interim* man face internals (萬 appears in `src/app/` only inside
Tile.svelte itself; the `src/core/` hits are unrelated — yaku names like 萬子 in
comments/strings and mpsz notation).

## Established design doctrine (from T-007-01-01 design.md)

- **Glyphs are SVG `<text>` via platform CJK serif fonts, not hand-authored paths,
  not shipped fonts** (Decision 1). Explicitly chosen because it "scales to
  T-007-01-03's 萬 kanji numerals without weeks of path authoring." Unicode script
  characters are not commercial tile artwork — provenance invariant holds.
  Fallback (only if playtest finds bad platform rendering): hand-authored paths.
- **No `<defs>`, no ids, no gradients** (Decision 2) — engraving is fill + hairline
  same-color stroke on the glyph.
- **The kind token is the hidden span; SVG must stay regex-silent and
  `<title>`-free** (Decision 3).
- **Owner direction** (memory, confirmed): Taiwan-style tile aesthetic from the
  start; Taiwan 16-tile is the committed post-DoD variant. The -01 review notes
  the interim numbered faces "are not the shipped look."
- The established palette so far: ink `#2b2b2b` (winds), red `#a03c2e` (chun, man),
  green `#2e7d4f` (hatsu, sou), blue `#2e5aa0` (pin), haku frame `#9db4c9`.

## Constraints and boundaries

- **`src/core/` untouched, byte-for-byte.** Everything needed is already exported:
  `TileKind`, `NumberedSuit`, `kindOf`, `suitOf`, `tileId`, `TILE_KINDS`
  (src/core/tiles.ts, re-exported via index.ts). `Rank` is `1..9` as string-typed
  template pieces; `kind[0]` yields the ASCII rank digit.
- **No consumer changes**: Table/App/ClaimPrompt pass `TileId` and never move.
- **No new dependency**, single-file build must stay green (`just build`;
  -01 recorded the baseline: 77,525 bytes, gzip 26.66 kB; the ~300KB ceiling is
  T-007-01-04's concern).
- **Concurrency**: T-007-01-02 will edit the *same* Tile.svelte numbered branch
  (p/s arms) and likely extend tile.ssr.test.ts. The DAG has no edge between -02
  and -03; lisa's commit lock is the safety net. Keeping this ticket's diff
  confined to the `m` arm plus additive test blocks minimizes the collision
  surface. Working tree currently carries unrelated shanten diffs from other
  threads — nothing outside `src/app/` + this work dir may be staged.
- **Verification commands**: `just test` (vitest over src, 556 tests green at
  -01), `just check` (svelte-check + tsc), `just build`.

## What "engraved kanji numerals" means concretely

Real man tiles compose two stacked characters: the rank numeral 一二三四五六七八九
above the suit mark 萬. The interim face already prefigures this (ASCII digit over
a small 萬); this ticket replaces the ASCII digit with the kanji numeral and scales
both characters to a deliberate, engraved, Taiwan-flavored composition. Face
geometry available: the ivory rect spans x 3–57, y 2–76 (54 × 74 units). Color
split conventions in physical sets vary — Japanese riichi sets typically ink the
numeral near-black with 萬 red; Taiwanese sets typically ink the numeral blue with
萬 red. Choosing between these is Design's call (owner direction leans Taiwan).

## Assumptions surfaced

- Platform CJK serif coverage of 一–九 and 萬 is at least as safe as the honor
  kanji already shipped (these are among the most common CJK characters; 萬 is
  already rendering on the interim face).
- No aka-dora (red 5) modeling exists in core; nothing here should invent one —
  5m gets the same treatment as its neighbors.
- Lisa handles ticket frontmatter; this session writes artifacts + code + commits
  only.
