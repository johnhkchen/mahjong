# T-007-01-01 — svg-tile-chassis-honors-backs — Research

## The ticket in one sentence

Replace Tile.svelte's text face with an original inline-SVG tile chassis (ivory face,
beveled body, engraved glyph) plus a tile back, proven on the 7 honor kinds — while a
visually-hidden per-tile kind token keeps the existing SSR assertions (`>1z<`-style)
green, and `src/core/` stays byte-for-byte untouched.

## Where the change lives — exactly one component

`src/app/Tile.svelte` (46 lines) is the presentational leaf: `{ id }: { id: TileId }`
in, one chip out. Its face today is the mpsz kind text:

```svelte
<span class="tile suit-{suit}">{kind}</span>
```

Its own header comment anticipates this ticket verbatim: "The future tile-art ticket
replaces this component's internals (kind text → original SVG face); Table and App
never move."

### Consumers (both pass only `id`, nothing else)

- `src/app/Table.svelte` — ponds (with `.claimed` opacity+8° rotate), melds (claimed
  tile in a `rotate(90deg)` wrapper), the player's 13-tile hand and drawn tile (each
  inside a chrome-free `<button class="tap">`), dora indicator, winning-tile chip.
- `src/app/ClaimPrompt.svelte` — the "call on <Tile/>?" header, each call button's
  `uses` tiles, the ron button's winning tile.

No consumer renders a tile back today: opponents' hands never render (concealed
information), and there is no wall display. The back is a new Tile capability with no
current caller — its API is a design decision, not a discovered constraint.

## The test contract — what "SSR/drive tests stay green" actually means

`src/app/drive.test.ts` never renders markup (it tests drive.ts selectors); it is
untouched by construction. The whole rendering contract is `src/app/app.ssr.test.ts`
(385 lines), which renders through the real Svelte SSR compiler and asserts *content
and aria landmarks only, never classes or structure* — its header explicitly grants
Tile's internals freedom to change. Its mechanics constrain us precisely:

1. **`tileTokensOf(body)`** = every match of `/>([1-9][mpsz])</g` over the raw SSR
   string. The dealt-table test asserts **multiset equality**: the 13 dealt kinds +
   dora indicator, *and nothing more renders as a tile*. So each Tile instance must
   emit its kind **exactly once** as a text node abutting tags (`>1z<`), and the SVG
   internals must emit **zero** accidental matches. Attribute values (`aria-label`,
   `d=`, `class=`) sit inside tags, not between `>`/`<`, so they can't match; an SVG
   `<title>1z</title>` WOULD match and double-count — forbidden.
