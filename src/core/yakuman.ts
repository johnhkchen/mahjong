// The yakuman catalog reachable without riichi, plus THE aggregator: yakuOf, the
// single win → yaku-name-list read the tsumo/ron fold (T-005-02-01) records and
// win legality (T-005-02-02) gates on. Three conventions live here and nowhere
// else: (1) the ONE-YAKU WIN GATE — a completion carrying no yaku answers `[]`,
// and that empty list is the refusal signal consumers must honor (no ron/tsumo
// offer, no legal win action); (2) YAKUMAN SUPERSEDE — a win carrying any yakuman
// lists only its yakuman names, never standard yaku (yaku.ts's monotone
// predicates — sanankou under suuankou, sankantsu under suukantsu — lean on this
// suppression); (3) YAKUMAN STACK — every satisfied yakuman is listed (a
// daisuushii tsumo is also tsuuiisou and suuankou), their combined valuation
// being the scoring epic's question, not this module's. Standard yaku aggregate
// as the UNION across decomposeAgari's readings — "every yaku some reading
// supports" — because "best reading" is a han question and han lives in the
// scoring epic; per-reading facts stay available through standardYakuOf.
// Tenhou and chiihou are absent: they are facts of the deal moment (a first
// uninterrupted draw) that no engine state can express yet — YakumanName widens
// extend-only when the fold can supply the fact (the riichi-family precedent in
// yaku.ts). Double-yakuman variant NAMES (kokushi 13-wait, suuankou tanki,
// junsei chuuren) are likewise deferred: they can land additively beside the
// base names (the double-wind-yakuhai multiplicity precedent) once the scoring
// epic decides whether this ruleset values doubles. No han, no fu, anywhere.

import { isHonor, isTerminal, kindOf, rankOf, suitOf, type TileKind } from './tiles'
import { decomposeAgari, type AgariDecomposition } from './agari'
import type { Meld } from './record'
import {
  STANDARD_YAKU_NAMES,
  standardYakuOf,
  type WinContext,
  type WindKind,
  type YakuName,
} from './yaku'

/**
 * The closed catalog of yakuman names reachable without riichi, as a literal
 * union in traditional listing order. Romanized per the codebase vocabulary;
 * 'kokushi' matches the AgariDecomposition form's spelling.
 */
export type YakumanName =
  | 'kokushi'
  | 'suuankou'
  | 'daisangen'
  | 'shousuushii'
  | 'daisuushii'
  | 'tsuuiisou'
  | 'chinroutou'
  | 'ryuuiisou'
  | 'chuuren-poutou'
  | 'suukantsu'

/**
 * Every yakuman name in the frozen catalog order — the order yakuOf returns
 * yakuman names in (deterministic order is contract, the STANDARD_YAKU_NAMES
 * precedent). The test table and the teaching UI's glossary iterate this list.
 */
export const YAKUMAN_NAMES: readonly YakumanName[] = Object.freeze([
  'kokushi',
  'suuankou',
  'daisangen',
  'shousuushii',
  'daisuushii',
  'tsuuiisou',
  'chinroutou',
  'ryuuiisou',
  'chuuren-poutou',
  'suukantsu',
])

/** Any name a win can carry — what the fold records and the UI displays. */
export type WinYakuName = YakuName | YakumanName

/**
 * Everything the aggregator reads: the whole win, before any reading is chosen
 * — WinContext minus the decomposition, plus the raw concealed kinds, because
 * aggregating across decomposeAgari's readings is exactly this module's job.
 * The circumstance fields reuse WinContext's names and types verbatim so the
 * fold assembles one object and spreads it per reading.
 */
export interface Win {
  /** The winner's concealed tiles INCLUDING the completing tile, as kinds. */
  readonly concealed: readonly TileKind[]
  /** The winner's exposed melds — arity for decomposition, kinds for scans. */
  readonly melds: readonly Meld[]
  /** The completing tile, kind-level (copies never affect any yaku). */
  readonly winningKind: TileKind
  /** How the winning tile arrived; wall/rinshan = tsumo, discard/chankan = ron. */
  readonly source: 'wall' | 'rinshan' | 'discard' | 'chankan'
  /** True when the live wall is empty at the win. */
  readonly lastTile: boolean
  /** The winner's seat wind, `${seat + 1}z`. */
  readonly seatWind: WindKind
  /** The round wind — caller-supplied; no match state exists in the engine. */
  readonly roundWind: WindKind
}

