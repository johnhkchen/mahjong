# T-007-01-04 — flowers-decorative-and-size-gate — Structure

Two files modified, zero files created, zero deleted, zero new dependencies.
`src/core/` untouched.

## 1. `src/app/Tile.svelte`

### Module context (`<script module>`) additions, after `MAN_RANKS` (line 37)
and before the pip-ink constants (line 39-43)

```ts
export type FlowerKind =
  | 'plum'
  | 'orchid'
  | 'chrysanthemum'
  | 'bamboo-flower' // the plant 竹, distinct from the sou suit's bamboo sticks
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'

// Decorative-only faces prepaying the committed Taiwan 16-tile variant (owner,
// 2026-07-02) — never dealt while the ruleset is Riichi. One shared ink flags the
// whole family as "not a suit" at a glance; see design.md Decision 3.
const FLOWER_INK = '#8a5a3c'

const FLOWERS: Record<FlowerKind, { glyph: string }> = {
  plum: { glyph: '梅' },
  orchid: { glyph: '蘭' },
  chrysanthemum: { glyph: '菊' },
  'bamboo-flower': { glyph: '竹' },
  spring: { glyph: '春' },
  summer: { glyph: '夏' },
  autumn: { glyph: '秋' },
  winter: { glyph: '冬' },
}
```

`FlowerKind` is `export`ed (Svelte 5 module-context named export) so
`tile.ssr.test.ts` can import it for typed literals: `import Tile, { type
FlowerKind } from './Tile.svelte'`. `FLOWERS` and `FLOWER_INK` stay
module-private, matching `HONORS`/`SUIT_INK`'s visibility — tests keep their
own local glyph map per the file's existing convention (`HONOR_GLYPHS`,
`MAN_RANK_GLYPHS` are already duplicated, not imported).

### Instance script (currently lines 159-176)

Prop type widens:

```ts
let { id }: { id: TileId | 'back' | FlowerKind } = $props()
```

One new derived, after the existing `honor` derived:

```ts
const flower = $derived(typeof id === 'string' && id !== 'back' ? FLOWERS[id] : undefined)
```

`kind`/`suit`/`rank`/`honor` derivations are unchanged — `kindOf` is still
only called when `typeof id === 'number'`, so no existing derivation touches
the new string-id case.

### Markup (currently lines 179-279)

Outer chassis `{#if id === 'back'} ... {:else} ...{/if}` is unchanged — a
flower `id` is a non-`'back'` string, so it already falls into the ivory-face
`{:else}` branch with zero structural change there.

Inside that branch's existing `{#if honor}...{:else if kind === '5z'}...
{:else if kind !== null && suit === 'm'}...{:else if rank !== null && suit
=== 'p'}...{:else if kind === '1s'}...{:else if rank !== null && suit ===
's'}{/if}` chain (lines 188-275): every existing condition tests `kind`,
`suit`, or `rank`, all of which are `null` when `id` is a flower string, so
none of them fire. Append one final branch:

```svelte
{:else if flower}
  <!-- Flower face: single engraved glyph, honors-style, shared decorative ink. -->
  <text
    class="glyph"
    x="30"
    y="54"
    text-anchor="middle"
    font-size="40"
    fill={FLOWER_INK}
    stroke={FLOWER_INK}
    stroke-width="0.75">{flower.glyph}</text
  >
{/if}
```

Identical `x`/`y`/`font-size`/`stroke-width` to the honors branch (lines
189-198) — same visual weight, same `.glyph` class (font stack), only the
ink and the glyph differ. No new CSS class, no new coordinate table, no new
shape primitive.

### The `.kind` span (currently line 278)

```svelte
<span class="kind">{kind ?? (id !== 'back' ? id : 'tile back')}</span>
```

Replaces the current `{kind ?? 'tile back'}`. For every existing caller
(`id` numeric or `'back'`) behavior is byte-identical: numeric `id` always
yields non-null `kind` (unchanged path), `id === 'back'` still yields `'tile
back'`. The only newly-reachable case is `id` a flower string: `kind` is
null, `id !== 'back'` is true, so the span renders the flower identifier
itself (e.g. `plum`) — the same "raw identifier as accessible name" pattern
every real kind already uses (`1z`, `5m`, etc.), just never itself matching
the `[1-9][mpsz]` token regex, so it cannot be mistaken for a dealt tile by
any existing test.

### Header comment (lines 162-170)

