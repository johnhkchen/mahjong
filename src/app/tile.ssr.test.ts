// The chassis contract: Tile renders through the real Svelte SSR compiler, and the
// assertions pin exactly what the rest of the app may rely on — the one hidden kind
// token per face chip, the aria-hidden SVG art, the honor/man/pip faces, and the
// tokenless back. Content only, never classes or geometry (pip multiplicity counts
// semantic elements, not coordinates), so the art stays free to be redrawn.

import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { TILE_KINDS, tileId, type TileKind } from '../core'
import Tile from './Tile.svelte'

/** Every tile-looking text token — the same regex app.ssr.test.ts matches with. */
function tileTokensOf(body: string): string[] {
  return [...body.matchAll(/>([1-9][mpsz])</g)].map((m) => m[1])
}

function chipOf(kind: TileKind): string {
  return render(Tile, { props: { id: tileId(kind, 0) } }).body
}

const WIND_WORDS = ['East', 'South', 'West', 'North']

// kind → its engraved kanji; 5z is deliberately absent (haku's face is the empty
// frame, not a glyph).
const HONOR_GLYPHS: ReadonlyMap<TileKind, string> = new Map([
  ['1z', '東'],
  ['2z', '南'],
  ['3z', '西'],
  ['4z', '北'],
  ['6z', '發'],
  ['7z', '中'],
])

describe('face chips — the kind token contract', () => {
  it('renders exactly one kind token per chip, for every one of the 34 kinds', () => {
    for (const kind of TILE_KINDS) {
      // Multiset exactness: the hidden token matches once, and nothing else in the
      // chip (SVG text included) forms a tile-looking token.
      expect(tileTokensOf(chipOf(kind)), kind).toEqual([kind])
    }
  })

  it('renders the art as one aria-hidden SVG over an ivory face', () => {
    for (const kind of TILE_KINDS) {
      const body = chipOf(kind)
      expect(body.split('<svg').length - 1, kind).toBe(1)
      expect(body, kind).toContain('aria-hidden="true"')
      expect(body, kind).toContain('#f6f1e4') // the face — this chip is not a back
    }
  })

  it('never emits an English wind word — the seat labels are Table\'s alone', () => {
    for (const kind of TILE_KINDS) {
      const body = chipOf(kind)
      for (const word of WIND_WORDS) expect(body, kind).not.toContain(word)
    }
  })
})

describe('honor faces', () => {
  it('engraves each honor kanji on its own kind and no other', () => {
    for (const [kind, glyph] of HONOR_GLYPHS) {
      expect(chipOf(kind), kind).toContain(`>${glyph}<`)
      for (const [other, otherGlyph] of HONOR_GLYPHS) {
        if (other !== kind) expect(chipOf(kind), `${otherGlyph} on ${kind}`).not.toContain(otherGlyph)
      }
    }
  })

  it('renders haku (5z) as the engraved empty frame — no glyph at all', () => {
    const body = chipOf('5z')
    expect(body).toContain('fill="none"') // the frame is stroked, not filled
    for (const glyph of HONOR_GLYPHS.values()) expect(body).not.toContain(glyph)
  })
})

describe('the tile back', () => {
  const back = render(Tile, { props: { id: 'back' } }).body

  it('renders the chassis with no kind token and no face', () => {
    expect(back.split('<svg').length - 1).toBe(1)
    expect(tileTokensOf(back)).toEqual([])
    expect(back).not.toContain('#f6f1e4') // no ivory face on a face-down tile
  })

  it('names itself "tile back" for assistive tech, wind-word-safe', () => {
    expect(back).toContain('tile back')
    for (const word of WIND_WORDS) expect(back).not.toContain(word)
  })
})

// kind → its engraved rank numeral; the 萬 mark is asserted separately since it
// is shared by all nine.
const MAN_RANK_GLYPHS: ReadonlyMap<TileKind, string> = new Map([
  ['1m', '一'],
  ['2m', '二'],
  ['3m', '三'],
  ['4m', '四'],
  ['5m', '五'],
  ['6m', '六'],
  ['7m', '七'],
  ['8m', '八'],
  ['9m', '九'],
])

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

/** Occurrences of a literal needle — the same idiom as the `<svg` count above. */
function countOf(body: string, needle: string): number {
  return body.split(needle).length - 1
}

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

describe('pip faces — pin coins and sou bamboo', () => {
  it('draws exactly N coins on Np', () => {
    // Each coin is exactly one <circle>; nothing else on a pin face is a circle.
    for (const r of RANKS) {
      expect(countOf(chipOf(`${r}p` as TileKind), '<circle'), `${r}p`).toBe(r)
    }
  })

  it('draws exactly N sticks on Ns, over the two chassis rects', () => {
    // Chassis = under-body + face (2 rects); each bamboo stick is one more.
    // 1s is the bird, asserted separately.
    for (const r of RANKS) {
      if (r === 1) continue
      expect(countOf(chipOf(`${r}s` as TileKind), '<rect'), `${r}s`).toBe(2 + r)
    }
  })

  it('draws the bird on 1s and nowhere else', () => {
    // The bird's body is the only <ellipse> in the entire set.
    for (const kind of TILE_KINDS) {
      expect(countOf(chipOf(kind), '<ellipse'), kind).toBe(kind === '1s' ? 1 : 0)
    }
  })

  it('renders pin and sou faces as pure shapes — no text at all', () => {
    // Stronger than the token regex: with zero <text> nodes, no p/s face can
    // ever leak a tile-looking token or a stray numeral.
    for (const r of RANKS) {
      expect(chipOf(`${r}p` as TileKind), `${r}p`).not.toContain('<text')
      expect(chipOf(`${r}s` as TileKind), `${r}s`).not.toContain('<text')
    }
  })

  it('renders 34 pairwise-distinct faces', () => {
    expect(new Set(TILE_KINDS.map(chipOf)).size).toBe(TILE_KINDS.length)
  })
})

describe('the full set at once', () => {
  it('34 face chips + a back yield exactly the 34 kinds, once each', () => {
    const sweep =
      TILE_KINDS.map(chipOf).join('') + render(Tile, { props: { id: 'back' } }).body
    expect([...tileTokensOf(sweep)].sort()).toEqual([...TILE_KINDS].sort())
  })
})
