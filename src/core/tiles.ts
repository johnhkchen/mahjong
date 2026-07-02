// The tile domain: 34 kinds x 4 copies = 136 tile identities, in mpsz notation.
// This file must stay import-free — it is the foundation of the pure engine.

export type NumberedSuit = 'm' | 'p' | 's'
export type Suit = NumberedSuit | 'z'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Numbered tiles: characters (m), circles (p), bamboo (s), ranks 1-9. */
export type NumberedKind = `${Rank}${NumberedSuit}`
/** Honors in mpsz order: 1z-4z = East, South, West, North winds; 5z-7z = haku, hatsu, chun dragons. */
export type HonorKind = `${1 | 2 | 3 | 4 | 5 | 6 | 7}z`
export type TileKind = NumberedKind | HonorKind

export type CopyIndex = 0 | 1 | 2 | 3
/**
 * One of the 136 physical tiles: an integer 0-135, encoded as
 * `kindIndexOf(kind) * COPIES_PER_KIND + copy`. Construct with tileId(), decode with
 * kindOf()/copyOf(); the arithmetic is not part of the public contract. No runtime range
 * checks here — ids entering from outside the program (action logs) are validated by the
 * log parser at that boundary.
 */
export type TileId = number

export const KIND_COUNT = 34
export const COPIES_PER_KIND = 4
export const TILE_COUNT = KIND_COUNT * COPIES_PER_KIND // 136

const NUMBERED_SUITS: readonly NumberedSuit[] = ['m', 'p', 's']

function buildKinds(): readonly TileKind[] {
  const kinds: TileKind[] = []
  for (const suit of NUMBERED_SUITS) {
    for (let rank = 1; rank <= 9; rank++) kinds.push(`${rank}${suit}` as TileKind)
  }
  for (let honor = 1; honor <= 7; honor++) kinds.push(`${honor}z` as TileKind)
  return Object.freeze(kinds)
}

/**
 * All 34 kinds in canonical order — 1m…9m, 1p…9p, 1s…9s, 1z…7z. The position of a kind in
 * this array is its canonical kind index (see kindIndexOf), the ordering used for hand
 * sorting and count-array algorithms downstream.
 */
export const TILE_KINDS: readonly TileKind[] = buildKinds()

const KIND_INDEX: ReadonlyMap<TileKind, number> = new Map(TILE_KINDS.map((kind, i) => [kind, i]))

/** Canonical kind index, 0-33: the position of `kind` in TILE_KINDS. */
export function kindIndexOf(kind: TileKind): number {
  return KIND_INDEX.get(kind)!
}

export function tileId(kind: TileKind, copy: CopyIndex): TileId {
  return kindIndexOf(kind) * COPIES_PER_KIND + copy
}

export function kindOf(id: TileId): TileKind {
  return TILE_KINDS[Math.floor(id / COPIES_PER_KIND)]
}

export function copyOf(id: TileId): CopyIndex {
  return (id % COPIES_PER_KIND) as CopyIndex
}

/** The full tile set [0..135] as a fresh mutable array — callers may shuffle it in place. */
export function allTileIds(): TileId[] {
  return Array.from({ length: TILE_COUNT }, (_, id) => id)
}

export function suitOf(kind: TileKind): Suit {
  return kind[1] as Suit
}

/** Rank 1-9 for numbered kinds; null for honors (branch on it — honors have no rank). */
export function rankOf(kind: TileKind): Rank | null {
  return suitOf(kind) === 'z' ? null : (Number(kind[0]) as Rank)
}

/** Winds and dragons — the 7 z-suit kinds. */
export function isHonor(kind: TileKind): boolean {
  return suitOf(kind) === 'z'
}

/** 1 or 9 of a numbered suit — 6 kinds. */
export function isTerminal(kind: TileKind): boolean {
  const rank = rankOf(kind)
  return rank === 1 || rank === 9
}

/** 2-8 of a numbered suit — 21 kinds. Honor/terminal/simple partition all 34. */
export function isSimple(kind: TileKind): boolean {
  const rank = rankOf(kind)
  return rank !== null && rank >= 2 && rank <= 8
}
