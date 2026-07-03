// Prices any ended TableState into four per-seat point deltas — the payment
// epic's entrypoint, and the module fu.ts/han.ts both explicitly defer to for
// "which reading prices best" (their own headers/review docs name this ticket
// by ID). Two ended shapes: 'agari' (a win, priced by the standard base-points
// formula through the ron/tsumo payment split) and 'ryuukyoku' (an exhaustive
// draw, settled by noten-bappu). Both always return four deltas summing to
// zero — points change hands, never appear or vanish.
//
// THE READING-SELECTION RESPONSIBILITY: a win can satisfy decomposeAgari with
// more than one reading (a ryanpeikou-shaped hand is also chiitoitsu-form), and
// different readings can carry DIFFERENT yaku lists — pinfu, iipeikou,
// sanshoku, toitoi, honitsu... are all decomposition-dependent. yakuOf's own
// aggregator unions standardYakuOf across every reading ("every yaku some
// reading supports"), which is correct for legality (some reading needs only
// one yaku to win) but WRONG for pricing: summing han over names drawn from
// mutually exclusive readings can price a total no single valid decomposition
// ever produces. This module re-derives decomposeAgari itself and prices EVERY
// reading that carries at least one yaku OF ITS OWN (dora cannot rescue a
// yaku-less reading — the one-yaku win gate restated at reading granularity),
// then takes the reading with the maximum base points: the same favorable-
// interpretation convention fu.ts's wait attribution and yaku.ts's
// concealedTripletCount already use, generalized from one ambiguous slot to
// one ambiguous whole-hand reading. Yakuman readings skip this entirely:
// yakuOf's supersession rule guarantees a yakuman win's yaku list holds ONLY
// yakuman names, priced flatly by han alone (no fu, no dora — standard rule).
//
// THE PUBLISHED PAYMENT TABLE (standard, NON-KIRIAGE Japanese riichi rules —
// research.md §3 has the full derivation; kiriage mangan, which rounds
// 4han30fu/3han60fu UP to a flat mangan payout, is deliberately not applied
// here: the ticket's own fixture numbers, 7700 (30fu/4han non-dealer ron) and
// 11600 (dealer), ARE the non-kiriage result — a kiriage table would instead
// pay flat mangan, 8000/12000):
//
//   Base points from han/fu: han 1-4 -> fu * 2^(2+han), capped at 2000; han 5
//   -> 2000 (mangan); han 6-7 -> 3000 (haneman); han 8-10 -> 4000 (baiman); han
//   11-12 -> 6000 (sanbaiman); han >=13 -> 8000 * floor(han/13) (yakuman —
//   stacking by multiples of 13 for simultaneous yakuman, and the same flat
//   tier a "counted yakuman" of 13+ han from ordinary yaku/dora reaches too).
//
//   Payment from base points, rounded up to the next 100 (roundUp100): ron —
//   the discarder alone pays base*6 (dealer winner) or base*4 (non-dealer
//   winner); tsumo — a dealer winner is paid base*2 by each of the other
//   three seats, a non-dealer winner is paid base*2 by the dealer and base*1
//   by each of the other two non-dealer seats.
//
//   Noten-bappu (ryuukyoku), a flat 3000-point pot split by tenpai count: 0 or
//   4 tenpai -> no exchange; 1 tenpai -> +3000 / -1000 each; 2 tenpai -> +1500
//   each / -1500 each; 3 tenpai -> +1000 each / -3000.
//
// No honba: it does not exist in TableState (no match/round structure to attach a
// repeat counter to).
//
// RIICHI STICKS (T-009-01-01): every seat with state.riichi[seat] true already gave
// up RIICHI_STICK the moment it declared -- riichiStickDeltas prices that -1000 per
// locked seat, elementwise added to the ordinary ron/tsumo/noten-bappu deltas below.
// An agari ALSO adds the whole running pot (state.pot -- incoming carried pot plus
// every stick placed this hand) to the winner; a ryuukyoku distributes nothing further
// (the pot sits unclaimed, carried to the next hand via game.ts's foldGame). THE
// CONSERVATION LAW THIS BREAKS, DELIBERATELY: SeatDeltas no longer sums to zero on
// every ended hand -- an agari's deltas sum to the incoming potIn (the sticks placed
// THIS hand cancel exactly against the pot paid to the winner, leaving only what was
// already carried in); a ryuukyoku's deltas sum to -RIICHI_STICK times the sticks
// placed this hand (money that left seats' scores and now sits in the pot, not yet in
// anyone's score). The invariant that DOES hold, across every hand boundary: running
// scores plus the pot are conserved exactly at 4 x STARTING_SCORE (game.ts threads
// potIn/pot hand-to-hand for precisely this reason).
//
// baseOf/roundUp100/ronDeltas/tsumoDeltas are exported alongside settlementOf: pure
// arithmetic over (han, fu) / (base, seats), the tested seam T-008-01-04's grid suite
// calls directly rather than reconstructing a TableState per han/fu cell.