/**
 * Every tile kind of the whole win WITH multiplicity — concealed kinds plus
 * meld tiles (a kan contributes four copies; the scans below ask membership
 * and ≥3 questions, so the extra copy is harmless — the allKinds precedent).
 */
function allKindsOf(win: Win): TileKind[] {
  const kinds = [...win.concealed]
  for (const meld of win.melds) {
    const tiles = meld.type === 'ankan' ? meld.own : [meld.claimed, ...meld.own]
    for (const tile of tiles) kinds.push(kindOf(tile))
  }
  return kinds
}

/** Occurrences of one kind in the whole-win multiset (≤ 18 tiles — linear is fine). */
function countOf(kinds: readonly TileKind[], kind: TileKind): number {
  let count = 0
  for (const k of kinds) if (k === kind) count += 1
  return count
}

/** The four wind kinds and the three dragon kinds, in mpsz order. */
const WIND_KINDS: readonly TileKind[] = ['1z', '2z', '3z', '4z']
const DRAGON_KINDS: readonly TileKind[] = ['5z', '6z', '7z']

/** The green tiles — all of ryuuiisou's material: 2s/3s/4s/6s/8s and hatsu. */
const GREEN_KINDS: readonly TileKind[] = ['2s', '3s', '4s', '6s', '8s', '6z']

// ---------------------------------------------------------------------------
// The predicates, in catalog order. Uniform signature (win, readings, kinds)
// so the table stays homogeneous; each ignores what it does not need. Most
// yakuman are whole-win MULTISET facts: in a legal win an honor kind held ≥3
// times can only be a triplet-class set (honors never run), so the dragon and
// wind yakuman reduce to count reads. Only kokushi and suuankou consult the
// readings; suukantsu reads melds alone.
// ---------------------------------------------------------------------------

/** Kokushi musou: the thirteen-orphans form — the decomposer owns the shape. */
function kokushi(_win: Win, readings: readonly AgariDecomposition[]): boolean {
  return readings.some((reading) => reading.form === 'kokushi')
}

/**
 * Suuankou: some reading with four concealed triplet-class sets — every meld an
 * ankan, every concealed set a triplet — completed by self-draw or on the pair
 * wait (tanki: the triplets stood complete before the win). A ron that
 * completes a triplet demotes it to open (three concealed left — sanankou +
 * toitoi, standard yaku the supersession no longer hides). Unlike sanankou's
 * ron adjustment there is no favorable run absorption here: an all-triplet
 * reading holds no run to absorb anything.
 */
function suuankou(win: Win, readings: readonly AgariDecomposition[]): boolean {
  const tsumo = win.source === 'wall' || win.source === 'rinshan'
  return readings.some(
    (reading) =>
      reading.form === 'standard' &&
      win.melds.every((meld) => meld.type === 'ankan') &&
      reading.sets.every((set) => set.type === 'triplet') &&
      (tsumo || reading.pair === win.winningKind),
  )
}

/** Daisangen: all three dragons held ≥3 times — necessarily three triplets. */
function daisangen(_win: Win, _readings: readonly AgariDecomposition[], kinds: readonly TileKind[]): boolean {
  return DRAGON_KINDS.every((kind) => countOf(kinds, kind) >= 3)
}

/**
 * Shousuushii: exactly three winds held as triplets with the fourth as the
 * pair. Count-exact on the fourth wind (=== 2) — a fourth triplet is
 * daisuushii, and the two predicates are disjoint by construction.
 */
function shousuushii(_win: Win, _readings: readonly AgariDecomposition[], kinds: readonly TileKind[]): boolean {
  const counts = WIND_KINDS.map((kind) => countOf(kinds, kind))
  return counts.filter((count) => count >= 3).length === 3 && counts.includes(2)
}

/** Daisuushii: all four winds held ≥3 times — four wind triplets. */
function daisuushii(_win: Win, _readings: readonly AgariDecomposition[], kinds: readonly TileKind[]): boolean {
  return WIND_KINDS.every((kind) => countOf(kinds, kind) >= 3)
}

/** Tsuuiisou: every tile an honor. Fires over the all-honor chiitoitsu form too. */
function tsuuiisou(_win: Win, _readings: readonly AgariDecomposition[], kinds: readonly TileKind[]): boolean {
  return kinds.every(isHonor)
}

/** Chinroutou: every tile a terminal — the no-run all-terminal shape junchan defers to. */
function chinroutou(_win: Win, _readings: readonly AgariDecomposition[], kinds: readonly TileKind[]): boolean {
  return kinds.every(isTerminal)
}

