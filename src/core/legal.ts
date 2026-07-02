// The offered half of the engine's public contract — "log in → legal actions / next
// state out" (architecture.md): given a folded table state, enumerate exactly the
// actions the step function will accept next. The step in record.ts stays the single
// authority on what FOLDS; this module is the authority on what is OFFERED. The two
// are deliberately independent statements of the same turn cycle, locked together by
// the agreement suite (legal.test.ts) — a legality bug and a step bug would have to
// agree to slip through. Bots, hints, the app's input wiring, and the random-legal-
// sequence generator all consume legality from here instead of inventing it.

import type { HandAction, TableState } from './record'

/**
 * The legal actions at a folded table state, in a deterministic order.
 *
 * Today's vocabulary (draw/discard) makes the set closed-form at every reachable
 * state:
 *
 * - an ended hand (phase !== 'playing') offers nothing;
 * - drawn === null → the turn seat's single draw. In a legally-folded 'playing'
 *   state this draw always folds: live cannot be empty here, because the phase
 *   flips to ryuukyoku on the discard that empties the wall (documented, not
 *   guarded — states are trusted from foldRecord, per the TileId/seed precedent);
 * - drawn !== null → the turn seat's 14 discards: the 13 hand tiles in hand order
 *   (hands are draw-ordered and never sorted, so the order is stable), then the
 *   drawn tile last, mirroring the physical table where the draw is held apart.
 *
 * Pure read: never mutates the state; returns a fresh array of fresh action
 * literals per call, so no caller can corrupt a fold through the result. Same
 * state → same set, always — bots and generators may sample by index.
 *
 * Extend-only, like the action vocabulary it mirrors: call/riichi/agari tickets
 * grow this enumeration (and this module); existing offerings never change shape.
 */
export function legalActions(state: TableState): HandAction[] {
  if (state.phase !== 'playing') return []
  if (state.drawn === null) {
    return [{ type: 'draw', seat: state.turn }]
  }
  const drawn = state.drawn
  return [
    ...state.hands[state.turn].map(
      (tile): HandAction => ({ type: 'discard', seat: state.turn, tile }),
    ),
    { type: 'discard', seat: state.turn, tile: drawn },
  ]
}
