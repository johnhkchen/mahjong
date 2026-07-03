// The shanten datum: how many tile exchanges separate a concealed hand from tenpai.
// `standardShanten` counts exchanges to the four-sets-and-a-pair shape alone — −1
// complete, 0 tenpai, up to 8 for thirteen mutually unreachable tiles. `shanten`, the
// module's face, is the min-of-three combinator the ticket promises: standard, chiitoitsu
// (seven distinct pairs), and kokushi (thirteen orphans), each read over the same
// concealed hand — the single shanten datum "competent" is defined against, the discard
// policy (T-006-03-01) minimizes, and the teaching prompts read. Like agari.ts and unlike
// waits.ts, this is KIND-level SHAPE distance: melds are read for ARITY ONLY (a call
// is one completed set whatever its content, kans included), and a kind whose four
// copies are all visible is never discounted — 4-copy exhaustion is waits' convention,
// reconciled with shanten by the property crown (T-006-02-03), not re-derived here.
//
// The standard-form algorithm is the classical block-count maximum: over every disjoint
// decomposition of the counts into complete sets (triplet/run), partial sets (a pair as
// proto-triplet, or two suit tiles at distance 1 or 2 as proto-run), and at most one
// reserved head pair — subject to the block cap sets + partials ≤ 4 − melds —
//
//   standardShanten = 8 − 2·melds − max(2·sets + partials + head)
//
// The cap and the explicit head flag are what make the formula exact; maximizing over
// ALL decompositions (a pair may serve as head, as a partial, or feed a triplet) is
// what an exhaustive backtracker buys over every greedy counting. Chiitoitsu and kokushi
// use the standard closed-form results instead (O(34)/O(13) linear scans, no search
// needed) — see chiitoiShanten/kokushiShanten below. Both are zero-meld forms by rule;
// `shanten` only evaluates them when melds is empty, and reads exactly standardShanten
// otherwise.

import { KIND_COUNT, kindIndexOf, type TileKind } from './tiles'
import type { Meld } from './record'

/** Fresh 34-slot kind-count array (TILE_KINDS order) — the agari/waits private twin. */
function countsOf(concealed: readonly TileKind[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const kind of concealed) counts[kindIndexOf(kind)] += 1
  return counts
}

/** A hand holds at most four melds — the four-sets-and-a-pair ceiling. */
const MAX_MELDS = 4

/**
 * The block-count backtracker: the maximum of 2·sets + partials + head reachable from
 * the counts at kind `from` onward, with `blocksLeft` set/partial slots and the head
 * pair still unclaimed iff `headFree`. Every countable shape is anchored at its LOWEST
 * kind — triplet kkk, run k·k+1·k+2, pair kk, proto-runs k·k+1 and k·k+2 — so at the
 * first nonzero kind the search branches over exactly the shapes anchored there
 * (re-entering the same kind, which may hold more) plus "advance: leave the remaining
 * copies as floaters"; once past k nothing later can touch k, which makes
 * lowest-kind-first exhaustive with no deduplication (the searchSets argument in
 * agari.ts, extended from two shapes to six). Suit-block guards keep proto-runs and
 * runs inside a numbered 9-block: k < 27 excludes honors, k % 9 caps the rank so 9m
 * never reaches into 1p through the contiguous kind indices. Mutate-recurse-restore on
 * the borrowed counts array; branches are tried highest-value-first and the search
 * returns early once it meets 2·blocksLeft + headFree, the trivial upper bound on what
 * remains — the only pruning, deliberately too simple to be wrong.
 */
function bestValue(counts: number[], from: number, blocksLeft: number, headFree: boolean): number {
  let k = from
  while (k < KIND_COUNT && counts[k] === 0) k += 1
  if (k === KIND_COUNT) return 0
  const upperBound = 2 * blocksLeft + (headFree ? 1 : 0)
  let best = 0
  if (blocksLeft > 0) {
    if (counts[k] >= 3) {
      counts[k] -= 3
      best = Math.max(best, 2 + bestValue(counts, k, blocksLeft - 1, headFree))
      counts[k] += 3
      if (best === upperBound) return best
    }
    if (k < 27 && k % 9 <= 6 && counts[k + 1] >= 1 && counts[k + 2] >= 1) {
      counts[k] -= 1
      counts[k + 1] -= 1
      counts[k + 2] -= 1
      best = Math.max(best, 2 + bestValue(counts, k, blocksLeft - 1, headFree))
      counts[k] += 1
      counts[k + 1] += 1
      counts[k + 2] += 1
      if (best === upperBound) return best
    }
  }
  if (counts[k] >= 2) {
    if (headFree) {
      counts[k] -= 2
      best = Math.max(best, 1 + bestValue(counts, k, blocksLeft, false))
      counts[k] += 2
      if (best === upperBound) return best
    }
    if (blocksLeft > 0) {
      counts[k] -= 2
      best = Math.max(best, 1 + bestValue(counts, k, blocksLeft - 1, headFree))
      counts[k] += 2
      if (best === upperBound) return best
    }
  }
  if (blocksLeft > 0 && k < 27) {
    if (k % 9 <= 7 && counts[k + 1] >= 1) {
      counts[k] -= 1
      counts[k + 1] -= 1
      best = Math.max(best, 1 + bestValue(counts, k, blocksLeft - 1, headFree))
      counts[k] += 1
      counts[k + 1] += 1
      if (best === upperBound) return best
    }
    if (k % 9 <= 6 && counts[k + 2] >= 1) {
      counts[k] -= 1
      counts[k + 2] -= 1
      best = Math.max(best, 1 + bestValue(counts, k, blocksLeft - 1, headFree))
      counts[k] += 1
      counts[k + 2] += 1
      if (best === upperBound) return best
    }
  }
  return Math.max(best, bestValue(counts, k + 1, blocksLeft, headFree))
}

