# T-007-01-01 — svg-tile-chassis-honors-backs — Design

## The decision in one paragraph

Rebuild Tile.svelte's internals as one self-contained inline SVG per chip — a
defs-free chassis (layered rounded rects: shadowed body, beveled edge, ivory face)
with the glyph engraved as SVG `<text>` using platform CJK/system fonts — plus a
sibling visually-hidden `<span>` carrying the mpsz kind token that the SSR regex
matches. Honor faces are kanji (東南西北 ink, 中 red, 發 green, 白 an engraved empty
frame); numbered kinds get an interim chassis face (rank numeral over a small suit
mark, rank and suit in *separate* text nodes so no stray `[1-9][mpsz]` token forms);
the back is the same chassis with a solid colored back-face and no kind token. The
component's prop widens to `id: TileId | 'back'`; existing consumers pass a TileId
and never move.

## Decision 1 — glyphs: SVG `<text>`, not hand-authored paths, not fonts shipped

- **Chosen: SVG `<text>` with generic font stacks (`serif` for kanji, current
  numeric styling for interim faces).** The original art is the chassis, the
  composition, the palette, and the engraving treatment; the kanji 東南西北中發 are
  Unicode script characters rendered by the viewer's OS fonts — neither scanned nor
  cloned commercial tile artwork, so the provenance invariant holds. Every target
  platform (iOS, Android, desktop) ships CJK glyphs. Bytes: near zero. This is also
  the only approach that scales to T-007-01-03's 萬 kanji numerals without weeks of
  path authoring.
- **Rejected: hand-authored `<path>` strokes per kanji.** Strongest provenance
  story, pixel-identical everywhere — but 6+ multi-stroke kanji as bezier art is
  high-effort, high-risk aesthetically (badly drawn 發 is worse than none), and
  kilobytes per glyph against the coming 300KB ceiling. Revisit only if platform
  font rendering disappoints in playtest.
- **Rejected: shipping a font subset.** New asset/dependency, fights
  single-file inlining and the no-new-dependency AC outright.

## Decision 2 — chassis: layered rects, zero `<defs>`, one SVG per Tile instance

Each rendered Tile is its own `<svg>` (~10 elements). With ~40 tiles on a live
table, `<defs>`+`<use>`/gradient sharing would need either duplicate ids per
instance (invalid HTML, first-instance wins) or a defs host in App/Table (violates
"Table and App never move"). So: **no defs, no ids, no gradients** — the bevel is
faked with three stacked rounded rects (dark under-body offset down = the tile's
thickness and drop shadow; edge tone; ivory face inset) and the engraving with
fill + a hairline darker stroke on the glyph. Deterministic SSR output, no id
collisions, trivially rotatable by the consumers' existing transforms. Bundle cost
is paid once (the component template), not per instance.

Geometry: `viewBox="0 0 60 84"` (the 5:7 mahjong proportion), CSS size
`width: 1.5em; height: 2.1em` on the current 0.8rem font-size context — the same
footprint width as today's chip, one third taller. Ponds wrap inside
`max-width: 9.5rem`; at ~1.2rem/tile that stays 7 per row, and the extra height is
absorbed by the flex rows (SSR tests assert no layout; P4 eyeball check at `just
dev` covers feel). `.pond { min-height: 1.6em }` in Table still reserves *some*
row height — imperfect (a tad short) but harmless, and Table is out of scope by
the ticket's own doctrine.

## Decision 3 — the kind token: hidden `<span>` sibling, single source of the regex match

```svelte
<span class="tile" ...>
  <svg aria-hidden="true" ...>…face…</svg>
  <span class="kind">{kind}</span>   <!-- visually hidden, real text -->
</span>
```

- Emits exactly one `>1z<`-style token per tile — the SSR multiset test's whole
  contract. The SVG is `aria-hidden` and contains **no text node matching
  `[1-9][mpsz]`**: honor kanji can't match; interim numbered faces split rank and
  suit into separate `<text>` elements (`>5<` and `>m<` never form `>5m<`).
