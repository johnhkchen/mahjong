// The offered half of the engine's public contract — "log in → legal actions / next
// state out" (architecture.md): given a folded table state, enumerate exactly the
// actions the step function will accept next. The step in record.ts stays the single
// authority on what FOLDS; this module is the authority on what is OFFERED. The two
// are deliberately independent statements of the same turn cycle, locked together by
// the agreement suite (legal.test.ts) — a legality bug and a step bug would have to
// agree to slip through. Nothing here imports record.ts guard logic; the rules are
// re-stated in enumeration form on purpose. The DERIVATION stack is different: this
// module consults isAgari/waits/yakuOf — the same modules applyWinTail consults —
// because they are shared vocabulary (waits.ts names ron offering and furiten gating
// as its readers), not turn-cycle logic; re-deriving yaku in enumeration form would
// be duplication with its own drift risk, and the agreement suite still locks the
// two call paths together. Bots, hints, the app's input wiring, and the
// random-legal-sequence generator all consume legality from here instead of
// inventing it.
//
// THE FURITEN DIVERGENCE — the one place the offered set is deliberately NARROWER
// than what folds: a seat whose waits intersect its own pond (basic discard
// furiten) is never OFFERED a ron, but the fold ACCEPTS one, because record.ts's
// doctrine is that knowing who else could have won is legality's business, never
// the step function's — and narrowing the fold now would invalidate stored logs it
// accepted before. Everywhere else, offered ⇔ folds still holds exactly; the
// win-offer agreement suite (legal.win.test.ts) pins the asymmetry from both sides.
// Temporary and riichi furiten are the riichi ticket's extensions, not this rule.

import { kindOf, rankOf, suitOf, type TileId, type TileKind } from './tiles'
import { SEAT_COUNT, type Seat } from './deal'
import type { HandAction, TableState } from './record'
import { isAgari } from './agari'
import { waits } from './waits'
import { yakuOf, type WinYakuName } from './yakuman'
import type { WindKind } from './yaku'

/** The held copies of one kind, in hand order — the canonical `uses` source. */
function copiesInHand(hand: readonly TileId[], kind: TileKind): TileId[] {
  return hand.filter((tile) => kindOf(tile) === kind)
}

/**
 * Whether any kan form may be offered: a rinshan replacement must remain (four kans
 * is the ceiling — kans made so far equal flipped indicators minus the initial one,
 * the kansMade identity from record.ts) and the live wall must hold a tile to move
 * into the dead wall (the haitei draw cannot be kanned). Mirrors the fold's
 * guardRinshanAvailable without sharing its code.
 */
function kanAllowed(state: TableState): boolean {
  return state.doraIndicators.length - 1 < 4 && state.live.length > 0
}

/**
 * The round wind win offers are gated with — re-stated from the fold (record.ts's
 * ROUND_WIND, per the header's independence rule: fold constants are re-stated, not
 * imported). Records are single hands, so both sides fix East until the match epic
 * threads the true round wind in as an input.
 */
const ROUND_WIND: WindKind = '1z'

/** A seat's own wind kind, `${seat + 1}z` — the re-stated fold convention. */
function windKindOf(seat: Seat): WindKind {
  return `${seat + 1}z` as WindKind
}

/**
 * The yaku a completed win would carry — the single Win-assembly point, so the
 * tsumo, window-ron, and houtei-ron gates cannot drift from each other or from the
 * shape applyWinTail folds. Callers guarantee completion (isAgari probed first), so
 * yakuOf never throws here; an empty result is the ONE-YAKU GATE's refusal — the
 * offer is withheld exactly where the fold would throw.
 */
function winYaku(
  state: TableState,
  seat: Seat,
  winningKind: TileKind,
  source: 'wall' | 'rinshan' | 'discard',
): readonly WinYakuName[] {
  return yakuOf({
    concealed: [...state.hands[seat].map(kindOf), winningKind],
    melds: state.melds[seat],
    winningKind,
    source,
    lastTile: state.live.length === 0,
    seatWind: windKindOf(seat),
    roundWind: ROUND_WIND,
  })
}

/**
 * BASIC discard furiten: the seat's waits intersect its own pond, at kind level.
 * Ponds keep the complete discard history (a claimed-away tile stays counted — the
 * Meld contract), so the pond read is literal. Whole-seat gate: any wait in the
 * pond kills every ron offer for the seat, on every tile. Evaluated only for a
 * seat already known to complete the discard (the probe-first order in ronOffers),
 * because waits is a 34-kind scan and legalActions runs at every fold step.
 */
function discardFuriten(state: TableState, seat: Seat): boolean {
  const seatWaits = waits(state.hands[seat].map(kindOf), state.melds[seat])
  const pondKinds = new Set(state.ponds[seat].map(kindOf))
  return seatWaits.some((kind) => pondKinds.has(kind))
}