Amend the existing invariant comment to name the flower branch, mirroring
how -02/-03 updated the same comment for their arms: the "must never emit a
`[1-9][mpsz]` text node... nor an English wind word" sentence gains a
clause noting flower ids render their own glyph and are never wired to a
real `TileId`.

## 2. `src/app/tile.ssr.test.ts`

One new top-level `describe` block, appended after `describe('pip faces...')`
(currently ending line 175) and before `describe('the full set at once', ...)`
(line 177) — placed before the full-set sweep so that sweep's existing
34-kind assertions are visually adjacent to the new flower-exclusion
assertions that extend it.

```ts
import Tile, { type FlowerKind } from './Tile.svelte' // widen existing import

// kind → its engraved glyph — the decorative flower family, never dealt.
const FLOWER_GLYPHS: ReadonlyMap<FlowerKind, string> = new Map([
  ['plum', '梅'],
  ['orchid', '蘭'],
  ['chrysanthemum', '菊'],
  ['bamboo-flower', '竹'],
  ['spring', '春'],
  ['summer', '夏'],
  ['autumn', '秋'],
  ['winter', '冬'],
])

function flowerChipOf(kind: FlowerKind): string {
  return render(Tile, { props: { id: kind } }).body
}

describe('flower faces — decorative only, never dealt', () => {
  it('engraves each flower glyph on its own kind and no other flower kind', () => {
    for (const [kind, glyph] of FLOWER_GLYPHS) {
      expect(flowerChipOf(kind), kind).toContain(`>${glyph}<`)
      for (const [other, otherGlyph] of FLOWER_GLYPHS) {
        if (other !== kind) expect(flowerChipOf(kind), `${otherGlyph} on ${kind}`).not.toContain(otherGlyph)
      }
    }
  })

  it('never appears on any of the 34 real kinds a folded/dealt hand can contain', () => {
    // TILE_KINDS is the exact domain buildWall/deal.ts ever draw from — see research.md.
    // No flower glyph may leak into a chip a real hand can ever render.
    for (const kind of TILE_KINDS) {
      const body = chipOf(kind)
      for (const glyph of FLOWER_GLYPHS.values()) expect(body, `${glyph} on ${kind}`).not.toContain(glyph)
    }
  })

  it('is disjoint from TILE_KINDS by identifier, not just by glyph', () => {
    const flowerIds = new Set(FLOWER_GLYPHS.keys())
    for (const kind of TILE_KINDS) expect(flowerIds.has(kind as unknown as FlowerKind)).toBe(false)
  })

  it('renders one aria-hidden SVG on an ivory face, same chassis as real tiles', () => {
    for (const kind of FLOWER_GLYPHS.keys()) {
      const body = flowerChipOf(kind)
      expect(body.split('<svg').length - 1, kind).toBe(1)
      expect(body, kind).toContain('aria-hidden="true"')
      expect(body, kind).toContain('#f6f1e4')
    }
  })
})
```

Purely additive — zero existing `describe`/`it` blocks edited. The existing
`chipOf`/`TILE_KINDS` imports are reused as-is; only the `Tile` import line
widens to pull the new named type export.

## 3. `scripts/verify-single-file.mjs`

One new rule, inserted after the existing `bytes` computation (current line
57) and before the success `console.log` (line 58):

```js
const SIZE_CEILING_BYTES = 300_000 // ~300KB — the full pack (34 faces + 8 flowers) stays lean

if (bytes > SIZE_CEILING_BYTES) {
  fail('size-ceiling', `index.html is ${bytes} bytes — over the ${SIZE_CEILING_BYTES}-byte single-file ceiling`)
}
```

Placed last so every existing rule (which can run on the raw `html` string
before `statSync` is even called) is unaffected; this rule is the only one
needing `bytes`, so it sits right where `bytes` first comes into scope,
matching the file's existing "each rule reads what it needs, in the order
its input becomes available" structure.

## Ordering

1. `Tile.svelte` (flower faces) — self-contained, no dependency on the other
   two changes.
2. `tile.ssr.test.ts` (flower tests) — depends on (1)'s `FlowerKind` export
   and face branch existing.
3. `verify-single-file.mjs` (size gate) — independent of (1)/(2); could run
   first or last. Ordered last here only because verifying the gate passes
   with the flower faces actually inlined is the natural final check.

## Files explicitly NOT touched

`src/core/*` (all of it), `src/app/Table.svelte`, `src/app/App.svelte`,
`src/app/ClaimPrompt.svelte`, `src/app/app.ssr.test.ts`,
`src/app/drive.ts`/`drive.test.ts`, `package.json`, `vite.config.ts`.
