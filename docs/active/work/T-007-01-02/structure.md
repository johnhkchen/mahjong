# T-007-01-02 — pin-sou-numbered-faces — Structure

## Files

| File | Change |
| --- | --- |
| `src/app/Tile.svelte` | **Modified.** Module script gains the pip vocabulary + layout tables; template's p/s branches replaced with pip rendering; m branch and everything else untouched. |
| `src/app/tile.ssr.test.ts` | **Modified.** New `pip faces` describe block (5 tests); existing tests untouched. |
| `docs/active/work/T-007-01-02/*` | **Created.** RDSPI artifacts. |

Nothing else. No new files, no deps, no config, no `src/core/`, no consumers.

## Tile.svelte — module script additions

All in the existing `<script lang="ts" module>` block, below `SUIT_INK` (which
stays — the m branch still reads it):

```ts
// Pip inks: dominant suit color + fixed darker ring/stroke shades, and the
// traditional red accent. Flat constants — no color math.
const PIN = { ink: '#2e5aa0', ring: '#1f3f73' }
const SOU = { ink: '#2e7d4f', edge: '#1f5737' }
const RED = { ink: '#a03c2e', ring: '#7a2b20' }  // shared by accents + bird beak

type Coin = { cx: number; cy: number; r: number; red?: boolean }
type Stick = { x: number; y: number; w: number; h: number; red?: boolean; tilt?: number }

const PIN_LAYOUTS: Record<Rank, readonly Coin[]> = { ... }   // literal per rank
const SOU_LAYOUTS: Record<Rank, readonly Stick[]> = { ... }  // ranks 2–9; 1 → [] (bird branch)
```

Layouts are written as **literals** (or tiny row/col helper calls) — no runtime
generation cleverness; the table *is* the artwork's source of truth. `Rank` is
imported as a type from `../core` (already exported).

### Coordinate sketch (tuned during implement; tests never pin these)

Face inset ≈ x 8–52, y 8–72; center x=30, mid y=39/40.

- **Pin** (cx list × cy list, radius):
  - 1p: (30,40) r16 red
  - 2p: (30 × 22,58) r10
  - 3p: (16,20)(30,40)(44,60) r9 — middle red
  - 4p: (19,41 × 24,56) r9
  - 5p: corners (18,42 × 21,59) r8 + center (30,40) r8 red
  - 6p: (19,41 × 18,40,62) r8
  - 7p: diag (15,16)(30,21)(45,26) r6.5 — middle red — over quad (19,41 × 45,63) r6.5
  - 8p: (19,41 × 15,31.5,48,64.5) r6.5
  - 9p: (16,30,44 × 17,40,63) r6.5 — center red
