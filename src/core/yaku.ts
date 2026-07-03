// The standard yaku catalog: the closed set of non-yakuman yaku predicates, evaluated
// over ONE decomposition of a win plus its circumstances (a WinContext), returning
// yaku NAMES only — han and fu belong to the scoring epic and appear nowhere in this
// API. The catalog is per-decomposition on purpose: decomposition-dependent yaku
// (pinfu, iipeikou, toitoi, sanshoku, the chanta family, sanankou…) are facts OF a
// reading, and the aggregation across readings — together with yakuman and the
// one-yaku win gate — is T-005-01-04's aggregator, layered on top of this module.
// The tsumo/ron fold (T-005-02-01) assembles WinContexts; legality (T-005-02-02)
// and the hand-end teaching screen consume the names. The riichi family (riichi,
// double riichi, ippatsu — T-009-01-02) is present: three circumstance-only
// predicates, same shape as menzenTsumo/haitei/houtei/rinshan/chankan below — none
// of them read the decomposition, only WinContext.riichi/ippatsu, which the fold
// (record.ts) and its independent restatements (settlement.ts's winOf, legal.ts's
// winYaku) populate from TableState.doubleRiichi/ippatsu. Dora and ura-dora are
// never yaku (han.ts's own header); yakuman forms are -04's.

import {
  TILE_KINDS,
  isHonor,
  isSimple,
  isTerminal,
  kindIndexOf,
  kindOf,
  rankOf,
  suitOf,
  type NumberedSuit,
  type TileKind,
} from './tiles'
import type { AgariDecomposition, ConcealedSet } from './agari'
import type { Meld } from './record'

/**
 * The closed catalog of standard (non-yakuman) yaku names, as a literal union.
 * Romanized per the codebase vocabulary. Wind yakuhai are TWO names — a
 * double-east hand fires both yakuhai-seat-wind and yakuhai-round-wind — so the
 * name list preserves the multiplicity fact without carrying han values.
 */
export type YakuName =
  | 'menzen-tsumo'
  | 'riichi'
  | 'double-riichi'
  | 'ippatsu'
  | 'pinfu'
  | 'tanyao'
  | 'iipeikou'
  | 'yakuhai-haku'
  | 'yakuhai-hatsu'
  | 'yakuhai-chun'
  | 'yakuhai-seat-wind'
  | 'yakuhai-round-wind'
  | 'sanshoku-doujun'
  | 'sanshoku-doukou'
  | 'ittsuu'
  | 'chanta'
  | 'junchan'
  | 'toitoi'
  | 'sanankou'
  | 'sankantsu'
  | 'chiitoitsu'
  | 'honroutou'
  | 'shousangen'
  | 'honitsu'
  | 'chinitsu'
  | 'ryanpeikou'
  | 'haitei'
  | 'houtei'
  | 'rinshan'
  | 'chankan'

/**
 * Every catalog name in the frozen catalog order — the order standardYakuOf
 * returns names in (deterministic order is contract, the legalActions precedent).
 * The aggregator, the teaching UI's yaku glossary, and the per-yaku test table
 * all iterate this list instead of maintaining parallel copies.
 */
export const STANDARD_YAKU_NAMES: readonly YakuName[] = Object.freeze([
  'menzen-tsumo',
  'riichi',
  'double-riichi',
  'ippatsu',
  'pinfu',
  'tanyao',
  'iipeikou',
  'yakuhai-haku',
  'yakuhai-hatsu',
  'yakuhai-chun',
  'yakuhai-seat-wind',
  'yakuhai-round-wind',
  'sanshoku-doujun',
  'sanshoku-doukou',
  'ittsuu',
  'chanta',
  'junchan',
  'toitoi',
  'sanankou',
  'sankantsu',
  'chiitoitsu',
  'honroutou',
  'shousangen',
  'honitsu',
  'chinitsu',
  'ryanpeikou',
  'haitei',
  'houtei',
  'rinshan',
  'chankan',
])