import { RIICHI_STICK, type Meld, type TableState } from './record'
import type { Seat } from './deal'
import { decomposeAgari } from './agari'
import { yakuOf, YAKUMAN_NAMES, type Win, type WinYakuName } from './yakuman'
import { standardYakuOf, type WinContext, type WindKind } from './yaku'
import { hanOf, doraHanOf } from './han'
import { fuOf } from './fu'
import { shanten } from './shanten'
import { kindOf, type TileKind } from './tiles'

/**
 * Four per-seat point deltas, indexed by Seat. Summed to zero before riichi
 * sticks existed; T-009-01-01 breaks that on any hand carrying a pot — see this
 * module's header for the corrected invariant (scores + pot conserved instead).
 */
export type SeatDeltas = readonly [number, number, number, number]

/** The named payment tiers above the han/fu formula — baseOf's fixed-base branches. */
export type LimitName = 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'yakuman'

/** One yaku (or yakuman) name priced into the winning reading, with its own han. */
export interface YakuLine {
  readonly name: WinYakuName
  readonly han: number
}

/**
 * The full priced detail of an ended hand — scoreBreakdownOf's return, a superset of
 * settlementOf's deltas-only result. `scores` is `deltas` applied to the standard
 * 25000-each starting total (STARTING_SCORE_DISPLAY below) — the addition every
 * consumer would otherwise have to do itself, done once here so no caller performs
 * arithmetic on point values at all.
 */
export type ScoreBreakdown =
  | {
      readonly kind: 'agari'
      readonly winner: Seat
      readonly by: 'ron' | 'tsumo'
      /** The discarder, for a ron — null for a tsumo (no discard was claimed). */
      readonly from: Seat | null
      /** The winning reading's own yaku — never state.win.yaku's cross-reading union. */
      readonly yaku: readonly YakuLine[]
      readonly doraHan: number
      /** Total han: every yaku line's han plus doraHan. */
      readonly han: number
      /** Null exactly when limitName is set — fu is not part of a limit hand's line. */
      readonly fu: number | null
      readonly limitName: LimitName | null
      /** The winner's total gain — deltas[winner], the "...7700" / "...8000" figure. */
      readonly points: number
      readonly deltas: SeatDeltas
      readonly scores: SeatDeltas
      /** The stick pot the winner just took (T-009-01-01) — 0 when none was riding. */
      readonly pot: number
    }
  | {
      readonly kind: 'ryuukyoku'
      readonly tenpai: readonly [boolean, boolean, boolean, boolean]
      readonly deltas: SeatDeltas
      readonly scores: SeatDeltas
      /** The stick pot left unclaimed, carrying to the next hand (T-009-01-01). */
      readonly pot: number
    }

/** Seat 0 is East, the dealer — the engine holds no match/round-rotation state. */
const DEALER_SEAT: Seat = 0

