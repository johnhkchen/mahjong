// The fu half of a win's price: base 20, closed-ron menzen +10, tsumo +2, per-set fu
// by open/closed × simple/terminal-honor (chi always 0; kans dwarf triplets), pair
// fu for a value tile (dragon, seat wind, round wind — a double-wind pair scores
// both), wait fu for a closed wait (kanchan/penchan/tanki, all +2 — shanpon and
// ryanmen score +0), pinfu's named 20 (tsumo) / 30 (ron) fixed exception, the
// kuipinfu convention (an open pinfu-shaped ron, raw 20, is priced 30 by rule
// rather than left at 20 — 20-fu ron is reserved for a truly closed pinfu), and
// chiitoitsu's fixed 25 (no rounding, no other component). Round up to the next 10
// everywhere else. Pure read over ONE decomposeAgari reading (WinContext, borrowed
// from yaku.ts verbatim — the "(decomposition, win context)" shape the ticket
// names), never the whole readings list: like standardYakuOf, aggregating across
// readings (picking the highest-scoring one) is a later caller's job, not this
// module's. Deliberately no han, no yaku names, no points — those are the scoring
// epic's later tickets (T-008-01-02, -03).
//
// THE WAIT-ATTRIBUTION AMBIGUITY: one decomposition's winning tile can sometimes
// have arrived by more than one structurally valid pre-win shape (e.g. pair=5p with
// a run 456p both containing the winning 5p: tanki-on-the-pair and kanchan-on-the-
// run are equally consistent with the same 14-tile decomposition). Resolved the
// same way yaku.ts's concealedTripletCount resolves the sibling ron/run-absorption
// ambiguity: favorably to the player — every structurally valid attribution is
// scored and the maximum wins. This is not a search: at most one pair, one same-
// kind triplet, and a handful of same-kind runs can ever contain the winning tile
// in one decomposition, so the candidate set is always small and closed-form.

import type { AgariDecomposition, ConcealedSet } from './agari'
import type { Meld } from './record'
import { isHonor, isTerminal, kindOf, kindIndexOf, rankOf, suitOf, type TileKind } from './tiles'
import type { WinContext } from './yaku'

const BASE_FU = 20
const MENZEN_RON_FU = 10
const TSUMO_FU = 2
const CHIITOITSU_FU = 25
/** Fixed by rule — a closed pinfu ron's raw sum already equals this (documented, not coincidental). */
const PINFU_RON_FU = 30
/** Fixed by rule — the ONE case where the ordinary tsumo +2 does not apply (raw would be 22). */
const PINFU_TSUMO_FU = 20
/** The kuipinfu convention — an open pinfu-shaped ron's raw 20 is priced 30, never left at 20. */
const KUIPINFU_RON_FU = 30

const OPEN_TRIPLET_SIMPLE = 2
const OPEN_TRIPLET_HONOR = 4
const CLOSED_TRIPLET_SIMPLE = 4
const CLOSED_TRIPLET_HONOR = 8
const OPEN_KAN_SIMPLE = 8
const OPEN_KAN_HONOR = 16
const CLOSED_KAN_SIMPLE = 16
const CLOSED_KAN_HONOR = 32

/** A closed (tanki/kanchan/penchan) wait — shanpon and ryanmen instead score +0. */
const WAIT_FU = 2

/** One value-tile fact (dragon, seat wind, or round wind) — a double wind sums both. */
const PAIR_VALUE_FU = 2

const DRAGON_KINDS: readonly TileKind[] = ['5z', '6z', '7z']

/** A hand is closed (menzen) iff its only melds are ankan — calls open it (yaku.ts's rule). */
function isMenzen(melds: readonly Meld[]): boolean {
  return melds.every((meld) => meld.type === 'ankan')
}

/** Wall and rinshan draws are self-draws; discard and chankan takes are ron. */
function isTsumoSource(source: WinContext['source']): boolean {
  return source === 'wall' || source === 'rinshan'
}

