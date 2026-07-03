<script lang="ts" module>
  import type { NumberedSuit, TileKind } from '../core'

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

  // Interim numbered ink — the established per-suit legibility palette.
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
</script>

<script lang="ts">
  import { kindOf, suitOf, type TileId } from '../core'

  // Presentational leaf: one physical tile in, one chip out — an original inline-SVG
  // chassis (ivory face over a beveled body, engraved glyph), or the face-down back
  // (`id="back"`, no consumer yet — opponents' hands and the wall are later tickets).
  // The mpsz kind still renders, as the visually-hidden `.kind` token: it is the
  // chip's accessible name and the tile-shaped text the SSR tests match; the SVG art
  // is aria-hidden presentation over it, and must never emit a `[1-9][mpsz]` text
  // node (numbered faces split rank and suit mark into separate nodes for exactly
  // this reason) nor an English wind word. T-007-01-02 replaces only the interim
  // p/s branch; the chassis, honors, man faces, and back are settled.
  let { id }: { id: TileId | 'back' } = $props()

  const kind = $derived(typeof id === 'number' ? kindOf(id) : null)
  const suit = $derived(kind === null ? null : suitOf(kind))
  const honor = $derived(kind === null ? undefined : HONORS[kind])
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
      {:else if kind !== null && suit !== null && suit !== 'z'}
        <!-- Interim p/s face until -02: rank numeral over a small suit mark
             (coin / bamboo stick) — separate nodes, never one token. -->
        <text class="rank" x="30" y="40" text-anchor="middle" font-size="34" fill={SUIT_INK[suit]}>{kind[0]}</text>
        {#if suit === 'p'}
          <circle cx="30" cy="62" r="8" fill={SUIT_INK.p} />
        {:else}
          <rect x="27" y="50" width="6" height="22" rx="3" fill={SUIT_INK.s} />
        {/if}
      {/if}
    {/if}
  </svg>
  <span class="kind">{kind ?? 'tile back'}</span>
</span>

<style>
  .tile {
    display: inline-flex;
    position: relative;
    /* The chip's em basis — the size the whole table was tuned around. */
    font-size: 0.8rem;
  }

  .chip {
    display: block;
    /* 1.5em × 2.1em is the viewBox's 5:7 exactly — no distortion. */
    width: 1.5em;
    height: 2.1em;
  }

  .glyph,
  .rank {
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
