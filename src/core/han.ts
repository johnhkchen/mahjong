// The han half of a win's price: a name → han lookup over the whole catalog
// (standard yaku, open/closed variants where the standard rules differ; every
// yakuman flat at 13, single-yakuman valuation only), plus dora + kan-dora
// counting — every flipped indicator (TableState.doras already unifies dora
// and kan-dora into one list) priced against the whole hand's tile multiset,
// one han per copy held. No ura-dora: riichi is not yet in the action
// vocabulary (yaku.ts's header), so there is no face-down indicator to count.
// No red fives: TileKind carries no aka variant. Deliberately no fu, no
// points, no aggregation of a win's yaku list into a total han — assembling
// name-han + dora-han into one number is the payment entrypoint's job
// (T-008-01-03), not this module's, exactly as fu.ts stays silent on han and
// points. Dora is not, and must never become, a member of WinYakuName: the
// one-yaku win gate (yakuman.ts's yakuOf / record.ts's applyWinTail) only
// ever inspects that union, so doraHanOf returning a plain number keeps dora
// structurally incapable of satisfying the gate.

import type { Meld } from './record'
import { kindOf, type TileKind } from './tiles'
import { YAKUMAN_NAMES, type Win, type WinYakuName } from './yakuman'
import type { YakuName } from './yaku'

/** A hand is closed (menzen) iff its only melds are ankan (yaku.ts's / fu.ts's rule). */
function isMenzen(melds: readonly Meld[]): boolean {
  return melds.every((meld) => meld.type === 'ankan')
}

/**
 * The standard-yaku han table: closed and open values per the published
 * riichi rule table (design.md). Names whose predicate in yaku.ts requires a
 * fully closed hand (menzen-tsumo, pinfu, iipeikou, chiitoitsu, ryanpeikou)
 * never reach hanOf with an open `melds` — their `open` column carries the
 * same value as `closed` rather than an unreachable sentinel, since hanOf has
 * no way (and no need) to tell "impossible" apart from a real open value here.
 */
const YAKU_HAN: Readonly<Record<YakuName, { closed: number; open: number }>> = {
  'menzen-tsumo': { closed: 1, open: 1 },
  riichi: { closed: 1, open: 1 },
  'double-riichi': { closed: 2, open: 2 },
  ippatsu: { closed: 1, open: 1 },
  pinfu: { closed: 1, open: 1 },
  tanyao: { closed: 1, open: 1 },
  iipeikou: { closed: 1, open: 1 },
  'yakuhai-haku': { closed: 1, open: 1 },
  'yakuhai-hatsu': { closed: 1, open: 1 },
  'yakuhai-chun': { closed: 1, open: 1 },
  'yakuhai-seat-wind': { closed: 1, open: 1 },
  'yakuhai-round-wind': { closed: 1, open: 1 },
  'sanshoku-doujun': { closed: 2, open: 1 },
  'sanshoku-doukou': { closed: 2, open: 2 },
  ittsuu: { closed: 2, open: 1 },
  chanta: { closed: 2, open: 1 },
  junchan: { closed: 3, open: 2 },
  toitoi: { closed: 2, open: 2 },
  sanankou: { closed: 2, open: 2 },
  sankantsu: { closed: 2, open: 2 },
  chiitoitsu: { closed: 2, open: 2 },
  honroutou: { closed: 2, open: 2 },
  shousangen: { closed: 2, open: 2 },
  honitsu: { closed: 3, open: 2 },
  chinitsu: { closed: 6, open: 5 },
  ryanpeikou: { closed: 3, open: 3 },
  haitei: { closed: 1, open: 1 },
  houtei: { closed: 1, open: 1 },
  rinshan: { closed: 1, open: 1 },
  chankan: { closed: 1, open: 1 },
}

/** Every yakuman prices as a flat single yakuman — openness is not a yakuman fact. */
const YAKUMAN_HAN = 13

/** Membership test reusing the frozen catalog array — no separate per-name table needed. */
const YAKUMAN_SET: ReadonlySet<string> = new Set(YAKUMAN_NAMES)

/**
 * The han value of one yaku or yakuman name, given the winner's melds (openness
 * is the only circumstance that varies a standard yaku's han; yakuman ignore
 * it). Pure table lookup — the caller supplies the SAME `melds` it already
 * holds on a Win/WinContext, no separate "is this hand closed" step.
 */
export function hanOf(name: WinYakuName, melds: readonly Meld[]): number {
  if (YAKUMAN_SET.has(name)) return YAKUMAN_HAN
  const entry = YAKU_HAN[name as YakuName]
  return isMenzen(melds) ? entry.closed : entry.open
}

/**
 * Every tile kind of the whole win WITH multiplicity — concealed kinds
 * (already including the winning tile, Win's contract) plus meld tiles (a kan
 * contributes four copies; dora counting wants every physical copy, so unlike
 * yakuman.ts's membership scans the extra copy here is not just harmless, it
 * is required). Duplicated from yakuman.ts's allKindsOf — the isMenzen
 * duplication precedent applied to this scan.
 */
function allKindsOf(win: Win): TileKind[] {
  const kinds: TileKind[] = [...win.concealed]
  for (const meld of win.melds) {
    const tiles = meld.type === 'ankan' ? meld.own : [meld.claimed, ...meld.own]
    for (const tile of tiles) kinds.push(kindOf(tile))
  }
  return kinds
}

/** Occurrences of one kind in a kind multiset (≤ 18 tiles — linear is fine). */
function countOf(kinds: readonly TileKind[], kind: TileKind): number {
  let count = 0
  for (const k of kinds) if (k === kind) count += 1
  return count
}

/**
 * Dora + kan-dora han for a win: every flipped indicator's mapped dora kind
 * (TableState.doras, dora and kan-dora already unified into one list) priced
 * against the whole hand's tile multiset, summed PER INDICATOR — not per
 * distinct dora kind — so two indicators mapping to the same kind each price
 * every matching tile again (the kan-dora stacking rule: two indicators on
 * 5p with two 5p held is 2 + 2 = 4, not 2). Reads meld tiles too — dora held
 * in an open pon/kan still counts. Dora is never a yaku: this returns a
 * plain number, structurally unable to satisfy WinYakuName-based win-gate
 * checks (yakuOf / applyWinTail never call this function or consult its
 * result).
 */
export function doraHanOf(win: Win, doraKinds: readonly TileKind[]): number {
  const kinds = allKindsOf(win)
  let han = 0
  for (const doraKind of doraKinds) han += countOf(kinds, doraKind)
  return han
}