/**
 * The four wind kinds. A seat's own wind is `${seat + 1}z` (Seat 0–3 anchors
 * 1z–4z, the deal.ts ordering); the ROUND wind is match structure the engine does
 * not hold (records are single hands), so both winds arrive on WinContext as
 * plain kinds the caller supplies. Defined here rather than tiles.ts because the
 * catalog is its only consumer today.
 */
export type WindKind = '1z' | '2z' | '3z' | '4z'

/**
 * The winner's riichi status at the moment of the win — 'none' unless the winner
 * had already declared this hand. 'riichi' and 'double' are mutually exclusive by
 * construction (a double riichi is never ALSO priced as a plain riichi, the
 * iipeikou/ryanpeikou disjoint-predicate precedent) — callers assign exactly one
 * of the three, never derive both flags independently (record.ts's
 * TableState.doubleRiichi implies TableState.riichi, and the caller-side mapping
 * — record.ts's applyWinTail, settlement.ts's winOf, legal.ts's winYaku, each an
 * independent restatement — reads that implication, not two free booleans).
 */
export type RiichiStatus = 'none' | 'riichi' | 'double'

/**
 * Everything one yaku evaluation reads: ONE reading of the win plus the
 * circumstances no tile multiset can encode. The fold (or any other caller)
 * assembles one WinContext per decomposition returned by decomposeAgari;
 * aggregating across readings is the -04 aggregator's job, not this type's.
 *
 * `source` names how the winning tile arrived and subsumes tsumo/ron: wall and
 * rinshan draws are tsumo; discard and chankan takes are ron. The illegal
 * combinations (a rinshan ron, a chankan tsumo) are unrepresentable by
 * construction. `lastTile` is consulted only for wall/discard sources — a
 * rinshan win on an emptied wall is rinshan, never haitei (the standard
 * convention, encoded in the haitei predicate's source check).
 */
export interface WinContext {
  /** One decomposition of the winning hand, from decomposeAgari. */
  readonly decomposition: AgariDecomposition
  /** The winner's exposed melds — read for openness and their set kinds. */
  readonly melds: readonly Meld[]
  /** The completing tile, kind-level (copies never affect any catalog yaku). */
  readonly winningKind: TileKind
  /** How the winning tile arrived; wall/rinshan = tsumo, discard/chankan = ron. */
  readonly source: 'wall' | 'rinshan' | 'discard' | 'chankan'
  /** True when the live wall is empty at the win (haitei/houtei circumstance). */
  readonly lastTile: boolean
  /** The winner's seat wind, `${seat + 1}z`. */
  readonly seatWind: WindKind
  /** The round wind — caller-supplied; no match state exists in the engine. */
  readonly roundWind: WindKind
  /** The winner's riichi status at the win (T-009-01-02) — see RiichiStatus. */
  readonly riichi: RiichiStatus
  /**
   * True while the winner's riichi ippatsu window is still open at the win
   * (T-009-01-02): declared, and no call has folded anywhere and no further
   * discard of the winner's own has folded since. Meaningless (and always false
   * from a real fold) when `riichi` is 'none'.
   */
  readonly ippatsu: boolean
}

/** Wall and rinshan draws are self-draws; discard and chankan takes are ron. */
function isTsumo(ctx: WinContext): boolean {
  return ctx.source === 'wall' || ctx.source === 'rinshan'
}

/** A hand is closed (menzen) iff its only melds are ankan — calls open it. */
function isMenzen(melds: readonly Meld[]): boolean {
  return melds.every((meld) => meld.type === 'ankan')
}

/**
 * The kind-level set a meld contributes to the four-sets picture: a chi IS a run
 * (start = its lowest kind), and every pon/kan is a triplet-class set. Shapes
 * were validated at claim time by the fold, so the min-kind read is safe.
 */
function meldSetOf(meld: Meld): ConcealedSet {
  if (meld.type === 'chi') {
    const kinds = [kindOf(meld.claimed), kindOf(meld.own[0]), kindOf(meld.own[1])]
    kinds.sort((a, b) => kindIndexOf(a) - kindIndexOf(b))
    return { type: 'run', start: kinds[0] }
  }
  return { type: 'triplet', kind: kindOf(meld.own[0]) }
}

