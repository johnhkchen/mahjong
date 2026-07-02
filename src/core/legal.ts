// The offered half of the engine's public contract — "log in → legal actions / next
// state out" (architecture.md): given a folded table state, enumerate exactly the
// actions the step function will accept next. The step in record.ts stays the single
// authority on what FOLDS; this module is the authority on what is OFFERED. The two
// are deliberately independent statements of the same turn cycle, locked together by
// the agreement suite (legal.test.ts) — a legality bug and a step bug would have to
// agree to slip through. Nothing here imports record.ts guard logic; the rules are
// re-stated in enumeration form on purpose. Bots, hints, the app's input wiring, and
// the random-legal-sequence generator all consume legality from here instead of
// inventing it.

import { kindOf, rankOf, suitOf, type TileId, type TileKind } from './tiles'
import { SEAT_COUNT, type Seat } from './deal'
import type { HandAction, TableState } from './record'

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
 * part of the contract (bots and generators may sample by index). The four state
 * classes and their frozen enumeration order:
 *
 * - an ended hand (phase !== 'playing') offers nothing;
 * - mustDiscard (a chi/pon claim just folded) → the caller's hand discards in hand
 *   order, nothing else: there is no drawn tile, a draw is out of sequence, and the
 *   fold rejects kans while a claim discard is owed;
 * - drawn === null → the turn seat's single draw FIRST (the default continuation —
 *   taking it lets the open window go stale), then, when a claim window is open, the
 *   claim offers: pons, then daiminkans, then chis (see claimOffers for sub-orders).
 *   In a legally-folded 'playing' state the draw always folds: live cannot be empty
 *   here, because the phase flips to ryuukyoku on the discard that empties the wall
 *   (documented, not guarded — states are trusted from foldRecord, per the
 *   TileId/seed precedent);
 * - drawn !== null → the turn seat's 14 discards: the 13 hand tiles in hand order
 *   (hands are draw-ordered and never sorted, so the order is stable), then the
 *   drawn tile last, mirroring the physical table where the draw is held apart;
 *   then its ankan offers, then its shouminkan offers (kan forms only while a
 *   rinshan tile remains and the live wall is not empty — see kanAllowed).
 *
 * Pure read: never mutates the state; returns a fresh array of fresh action
 * literals (fresh `uses` tuples included) per call, so no caller can corrupt a fold
 * through the result. Same state → same array, always.
 *
 * Extend-only, like the action vocabulary it mirrors: riichi/agari tickets grow
 * this enumeration (and this module); existing offerings never change shape, and
 * the draw-first / 14-discard-prefix positions stay stable.
 */
export function legalActions(state: TableState): HandAction[] {
  if (state.phase !== 'playing') return []
  const seat = state.turn
  if (state.mustDiscard) {
    return state.hands[seat].map((tile): HandAction => ({ type: 'discard', seat, tile }))
  }
  if (state.drawn === null) {
    const offers: HandAction[] = [{ type: 'draw', seat }]
    if (state.claimable !== null) offers.push(...claimOffers(state))
    return offers
  }
  const drawn = state.drawn
  return [
    ...state.hands[seat].map((tile): HandAction => ({ type: 'discard', seat, tile })),
    { type: 'discard', seat, tile: drawn },
    ...ankanOffers(state),
    ...shouminkanOffers(state),
  ]
}