/** The frozen round wind every fold assembles wins with (record.ts's ROUND_WIND). */
const ROUND_WIND: WindKind = '1z'

const MANGAN_BASE = 2000
const HANEMAN_BASE = 3000
const BAIMAN_BASE = 4000
const SANBAIMAN_BASE = 6000
const YAKUMAN_BASE = 8000

/** The flat noten-bappu pot, split by tenpai count (research.md §3). */
const NOTEN_BAPPU_POT = 3000

/**
 * The standard starting total per seat, duplicated from game.ts's identical
 * STARTING_SCORE (importing it would cycle: game.ts already imports this module) — the
 * DEALER_SEAT/ROUND_WIND/windKindOf duplication precedent applied to one more constant.
 * scoreBreakdownOf's `scores` field is this hand's deltas applied to this baseline —
 * this module has no game/GameRecord state, so "score" here means "this one hand,
 * played from the standard starting total," not a persisted running total.
 */
const STARTING_SCORE_DISPLAY = 25000

/** Membership test reusing the frozen catalog array — han.ts's own precedent. */
const YAKUMAN_SET: ReadonlySet<string> = new Set(YAKUMAN_NAMES)

/** A seat's own wind kind: Seat 0-3 anchors 1z-4z — record.ts's windKindOf, duplicated. */
function windKindOf(seat: Seat): WindKind {
  return `${seat + 1}z` as WindKind
}

/** Standard 100-point rounding: every payment rounds up to the next 100. */
export function roundUp100(points: number): number {
  return Math.ceil(points / 100) * 100
}

/**
 * Rebuilds the Win object yakuOf/standardYakuOf/fuOf/doraHanOf all read, from
 * an ended (`phase === 'agari'`) TableState — the shape those modules take
 * that TableState itself does not directly store. `concealed` mirrors
 * applyWinTail's own assembly exactly: the winner's pre-completion hand plus
 * the winning tile's kind. `source` reads `state.drawnFrom` for a tsumo
 * (untouched by applyWinTail after the fold ends) or is 'discard' for a ron —
 * chankan stays fold-unreachable (record.ts's own note), so that source never
 * arises from a real TableState. `lastTile` reads the same `live.length ===
 * 0` fact applyWinTail itself computed, unmutated since the win landed.
 */
function winOf(state: TableState): Win {
  const win = state.win
  if (win === null) {
    throw new RangeError('winOf: state.win is null — the hand has not ended in agari')
  }
  const { winner, tile } = win
  return {
    concealed: [...state.hands[winner].map(kindOf), kindOf(tile)],
    melds: state.melds[winner],
    winningKind: kindOf(tile),
    source: win.by === 'tsumo' ? state.drawnFrom! : 'discard',
    lastTile: state.live.length === 0,
    seatWind: windKindOf(winner),
    roundWind: ROUND_WIND,
  }
}

/**
 * Base points from han + fu, the whole published tier table in one function:
 * han >= 13 is the yakuman flat tier (stacking by multiples of 13 — this also
 * covers a "counted yakuman" of 13+ han reached through ordinary yaku/dora,
 * never just called with `fu` meaningful at that tier); 11-12/8-10/6-7/5 are
 * the fixed sanbaiman/baiman/haneman/mangan tiers, fu-independent; below that
 * the formula applies, capped at the mangan boundary (research.md §3's
 * kiriage-boundary note: this cap catches hands whose raw formula EXCEEDS
 * 2000, e.g. 4han40fu, but does NOT round hands landing just under 2000 —
 * e.g. 4han30fu's 1920 — up to a flat mangan; that rounding is the kiriage
 * convention this module deliberately does not apply).
 */
export function baseOf(han: number, fu: number): number {
  if (han >= 13) return YAKUMAN_BASE * Math.floor(han / 13)
  if (han >= 11) return SANBAIMAN_BASE
  if (han >= 8) return BAIMAN_BASE
  if (han >= 6) return HANEMAN_BASE
  if (han === 5) return MANGAN_BASE
  return Math.min(fu * 2 ** (2 + han), MANGAN_BASE)
}

