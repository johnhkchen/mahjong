# T-007-01-01 — svg-tile-chassis-honors-backs — Structure

## File-level changes

| File | Change | Contents |
|---|---|---|
| `src/app/Tile.svelte` | **rewrite internals** | SVG chassis + faces + back + hidden kind token; prop widens to `id: TileId \| 'back'` |
| `src/app/tile.ssr.test.ts` | **create** | the chassis contract: tokens, faces, back — the surface -02/-03 build on |

Nothing else. No Table/App/ClaimPrompt edits, nothing under `src/core/`, no config,
no dependencies. Both consumers keep compiling because the prop union only widens.

## Public interface (the component contract)

```ts
let { id }: { id: TileId | 'back' } = $props()
```

- `typeof id === 'number'` → a face chip: chassis + face art + hidden `{kind}` token.
- `id === 'back'` → the back chip: chassis + back panel, hidden text `tile back`,
  **no kind token**.

Everything else about the component is internal and free to change under the SSR
tests' content-only assertions.

## Internal organization of Tile.svelte

### Script block (order as listed)

1. Imports: `kindOf`, `suitOf`, `type TileId` from `../core` (unchanged set).
2. Header comment: updated to describe the chassis system and the token contract
   (the "future tile-art ticket" note has landed — say so; -02/-03 replace only
   the interim numbered faces).
3. `const kind = $derived(typeof id === 'number' ? kindOf(id) : null)`
   `const suit = $derived(kind === null ? null : suitOf(kind))`
4. `HONORS` — a plain module-level lookup, kind → `{ glyph, ink }`:
   `1z 東 / 2z 南 / 3z 西 / 4z 北` in ink `#2b2b2b`; `6z 發` in `#2e7d4f`;
   `7z 中` in `#a03c2e`. **5z is absent** (the haku frame is a template branch,
   not a glyph). Honor lookup result derived: `const honor = $derived(...)`.
5. `SUIT_INK` — m `#a03c2e`, p `#2e5aa0`, s `#2e7d4f` (today's exact palette),
   used by the interim numbered faces.

### Template (one root span, four face branches)

```
<span class="tile">
  <svg class="chip" viewBox="0 0 60 84" aria-hidden="true">
    body + face rects (shared chassis, always rendered; back panel replaces face)
    {#if id === 'back'}         back panel rect
    {:else if honor}            one <text> kanji, fill = honor.ink
    {:else if kind === '5z'}    haku: stroked empty rounded-rect frame
    {:else}                     interim numbered: rank <text> + suit mark
                                (m: small 萬 <text>; p: <circle>; s: bamboo <rect>)
    {/if}
  </svg>
  {#if kind !== null}<span class="kind">{kind}</span>
  {:else}<span class="kind">tile back</span>{/if}
</span>
```

### Chassis geometry (viewBox 0 0 60 84 — the 5:7 tile)

- **Under-body / thickness**: full-bleed rounded rect `(0,0) 60×84 rx 9`,
  fill `#b9a97e` (the darker edge tone) — reads as the tile's side.
- **Face**: inset rounded rect `(3,2) 54×74 rx 6`, fill ivory `#f6f1e4` with a
  hairline stroke `#c9bfa6` — leaving ~8 units of under-body visible at the
  bottom: the bevel/thickness cue. (These are today's exact face/border colors,
  promoted from CSS to SVG fills.)
- **Back panel** (back chips only): same inset rect, fill deep indigo `#31588f`,
  hairline stroke a darker `#24406a`.
- **Glyph text**: `x=30`, centered with `text-anchor="middle"`, kanji at
  `font-size≈40` around `y≈52`, `font-family` a bare generic stack
  (`'Hiragino Mincho ProN', 'Noto Serif CJK TC', serif`), engraved look =
  solid ink fill + `stroke` same ink at hairline width (no gradients, no filters,
  no defs — Decision 2).
- **Haku frame**: `(12,14) 36×50 rx 4`, `fill="none"`,
  stroke pale blue-gray `#9db4c9`, `stroke-width 3`.
- **Interim numbered face**: rank `<text>` at `y≈40, font-size≈34`, fill
  `SUIT_INK[suit]`; below it the suit mark — m: `<text>萬</text>` `font-size≈18,
  y≈68`; p: `<circle cy=62 r=8>`; s: `<rect (27,50) 6×22 rx 3>` — mark fill the
  same suit ink. Rank and suit are **separate nodes**: no `[1-9][mpsz]` text node
  can form (the regex-silence rule from design Decision 3).

### Scoped styles

- `.tile` — `display: inline-flex; position: relative;` (the consumer-rotatable
  box; padding/border/background all move into the SVG).
- `.chip` — `width: 1.5em; height: 2.1em; display: block;` — em-sized so every
  consumer context (0.8rem tables today) scales it as it scales text.
- `.kind` — the visually-hidden clip pattern: `position: absolute; width: 1px;
  height: 1px; clip-path: inset(50%); overflow: hidden; white-space: nowrap;`
  Real rendered text (never `display:none`) — it is the chip's accessible name
  and the SSR token in one.
- The old `.suit-*` classes and text styling are deleted; suit color now lives in
  SVG fills.

### Hard output rules (restated as checklist for implementation)

- Exactly one `>kind<` text node per face chip (the hidden span); zero for backs.
- No SVG `<title>`, no text node matching `[1-9][mpsz]`, no English wind words,
  no `melds"` substring, no element ids.
- The hidden span is the only `</span>` before the root's own — regionTokens'
  `</span>`-sliced regions ("drawn tile", "winning tile") keep working.

## tile.ssr.test.ts — internal organization

Same conventions as `app.ssr.test.ts` (svelte/server `render`, content-only
assertions), with a local copy of the tiny `tileTokensOf` helper (it is
test-file-local there, deliberately not exported).

1. **Token contract, all 34 kinds** — for every kind `tileId(kind, 0)` renders
   exactly `[kind]` as its token multiset (one token, nothing else matches).
2. **Chassis present** — each chip emits exactly one `<svg` and an ivory face rect;
   an `aria-hidden="true"` SVG (art is presentation; the token is the name).
3. **Honor faces** — 東南西北發中 each appear on their kind's chip and on no other
   honor's; 5z contains no kanji but does contain the frame (`fill="none"` rect).
4. **Back** — `id: 'back'` emits `<svg`, zero kind tokens, the "tile back" hidden
   text, and no wind words (guards the app-level four-winds-once test by
   construction).
5. **Regex silence** — a full-set sweep: concatenated SSR of all 34 chips + a back
   yields exactly 34 tokens (the multiset of kinds, once each).

Imports from core: `TILE_KINDS`, `tileId` (public, already exported) — read-only
use, core untouched.

## Ordering

1. Rewrite `Tile.svelte` (component compiles standalone; consumers untouched).
2. Add `tile.ssr.test.ts`.
3. Verify: `just test` (all suites incl. existing SSR), `just check`, `just build`.

One commit — the ticket is one component rewrite plus its contract test; the test
is meaningless without the rewrite and the rewrite unproven without the test.