/**
 * The full four-set picture of a standard-form context — concealed sets zipped
 * with the melds' kind-level sets — or null for the pairs forms (chiitoitsu has
 * no sets; kokushi never reaches the predicates).
 */
function combinedSets(ctx: WinContext): readonly ConcealedSet[] | null {
  if (ctx.decomposition.form !== 'standard') return null
  return [...ctx.decomposition.sets, ...ctx.melds.map(meldSetOf)]
}

/** Whether the full four-set picture holds a triplet-class set of `kind`. */
function hasTripletOf(ctx: WinContext, kind: TileKind): boolean {
  const sets = combinedSets(ctx)
  return sets !== null && sets.some((set) => set.type === 'triplet' && set.kind === kind)
}

/**
 * Every tile kind of the whole hand WITH multiplicity — pair, concealed sets,
 * and meld tiles (a kan contributes four copies; the whole-hand scans only ask
 * membership questions, so the extra copy is harmless). Chiitoitsu expands its
 * pairs; the kokushi arm exists for totality (standardYakuOf answers kokushi
 * with [] before any predicate runs).
 */
function allKinds(ctx: WinContext): TileKind[] {
  const decomposition = ctx.decomposition
  const kinds: TileKind[] = []
  switch (decomposition.form) {
    case 'standard': {
      kinds.push(decomposition.pair, decomposition.pair)
      for (const set of decomposition.sets) {
        if (set.type === 'triplet') {
          kinds.push(set.kind, set.kind, set.kind)
        } else {
          const at = kindIndexOf(set.start)
          kinds.push(TILE_KINDS[at], TILE_KINDS[at + 1], TILE_KINDS[at + 2])
        }
      }
      for (const meld of ctx.melds) {
        const tiles = meld.type === 'ankan' ? meld.own : [meld.claimed, ...meld.own]
        for (const tile of tiles) kinds.push(kindOf(tile))
      }
      return kinds
    }
    case 'chiitoitsu': {
      for (const pair of decomposition.pairs) kinds.push(pair, pair)
      return kinds
    }
    case 'kokushi': {
      for (const kind of TILE_KINDS) {
        if (isTerminal(kind) || isHonor(kind)) kinds.push(kind)
      }
      kinds.push(decomposition.pair)
      return kinds
    }
  }
}

/** The distinct numbered suits present across the whole hand. */
function numberedSuitsOf(kinds: readonly TileKind[]): Set<NumberedSuit> {
  const suits = new Set<NumberedSuit>()
  for (const kind of kinds) {
    const suit = suitOf(kind)
    if (suit !== 'z') suits.add(suit)
  }
  return suits
}

// ---------------------------------------------------------------------------
// The predicates, in catalog order. Each states its rule and, where the riichi
// world knows variations, the convention this catalog fixes.
// ---------------------------------------------------------------------------

/** Menzen tsumo: a self-draw on a closed hand. Ankan keeps the hand closed. */
function menzenTsumo(ctx: WinContext): boolean {
  return isTsumo(ctx) && isMenzen(ctx.melds)
}

/**
 * Riichi: declared this hand, and NOT a double riichi (doubleRiichiYaku
 * supersedes — the disjoint-by-construction pair, RiichiStatus's own contract).
 */
function riichiYaku(ctx: WinContext): boolean {
  return ctx.riichi === 'riichi'
}

/** Double riichi: declared on the seat's first, uninterrupted discard. */
function doubleRiichiYaku(ctx: WinContext): boolean {
  return ctx.riichi === 'double'
}

/** Ippatsu: won within one uninterrupted go-around of a riichi declaration. */
function ippatsuYaku(ctx: WinContext): boolean {
  return ctx.ippatsu
}

/**
 * Tanyao: every tile a simple (2–8). Kuitan — OPEN tanyao — is allowed, the
 * common modern default; the predicate deliberately never looks at the melds'
 * openness, only their tiles.
 */