/** The waiting and drawn-tile hand sizes a shanten query may hold, three per meld out. */
const TENPAI_TILE_COUNT = 13
const AGARI_TILE_COUNT = 14

/**
 * Standard-form shanten — the module's face. `concealed` is the seat's concealed hand
 * as kinds, at EITHER legal arity: 13 − 3·melds (between turns) or 14 − 3·melds
 * (holding a draw — the drawn tile is just a fourteenth kind; a complete hand reads
 * −1). `melds` are the seat's exposed melds, read for arity only — each call discounts
 * one required set. Returns an integer: −1 complete, 0 tenpai, positive counts the
 * exchanges to tenpai (at most 8). Pure read: inputs never mutated, same input ⇒ same
 * output. A wrong-arity query is caller corruption, not "far from tenpai", and throws
 * RangeError naming both accepted counts (the decomposeAgari/waits precedent). Kind
 * VALUES are trusted — TileKind is a compile-time union, and inputs from outside the
 * program are validated at the log-parser boundary, per the TileId rule in tiles.ts.
 */
export function standardShanten(concealed: readonly TileKind[], melds: readonly Meld[]): number {
  if (melds.length > MAX_MELDS) {
    throw new RangeError(
      `standardShanten with ${melds.length} melds — a hand holds at most ${MAX_MELDS}`,
    )
  }
  const waiting = TENPAI_TILE_COUNT - 3 * melds.length
  const drawn = AGARI_TILE_COUNT - 3 * melds.length
  if (concealed.length !== waiting && concealed.length !== drawn) {
    throw new RangeError(
      `standardShanten requires ${waiting} or ${drawn} concealed tiles with ${melds.length} melds, got ${concealed.length}`,
    )
  }
  const counts = countsOf(concealed)
  return 8 - 2 * melds.length - bestValue(counts, 0, MAX_MELDS - melds.length, true)
}

/** The 13 kokushi kind indices: terminals of each numbered suit, then every honor — the agari.ts KOKUSHI_KIND_INDEXES twin. */
const KOKUSHI_KIND_INDEXES: readonly number[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

/**
 * Chiitoitsu shanten: `6 − pairs + max(0, 7 − kinds)`, where `pairs` counts kinds held
 * at ≥ 2 copies and `kinds` counts distinct kinds present — both naturally ≤ 7/≤ 13 for
 * a legal hand, so no explicit cap is needed. The second term penalizes duplicate-heavy
 * hands (e.g. four-of-a-kind) that hold pairs but too few DISTINCT kinds to ever reach
 * seven without breaking one down. Zero-meld form only — the caller gates on that.
 */
function chiitoiShanten(counts: readonly number[]): number {
  let pairs = 0
  let kinds = 0
  for (const count of counts) {
    if (count >= 2) pairs += 1
    if (count >= 1) kinds += 1
  }
  return 6 - pairs + Math.max(0, 7 - kinds)
}

/**
 * Kokushi shanten: `13 − kinds − hasPair`, where `kinds` counts the 13 terminal/honor
 * kinds present at least once and `hasPair` is 1 iff one of them is held at ≥ 2 copies.
 * Zero-meld form only — the caller gates on that.
 */
function kokushiShanten(counts: readonly number[]): number {
  let kinds = 0
  let hasPair = false
  for (const k of KOKUSHI_KIND_INDEXES) {
    if (counts[k] >= 1) kinds += 1
    if (counts[k] >= 2) hasPair = true
  }
  return 13 - kinds - (hasPair ? 1 : 0)
}

/**
 * The min-of-three combinator — the module's face. Returns
 * `min(standardShanten, chiitoiShanten, kokushiShanten)`: the single shanten datum the
 * discard policy minimizes and the teaching prompts read. Delegates arity and meld-count
 * validation to `standardShanten` (same RangeError messages, no duplicated checks).
 * Chiitoitsu and kokushi are zero-meld forms by rule — any call breaks both — so they
 * are only evaluated when `melds.length === 0`; a melded hand reads exactly
 * `standardShanten`. Pure read: inputs never mutated, same input ⇒ same output.
 */
export function shanten(concealed: readonly TileKind[], melds: readonly Meld[]): number {
  const standard = standardShanten(concealed, melds)
  if (melds.length > 0) return standard
  const counts = countsOf(concealed)
  return Math.min(standard, chiitoiShanten(counts), kokushiShanten(counts))
}
