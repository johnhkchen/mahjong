<script lang="ts" module>
  import type { NumberedSuit, Rank, TileKind } from '../core'

  // The face vocabulary is shared by every chip instance. Honor faces: engraved
  // kanji + ink, Taiwan-style. 5z (haku) is deliberately absent — its face is the
  // empty engraved frame branch below, not a glyph.
  const HONORS: Partial<Record<TileKind, { glyph: string; ink: string }>> = {
    '1z': { glyph: '東', ink: '#2b2b2b' },
    '2z': { glyph: '南', ink: '#2b2b2b' },
    '3z': { glyph: '西', ink: '#2b2b2b' },
    '4z': { glyph: '北', ink: '#2b2b2b' },
    '6z': { glyph: '發', ink: '#2e7d4f' },
    '7z': { glyph: '中', ink: '#a03c2e' },
  }

  // The established per-suit legibility palette; the man face reads its 萬 ink
  // from here, and the pip ink constants below share the same hexes.
  const SUIT_INK: Record<NumberedSuit, string> = {
    m: '#a03c2e',
    p: '#2e5aa0',
    s: '#2e7d4f',
  }

  // Man rank numerals, keyed by the kind's rank digit. The face composes this
  // over the red 萬 mark — Taiwan two-color (the numeral's blue is the palette's
  // ink-blue, deliberately a literal: it is not "pin ink").
  const MAN_RANKS: Record<string, string> = {
    '1': '一',
    '2': '二',
    '3': '三',
    '4': '四',
    '5': '五',
    '6': '六',
    '7': '七',
    '8': '八',
    '9': '九',
  }

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
  // 2026-07-02) — never dealt while the ruleset is Riichi (src/core/ has no flower
  // concept at all; nothing constructs a FlowerKind today). One shared ink flags
  // the whole family as "not a suit" at a glance.
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

  // Pip inks: the suit's dominant color plus a fixed darker ring/edge shade, and
  // the shared red accent. Flat constants — no color math at render time.
  const PIN = { ink: '#2e5aa0', ring: '#1f3f73' }
  const SOU = { ink: '#2e7d4f', edge: '#1f5737' }
  const RED = { ink: '#a03c2e', ring: '#7a2b20' }

  type Coin = { cx: number; cy: number; r: number; red: boolean }
  type Stick = { x: number; y: number; w: number; h: number; red: boolean; tilt: number }

  const coin = (cx: number, cy: number, r: number, red = false): Coin => ({ cx, cy, r, red })
  const stick = (x: number, y: number, h: number, o: { w?: number; red?: boolean; tilt?: number } = {}): Stick => ({
    x,
    y,
    w: o.w ?? 7,
    h,
    red: o.red ?? false,
    tilt: o.tilt ?? 0,
  })

  // The pin faces: each rank as its traditional coin arrangement (single grand
  // coin, stacks, diagonals, grids — centuries-old convention), with the red
  // accent on the visual center of the odd ranks that have one. These literals
  // ARE the artwork's source of truth; the face inset runs x 8–52, y 6–72.
  const PIN_LAYOUTS: Record<Rank, readonly Coin[]> = {
    1: [coin(30, 40, 16, true)],
    2: [coin(30, 22, 10), coin(30, 58, 10)],
    3: [coin(16, 19, 9), coin(30, 40, 9, true), coin(44, 61, 9)],
    4: [coin(19, 24, 9), coin(41, 24, 9), coin(19, 56, 9), coin(41, 56, 9)],
    5: [coin(18, 21, 8), coin(42, 21, 8), coin(30, 40, 8, true), coin(18, 59, 8), coin(42, 59, 8)],
    6: [coin(19, 18, 8), coin(41, 18, 8), coin(19, 40, 8), coin(41, 40, 8), coin(19, 62, 8), coin(41, 62, 8)],
    7: [
      coin(15, 15, 6.5),
      coin(30, 20, 6.5, true),
      coin(45, 25, 6.5),
      coin(19, 45, 6.5),
      coin(41, 45, 6.5),
      coin(19, 63, 6.5),
      coin(41, 63, 6.5),
    ],
    8: [
      coin(19, 15, 6.5),
      coin(41, 15, 6.5),
      coin(19, 31, 6.5),
      coin(41, 31, 6.5),
      coin(19, 47, 6.5),
      coin(41, 47, 6.5),
      coin(19, 63, 6.5),
      coin(41, 63, 6.5),
    ],
    9: [
      coin(16, 17, 6.5),
      coin(30, 17, 6.5),
      coin(44, 17, 6.5),
      coin(16, 40, 6.5),
      coin(30, 40, 6.5, true),
      coin(44, 40, 6.5),
      coin(16, 63, 6.5),
      coin(30, 63, 6.5),
      coin(44, 63, 6.5),
    ],
  }

  // The sou faces, 2s–9s: bamboo sticks in the traditional stacks and grids,
  // red where tradition puts the accent (5s center, 7s lone top, 9s middle row).
  // 8s is the mountain eight — two gables (∧ over ∨), each leg two tilted sticks
  // rotated about their own centers. 1s is the bird, hand-drawn in its own
  // template branch, so its entry here stays empty.
  const SOU_LAYOUTS: Record<Rank, readonly Stick[]> = {
    1: [],
    2: [stick(26.5, 10, 28), stick(26.5, 44, 28)],
    3: [stick(26.5, 8, 26), stick(13, 44, 26), stick(40, 44, 26)],
    4: [stick(14, 10, 28), stick(39, 10, 28), stick(14, 42, 28), stick(39, 42, 28)],
    5: [
      stick(13, 9, 26),
      stick(40, 9, 26),
      stick(26.5, 27, 26, { red: true }),
      stick(13, 45, 26),
      stick(40, 45, 26),
    ],
    6: [
      stick(11, 10, 28),
      stick(26.5, 10, 28),
      stick(42, 10, 28),
      stick(11, 44, 28),
      stick(26.5, 44, 28),
      stick(42, 44, 28),
    ],
    7: [
      stick(26.5, 7, 22, { red: true }),
      stick(11, 33, 18),
      stick(26.5, 33, 18),
      stick(42, 33, 18),
      stick(11, 53, 18),
      stick(26.5, 53, 18),
      stick(42, 53, 18),
    ],
    8: [
      stick(20.45, 10.4, 16, { w: 6.5, tilt: 35 }),
      stick(13.25, 18.8, 16, { w: 6.5, tilt: 35 }),
      stick(33.05, 10.4, 16, { w: 6.5, tilt: -35 }),
      stick(40.25, 18.8, 16, { w: 6.5, tilt: -35 }),
      stick(20.45, 53.6, 16, { w: 6.5, tilt: -35 }),
      stick(13.25, 45.2, 16, { w: 6.5, tilt: -35 }),
      stick(33.05, 53.6, 16, { w: 6.5, tilt: 35 }),
      stick(40.25, 45.2, 16, { w: 6.5, tilt: 35 }),
    ],
    9: [
      stick(11, 9, 17),
      stick(26.5, 9, 17),
      stick(42, 9, 17),
      stick(11, 31.5, 17, { red: true }),
      stick(26.5, 31.5, 17, { red: true }),
      stick(42, 31.5, 17, { red: true }),
      stick(11, 54, 17),
      stick(26.5, 54, 17),
      stick(42, 54, 17),
    ],
  }