/**
 * Ryuuiisou: every tile green (2s/3s/4s/6s/8s/6z). Hatsu is NOT required —
 * the common modern convention; an all-green hand without 6z still counts.
 */
function ryuuiisou(_win: Win, _readings: readonly AgariDecomposition[], kinds: readonly TileKind[]): boolean {
  return kinds.every((kind) => GREEN_KINDS.includes(kind))
}

/**
 * Chuuren poutou: the nine gates — a fully concealed hand (zero melds; even an
 * ankan breaks the form, the standard convention: the 1112345678999 multiset
 * must sit in hand) of ONE numbered suit whose rank counts cover
 * 3-1-1-1-1-1-1-1-3; fourteen tiles leave exactly one surplus rank.
 */
function chuurenPoutou(win: Win, _readings: readonly AgariDecomposition[], kinds: readonly TileKind[]): boolean {
  if (win.melds.length > 0) return false
  const suits = new Set(kinds.map(suitOf))
  if (suits.size !== 1 || suits.has('z')) return false
  const counts = new Array<number>(10).fill(0)
  for (const kind of kinds) counts[rankOf(kind)!] += 1
  if (counts[1] < 3 || counts[9] < 3) return false
  for (let rank = 2; rank <= 8; rank += 1) {
    if (counts[rank] < 1) return false
  }
  return true
}

/** Suukantsu: four kans of any form — the shape sankantsu stays monotone under. */
function suukantsu(win: Win): boolean {
  return win.melds.filter((meld) => meld.type !== 'chi' && meld.type !== 'pon').length === 4
}

/** The catalog table zipping names to predicates in catalog order — private. */
const YAKUMAN: readonly {
  name: YakumanName
  test: (win: Win, readings: readonly AgariDecomposition[], kinds: readonly TileKind[]) => boolean
}[] = [
  { name: 'kokushi', test: kokushi },
  { name: 'suuankou', test: suuankou },
  { name: 'daisangen', test: daisangen },
  { name: 'shousuushii', test: shousuushii },
  { name: 'daisuushii', test: daisuushii },
  { name: 'tsuuiisou', test: tsuuiisou },
  { name: 'chinroutou', test: chinroutou },
  { name: 'ryuuiisou', test: ryuuiisou },
  { name: 'chuuren-poutou', test: chuurenPoutou },
  { name: 'suukantsu', test: suukantsu },
]

/**
 * THE aggregator: every yaku name a win carries. Yakuman first — any hit
 * returns only the satisfied yakuman names, in YAKUMAN_NAMES order (the
 * supersession + stacking conventions above). Otherwise the union of
 * standardYakuOf over every decomposeAgari reading, in STANDARD_YAKU_NAMES
 * order — so a ryanpeikou-shaped hand lists both ryanpeikou and chiitoitsu,
 * and the scoring epic later picks its single best reading per-reading.
 *
 * `[]` means "this completion carries no yaku" — the WIN GATE's refusal.
 * A NON-completion is caller corruption, not "no yaku", and throws RangeError
 * (the decomposeAgari arity guards pass through; callers asking "is this a
 * win at all" have isAgari) — keeping `[]` unambiguous for the gate. The
 * winning kind must appear among the concealed tiles (the completing tile is
 * concealed-side by decomposeAgari's contract) — desync throws likewise.
 *
 * Pure read: inputs never mutated, same win ⇒ same list, fresh array per call.
 */
export function yakuOf(win: Win): WinYakuName[] {
  const readings = decomposeAgari(win.concealed, win.melds)
  if (readings.length === 0) {
    throw new RangeError('yakuOf: the concealed tiles and melds do not complete a win')
  }
  if (!win.concealed.includes(win.winningKind)) {
    throw new RangeError(
      `yakuOf: winning kind ${win.winningKind} is absent from the concealed tiles`,
    )
  }
  const kinds = allKindsOf(win)
  const yakuman = YAKUMAN.filter((entry) => entry.test(win, readings, kinds))
  if (yakuman.length > 0) return yakuman.map((entry) => entry.name)
  const union = new Set<YakuName>()
  for (const decomposition of readings) {
    const ctx: WinContext = {
      decomposition,
      melds: win.melds,
      winningKind: win.winningKind,
      source: win.source,
      lastTile: win.lastTile,
      seatWind: win.seatWind,
      roundWind: win.roundWind,
    }
    for (const name of standardYakuOf(ctx)) union.add(name)
  }
  return STANDARD_YAKU_NAMES.filter((name) => union.has(name))
}