/** True/false form: is `kind` worth pair fu at all — the pinfu-shape pair gate. */
function isValuableKind(ctx: WinContext, kind: TileKind): boolean {
  return DRAGON_KINDS.includes(kind) || kind === ctx.seatWind || kind === ctx.roundWind
}

/** Sum form: pair fu is additive — a double-wind pair (seat === round) scores both. */
function pairFuOf(ctx: WinContext, kind: TileKind): number {
  let fu = 0
  if (DRAGON_KINDS.includes(kind)) fu += PAIR_VALUE_FU
  if (kind === ctx.seatWind) fu += PAIR_VALUE_FU
  if (kind === ctx.roundWind) fu += PAIR_VALUE_FU
  return fu
}

function isTerminalOrHonor(kind: TileKind): boolean {
  return isTerminal(kind) || isHonor(kind)
}

function tripletFu(open: boolean, honor: boolean): number {
  if (open) return honor ? OPEN_TRIPLET_HONOR : OPEN_TRIPLET_SIMPLE
  return honor ? CLOSED_TRIPLET_HONOR : CLOSED_TRIPLET_SIMPLE
}

function kanFu(open: boolean, honor: boolean): number {
  if (open) return honor ? OPEN_KAN_HONOR : OPEN_KAN_SIMPLE
  return honor ? CLOSED_KAN_HONOR : CLOSED_KAN_SIMPLE
}

/** A meld's own fu — chi is always 0; every other form is a fixed open/closed × honor rate. */
function meldFuOf(meld: Meld): number {
  switch (meld.type) {
    case 'chi':
      return 0
    case 'pon':
      return tripletFu(true, isTerminalOrHonor(kindOf(meld.own[0])))
    case 'daiminkan':
    case 'shouminkan':
      return kanFu(true, isTerminalOrHonor(kindOf(meld.own[0])))
    case 'ankan':
      return kanFu(false, isTerminalOrHonor(kindOf(meld.own[0])))
  }
}

/** A concealed set's fu assuming the DEFAULT (closed/anko) reading — runs are always 0. */
function defaultSetFuOf(set: ConcealedSet): number {
  return set.type === 'run' ? 0 : tripletFu(false, isTerminalOrHonor(set.kind))
}

/** Whether `kind` falls within the run starting at `start` (same suit, offset 0-2). */
function runContains(start: TileKind, kind: TileKind): boolean {
  if (suitOf(kind) !== suitOf(start)) return false
  const offset = kindIndexOf(kind) - kindIndexOf(start)
  return offset >= 0 && offset <= 2
}

/**
 * Two-sided (ryanmen) completion of the run at `start`: at the low end (offset 0)
 * ryanmen iff a rank above the run exists (789 won on 7 is instead the 89 penchan);
 * at the high end (offset 2) ryanmen iff a rank below exists (123 won on 3 is the 12
 * penchan). The middle tile (offset 1) is always the kanchan — never ryanmen.
 */
function completesRyanmen(start: TileKind, winning: TileKind): boolean {
  if (suitOf(winning) !== suitOf(start)) return false
  const offset = kindIndexOf(winning) - kindIndexOf(start)
  const rank = rankOf(start)!
  if (offset === 0) return rank <= 6
  if (offset === 2) return rank >= 2
  return false
}

/**
 * The pinfu SHAPE (for fu, independent of the pinfu YAKU name): every meld a chi
 * (zero melds included — pon/kan/ankan disqualify outright, each already worth fu
 * on its own), every concealed set a run, a non-valuable pair, and the winning tile
 * completing some run from a two-sided wait. Closed (zero melds) is true pinfu;
 * one-or-more chi melds is the open kuipinfu shape — both handled by the caller.
 */
function isPinfuShape(
  ctx: WinContext,
  decomposition: Extract<AgariDecomposition, { form: 'standard' }>,
): boolean {
  if (!ctx.melds.every((meld) => meld.type === 'chi')) return false
  if (!decomposition.sets.every((set) => set.type === 'run')) return false
  if (isValuableKind(ctx, decomposition.pair)) return false
  return decomposition.sets.some(
    (set) =>
      set.type === 'run' &&
      runContains(set.start, ctx.winningKind) &&
      completesRyanmen(set.start, ctx.winningKind),
  )
}