- **Sou** (stick w≈7, h per layout; x is the stick's left edge):
  - 2s: x 26.5, y 10 & 42, h 28
  - 3s: top (26.5,10 h26); bottom (14,44)(39,44) h26
  - 4s: (14,39 × 10,42) h28
  - 5s: corners (13,40 × 9,42) h26 + center (26.5,25.5) h26 red
  - 6s: (11,26.5,42 × 10,42) h28  ← 2 rows × 3 cols
  - 7s: top (26.5,8 h24) red; grid (11,26.5,42 × 36,36) — 2 rows × 3 cols h~16… 
    (7s = 1 over 2×3: three cols × two rows below, shorter sticks h16, y 36 & 54)
  - 8s: two gables — top pair tilted ∓20° meeting high, bottom pair tilted ±20°
    meeting low; each stick h24, rotated about its own center via
    `transform="rotate(a cx cy)"`
  - 9s: (11,26.5,42 × 9,31,53) h~18, 3 cols × 3 rows — middle row red
- **1s bird** (center-ish, perch below): perch stick rect (26.5, 56, 7×14, green);
  body ellipse (30, 36) rx11 ry13 green; head circle (39, 22) r6.5 green; beak
  triangle path from head tip, red; eye circle (41, 20.5) r1.4 ivory; two tail
  feather rects angled left-down from the body (rotated, red + green).

**Constraint check on marker exclusivity** (Decision 2): the bird's head and eye
are `<circle>` — circles must stay *pin-only* for the coin count… they are not:
the coin-count test only counts circles **on pin chips**, so circles elsewhere
are harmless. The `<ellipse>` marker must be 1s-only — body is the sole ellipse
anywhere. The sou rect-count applies to 2s–9s only, so the bird's perch/tail
rects on 1s don't collide. Documented so the tests' scoping is deliberate.

## Tile.svelte — template changes

The `{:else if kind !== null && suit !== null && suit !== 'z'}` region becomes:

```svelte
{:else if kind !== null && suit === 'm'}
  <!-- Interim manzu face until T-007-01-03: numeral over 萬, separate nodes. -->
  <text class="rank" …>{kind[0]}</text>
  <text class="glyph" …>萬</text>
{:else if kind !== null && suit === 'p'}
  {#each PIN_LAYOUTS[rank] as coin}
    <circle cx={…} cy={…} r={…} fill={…} stroke={…} stroke-width="1.5" />
    <rect x={…} y={…} width={…} height={…} fill="#f6f1e4" />  <!-- square hole -->
  {/each}
{:else if kind === '1s'}
  <!-- The bird: flat geometric sparrow on a bamboo perch. -->
  …7 hand-placed shapes…
{:else if kind !== null && suit === 's'}
  {#each SOU_LAYOUTS[rank] as stick}
    <rect … rx={w/2} fill={…} stroke={…} transform={stick.tilt ? … : undefined} />
    <line … stroke="#f6f1e4" />  <!-- bamboo joint, same transform -->
  {/each}
{/if}
```

Instance script gains `const rank = $derived(...)` from `rankOf(kind)` (already
exported by core) or `Number(kind[0])`; import `rankOf` alongside the existing
imports. The `.rank`/`.glyph` CSS classes stay (m still uses both). The hidden
`.kind` span, chassis rects, honors, haku, back branch: byte-identical.

Deleted: the interim p circle mark, the interim s stick mark, and the p/s use of
the big `.rank` numeral. `SUIT_INK.p` / `SUIT_INK.s` become unused **iff** the
pip tables carry their own inks — keep `SUIT_INK` intact anyway (m reads
`SUIT_INK.m`; narrow it only if svelte-check flags unused, which it won't for a
record).

## tile.ssr.test.ts — additions

One new describe after `honor faces`, using the existing `chipOf` helper:

```ts
describe('pip faces — pin coins and sou bamboo', () => {
  const RANKS = [1,2,3,4,5,6,7,8,9] as const
  it('draws exactly N coins on Np', …)                 // count '<circle' occurrences
  it('draws exactly N sticks on Ns (N ≥ 2)', …)        // count '<rect' == 2 + N
  it('draws the bird on 1s and nowhere else', …)       // '<ellipse' exclusivity over TILE_KINDS
  it('renders pip faces as pure shapes — no <text>', …)// all p + s chips lack '<text'
  it('keeps the interim manzu numerals for -03', …)    // 5m still has '<text'
  it('renders 34 pairwise-distinct faces', …)          // new Set(TILE_KINDS.map(chipOf)).size === 34
})
```

Counting helper: `const countOf = (body: string, needle: string) =>
body.split(needle).length - 1` — same idiom the existing `<svg` count uses.

## Ordering

1. Tile.svelte module-script tables + template branches (the whole component
   change is one coherent unit — a half-replaced face branch never compiles
   sensibly).
2. tile.ssr.test.ts additions.
3. Verify: `just test`, `just check`, `just build`; eyeball via `just dev` is
   noted for the human but not blocking.
4. One commit: component + tests together (the -01 precedent), staged paths
   audited to `src/app/Tile.svelte`, `src/app/tile.ssr.test.ts`,
   `docs/active/work/T-007-01-02/**` only.

## Interfaces unchanged

`Tile` props (`id: TileId | 'back'`), the kind-token contract, all consumer
markup, all of `src/core/`'s exports. This ticket is entirely inside the
component's aria-hidden presentation layer — exactly the seam -01 built.
