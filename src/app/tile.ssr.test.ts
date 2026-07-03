// The chassis contract: Tile renders through the real Svelte SSR compiler, and the
// assertions pin exactly what the rest of the app (and T-007-01-02/-03, which redraw
// the interim numbered faces on this chassis) may rely on — the one hidden kind token
// per face chip, the aria-hidden SVG art, the honor faces, and the tokenless back.
// Content only, never classes or geometry, so the art stays free to be redrawn.

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

describe('the full set at once', () => {
  it('34 face chips + a back yield exactly the 34 kinds, once each', () => {
    const sweep =
      TILE_KINDS.map(chipOf).join('') + render(Tile, { props: { id: 'back' } }).body
    expect([...tileTokensOf(sweep)].sort()).toEqual([...TILE_KINDS].sort())
  })
})
