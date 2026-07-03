// The pure agari predicate everything else in E-005 stands on: concealed tile kinds +
// melds in, every distinct four-sets-and-a-pair decomposition out (plus the chiitoitsu
// and kokushi forms), an empty list meaning "not a win". Deliberately KIND-level:
// physical copies never affect whether a hand decomposes (a future red five changes
// dora counting, not shape), and kind granularity lets waits (T-005-01-02) ask about
// completions whose four physical copies are already visible. Melds are read for
// ARITY ONLY — a chi IS a run and a pon/kan IS a triplet-class set, so their
// yaku-relevant structure stays on the Meld objects the caller already holds; the
// output covers the concealed side, and the full 4-set picture is decomposition +
// melds, zipped by the caller. Waits, the yaku catalog, and the tsumo/ron fold are
// all consumers of this module; none of them re-derive decomposition.

import { KIND_COUNT, TILE_KINDS, kindIndexOf, type TileKind } from './tiles'
import type { Meld } from './record'

/**
 * One concealed set in a standard decomposition: a run (start, start+1, start+2 in
 * start's numbered suit — honors never run) or a triplet. Concealed sets only — meld
 * sets live on the caller's Melds, never duplicated here.
 */
export type ConcealedSet =
  | { readonly type: 'run'; readonly start: TileKind }
  | { readonly type: 'triplet'; readonly kind: TileKind }

/**
 * One complete reading of a winning hand — a discriminated union over the three
 * agari forms:
 *
 * - `standard`: the pair plus the concealed sets; `sets.length` is always
 *   4 − melds (a kan is ONE set — the concealed remainder is 14 − 3·melds tiles
 *   regardless of kan count).
 * - `chiitoitsu`: seven DISTINCT pairs, ascending kind order. Four of a kind is NOT
 *   two pairs, and any call breaks the form — zero melds by rule, not just by the
 *   13 − 3k arithmetic.
 * - `kokushi`: one of each of the 13 terminal/honor kinds plus a duplicate of one
 *   of them (`pair` names the duplicated kind); fully concealed, zero melds.
 *
 * A hand can satisfy standard AND chiitoitsu simultaneously (ryanpeikou shapes) —
 * that is why decomposeAgari returns a list over forms, not one tagged value.
 */
export type AgariDecomposition =
  | {
      readonly form: 'standard'
      readonly pair: TileKind
      readonly sets: readonly ConcealedSet[]
    }
  | { readonly form: 'chiitoitsu'; readonly pairs: readonly TileKind[] }
  | { readonly form: 'kokushi'; readonly pair: TileKind }

/** Fresh 34-slot kind-count array over the concealed tiles (TILE_KINDS order). */
function countsOf(concealed: readonly TileKind[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const kind of concealed) counts[kindIndexOf(kind)] += 1
  return counts
}

/**
 * The standard-form backtracker over the counts array: emit every partition of the
 * remaining counts into `remaining` sets, resolving the LOWEST nonzero kind first.
 * At that kind the whole consumption is decided in one branch — one triplet or none
 * (a count of 4 leaves a forced run-start after a triplet), with every leftover copy
 * a run-start (numbered suit, rank ≤ 7, successors available; the k % 9 ≤ 6 && k <
 * 27 guard keeps a run inside its suit block, so 9m never "runs" into 1p through
 * the contiguous kind indices). Because the current kind is consumed COMPLETELY
 * before advancing, each distinct partition is emitted exactly once — no dedup pass
 * — and sets emerge in ascending kind order, triplet before runs at the same kind
 * (the documented result order). Mutate-recurse-restore on the shared counts array;
 * every emitted partition is a fresh array.
 */
