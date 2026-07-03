// The waits derivation: which kinds complete a 13-tile hand to agari — the one datum
// ron offering, furiten gating, and tenpai teaching all read. A CONSUMER of agari.ts
// (never re-derives decomposition): each candidate kind is probed through isAgari, so
// waits' idea of a win can never drift from the decomposer's. The exhaustion
// convention, chosen here and frozen: a kind all four of whose physical copies are
// visible to the hand ITSELF — concealed tiles plus its own melds' tiles, claimed
// included — is never a wait. Such a kind can neither be discarded by an opponent
// (ron) nor remain in the wall (tsumo), and under the mainstream formal-tenpai rule a
// hand whose every structural completion is self-exhausted is NOTEN — so one filtered
// list serves all three readers, and `waits(...).length > 0` IS tenpai. Kinds
// exhausted by OTHER seats' ponds, melds, or indicators are deliberately NOT
// excluded: that is live-tile counting over table-wide visibility, a hint-layer
// concern, not hand shape. Unlike agari.ts (melds read for arity only), this module
// reads meld CONTENT — the copies a call consumed are exactly what exhaustion counts.

import { COPIES_PER_KIND, KIND_COUNT, TILE_KINDS, kindIndexOf, kindOf, type TileKind } from './tiles'
import { isAgari } from './agari'
import type { Meld } from './record'

/**
 * Fresh 34-slot count array over every tile the hand accounts for: the concealed
 * kinds plus each meld's tiles — `own` always, `claimed` for the claiming forms
 * (an ankan claims nothing; all four of its copies are `own`).
 */
function visibleCounts(concealed: readonly TileKind[], melds: readonly Meld[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const kind of concealed) counts[kindIndexOf(kind)] += 1
  for (const meld of melds) {
    for (const tile of meld.own) counts[kindIndexOf(kindOf(tile))] += 1
    if (meld.type !== 'ankan') counts[kindIndexOf(kindOf(meld.claimed))] += 1
  }
  return counts
}

/** A hand holds at most four melds — the four-sets-and-a-pair ceiling. */
const MAX_MELDS = 4

/** The waiting hand: one tile short of the 14 a win decomposes, three per meld out. */
const TENPAI_TILE_COUNT = 13

/**
 * Every kind that completes the hand to agari and can still physically arrive — the
 * module's face. `concealed` is the seat's between-turns hand (13 − 3·melds kinds,
 * NO drawn or claimable tile); `melds` are the seat's exposed melds. Result is in
 * ascending TILE_KINDS order — part of the contract, the decomposeAgari precedent.
 * An empty result IS the noten signal (no separate null), and per the exhaustion
 * convention above that includes a hand whose every structural completion is
 * self-exhausted. Pure read: inputs never mutated, fresh array per call, same input
 * ⇒ same output. A wrong-arity query is caller corruption, not "no waits", and
 * throws RangeError naming both numbers (the decomposeAgari precedent) — guarded
 * here so the message counts from 13, not from the inner 14-tile probe's arithmetic.
 */
export function waits(concealed: readonly TileKind[], melds: readonly Meld[]): TileKind[] {
  if (melds.length > MAX_MELDS) {
    throw new RangeError(`waits with ${melds.length} melds — a hand holds at most ${MAX_MELDS}`)
  }
  const expected = TENPAI_TILE_COUNT - 3 * melds.length
  if (concealed.length !== expected) {
    throw new RangeError(
      `waits requires ${expected} concealed tiles with ${melds.length} melds, got ${concealed.length}`,
    )
  }
  const counts = visibleCounts(concealed, melds)
  const result: TileKind[] = []
  for (let k = 0; k < KIND_COUNT; k += 1) {
    if (counts[k] >= COPIES_PER_KIND) continue
    if (isAgari([...concealed, TILE_KINDS[k]], melds)) result.push(TILE_KINDS[k])
  }
  return result
}

/** True when at least one kind completes the hand — the emptiness read of waits. */
export function isTenpai(concealed: readonly TileKind[], melds: readonly Meld[]): boolean {
  return waits(concealed, melds).length > 0
}
