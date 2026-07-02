import { describe, expect, it } from 'vitest'
import {
  TILE_KINDS,
  doraKindOf,
  kindIndexOf,
  suitOf,
  type NumberedSuit,
  type TileKind,
} from './index'

describe('dora indicator mapping', () => {
  it('maps every one of the 34 kinds to a valid kind (total)', () => {
    const valid = new Set<TileKind>(TILE_KINDS)
    for (const kind of TILE_KINDS) {
      expect(valid.has(doraKindOf(kind)), `doraKindOf(${kind})`).toBe(true)
    }
  })

  it('pins the wraparound cases from the AC', () => {
    expect(doraKindOf('9m')).toBe('1m')
    expect(doraKindOf('9p')).toBe('1p')
    expect(doraKindOf('9s')).toBe('1s')
    expect(doraKindOf('4z')).toBe('1z') // North wraps to East, not to a dragon
    expect(doraKindOf('7z')).toBe('5z') // chun wraps to haku
  })

  it('matches the hand-written full table (second independent spelling)', () => {
    // Transcribed from the rule statement — dora is the next tile in the indicator's own
    // cycle (suit ranks wrap 9→1; winds E→S→W→N→E; dragons haku→hatsu→chun→haku).
    // Independent spelling of the mapping: never regenerate this table by running the code.
    const table = {
      '1m': '2m', '2m': '3m', '3m': '4m', '4m': '5m', '5m': '6m',
      '6m': '7m', '7m': '8m', '8m': '9m', '9m': '1m',
      '1p': '2p', '2p': '3p', '3p': '4p', '4p': '5p', '5p': '6p',
      '6p': '7p', '7p': '8p', '8p': '9p', '9p': '1p',
      '1s': '2s', '2s': '3s', '3s': '4s', '4s': '5s', '5s': '6s',
      '6s': '7s', '7s': '8s', '8s': '9s', '9s': '1s',
      '1z': '2z', '2z': '3z', '3z': '4z', '4z': '1z',
      '5z': '6z', '6z': '7z', '7z': '5z',
    } satisfies Record<TileKind, TileKind>
    for (const kind of TILE_KINDS) {
      expect(doraKindOf(kind), `doraKindOf(${kind})`).toBe(table[kind])
    }
  })

  it('is a permutation of the 34 kinds (bijective)', () => {
    expect(new Set(TILE_KINDS.map(doraKindOf)).size).toBe(34)
  })

  it('stays within the indicator cycle group and never fixes a point', () => {
    for (const kind of TILE_KINDS) {
      const dora = doraKindOf(kind)
      expect(dora).not.toBe(kind)
      expect(suitOf(dora)).toBe(suitOf(kind))
      const index = kindIndexOf(kind)
      const doraIndex = kindIndexOf(dora)
      if (index >= 27 && index <= 30) {
        // Wind indicators (E S W N) yield wind dora — never cross into dragons.
        expect(doraIndex).toBeGreaterThanOrEqual(27)
        expect(doraIndex).toBeLessThanOrEqual(30)
      }
      if (index >= 31) {
        // Dragon indicators yield dragon dora — never cross into winds.
        expect(doraIndex).toBeGreaterThanOrEqual(31)
      }
    }
  })

  it('advances rank by exactly one below the wrap (successor rule)', () => {
    for (const suit of ['m', 'p', 's'] as NumberedSuit[]) {
      for (let rank = 1; rank <= 8; rank++) {
        expect(doraKindOf(`${rank}${suit}` as TileKind)).toBe(`${rank + 1}${suit}`)
      }
    }
  })
})