function tanyao(ctx: WinContext): boolean {
  return allKinds(ctx).every(isSimple)
}

/** Yakuhai: a triplet-class set of the given honor. The pair never counts. */
function yakuhaiOf(kind: TileKind): (ctx: WinContext) => boolean {
  return (ctx) => hasTripletOf(ctx, kind)
}

/** Seat-wind yakuhai — tested independently of the round wind (double-fire). */
function yakuhaiSeatWind(ctx: WinContext): boolean {
  return hasTripletOf(ctx, ctx.seatWind)
}

/** Round-wind yakuhai — tested independently of the seat wind (double-fire). */
function yakuhaiRoundWind(ctx: WinContext): boolean {
  return hasTripletOf(ctx, ctx.roundWind)
}

/** Chiitoitsu: the seven-pairs form IS the yaku; closed by construction. */
function chiitoitsu(ctx: WinContext): boolean {
  return ctx.decomposition.form === 'chiitoitsu'
}

/**
 * Honroutou: every tile a terminal or honor — no runs can exist, so the shape
 * is toitoi-like or chiitoitsu. Disjoint from chanta/junchan by their ≥1-run
 * clauses (the no-stacking convention, encoded structurally).
 */
function honroutou(ctx: WinContext): boolean {
  return allKinds(ctx).every((kind) => isTerminal(kind) || isHonor(kind))
}

/** Honitsu: one numbered suit plus at least one honor (else it is chinitsu). */
function honitsu(ctx: WinContext): boolean {
  const kinds = allKinds(ctx)
  return numberedSuitsOf(kinds).size === 1 && kinds.some(isHonor)
}

/** Chinitsu: one numbered suit and no honors at all. Disjoint from honitsu. */
function chinitsu(ctx: WinContext): boolean {
  const kinds = allKinds(ctx)
  return numberedSuitsOf(kinds).size === 1 && !kinds.some(isHonor)
}

/**
 * Haitei: the last live-wall draw wins. The wall source check excludes rinshan
 * — a kan replacement that wins on an emptied wall is rinshan, never haitei.
 */
function haitei(ctx: WinContext): boolean {
  return ctx.source === 'wall' && ctx.lastTile
}

/** Houtei: ron on the final discard of an emptied wall. */
function houtei(ctx: WinContext): boolean {
  return ctx.source === 'discard' && ctx.lastTile
}

/** Rinshan kaihou: the win rides a kan's replacement draw. */
function rinshan(ctx: WinContext): boolean {
  return ctx.source === 'rinshan'
}

/** Chankan: the win robs a shouminkan's added tile. */
function chankan(ctx: WinContext): boolean {
  return ctx.source === 'chankan'
}

/** The three dragon kinds — always yakuhai, and the shousangen material. */
const DRAGON_KINDS: readonly TileKind[] = ['5z', '6z', '7z']

/** A kind whose triplet is always worth a yaku for THIS winner: dragons + winds. */
function isYakuhaiKind(ctx: WinContext, kind: TileKind): boolean {
  return DRAGON_KINDS.includes(kind) || kind === ctx.seatWind || kind === ctx.roundWind
}

/** Whether the run starting at `start` contains `kind` (same suit block). */
function runContains(start: TileKind, kind: TileKind): boolean {
  if (suitOf(kind) !== suitOf(start)) return false
  const offset = kindIndexOf(kind) - kindIndexOf(start)
  return offset >= 0 && offset <= 2
}

/**
 * Whether winning on `winning` completes the run at `start` from a TWO-SIDED
 * (ryanmen) wait: at the low end the pre-win pair was (start+1, start+2), two-
 * sided iff a rank above the run exists (start rank ≤ 6 — 789 won on 7 is the
 * 89 penchan); at the high end the pair was (start, start+1), two-sided iff a
 * rank below exists (start rank ≥ 2 — 123 won on 3 is the 12 penchan). The
 * middle tile is the kanchan by construction.
 */
