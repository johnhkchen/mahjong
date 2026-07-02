import { describe, expect, it } from 'vitest'
import {
  COPIES_PER_KIND,
  KIND_COUNT,
  TILE_COUNT,
  TILE_KINDS,
  allTileIds,
  copyOf,
  isHonor,
  isSimple,
  isTerminal,
  kindIndexOf,
  kindOf,
  rankOf,
  suitOf,
  tileId,
  type CopyIndex,
  type TileKind,
} from './index'

describe('tile domain', () => {
  it('enumerates exactly 34 distinct kinds and 136 distinct tile ids', () => {
    expect(KIND_COUNT).toBe(34)
    expect(TILE_KINDS.length).toBe(34)
    expect(new Set(TILE_KINDS).size).toBe(34)

    expect(TILE_COUNT).toBe(136)
    expect(TILE_COUNT).toBe(KIND_COUNT * COPIES_PER_KIND)
    const ids = allTileIds()
    expect(ids.length).toBe(136)
    expect(new Set(ids).size).toBe(136)
  })

  it('lists the kinds in exact canonical mpsz order', () => {
    // Second independent spelling of the order; honors are E S W N haku hatsu chun.
    expect(TILE_KINDS).toEqual([
      '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
      '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
      '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
      '1z', '2z', '3z', '4z', '5z', '6z', '7z',
    ])
  })

  it('round-trips the id encoding exhaustively in both directions', () => {
    for (const id of allTileIds()) {
      expect(tileId(kindOf(id), copyOf(id))).toBe(id)
    }
    for (const kind of TILE_KINDS) {
      for (const copy of [0, 1, 2, 3] as const) {
        const id = tileId(kind, copy)
        expect(kindOf(id)).toBe(kind)
        expect(copyOf(id)).toBe(copy)
      }
    }
  })

  it('yields exactly 4 tiles of each kind', () => {
    const perKind = new Map<TileKind, number>()
    for (const id of allTileIds()) {
      const kind = kindOf(id)
      perKind.set(kind, (perKind.get(kind) ?? 0) + 1)
    }
    expect(perKind.size).toBe(34)
    for (const kind of TILE_KINDS) expect(perKind.get(kind)).toBe(4)
  })

  it('bridges kind and canonical index consistently', () => {
    TILE_KINDS.forEach((kind, i) => {
      expect(kindIndexOf(kind)).toBe(i)
      for (const copy of [0, 1, 2, 3] as CopyIndex[]) {
        expect(tileId(kind, copy)).toBe(i * 4 + copy)
      }
    })
  })

  it('classifies terminals, honors, and simples as a partition of all 34 kinds', () => {
    expect(TILE_KINDS.filter(isTerminal)).toEqual(['1m', '9m', '1p', '9p', '1s', '9s'])
    expect(TILE_KINDS.filter(isHonor)).toEqual(['1z', '2z', '3z', '4z', '5z', '6z', '7z'])
    expect(TILE_KINDS.filter(isSimple).length).toBe(21)
    for (const kind of TILE_KINDS) {
      const memberships = [isHonor(kind), isTerminal(kind), isSimple(kind)].filter(Boolean)
      expect(memberships.length).toBe(1)
    }
  })

  it('exposes suit and rank per kind', () => {
    expect(suitOf('1m')).toBe('m')
    expect(suitOf('9s')).toBe('s')
    expect(suitOf('5p')).toBe('p')
    expect(suitOf('1z')).toBe('z')
    expect(rankOf('1m')).toBe(1)
    expect(rankOf('9s')).toBe(9)
    expect(rankOf('5p')).toBe(5)
    expect(rankOf('1z')).toBeNull()
    expect(rankOf('7z')).toBeNull()
    for (const kind of TILE_KINDS) {
      expect(rankOf(kind) === null).toBe(isHonor(kind))
    }
  })

  it('freezes TILE_KINDS and hands out a fresh tile set per call', () => {
    expect(Object.isFrozen(TILE_KINDS)).toBe(true)
    const first = allTileIds()
    expect(first).not.toBe(allTileIds())
    first[0] = 999
    expect(allTileIds()[0]).toBe(0)
  })
})