/**
 * The ron offers on a discard, in rotation order from the discarder's right — the
 * claimOffers seat scan, which is also atamahane order, so a driver breaking a
 * multiple-ron tie can take the first offered ron. Shared by the open-window arm
 * and the ryuukyoku (houtei) arm; `discarder`/`tile` name the discard either way.
 * Gates, cheapest first: the tile completes the seat's hand (isAgari probe), the
 * seat is not furiten (see discardFuriten), and the completion carries at least
 * one yaku (winYaku, source 'discard' — in the houtei arm lastTile is true, so
 * 'houtei' itself satisfies the gate and only completion or furiten can exclude).
 * All simultaneously legal rons are enumerated: exactly one may FOLD (the
 * multiple-ron convention — the recorder picks), but which one is the recorder's
 * choice to make, so legality states the whole choice set.
 */
function ronOffers(state: TableState, discarder: Seat, tile: TileId): HandAction[] {
  const kind = kindOf(tile)
  const offers: HandAction[] = []
  for (let k = 1; k < SEAT_COUNT; k++) {
    const seat = ((discarder + k) % SEAT_COUNT) as Seat
    if (!isAgari([...state.hands[seat].map(kindOf), kind], state.melds[seat])) continue
    if (discardFuriten(state, seat)) continue
    if (winYaku(state, seat, kind, 'discard').length === 0) continue
    offers.push({ type: 'ron', seat, tile })
  }
  return offers
}

/**
 * The turn seat's tsumo offer at a post-draw point: the drawn tile completes the
 * hand (isAgari probe) with at least one yaku — the source is `drawnFrom` verbatim
 * ('wall' or 'rinshan', deciding menzen-tsumo/haitei vs rinshan kaihou), exactly
 * what applyTsumo folds. No furiten gate: furiten restricts ron only, never the
 * self-draw. Zero or one offer, never more.
 */
function tsumoOffer(state: TableState): HandAction[] {
  const seat = state.turn
  const kind = kindOf(state.drawn!)
  if (!isAgari([...state.hands[seat].map(kindOf), kind], state.melds[seat])) return []
  if (winYaku(state, seat, kind, state.drawnFrom!).length === 0) return []
  return [{ type: 'tsumo', seat }]
}

/**
 * The claim offers on an open claim window, in the frozen order: all pons, then all
 * daiminkans, then all chis (claim precedence made positional — pon/kan outrank chi).
 * Candidate seats scan in rotation order from the discarder's right; the physical
 * copy arithmetic (4 copies, 1 in the pond) means at most one seat can ever pon or
 * daiminkan a given discard, but the loop stays principled. Every distinct copy
 * combination is its own offer (a seat holding three copies has three pon pairs) —
 * the offered set is the foldable claim set up to `uses` ordering, and stays correct
 * when copies stop being interchangeable (red fives). `uses` are in hand order; chi
 * `uses` read [lower kind, higher kind] with copy loops lower-outer/higher-inner,
 * shapes low-rank ascending. Honors have no rank, so they are never chi-able.
 */
function claimOffers(state: TableState): HandAction[] {
  const window = state.claimable!
  const kind = kindOf(window.tile)
  const offers: HandAction[] = []
  for (let k = 1; k < SEAT_COUNT; k++) {
    const seat = ((window.seat + k) % SEAT_COUNT) as Seat
    const copies = copiesInHand(state.hands[seat], kind)
    for (let i = 0; i < copies.length; i++) {
      for (let j = i + 1; j < copies.length; j++) {
        offers.push({ type: 'pon', seat, tile: window.tile, uses: [copies[i], copies[j]] })
      }
    }
  }
  if (kanAllowed(state)) {
    for (let k = 1; k < SEAT_COUNT; k++) {
      const seat = ((window.seat + k) % SEAT_COUNT) as Seat
      const copies = copiesInHand(state.hands[seat], kind)
      if (copies.length === 3) {
        offers.push({
          type: 'daiminkan',
          seat,
          tile: window.tile,
          uses: [copies[0], copies[1], copies[2]],
        })
      }
    }
  }
  const rank = rankOf(kind)
  if (rank !== null) {
    const seat = ((window.seat + 1) % SEAT_COUNT) as Seat
    const suit = suitOf(kind)
    const hand = state.hands[seat]
    for (let low = rank - 2; low <= rank; low++) {
      if (low < 1 || low + 2 > 9) continue
      const needed = [low, low + 1, low + 2].filter((r) => r !== rank)
      const lowCopies = copiesInHand(hand, `${needed[0]}${suit}` as TileKind)
      const highCopies = copiesInHand(hand, `${needed[1]}${suit}` as TileKind)
      for (const lowTile of lowCopies) {
        for (const highTile of highCopies) {
          offers.push({ type: 'chi', seat, tile: window.tile, uses: [lowTile, highTile] })
        }
      }
    }
  }
  return offers
}

/**
 * The turn seat's ankan offers at a post-draw point: one per kind with all four
 * copies concealed (hand plus, possibly, the drawn tile), kinds in first-occurrence
 * order scanning the hand then the drawn tile; `uses` are the hand copies in hand
 * order with the drawn tile last, matching the discard enumeration's drawn-last.
 */