function completesRyanmen(start: TileKind, winning: TileKind): boolean {
  if (suitOf(winning) !== suitOf(start)) return false
  const offset = kindIndexOf(winning) - kindIndexOf(start)
  const rank = rankOf(start)!
  if (offset === 0) return rank <= 6
  if (offset === 2) return rank >= 2
  return false
}

/** A set "contains a terminal": an edge run (123/789) or a terminal triplet. */
function setHasTerminal(set: ConcealedSet): boolean {
  if (set.type === 'run') {
    const rank = rankOf(set.start)!
    return rank === 1 || rank === 7
  }
  return isTerminal(set.kind)
}

/** Duplicated concealed runs as Σ⌊copies-per-start / 2⌋ — the peikou count. */
function peikouCount(ctx: WinContext): number {
  if (ctx.decomposition.form !== 'standard') return 0
  const byStart = new Map<TileKind, number>()
  for (const set of ctx.decomposition.sets) {
    if (set.type === 'run') byStart.set(set.start, (byStart.get(set.start) ?? 0) + 1)
  }
  let pairs = 0
  for (const count of byStart.values()) pairs += Math.floor(count / 2)
  return pairs
}

/**
 * Concealed triplets: the decomposition's triplets plus ankans, MINUS the ron
 * adjustment — a triplet of the winning kind completed by ron is not concealed,
 * unless the same decomposition holds a run that can absorb the winning tile
 * instead (the favorable attribution; the pair can never absorb it — a pair and
 * a triplet of one kind would be five copies).
 */
function concealedTripletCount(ctx: WinContext): number {
  const decomposition = ctx.decomposition
  if (decomposition.form !== 'standard') return 0
  let count = ctx.melds.filter((meld) => meld.type === 'ankan').length
  for (const set of decomposition.sets) {
    if (set.type === 'triplet') count += 1
  }
  const ronCompletesTriplet =
    !isTsumo(ctx) &&
    decomposition.sets.some((set) => set.type === 'triplet' && set.kind === ctx.winningKind) &&
    !decomposition.sets.some((set) => set.type === 'run' && runContains(set.start, ctx.winningKind))
  return ronCompletesTriplet ? count - 1 : count
}

/**
 * Pinfu: a fully concealed all-runs hand (any meld — even an ankan, itself a
 * triplet — disqualifies) whose pair is not yakuhai (an otakaze wind pair is
 * fine) and whose winning tile completes some run from a two-sided wait.
 */
function pinfu(ctx: WinContext): boolean {
  const decomposition = ctx.decomposition
  if (decomposition.form !== 'standard' || ctx.melds.length > 0) return false
  if (!decomposition.sets.every((set) => set.type === 'run')) return false
  if (isYakuhaiKind(ctx, decomposition.pair)) return false
  return decomposition.sets.some(
    (set) => set.type === 'run' && completesRyanmen(set.start, ctx.winningKind),
  )
}

/**
 * Iipeikou: a closed hand with EXACTLY one duplicated concealed run — two
 * duplicated pairs are ryanpeikou, which supersedes (the predicates are
 * disjoint by construction, never both).
 */
function iipeikou(ctx: WinContext): boolean {
  return isMenzen(ctx.melds) && peikouCount(ctx) === 1
}

/** Ryanpeikou: a closed hand with two duplicated concealed runs. */
function ryanpeikou(ctx: WinContext): boolean {
  return isMenzen(ctx.melds) && peikouCount(ctx) === 2
}

/** Sanshoku doujun: the same-starting run in all three numbered suits. */
function sanshokuDoujun(ctx: WinContext): boolean {
  const sets = combinedSets(ctx)
  if (sets === null) return false
  const suitsByRank = new Map<number, Set<string>>()
  for (const set of sets) {
    if (set.type !== 'run') continue
    const rank = rankOf(set.start)!
    const suits = suitsByRank.get(rank) ?? new Set<string>()
    suits.add(suitOf(set.start))
    suitsByRank.set(rank, suits)
  }
  return [...suitsByRank.values()].some((suits) => suits.size === 3)
}

