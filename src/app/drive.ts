// App-side wiring over core's offered set — the seam between input (taps, the bot
// placeholder, the auto-draw) and the authoritative record. Every function here takes
// legalActions output and returns an ELEMENT of it or null; nothing in this module
// computes legality, reads hands, or counts the wall — the app builds actions via
// legalActions, never locally (the ticket's contract, tested in drive.test.ts). The
// tsumogiri chooser is the deliberate bot placeholder: it stands exactly where a real
// core bot (table state → action, a stateless peripheral) will be swapped in later.

import type { HandAction, Seat, TileId } from '../core'

/** The human's seat — East, the dealer. Table.svelte presents the same fact. */
export const PLAYER: Seat = 0

/**
 * The action a tap on `tile` builds: the discard of that tile by `player`, taken from
 * `offered` itself — never constructed — or null when no such discard is offered (not
 * the player's discard turn, or the tile isn't legally discardable). The seat check is
 * explicit so the promise holds for any caller, not only ones relying on legalActions'
 * homogeneous-offering shape.
 */
export function tapDiscard(
  offered: readonly HandAction[],
  player: Seat,
  tile: TileId,
): HandAction | null {
  return (
    offered.find(
      (action) => action.type === 'discard' && action.seat === player && action.tile === tile,
    ) ?? null
  )
}

/**
 * The action that happens without player input, or null when the game waits on the
 * player's discard choice or has ended (empty offering — the loop's halt condition):
 *
 * - any draw is forced, the player's included — a draw is never a choice (legalActions
 *   offers it as a singleton);
 * - a non-player discard offering forces tsumogiri: the LAST offered discard, by
 *   legalActions' frozen hand-order-then-drawn-last contract (sampling by index is that
 *   contract's blessed use). A real bot later replaces exactly this arm.
 *
 * Classifying by offered[0] is sound because an offering is homogeneous — all draws or
 * all discards, all by the turn seat (legalActions' documented closed form).
 */
export function forcedAction(
  offered: readonly HandAction[],
  player: Seat,
): HandAction | null {
  const head = offered[0]
  if (head === undefined) return null
  if (head.type === 'draw') return head
  if (head.seat === player) return null
  return offered[offered.length - 1]
}