/** One reading's own yaku names — standardYakuOf for standard, the form itself for chiitoitsu. */
function readingYakuOf(ctx: WinContext): readonly WinYakuName[] {
  return ctx.decomposition.form === 'chiitoitsu' ? ['chiitoitsu'] : standardYakuOf(ctx)
}

/** Han from a list of yaku names plus dora — the sum every scored reading needs. */
function hanOfNames(names: readonly WinYakuName[], melds: readonly Meld[], doraHan: number): number {
  return names.reduce((sum, name) => sum + hanOf(name, melds), doraHan)
}

/**
 * One priced reading's full detail — pricedReadingCandidatesOf's/bestReadingOf's
 * element, the retained-detail superset of what used to be a bare base-points number
 * (T-008-03-01: the score-breakdown screen needs the yaku list and fu a plain base
 * number discards).
 */
interface PricedReading {
  readonly yaku: readonly YakuLine[]
  readonly doraHan: number
  readonly han: number
  readonly fu: number
  readonly base: number
}

/** `names` priced as YakuLine entries — one hanOf lookup per name, melds-aware. */
function yakuLinesOf(names: readonly WinYakuName[], melds: readonly Meld[]): YakuLine[] {
  return names.map((name) => ({ name, han: hanOf(name, melds) }))
}

/**
 * Every non-yakuman reading's full priced detail, for readings that carry their OWN
 * yaku (dora alone cannot price a reading — design.md's Rejected Option C). Never
 * empty when called on a legal non-yakuman win: the fold that produced this win
 * already required SOME reading to contribute a yaku to yakuOf's union, so at least
 * one candidate always survives the filter.
 */
function pricedReadingCandidatesOf(win: Win, doraHan: number): PricedReading[] {
  const candidates: PricedReading[] = []
  for (const decomposition of decomposeAgari(win.concealed, win.melds)) {
    if (decomposition.form === 'kokushi') continue
    const ctx: WinContext = {
      decomposition,
      melds: win.melds,
      winningKind: win.winningKind,
      source: win.source,
      lastTile: win.lastTile,
      seatWind: win.seatWind,
      roundWind: win.roundWind,
    }
    const names = readingYakuOf(ctx)
    if (names.length === 0) continue
    const fu = fuOf(ctx)
    const han = hanOfNames(names, win.melds, doraHan)
    candidates.push({ yaku: yakuLinesOf(names, win.melds), doraHan, han, fu, base: baseOf(han, fu) })
  }
  return candidates
}

/**
 * The whole win's priced detail: the yakuman flat tier (fu 0 — yakuman scoring
 * ignores it, baseOf's own han>=13 branch never reads its fu argument), or the
 * max-base candidate among every reading carrying its own yaku. ONE selection
 * implementation — bestBaseOf below is a thin wrapper over this, so settlementOf and
 * scoreBreakdownOf can never select two different readings for the same win.
 */
function bestReadingOf(win: Win, doraKinds: readonly TileKind[]): PricedReading {
  const yaku = yakuOf(win)
  if (yaku.some((name) => YAKUMAN_SET.has(name))) {
    const han = hanOfNames(yaku, win.melds, 0)
    return { yaku: yakuLinesOf(yaku, win.melds), doraHan: 0, han, fu: 0, base: baseOf(han, 0) }
  }
  const candidates = pricedReadingCandidatesOf(win, doraHanOf(win, doraKinds))
  return candidates.reduce((best, candidate) => (candidate.base > best.base ? candidate : best))
}

/** The whole win's base points — bestReadingOf's base, kept as its own name for settlementOf's call site. */
function bestBaseOf(win: Win, doraKinds: readonly TileKind[]): number {
  return bestReadingOf(win, doraKinds).base
}