- Hidden via the standard clip pattern (absolute, 1px, `clip-path: inset(50%)`,
  `overflow: hidden`, `white-space: nowrap`) — **not** `display:none`, so the token
  stays the accessible name of non-interactive chips (pond tiles, dora), exactly
  the role the visible text plays today.
- Region-slice safety: the token's own `</span>` is the first `</span>` after the
  "drawn tile"/"winning tile" labels, and the token text precedes it — regionTokens
  keeps slicing correctly. `</tspan>` (if tspans are ever used) does not contain
  the substring `</span>`.
- No `<title>` elements in the SVG (a `<title>1z</title>` would double-count), and
  no English wind words anywhere in Tile's output (the four-winds-exactly-once
  test). The back's hidden text is "tile back" — word-safe.

**Rejected: keeping the kind visible in a corner of the face** (like index marks on
playing cards). Honors don't carry latin indices on real tiles and it fights the
Taiwan look; the teaching layer speaks through labels and prompts, not face text.

## Decision 4 — prop API: `id: TileId | 'back'`

- **Chosen:** widen the one existing prop to the union. `TileId` is `number`, so
  `typeof id === 'number'` discriminates cleanly; a back caller writes
  `<Tile id="back" />`. Invalid states (a back with a kind, an id-less face) are
  unrepresentable; every current consumer compiles unchanged.
- **Rejected: `back?: boolean` beside optional `id`** — representable nonsense
  (`id` and `back` both set, neither set) that svelte-check can't rule out.
- **Rejected: a separate TileBack.svelte** — the back shares the whole chassis;
  two components means the chassis geometry lives twice or gets extracted into a
  third thing. One leaf, one union prop.

The back renders the body + edge + a solid back-face panel (deep indigo-blue
`#31588f` family — distinct from the green felt `#1e6b4e` so backs read against
it), no glyph, no kind token, hidden text "tile back".

## Decision 5 — the seven honor faces + interim numbered faces

- **Winds 1z–4z:** single large engraved kanji 東/南/西/北, near-black ink
  (`#2b2b2b`, today's `.suit-z` color).
- **7z chun:** 中 in the established red (`#a03c2e`, today's `.suit-m`).
- **6z hatsu:** 發 in the established green (`#2e7d4f`, today's `.suit-s`).
- **5z haku:** no glyph — an engraved thin rounded-rect frame in a pale blue-gray,
  the classic "blank with border" haku. (A truly blank face would be
  indistinguishable from a face-up back-side-less chip.)
- **Interim m/p/s faces (until -02/-03):** the rank numeral, large, in the suit's
  established color, over a small suit mark below — 萬 for m (prefiguring -03),
  a filled circle for p, a bamboo stick (thin rounded rect) for s. Rank and suit
  mark are separate SVG nodes — legible, tile-flavored, regex-silent.

Kind→face mapping lives in a small `$derived` lookup in Tile's script (kanji char +
ink color per honor kind), keeping the template a handful of branches: back |
honor-kanji | haku-frame | interim-numbered.

## Testing strategy

Existing `app.ssr.test.ts` already proves the load-bearing constraints (token
multiset, regions, wind-word count) — it runs unchanged. Add
`src/app/tile.ssr.test.ts` rendering Tile directly (same `svelte/server` pattern):
one token per kind for all 34 kinds; exactly one `<svg` per chip; honor faces carry
their kanji; back emits `<svg` but zero kind tokens and no wind words; nothing in
any face matches the token regex beyond the hidden span. That file is the chassis
contract -02/-03 build on. `just check` guards types; `just build` proves
single-file inlining still holds.

## Out of scope, stated

Wiring backs into Table (opponent hands/wall rows), flower tiles, the size ceiling
(-04), any Table/App/ClaimPrompt edit, anything under `src/core/`.