function ankanOffers(state: TableState): HandAction[] {
  if (!kanAllowed(state)) return []
  const seat = state.turn
  const hand = state.hands[seat]
  const drawn = state.drawn!
  const offers: HandAction[] = []
  const seen = new Set<TileKind>()
  for (const tile of [...hand, drawn]) {
    const kind = kindOf(tile)
    if (seen.has(kind)) continue
    seen.add(kind)
    const held = copiesInHand(hand, kind)
    const uses = kindOf(drawn) === kind ? [...held, drawn] : held
    if (uses.length === 4) {
      offers.push({ type: 'ankan', seat, uses: [uses[0], uses[1], uses[2], uses[3]] })
    }
  }
  return offers
}

/**
 * The turn seat's shouminkan offers at a post-draw point: for each of its pons, in
 * meld order, the loose fourth copy if this seat holds it (hand order) or just drew
 * it. The action records only the added tile, per the vocabulary's derivability rule.
 */
function shouminkanOffers(state: TableState): HandAction[] {
  if (!kanAllowed(state)) return []
  const seat = state.turn
  const hand = state.hands[seat]
  const drawn = state.drawn!
  const offers: HandAction[] = []
  for (const meld of state.melds[seat]) {
    if (meld.type !== 'pon') continue
    const kind = kindOf(meld.own[0])
    const tile = hand.find((t) => kindOf(t) === kind) ?? (kindOf(drawn) === kind ? drawn : null)
    if (tile !== null && tile !== undefined) {
      offers.push({ type: 'shouminkan', seat, tile })
    }
  }
  return offers
}

/**
 * The legal actions at a folded table state, in a deterministic order — the order is
 * part of the contract (bots and generators may sample by index). The five state
 * classes and their frozen enumeration order:
 *
 * - agari offers nothing — a won hand is over, full stop;
 * - ryuukyoku offers ONLY the houtei rons (the fold's ryuukyoku→agari carve-out,
 *   mirrored in enumeration form): ron offers against the reconstructed final
 *   discard — `turn` stays at the last discarder (the ended-turn convention) and
 *   that pond's last tile IS the final discard — gated like every ron (see
 *   ronOffers); for almost every ryuukyoku the set is empty;
 * - mustDiscard (a chi/pon claim just folded) → the caller's hand discards in hand
 *   order, nothing else: there is no drawn tile, a draw is out of sequence, and the
 *   fold rejects kans while a claim discard is owed;
 * - drawn === null → the turn seat's single draw FIRST (the default continuation —
 *   taking it lets the open window go stale), then, when a claim window is open,
 *   the RONS (win offers precede call offers within their class — the AC's
 *   ron-above-pon/kan-above-chi priority made positional; see ronOffers for the
 *   seat scan and gates), then the claim offers: pons, then daiminkans, then chis
 *   (see claimOffers for sub-orders). In a legally-folded 'playing' state the draw
 *   always folds: live cannot be empty here, because the phase flips to ryuukyoku
 *   on the discard that empties the wall (documented, not guarded — states are
 *   trusted from foldRecord, per the TileId/seed precedent);
 * - drawn !== null → the turn seat's 14 discards: the 13 hand tiles in hand order
 *   (hands are draw-ordered and never sorted, so the order is stable), then the
 *   drawn tile last, mirroring the physical table where the draw is held apart;
 *   then its tsumo offer if the drawn tile completes a yaku-bearing hand (the win
 *   again preceding the calls — see tsumoOffer), then its ankan offers, then its
 *   shouminkan offers (kan forms only while a rinshan tile remains and the live
 *   wall is not empty — see kanAllowed).
 *
 * Pure read: never mutates the state; returns a fresh array of fresh action
 * literals (fresh `uses` tuples included) per call, so no caller can corrupt a fold
 * through the result. Same state → same array, always.
 *
 * Extend-only, like the action vocabulary it mirrors: riichi tickets grow this
 * enumeration (and this module); existing offerings never change shape, and the
 * draw-first / 14-discard-prefix positions stay stable. (This ticket shifted the
 * claim-block and kan-block indices by inserting the win offers ahead of them —
 * within the promise, which froze only those two positions.)
 */
export function legalActions(state: TableState): HandAction[] {
  if (state.phase === 'agari') return []
  if (state.phase === 'ryuukyoku') {
    const pond = state.ponds[state.turn]
    return ronOffers(state, state.turn, pond[pond.length - 1])
  }
  const seat = state.turn
  if (state.mustDiscard) {
    return state.hands[seat].map((tile): HandAction => ({ type: 'discard', seat, tile }))
  }
  if (state.drawn === null) {
    const offers: HandAction[] = [{ type: 'draw', seat }]
    if (state.claimable !== null) {
      offers.push(...ronOffers(state, state.claimable.seat, state.claimable.tile))
      offers.push(...claimOffers(state))
    }
    return offers
  }
  const drawn = state.drawn
  return [
    ...state.hands[seat].map((tile): HandAction => ({ type: 'discard', seat, tile })),
    { type: 'discard', seat, tile: drawn },
    ...tsumoOffer(state),
    ...ankanOffers(state),
    ...shouminkanOffers(state),
  ]
}
