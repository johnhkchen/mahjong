# T-007-01-02 — pin-sou-numbered-faces — Research

## The ticket in context

Draw the 18 pip faces — 1p–9p (coins) and 1s–9s (bamboo) — on the SVG chassis that
T-007-01-01 established, replacing the interim "numeral over a small suit mark"
faces for those two suits. Manzu (m) keeps its interim face: T-007-01-03 owns the
kanji-numeral 萬 faces. Acceptance: distinct original SVG pip faces for all 18
kinds, SSR tests still resolve kinds via the preserved hidden kind token,
svelte-check green, no new dependency, `src/core/` untouched.

## Where the work lives

Everything happens in one file plus its contract test:

- **`src/app/Tile.svelte`** (~115 lines) — the single presentational leaf. One
  physical tile in (`id: TileId | 'back'`), one chip out. Its own header comment
  says explicitly: "T-007-01-02/-03 replace only the interim numbered branch; the
  chassis, honors, and back are settled here."
- **`src/app/tile.ssr.test.ts`** (8 tests) — the chassis contract this ticket
  builds on and extends.
- **`src/app/app.ssr.test.ts`** — app-level SSR assertions (token multiset,
  regions, four-winds-exactly-once) that must keep passing with zero edits.

No consumer (Table.svelte, App.svelte, ClaimPrompt.svelte) knows anything about
faces; they pass a `TileId` and never move. `src/core/` supplies the vocabulary
only: `kindOf(id)`, `suitOf(kind)`, `rankOf(kind)` (returns `Rank | null`, null
for honors), `TILE_KINDS`, `tileId(kind, copy)`, types `TileKind`, `Rank` (1–9),
`NumberedSuit` (`'m' | 'p' | 's'`).

## The current interim branch (what gets replaced)

`Tile.svelte` lines 66–77: for any numbered suit, a large rank numeral
(`<text class="rank">` at x=30 y=40, font-size 34) in the suit ink, over a small
suit mark below — 萬 text for m, a filled circle (cx=30 cy=62 r=8) for p, a thin
rounded rect (27,50 6×22) for s. Rank and suit mark are deliberately separate SVG
nodes so no `[1-9][mpsz]` text token ever forms.

Established per-suit inks (module script `SUIT_INK`): m `#a03c2e` (red),
p `#2e5aa0` (blue), s `#2e7d4f` (green). Honor ink `#2b2b2b`. Chassis palette:
under-body `#b9a97e`, ivory face `#f6f1e4` stroked `#c9bfa6`, back `#31588f`.

## Chassis geometry (fixed, not this ticket's to change)

`viewBox="0 0 60 84"` (5:7). Under-body: full-bleed rect rx=9. Face: inset rect
x=3 y=2 w=54 h=74 rx=6 — so the usable face area runs x 3–57, y 2–76, with the
bottom 8 units of the viewBox reading as the tile's thickness. Comfortable art
inset (clear of the face's rounded corners and hairline stroke) is roughly
x 7–53, y 6–72: a 46×66 canvas.

## The load-bearing contract (from tile.ssr.test.ts + design doctrine)

1. **One hidden kind token per face chip.** The visually-hidden `.kind` span is
   the only `>([1-9][mpsz])<` match in the chip. Nothing in the SVG may emit a
   text node matching that regex. Pure-shape faces (circles, rects, paths — no
   `<text>` at all) are trivially safe; any `<text>` must never place a digit
   adjacent to m/p/s/z in one node.
2. **One aria-hidden `<svg>` per chip**, ivory `#f6f1e4` present on faces.
3. **No English wind words** (East/South/West/North) anywhere in Tile output.
4. **No `<defs>`, no ids, no gradients** — ~40 chips per live table are each their
   own inline SVG; shared ids would collide (first-instance-wins). The prior
   design explicitly banned defs/ids/gradients; pip faces must repeat elements
   inline instead of `<use>`.
5. **No `<title>` elements** (would double-count tokens / leak names).
6. **Tests are content-only** — no class or geometry assertions — so the art
   stays redrawable. Existing tests count `<svg` occurrences and match glyph/hex
   sentinels; that style is the precedent for any new assertions.
7. **Honor glyph exclusivity**: `tile.ssr.test.ts` asserts each honor kanji
   appears on its kind only — pip faces must not contain 東南西北發中 (they
   won't; they're shapes).

## Aesthetic direction and provenance constraints

- **Original tile art only** (CLAUDE.md invariant): never scanned/cloned
  commercial tile sets. The prior ticket's stance: the original art is the
  chassis, composition, palette, and treatment; layouts of pips (3×3 grids etc.)
  are centuries-old public-domain convention, like kanji being script characters.
- **Owner direction** (memory): Taiwan-style tile aesthetic from the start.
  Taiwan/Hong Kong-style pin faces are coins (circle-with-ring motifs); sou faces
  are bamboo sticks with the traditional red/green accenting; 1s is
  traditionally a bird.
- Prior precedent on risk: "badly drawn 發 is worse than none" — hand-authored
  figurative art is the highest-risk element. The only figurative candidate here
  is the 1s bird; everything else is geometric repetition.

## Traditional pip layouts (public-domain convention, for reference)

- **Pin (coins)**: 1p one large coin; 2p two stacked; 3p diagonal; 4p 2×2;
  5p quincunx; 6p 2×3; 7p a diagonal of 3 over a 2×2 quad; 8p 2×4; 9p 3×3.
  Coin sizes shrink as count grows. Riichi sets typically mix red/green/blue
  across coins in a per-rank pattern.
- **Sou (bamboo)**: 2s two stacked; 3s one over two; 4s 2×2; 5s quincunx with a
  red center; 6s 2×3; 7s one (red) over 2×3; 8s two facing chevrons (∧ over ∨) in
  many sets, or 2×4 columns in others; 9s 3×3 with the middle row (or a diagonal)
  red. 1s is the bird in nearly every real set.

## Build/verify toolchain

`just test` (vitest over the repo — 24 files / 556 tests green at last commit),
`just check` (svelte-check + tsc), `just build` (single-file dist/index.html —
77,525 bytes, gzip 26.66 kB recorded as T-007-01-01's baseline; T-007-01-04 owns
the ~300KB ceiling but gratuitous bloat here would be noticed). Tools run through
flox; `just` recipes exist for all of these.

## Working-tree caveat

The tree carries unrelated in-flight edits from sibling lisa threads (shanten
files, other tickets' docs). This ticket must stage only `src/app/Tile.svelte`,
`src/app/tile.ssr.test.ts` (if extended), and `docs/active/work/T-007-01-02/**` —
the same staged-paths discipline T-007-01-01's review recorded.

## Assumptions surfaced

- "SSR tests still resolve those kinds via the preserved kind token" (AC) means:
  keep the hidden `.kind` span mechanism exactly as-is; only the aria-hidden art
  changes for p/s.
- The m interim branch stays (T-007-01-03's scope); the `{:else if suit === 'm'}`
  structure survives but p/s branches are redrawn.
- No new test *file* is required; extending `tile.ssr.test.ts` with pip-face
  assertions follows the established pattern.
- Pip counts are semantic content (a 7p *is* seven coins), so multiplicity
  assertions are within the content-only doctrine if written against element
  occurrences rather than classes/coordinates — a design-phase decision.