</script>

<script lang="ts">
  import { kindOf, rankOf, suitOf, type TileId } from '../core'

  // Presentational leaf: one physical tile in, one chip out — an original inline-SVG
  // chassis (ivory face over a beveled body, engraved glyph or pip art), or the
  // face-down back (`id="back"`, no consumer yet — opponents' hands and the wall are
  // later tickets). The mpsz kind still renders, as the visually-hidden `.kind`
  // token: it is the chip's accessible name and the tile-shaped text the SSR tests
  // match; the SVG art is aria-hidden presentation over it, and must never emit a
  // `[1-9][mpsz]` text node (the man face splits numeral and mark into separate
  // nodes; pin/sou faces are pure shapes with no text at all) nor an English wind
  // word. All 34 faces and the back are settled art. A FlowerKind id renders its
  // own decorative glyph and is never constructed from a real TileId — no caller
  // wires one in yet (see FlowerKind above).
  let { id }: { id: TileId | 'back' | FlowerKind } = $props()

  const kind = $derived(typeof id === 'number' ? kindOf(id) : null)
  const suit = $derived(kind === null ? null : suitOf(kind))
  const rank = $derived(kind === null ? null : rankOf(kind))
  const honor = $derived(kind === null ? undefined : HONORS[kind])
  const flower = $derived(typeof id === 'string' && id !== 'back' ? FLOWERS[id] : undefined)
</script>