function searchSets(
  counts: number[],
  remaining: number,
  from: number,
  acc: ConcealedSet[],
  out: ConcealedSet[][],
): void {
  if (remaining === 0) {
    out.push(acc.slice())
    return
  }
  let k = from
  while (k < KIND_COUNT && counts[k] === 0) k += 1
  if (k === KIND_COUNT) return
  const held = counts[k]
  for (const triplets of held >= 3 ? [1, 0] : [0]) {
    const runs = held - 3 * triplets
    if (runs > 0 && !(k < 27 && k % 9 <= 6 && counts[k + 1] >= runs && counts[k + 2] >= runs)) {
      continue
    }
    if (triplets + runs > remaining) continue
    counts[k] = 0
    if (runs > 0) {
      counts[k + 1] -= runs
      counts[k + 2] -= runs
    }
    if (triplets === 1) acc.push({ type: 'triplet', kind: TILE_KINDS[k] })
    for (let r = 0; r < runs; r += 1) acc.push({ type: 'run', start: TILE_KINDS[k] })
    searchSets(counts, remaining - triplets - runs, k + 1, acc, out)
    for (let r = 0; r < triplets + runs; r += 1) acc.pop()
    counts[k] = held
    if (runs > 0) {
      counts[k + 1] += runs
      counts[k + 2] += runs
    }
  }
}

/**
 * Every standard-form decomposition: the pair loop in TILE_KINDS order wrapping the
 * backtracker — so results are ordered by pair kind ascending, then by the
 * backtracker's own branch order. `counts` is borrowed and restored, not consumed.
 */
function standardDecompositions(counts: number[], setCount: number): AgariDecomposition[] {
  const results: AgariDecomposition[] = []
  for (let pair = 0; pair < KIND_COUNT; pair += 1) {
    if (counts[pair] < 2) continue
    counts[pair] -= 2
    const partitions: ConcealedSet[][] = []
    searchSets(counts, setCount, 0, [], partitions)
    counts[pair] += 2
    for (const sets of partitions) {
      results.push({ form: 'standard', pair: TILE_KINDS[pair], sets })
    }
  }
  return results
}

/** A hand holds at most four melds — the four-sets-and-a-pair ceiling. */
const MAX_MELDS = 4

/** The full hand a win decomposes: four sets and a pair, three tiles per meld out. */
const AGARI_TILE_COUNT = 14

/**
 * Decompose a winning hand into every distinct reading — the module's face.
 * `concealed` is the seat's concealed tiles INCLUDING the completing tile (drawn or
 * claimed), as kinds; `melds` are the seat's exposed melds, read for arity only
 * (the concealed remainder must be 14 − 3·melds tiles). An empty result IS the
 * not-a-win signal — no separate null.
 *
 * Result order is part of the contract (the legalActions precedent): standard
 * decompositions first — pair kind ascending, sets ascending by kind with a triplet
 * before runs of the same kind — then chiitoitsu, then kokushi. Pure read: inputs
 * are never mutated, every returned array is fresh, same input ⇒ same output.
 *
 * A wrong-arity query is caller corruption, not "no win", and throws RangeError
 * (the nextInt precedent). Kind VALUES are trusted — TileKind is a compile-time
 * union, and inputs from outside the program are validated at the log-parser
 * boundary, per the TileId rule in tiles.ts.
 */
export function decomposeAgari(
  concealed: readonly TileKind[],
  melds: readonly Meld[],
): AgariDecomposition[] {
  if (melds.length > MAX_MELDS) {
    throw new RangeError(
      `decomposeAgari with ${melds.length} melds — a hand holds at most ${MAX_MELDS}`,
    )
  }
  const expected = AGARI_TILE_COUNT - 3 * melds.length
  if (concealed.length !== expected) {
    throw new RangeError(
      `decomposeAgari requires ${expected} concealed tiles with ${melds.length} melds, got ${concealed.length}`,
    )
  }
  const counts = countsOf(concealed)
  return standardDecompositions(counts, MAX_MELDS - melds.length)
}

/** True when the concealed tiles + melds complete a win in any form — the guard read. */
export function isAgari(concealed: readonly TileKind[], melds: readonly Meld[]): boolean {
  return decomposeAgari(concealed, melds).length > 0
}