/**
 * The fu delta of attributing the win to `set` (a candidate the winning tile could
 * have completed), relative to `defaultSetFuOf`'s closed-triplet baseline:
 * - a same-kind triplet: 0 on tsumo (self-draws always resolve anko, the standard
 *   convention — a shanpon tsumo scores no less than a plain anko), or the
 *   open-minus-closed rate on ron (the ron-completed-triplet adjustment, the
 *   concealedTripletCount precedent applied per-set instead of as a count) plus 0
 *   wait fu (shanpon has none).
 * - a run containing the winning kind: 0 (ryanmen) or WAIT_FU (kanchan/penchan) —
 *   the run's own fu never changes (runs are always 0).
 */
function attributionDelta(ctx: WinContext, tsumo: boolean, set: ConcealedSet): number | null {
  if (set.type === 'triplet' && set.kind === ctx.winningKind) {
    if (tsumo) return 0
    const honor = isTerminalOrHonor(set.kind)
    return tripletFu(true, honor) - tripletFu(false, honor)
  }
  if (set.type === 'run' && runContains(set.start, ctx.winningKind)) {
    return completesRyanmen(set.start, ctx.winningKind) ? 0 : WAIT_FU
  }
  return null
}

/**
 * The whole standard-form computation: base + menzen-ron + tsumo (raw, before the
 * pinfu overrides) + unconditional pair fu + meld fu + default (closed) set fu +
 * the MAX attribution delta over every structurally valid candidate (tanki on the
 * pair, shanpon/ron-triplet on a matching triplet, kanchan/penchan/ryanmen on every
 * run containing the winning kind) — then the two named pinfu/kuipinfu overrides,
 * then round up to 10.
 */
function standardFuOf(
  ctx: WinContext,
  decomposition: Extract<AgariDecomposition, { form: 'standard' }>,
): number {
  const tsumo = isTsumoSource(ctx.source)
  const menzen = isMenzen(ctx.melds)

  let raw = BASE_FU
  if (menzen && !tsumo) raw += MENZEN_RON_FU
  if (tsumo) raw += TSUMO_FU
  raw += pairFuOf(ctx, decomposition.pair)
  for (const meld of ctx.melds) raw += meldFuOf(meld)
  for (const set of decomposition.sets) raw += defaultSetFuOf(set)

  const candidates: number[] = []
  if (decomposition.pair === ctx.winningKind) candidates.push(WAIT_FU)
  for (const set of decomposition.sets) {
    const delta = attributionDelta(ctx, tsumo, set)
    if (delta !== null) candidates.push(delta)
  }
  if (candidates.length === 0) {
    throw new RangeError(
      `fuOf: winning kind ${ctx.winningKind} completes neither the pair nor any set of this decomposition`,
    )
  }
  raw += Math.max(...candidates)

  if (isPinfuShape(ctx, decomposition) && ctx.melds.length === 0 && tsumo) {
    raw = PINFU_TSUMO_FU
  }
  if (ctx.melds.length > 0 && raw === BASE_FU) {
    raw = KUIPINFU_RON_FU
  }
  return Math.ceil(raw / 10) * 10
}

/**
 * Fu for one reading of a win — the module's face. Chiitoitsu is fixed 25 (no other
 * component, no rounding — never enters the round-up path). Kokushi throws: a
 * yakuman prices flat by han alone, so asking for its fu is caller corruption (the
 * decomposeAgari/yakuOf precedent — domain-inapplicable input is a loud throw, not
 * a meaningless number). Pure read: `ctx` is never mutated, same input ⇒ same
 * output.
 */
export function fuOf(ctx: WinContext): number {
  const decomposition = ctx.decomposition
  if (decomposition.form === 'chiitoitsu') return CHIITOITSU_FU
  if (decomposition.form === 'kokushi') {
    throw new RangeError('fuOf: kokushi is a yakuman — priced by han alone, fu does not apply')
  }
  return standardFuOf(ctx, decomposition)
}