2. **`regionTokens(body, label, closeTag)`** slices from `aria-label="..."` to the
   first `closeTag` after it. Two regions close on `</span>` ("drawn tile", "winning
   tile"): the kind token must therefore appear **before the first `</span>`** that
   follows the region's opening — i.e. if Tile's internals contain a `<span>`, the
   token must come inside/before it, or Tile must contain no `</span>` before the
   token. (`</tspan>` does not contain the substring `</span>` — SVG text is safe.)
3. **`body.split(wind).length - 1 === 1`** for East/South/West/North — the SSR body
   may contain each English wind word exactly once (the seat labels). The honor
   faces must NOT introduce the words East/South/West/North anywhere — not in
   aria-labels, not in `<title>`s, not in comments that survive SSR.
4. **`body.split('melds"').length - 1 === 1`** — trivially safe unless Tile emits
   a `melds"` substring.
5. Button counts split on `aria-label="discard ` — Table-level labels, unaffected.

Svelte 5 SSR renders `{kind}` inside an element as a bare text node (that is what
makes `>1z<` match today), and SVG elements SSR fine through `svelte/server`.

## The tile domain facts (core, read-only)

`src/core/tiles.ts`: `kindOf(id): TileKind`, `suitOf(kind): 'm'|'p'|'s'|'z'`. Honors
in mpsz order: **1z–4z = East/South/West/North winds, 5z = haku (white dragon),
6z = hatsu (green dragon), 7z = chun (red dragon)**. Numbered kinds 1m–9s exist and
render constantly mid-game — this ticket draws honor faces only, so the chassis must
still carry a legible interim face for m/p/s kinds until T-007-01-02/-03 (pin/sou
pips, man kanji) land on the same chassis. Sibling tickets confirm the split:
-02 and -03 both `depends_on: [T-007-01-01]` and say "on the established chassis";
-04 adds the 8 flowers and a ~300KB single-file ceiling.

## The aesthetic direction (owner decision, recorded)

Owner decision 2026-07-02 (memory `owner-taiwan-16-tile-direction`, echoed in
vision/charter): the tile aesthetic is **Taiwan-style from the start** — ivory face,
beveled body, bold engraved glyphs, **kanji honors**. The ticket Context repeats the
chassis words. Standard kanji faces: 東南西北 for winds, 中 (red) for chun, 發
(green) for hatsu, and haku traditionally a blank face or plain frame. The
architecture invariant "original tile art only" means we draw these ourselves —
kanji shapes as original vector strokes/paths or SVG `<text>`; no copied commercial
assets, no font files shipped (a font dependency would also fight the single-file
build and the no-new-dependency AC).

## Styling and layout reality around the chip

- Tile today: `inline-flex`, `min-width: 1.5em`, `padding: 0.3em 0.2em`,
  `font-size: 0.8rem` — roughly 1.5em × 1.6em at 0.8rem. Everything around it is
  sized in em/rem: `.pond { min-height: 1.6em; max-width: 9.5rem }` reserves one
  tile row; hand/pond wrap with 0.15rem gaps inside a `min(100%, 70dvh)` square
  felt grid. A substantially larger chip would overflow the 9.5rem pond width for
  long ponds (SSR tests don't assert layout, but P4 is "feel").
- Rotations applied by consumers (`rotate(90deg)` meld claim, `rotate(8deg)` pond
  claim) act on the Tile root's box — an inline SVG chip rotates as a unit, no work
  needed on the Tile side.
- Suit-tinted face colors live in Tile's scoped CSS (`.suit-m/p/s/z`) — internal,
  free to change; nothing outside references those classes (SSR tests never assert
  classes).

## Build and toolchain constraints

- Svelte 5.56.4, Vite 8, `vite-plugin-singlefile`: everything inlines into one
  `dist/index.html`. `scripts/verify-single-file.mjs` gates the build (exactly one
  file, no reference attributes, >10KB). No size ceiling yet — T-007-01-04 adds
  ~300KB; the chassis should stay lean (shared defs per face, not per instance —
  though note each Tile instance SSRs its own SVG markup; ~40 tiles on screen).
- Commands: `just test` (vitest, node env), `just check` (svelte-check + tsc),
  `just build`. svelte-check must pass — SVG-in-Svelte is fully supported; a11y
  lint may flag nothing new if the hidden token remains real text.
- **No new dependency** (AC): hand-authored SVG only.

## Accessibility as-is

The visible kind text is currently the accessible name of every non-interactive tile
chip (pond tiles, dora, meld tiles); interactive/marked wrappers get explicit
aria-labels from consumers ("discard 1z", "claimed 2p from north"). The
visually-hidden kind token must remain *real rendered text* (not `display:none`,
which SSR would still emit but AT would skip — and `display:none` text still matches
the regex; the a11y question and the regex question are separable but both favor a
clip-pattern hidden span).

## Concurrency note

Other lisa threads have `src/core/shanten.*` and several T-005/T-006 tickets dirty in
the working tree. This ticket touches only `src/app/Tile.svelte` (+ possibly a new
test file in `src/app/`) and `docs/active/work/T-007-01-01/` — no overlap, and the
"core byte-for-byte untouched" AC is satisfied by simply never editing `src/core/`.

## Constraints and assumptions surfaced

- Exactly one `>kind<` token per rendered tile; zero stray `[1-9][mpsz]` text nodes
  from the SVG; no English wind words; token before any early `</span>` closers.
- Honor faces (7) + back are the deliverable; m/p/s kinds keep a legible interim
  face on the same chassis (their tokens already render and are asserted today).
- The back has no consumer yet — Tile grows the capability; wiring it into Table
  (opponent hands, wall) is future tickets' work.
- Original art, hand-authored inline SVG, no fonts, no assets, no new deps.
- Only `src/app/Tile.svelte` internals change; Table/App/ClaimPrompt stay put.