/** Sanshoku doukou: the same-rank triplet in all three numbered suits. */
function sanshokuDoukou(ctx: WinContext): boolean {
  const sets = combinedSets(ctx)
  if (sets === null) return false
  const suitsByRank = new Map<number, Set<string>>()
  for (const set of sets) {
    if (set.type !== 'triplet' || isHonor(set.kind)) continue
    const rank = rankOf(set.kind)!
    const suits = suitsByRank.get(rank) ?? new Set<string>()
    suits.add(suitOf(set.kind))
    suitsByRank.set(rank, suits)
  }
  return [...suitsByRank.values()].some((suits) => suits.size === 3)
}

/** Ittsuu: the 123-456-789 straight within ONE suit, melds included. */
function ittsuu(ctx: WinContext): boolean {
  const sets = combinedSets(ctx)
  if (sets === null) return false
  const startsBySuit = new Map<string, Set<number>>()
  for (const set of sets) {
    if (set.type !== 'run') continue
    const suit = suitOf(set.start)
    const starts = startsBySuit.get(suit) ?? new Set<number>()
    starts.add(rankOf(set.start)!)
    startsBySuit.set(suit, starts)
  }
  return [...startsBySuit.values()].some(
    (starts) => starts.has(1) && starts.has(4) && starts.has(7),
  )
}

/**
 * Chanta: every set and the pair contain a terminal or honor, with at least one
 * run and at least one honor. The two extra clauses keep the family disjoint:
 * no honors is junchan territory, no runs is honroutou territory — the standard
 * no-stacking convention encoded structurally rather than by aggregator cleanup.
 */
function chanta(ctx: WinContext): boolean {
  const decomposition = ctx.decomposition
  if (decomposition.form !== 'standard') return false
  const sets = combinedSets(ctx)!
  if (!sets.some((set) => set.type === 'run')) return false
  if (!allKinds(ctx).some(isHonor)) return false
  if (!isTerminal(decomposition.pair) && !isHonor(decomposition.pair)) return false
  return sets.every((set) => setHasTerminal(set) || (set.type === 'triplet' && isHonor(set.kind)))
}

/**
 * Junchan: every set and the pair contain a TERMINAL (honors fail this by
 * definition), with at least one run — the all-triplet all-terminal shape is
 * chinroutou, a yakuman, and this catalog stays silent on it by design.
 */
function junchan(ctx: WinContext): boolean {
  const decomposition = ctx.decomposition
  if (decomposition.form !== 'standard') return false
  const sets = combinedSets(ctx)!
  if (!sets.some((set) => set.type === 'run')) return false
  if (!isTerminal(decomposition.pair)) return false
  return sets.every(setHasTerminal)
}

/** Toitoi: all four sets triplet-class — any kan counts, any chi disqualifies. */
function toitoi(ctx: WinContext): boolean {
  const sets = combinedSets(ctx)
  return sets !== null && sets.every((set) => set.type === 'triplet')
}

/**
 * Sanankou: at least three concealed triplets (see concealedTripletCount for
 * the ron adjustment). "At least", not "exactly": four concealed triplets is
 * suuankou, a yakuman the -04 gate suppresses standard yaku under — keeping the
 * predicate monotone keeps yakuman knowledge out of this module.
 */
function sanankou(ctx: WinContext): boolean {
  return concealedTripletCount(ctx) >= 3
}

/** Sankantsu: at least three kans of any form (four is suukantsu, -04's). */
function sankantsu(ctx: WinContext): boolean {
  return ctx.melds.filter((meld) => meld.type !== 'chi' && meld.type !== 'pon').length >= 3
}

/**
 * Shousangen: exactly two dragon triplets with the third dragon as the pair —
 * three dragon triplets are daisangen, the -04 yakuman.
 */