/**
 * The named tier `base` falls in, or null when it is priced by the plain han/fu
 * formula (below mangan). A pure name lookup on a number baseOf already computed —
 * no new arithmetic, and the mangan-CAP case (a hand whose raw formula exceeds 2000,
 * e.g. 4han40fu) is named 'mangan' by this same base-value check, exactly matching
 * baseOf's own cap semantics (its doc comment) without re-deriving the cap.
 */
function limitNameOf(base: number): LimitName | null {
  if (base >= YAKUMAN_BASE) return 'yakuman'
  if (base === SANBAIMAN_BASE) return 'sanbaiman'
  if (base === BAIMAN_BASE) return 'baiman'
  if (base === HANEMAN_BASE) return 'haneman'
  if (base === MANGAN_BASE) return 'mangan'
  return null
}

/** Ron: the discarder alone pays; every other seat is untouched. */
export function ronDeltas(base: number, winner: Seat, discarder: Seat): SeatDeltas {
  const payment = roundUp100(base * (winner === DEALER_SEAT ? 6 : 4))
  const deltas: [number, number, number, number] = [0, 0, 0, 0]
  deltas[winner] += payment
  deltas[discarder] -= payment
  return deltas
}

/** Tsumo: every other seat pays — dealer rate from all three, or the split rate. */
export function tsumoDeltas(base: number, winner: Seat): SeatDeltas {
  const deltas: [number, number, number, number] = [0, 0, 0, 0]
  const dealerPays = roundUp100(base * 2)
  const nonDealerPays = roundUp100(base * 1)
  for (let seat = 0; seat < 4; seat++) {
    if (seat === winner) continue
    const payment = winner === DEALER_SEAT || seat === DEALER_SEAT ? dealerPays : nonDealerPays
    deltas[seat] -= payment
    deltas[winner] += payment
  }
  return deltas
}

/** Per-seat tenpai at the ryuukyoku moment — every hand is quiescent (record.ts). */
function tenpaiFlagsOf(state: TableState): readonly [boolean, boolean, boolean, boolean] {
  const seats: readonly Seat[] = [0, 1, 2, 3]
  const [a, b, c, d] = seats.map(
    (seat) => shanten(state.hands[seat].map(kindOf), state.melds[seat]) === 0,
  )
  return [a, b, c, d]
}

/** Noten-bappu: the fixed 3000-point pot split by tenpai count (module header). */
function notenBappuOf(tenpai: readonly boolean[]): SeatDeltas {
  const tenpaiCount = tenpai.filter(Boolean).length
  const deltas: [number, number, number, number] = [0, 0, 0, 0]
  if (tenpaiCount === 0 || tenpaiCount === 4) return deltas
  const gain = NOTEN_BAPPU_POT / tenpaiCount
  const loss = NOTEN_BAPPU_POT / (4 - tenpaiCount)
  for (let seat = 0; seat < 4; seat++) {
    deltas[seat] = tenpai[seat] ? gain : -loss
  }
  return deltas
}

/**
 * Every locked seat already gave up RIICHI_STICK the instant it declared
 * (T-009-01-01) — priced as its own delta contribution, independent of how the
 * hand ends. Zero for every seat on a hand with no riichi in it.
 */
function riichiStickDeltas(state: TableState): SeatDeltas {
  return [0, 1, 2, 3].map((seat) => (state.riichi[seat] ? -RIICHI_STICK : 0)) as unknown as SeatDeltas
}

/**
 * Overlays riichi's two settlement effects onto a base ron/tsumo/noten-bappu
 * payment: every locked seat's stick (riichiStickDeltas), then — agari only,
 * `winner` non-null — the whole running pot (state.pot: incoming carried pot
 * plus every stick placed this hand) added to the winner. A ryuukyoku
 * (`winner` null) distributes nothing further; the pot rides to the next hand
 * via game.ts's foldGame. The ONE place either settlementOf or
 * scoreBreakdownOf touches riichi's payment, so they can never disagree on it
 * (the module header's own discipline, extended to this ticket).
 */