<span class="tile">
  <svg class="chip" viewBox="0 0 60 84" aria-hidden="true">
    <!-- The chassis: full-bleed under-body, then the inset face (or back panel)
         leaving the bottom edge visible — the tile's thickness. -->
    <rect width="60" height="84" rx="9" fill="#b9a97e" />
    {#if id === 'back'}
      <rect x="3" y="2" width="54" height="74" rx="6" fill="#31588f" stroke="#24406a" />
    {:else}
      <rect x="3" y="2" width="54" height="74" rx="6" fill="#f6f1e4" stroke="#c9bfa6" />
      {#if honor}
        <text
          class="glyph"
          x="30"
          y="54"
          text-anchor="middle"
          font-size="40"
          fill={honor.ink}
          stroke={honor.ink}
          stroke-width="0.75">{honor.glyph}</text
        >
      {:else if kind === '5z'}
        <!-- Haku: the classic blank face with an engraved frame. -->
        <rect x="12" y="14" width="36" height="50" rx="4" fill="none" stroke="#9db4c9" stroke-width="3" />
      {:else if kind !== null && suit === 'm'}
        <!-- Man face: engraved kanji numeral over the suit mark, Taiwan two-color. -->
        <text
          class="glyph"
          x="30"
          y="42"
          text-anchor="middle"
          font-size="32"
          fill="#2e5aa0"
          stroke="#2e5aa0"
          stroke-width="0.6">{MAN_RANKS[kind[0]]}</text
        >
        <text
          class="glyph"
          x="30"
          y="70"
          text-anchor="middle"
          font-size="24"
          fill={SUIT_INK.m}
          stroke={SUIT_INK.m}
          stroke-width="0.6">萬</text
        >
      {:else if rank !== null && suit === 'p'}
        <!-- Pin face: the rank as cash coins — a ring-stroked circle with the
             ivory square hole punched over it. Pure shapes, no text. -->
        {#each PIN_LAYOUTS[rank] as c}
          <circle
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill={c.red ? RED.ink : PIN.ink}
            stroke={c.red ? RED.ring : PIN.ring}
            stroke-width="1.5"
          />
          <rect
            x={c.cx - c.r * 0.35}
            y={c.cy - c.r * 0.35}
            width={c.r * 0.7}
            height={c.r * 0.7}
            fill="#f6f1e4"
          />
        {/each}
      {:else if kind === '1s'}
        <!-- The one of bamboo: a flat geometric sparrow on a bamboo perch — the
             traditional bird face, drawn as plain shapes in the suit palette. -->
        <rect x="13" y="42" width="4.5" height="13" rx="2.25" fill={SOU.ink} transform="rotate(40 15.25 48.5)" />
        <rect x="17.5" y="45" width="4.5" height="13" rx="2.25" fill={RED.ink} transform="rotate(40 19.75 51.5)" />
        <rect x="26.5" y="58" width="7" height="13" rx="3.5" fill={SOU.ink} stroke={SOU.edge} stroke-width="1" />
        <line x1="27.7" y1="64.5" x2="32.3" y2="64.5" stroke="#f6f1e4" stroke-width="1.2" />
        <ellipse cx="30" cy="37" rx="11" ry="13" fill={SOU.ink} stroke={SOU.edge} stroke-width="1" />
        <circle cx="39" cy="21" r="6.5" fill={SOU.ink} stroke={SOU.edge} stroke-width="1" />
        <path d="M45 19 L52 22 L45 25 Z" fill={RED.ink} />
        <circle cx="41" cy="19.5" r="1.4" fill="#f6f1e4" />
      {:else if rank !== null && suit === 's'}
        <!-- Sou face: the rank as bamboo sticks — a rounded rect with an ivory
             joint line at the waist; 8s tilts its sticks into the two gables. -->
        {#each SOU_LAYOUTS[rank] as s}
          {@const scx = s.x + s.w / 2}
          {@const scy = s.y + s.h / 2}
          {@const xf = s.tilt === 0 ? undefined : `rotate(${s.tilt} ${scx} ${scy})`}
          <rect
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.w / 2}
            fill={s.red ? RED.ink : SOU.ink}
            stroke={s.red ? RED.ring : SOU.edge}
            stroke-width="1"
            transform={xf}
          />
          <line x1={s.x + 1.2} y1={scy} x2={s.x + s.w - 1.2} y2={scy} stroke="#f6f1e4" stroke-width="1.2" transform={xf} />
        {/each}
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
    {/if}
  </svg>
  <span class="kind">{kind ?? (id !== 'back' ? id : 'tile back')}</span>
</span>

<style>
  .tile {
    display: inline-flex;
    position: relative;
    /* The chip's em basis — the size the whole table was tuned around. A zone
       that needs bigger tiles (the thumb-zone hand) sets --tile-scale; the
       default keeps every other chip at the settled size. */
    font-size: var(--tile-scale, 0.8rem);
  }

  .chip {
    display: block;
    /* 1.5em × 2.1em is the viewBox's 5:7 exactly — no distortion. */
    width: 1.5em;
    height: 2.1em;
  }

  .glyph {
    font-family: 'Hiragino Mincho ProN', 'Noto Serif CJK TC', 'Noto Serif TC', serif;
    font-weight: 700;
  }

  /* The kind token: visually hidden, never display:none — it stays real rendered
     text, the chip's accessible name and the SSR tests' `>1z<` match. */
  .kind {
    position: absolute;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }
</style>
