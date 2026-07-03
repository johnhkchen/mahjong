# T-007-01-03 — man-numbered-faces — Structure

## Files touched

| File | Change | Size delta |
| --- | --- | --- |
| `src/app/Tile.svelte` | Modify: add `MAN_RANKS` to module context; split the interim numbered branch into a real `m` arm + untouched p/s interim arm | ~+12 lines |
| `src/app/tile.ssr.test.ts` | Modify: append a `man faces` describe block (3 tests) + a `MAN_RANK_GLYPHS` map beside `HONOR_GLYPHS` | ~+35 lines |
| `docs/active/work/T-007-01-03/*` | Create: the six RDSPI artifacts | — |

Created: nothing in `src/`. Deleted: nothing. **Forbidden:** anything under
`src/core/` (byte-for-byte), Table/App/ClaimPrompt, package/config files, the p/s
arm's existing lines beyond the mechanical branch split.

## `src/app/Tile.svelte` — exact shape

### Module context (after `SUIT_INK`, ~line 21)

```ts
// Man rank numerals, keyed by the kind's rank digit. The face composes this
// over the 萬 mark — Taiwan two-color: blue numeral, red mark.
const MAN_RANKS: Record<string, string> = {
  '1': '一', '2': '二', '3': '三', '4': '四', '5': '五',
  '6': '六', '7': '七', '8': '八', '9': '九',
}
```

(Formatted per house prettier style — the repo writes these maps one entry per
line; follow the file's existing `HONORS` layout.)

### Template — the numbered branch (current lines 66–77)

Current single arm:

```svelte
{:else if kind !== null && suit !== null && suit !== 'z'}
  <text class="rank" …>{kind[0]}</text>
  {#if suit === 'm'} <text …>萬</text>
  {:else if suit === 'p'} <circle … />
  {:else} <rect … /> {/if}
```

becomes two arms — man real, p/s interim verbatim:

```svelte
{:else if kind !== null && suit === 'm'}
  <!-- Man face: engraved kanji numeral over the 萬 mark — Taiwan two-color. -->
  <text class="glyph" x="30" y="42" text-anchor="middle" font-size="32"
    fill="#2e5aa0" stroke="#2e5aa0" stroke-width="0.6">{MAN_RANKS[kind[0]]}</text>
  <text class="glyph" x="30" y="70" text-anchor="middle" font-size="24"
    fill={SUIT_INK.m} stroke={SUIT_INK.m} stroke-width="0.6">萬</text>
{:else if kind !== null && suit !== null && suit !== 'z'}
  <!-- Interim p/s face until -02: rank numeral over a small suit mark
       (coin / bamboo stick) — separate nodes, never one token. -->
  <text class="rank" x="30" y="40" text-anchor="middle" font-size="34"
    fill={SUIT_INK[suit]}>{kind[0]}</text>
  {#if suit === 'p'}
    <circle cx="30" cy="62" r="8" fill={SUIT_INK.p} />
  {:else}
    <rect x="27" y="50" width="6" height="22" rx="3" fill={SUIT_INK.s} />
  {/if}
{/if}
```

Notes pinning the shape:

- The numeral's blue is written as the literal `#2e5aa0` (with a comment tying it
  to the palette), *not* `SUIT_INK.p` — the man numeral is not "pin ink"; -02 may
  legitimately retire or restyle `SUIT_INK.p` without repainting man faces.
  `SUIT_INK.m` stays the 萬 mark's red (that mapping survives -02, which only
  consumes p/s entries).
- `MAN_RANKS[kind[0]]` — `kind` is narrowed non-null by the branch guard; `kind[0]`
  indexes a `Record<string, string>` with no cast.
- Both new texts reuse class `glyph` (serif CJK stack, weight 700); the `rank`
  class remains p/s-only. No style-block changes at all.
- Header comment of the component (lines 27–35) gets its one stale phrase updated:
  the interim-branch sentence now names only -02/p/s (the man face is no longer
  interim). One line, no doctrine change.
- No new ids, defs, tspans, titles; no ASCII digits remain anywhere in the man
  arm — the m-face SVG cannot even partially match `[1-9][mpsz]`.

## `src/app/tile.ssr.test.ts` — exact shape

### New fixture, beside `HONOR_GLYPHS` (~line 33)

```ts
// kind → its engraved rank numeral; the 萬 mark is asserted separately since it
// is shared by all nine.
const MAN_RANK_GLYPHS: ReadonlyMap<TileKind, string> = new Map([
  ['1m', '一'], ['2m', '二'], ['3m', '三'], ['4m', '四'], ['5m', '五'],
  ['6m', '六'], ['7m', '七'], ['8m', '八'], ['9m', '九'],
])
```

### New describe block, appended after `honor faces` (before `the tile back`
or at file end — placement is additive either way; end-of-file minimizes
collision with a concurrent -02 append near `honor faces`)

```ts
describe('man faces', () => {
  it('engraves each rank numeral on its own kind and no other', () => {
    for (const [kind, glyph] of MAN_RANK_GLYPHS) {
      expect(chipOf(kind), kind).toContain(`>${glyph}<`)
      for (const other of TILE_KINDS) {
        if (other !== kind)
          expect(chipOf(other), `${glyph} on ${other}`).not.toContain(`>${glyph}<`)
      }
    }
  })

  it('marks all nine man kinds — and only them — with 萬', () => {
    for (const kind of TILE_KINDS) {
      const body = chipOf(kind)
      if (MAN_RANK_GLYPHS.has(kind)) expect(body, kind).toContain('>萬<')
      else expect(body, kind).not.toContain('萬')
    }
  })

  it('renders no ASCII rank digit on any man face', () => {
    for (const kind of MAN_RANK_GLYPHS.keys()) {
      expect(chipOf(kind), kind).not.toMatch(/>[1-9]</)
    }
  })
})
```

Assertion-safety audit (why these can't false-positive):

- Numeral exclusivity sweeps with `>${glyph}<` (full text node), so it cannot
  trip on the hidden token or attributes; no honor kanji equals any of 一–九
  (四≠西), and p/s interim faces render ASCII digits, not kanji.
- The 萬-negative uses bare `'萬'` (stricter): today no other face emits 萬 in any
  position, and -02's pips must not either — this is precisely the suit-signature
  contract worth pinning.
- The no-ASCII-digit test matches text nodes only (`>[1-9]<`), so the hidden
  `>1m<` token (digit followed by `m`, not `<`) stays out of scope.

Existing tests re-verify unchanged: token exactness (the new kanji can't form
mpsz tokens), one aria-hidden SVG + ivory face, wind-word silence, honor
exclusivity (no man glyph collides), 34-kind sweep.

## Interfaces and boundaries (unchanged, restated)

- **Public interface of Tile.svelte:** `id: TileId | 'back'` — untouched.
- **Consumers** (Table, App, ClaimPrompt): zero edits.
- **Core imports used:** `kindOf`, `suitOf`, `TileId`, `TileKind`,
  `NumberedSuit` — all already imported; no import-line change in the component.
  The test file already imports `TILE_KINDS`, `tileId`, `TileKind`.

## Ordering

1. Tile.svelte man arm + `MAN_RANKS` (component change, self-contained).
2. tile.ssr.test.ts additions (pin the new contract).
3. Verify: `just test`, `just check`, `just build`.
4. One commit: component + tests together (the -01 precedent: face + contract as
   one unit), staging only `src/app/Tile.svelte`, `src/app/tile.ssr.test.ts`, and
   this work dir. Artifacts commit follows per lisa convention.