function shousangen(ctx: WinContext): boolean {
  const decomposition = ctx.decomposition
  if (decomposition.form !== 'standard') return false
  const dragonTriplets = DRAGON_KINDS.filter((kind) => hasTripletOf(ctx, kind)).length
  return dragonTriplets === 2 && DRAGON_KINDS.includes(decomposition.pair)
}

/**
 * The catalog table zipping names to predicates in catalog order — module-
 * private: consumers get names from standardYakuOf, never predicate functions.
 */
const STANDARD_YAKU: readonly { name: YakuName; test: (ctx: WinContext) => boolean }[] = [
  { name: 'menzen-tsumo', test: menzenTsumo },
  { name: 'riichi', test: riichiYaku },
  { name: 'double-riichi', test: doubleRiichiYaku },
  { name: 'ippatsu', test: ippatsuYaku },
  { name: 'pinfu', test: pinfu },
  { name: 'tanyao', test: tanyao },
  { name: 'iipeikou', test: iipeikou },
  { name: 'yakuhai-haku', test: yakuhaiOf('5z') },
  { name: 'yakuhai-hatsu', test: yakuhaiOf('6z') },
  { name: 'yakuhai-chun', test: yakuhaiOf('7z') },
  { name: 'yakuhai-seat-wind', test: yakuhaiSeatWind },
  { name: 'yakuhai-round-wind', test: yakuhaiRoundWind },
  { name: 'sanshoku-doujun', test: sanshokuDoujun },
  { name: 'sanshoku-doukou', test: sanshokuDoukou },
  { name: 'ittsuu', test: ittsuu },
  { name: 'chanta', test: chanta },
  { name: 'junchan', test: junchan },
  { name: 'toitoi', test: toitoi },
  { name: 'sanankou', test: sanankou },
  { name: 'sankantsu', test: sankantsu },
  { name: 'chiitoitsu', test: chiitoitsu },
  { name: 'honroutou', test: honroutou },
  { name: 'shousangen', test: shousangen },
  { name: 'honitsu', test: honitsu },
  { name: 'chinitsu', test: chinitsu },
  { name: 'ryanpeikou', test: ryanpeikou },
  { name: 'haitei', test: haitei },
  { name: 'houtei', test: houtei },
  { name: 'rinshan', test: rinshan },
  { name: 'chankan', test: chankan },
]

/** Catalog-order index of each name, for sorting evaluation results. */
const NAME_ORDER: ReadonlyMap<YakuName, number> = new Map(
  STANDARD_YAKU_NAMES.map((name, at) => [name, at]),
)

/**
 * Evaluate the standard catalog over one WinContext: the names of every
 * satisfied non-yakuman yaku, in catalog order, fresh array per call. `[]`
 * means "no standard yaku" — the one-yaku WIN GATE is the -04 aggregator's
 * refusal, not this function's. A kokushi decomposition answers `[]` (it is a
 * yakuman, -04's concern) — legal input, empty answer.
 *
 * Pure read: inputs never mutated, same context ⇒ same list. A context whose
 * decomposition and melds disagree on arity is caller corruption, not "no
 * yaku", and throws RangeError (the decomposeAgari precedent): standard form
 * requires sets + melds = 4; the pairs forms require zero melds.
 */
export function standardYakuOf(ctx: WinContext): YakuName[] {
  const decomposition = ctx.decomposition
  if (decomposition.form === 'standard') {
    if (decomposition.sets.length + ctx.melds.length !== 4) {
      throw new RangeError(
        `standardYakuOf: standard decomposition with ${decomposition.sets.length} concealed sets and ${ctx.melds.length} melds — a win holds exactly 4 sets`,
      )
    }
  } else if (ctx.melds.length !== 0) {
    throw new RangeError(
      `standardYakuOf: ${decomposition.form} decomposition with ${ctx.melds.length} melds — the form is closed by rule`,
    )
  }
  if (decomposition.form === 'kokushi') return []
  return STANDARD_YAKU.filter((yaku) => yaku.test(ctx))
    .map((yaku) => yaku.name)
    .sort((a, b) => NAME_ORDER.get(a)! - NAME_ORDER.get(b)!)
}