function withRiichiSettlement(payment: SeatDeltas, state: TableState, winner: Seat | null): SeatDeltas {
  const sticks = riichiStickDeltas(state)
  const deltas = payment.map((value, seat) => value + sticks[seat]) as [number, number, number, number]
  if (winner !== null) deltas[winner] += state.pot
  return deltas
}

/**
 * The module's face: any ended TableState in, four per-seat point deltas out.
 * 'ryuukyoku' settles noten-bappu; 'agari' prices the win through the best
 * reading (or the yakuman flat tier) and splits the payment by ron/tsumo and
 * dealer/non-dealer. Either ending is then overlaid with riichi's stick/pot
 * effects (withRiichiSettlement — T-009-01-01; see this module's header for
 * the resulting, no-longer-always-zero per-hand sum). 'playing' is caller
 * corruption — settlement on an unended hand is domain-inapplicable, and
 * throws loudly rather than guessing (the fuOf-kokushi precedent).
 */
export function settlementOf(state: TableState): SeatDeltas {
  if (state.phase === 'playing') {
    throw new RangeError("settlementOf: the hand has not ended — phase is 'playing'")
  }
  if (state.phase === 'ryuukyoku') {
    return withRiichiSettlement(notenBappuOf(tenpaiFlagsOf(state)), state, null)
  }
  const win = winOf(state)
  const base = bestBaseOf(win, state.doras)
  const ended = state.win!
  const payment =
    ended.by === 'ron'
      ? ronDeltas(base, ended.winner, ended.from)
      : tsumoDeltas(base, ended.winner)
  return withRiichiSettlement(payment, state, ended.winner)
}

/** `deltas` applied to the standard starting total — the score-breakdown screen's seat totals. */
function seatScoresOf(deltas: SeatDeltas): SeatDeltas {
  return deltas.map((delta) => STARTING_SCORE_DISPLAY + delta) as unknown as SeatDeltas
}

/**
 * The score-breakdown screen's one entrypoint: any ended TableState in, the full
 * priced detail out — a superset of settlementOf's deltas, sharing every arithmetic
 * step with it (bestReadingOf/ronDeltas/tsumoDeltas/tenpaiFlagsOf/notenBappuOf are
 * ALL the same calls settlementOf itself makes, so the two functions can never
 * disagree on a payment). 'playing' throws, matching settlementOf's own guard —
 * a breakdown of an unended hand is equally domain-inapplicable.
 */
export function scoreBreakdownOf(state: TableState): ScoreBreakdown {
  if (state.phase === 'playing') {
    throw new RangeError("scoreBreakdownOf: the hand has not ended — phase is 'playing'")
  }
  if (state.phase === 'ryuukyoku') {
    const tenpai = tenpaiFlagsOf(state)
    const deltas = withRiichiSettlement(notenBappuOf(tenpai), state, null)
    return { kind: 'ryuukyoku', tenpai, deltas, scores: seatScoresOf(deltas), pot: state.pot }
  }
  const win = winOf(state)
  const reading = bestReadingOf(win, state.doras)
  const ended = state.win!
  const payment =
    ended.by === 'ron'
      ? ronDeltas(reading.base, ended.winner, ended.from)
      : tsumoDeltas(reading.base, ended.winner)
  const deltas = withRiichiSettlement(payment, state, ended.winner)
  const limitName = limitNameOf(reading.base)
  return {
    kind: 'agari',
    winner: ended.winner,
    by: ended.by,
    from: ended.by === 'ron' ? ended.from : null,
    yaku: reading.yaku,
    doraHan: reading.doraHan,
    han: reading.han,
    fu: limitName === null ? reading.fu : null,
    limitName,
    points: deltas[ended.winner],
    deltas,
    scores: seatScoresOf(deltas),
    pot: state.pot,
  }
}
