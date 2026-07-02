// App-side wiring over core's offered set — the seam between input (taps, the bot
// placeholder, the auto-draw) and the authoritative record. Every function here takes
// legalActions output and returns an ELEMENT of it or null; nothing in this module
// computes legality, reads hands, or counts the wall — the app builds actions via
// legalActions, never locally (the ticket's contract, tested in drive.test.ts). The
// tsumogiri chooser is the deliberate bot placeholder: it stands exactly where a real
// core bot (table state → action, a stateless peripheral) will be swapped in later —
// and bot seats auto-pass every claim window for the same reason (placeholder bots
// never call). The PLAYER's claims are the exception: forcedAction waits on them, and
// tapClaim/passClaim select the call or the decline from the same offered set.

import { kindOf, type HandAction, type Seat, type TileId } from '../core'

/** The human's seat — East, the dealer. Table.svelte presents the same fact. */
export const PLAYER: Seat = 0

/**
 * The claim-window call forms — what a seat may take from another seat's fresh
 * discard. Ankan/shouminkan are deliberately NOT claims: they are the turn seat's
 * own-turn choices, already handled by forcedAction's player-discard null (the
 * player's kan UI is future work; a bot's kan offers lose to tsumogiri below).
 */
type ClaimAction = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

function isClaim(action: HandAction): action is ClaimAction {
  return action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan'
}

/**
 * A claim button's payload — the minimal datum distinguishing every offer a window
 * can hold for one seat: the call form plus the exact copies it consumes. Distinct
 * chi variants (different shapes OR different physical copies of one shape) differ
 * precisely in `uses`; the claimed tile is implied (one window tile per state) and
 * the seat is the player parameter. Stays sufficient when red fives make copies
 * non-interchangeable, for the same reason legalActions enumerates per copy.
 */
export interface ClaimChoice {
  readonly type: ClaimAction['type']
  readonly uses: readonly TileId[]
}

/**
 * The claim offers the window holds for `player`, in offered (frozen) order: pons,
 * then daiminkans, then chis, shapes low-rank ascending — elements of `offered`
 * itself, never rebuilt. Empty at everything that is not an open claim window with
 * player offers. The one predicate three consumers share: forcedAction's wait
 * condition, passClaim's guard, and the claim prompt's render list (T-004-02-02) —
 * the loop waits exactly when the prompt shows.
 */
export function claimChoices(offered: readonly HandAction[], player: Seat): HandAction[] {
  return offered.filter((action) => isClaim(action) && action.seat === player)
}

/**
 * claimChoices deduped for presentation: the FIRST offer of each (call form,
 * `uses` kinds) group, frozen order preserved — still elements of `offered` itself.
 * The enumeration is complete, not minimal (a triplet holder has three pon pairs
 * that differ only in which physical copies they expose), and until red fives make
 * copies non-interchangeable those variants are indistinguishable buttons; the
 * prompt renders THIS list, one button per choice a learner could mean. Keeping the
 * first of a group is canonical: `uses` come in hand order, so the survivor is the
 * combination the enumeration named first. Shape-distinct chi variants and distinct
 * call forms always differ in kinds, so they always survive. Kinds are read only to
 * GROUP offers, never to build one — selection stays tapClaim's. Empty exactly when
 * claimChoices is empty (a dedupe never empties a non-empty list), so the prompt's
 * visibility and forcedAction's wait remain one predicate family.
 */
export function promptChoices(offered: readonly HandAction[], player: Seat): HandAction[] {
  const seen = new Set<string>()
  return claimChoices(offered, player).filter((action) => {
    if (!isClaim(action)) return false // unreachable past claimChoices; type-narrows
    const key = `${action.type}|${action.uses.map(kindOf).join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Ordered equality — `uses` order is canonical legalActions output, echoed back. */
function usesEqual(a: readonly TileId[], b: readonly TileId[]): boolean {
  return a.length === b.length && a.every((tile, i) => tile === b[i])
}

/**
 * The action a tap on a claim button builds: the offered element matching `choice`
 * by call form and exact `uses` — taken from `offered` itself, never constructed —
 * or null when no such claim is offered to `player` (no window, not this player's
 * offer, a lookalike `uses` combination, or a stale/ended state). Matching is
 * ordered because the button echoes back the canonical `uses` it was rendered from;
 * a reordered tuple is a lookalike, not a selection.
 */
export function tapClaim(
  offered: readonly HandAction[],
  player: Seat,
  choice: ClaimChoice,
): HandAction | null {
  return (
    offered.find(
      (action) =>
        isClaim(action) &&
        action.seat === player &&
        action.type === choice.type &&
        usesEqual(action.uses, choice.uses),
    ) ?? null
  )
}

/**
 * The action a pass on the claim prompt builds: the draw at the head — the default
 * continuation whose fold lets the window go stale (there is no pass action in the
 * vocabulary; declining IS taking the next draw, which may be the player's own).
 * Null whenever the player holds no claim offer: complementary to forcedAction by
 * construction, so exactly one driver applies at every state — passClaim is non-null
 * precisely where forcedAction newly waits, and a pass button can only exist while
 * there is something to decline.
 */
export function passClaim(offered: readonly HandAction[], player: Seat): HandAction | null {
  const head = offered[0]
  if (head === undefined || head.type !== 'draw') return null
  return claimChoices(offered, player).length > 0 ? head : null
}

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
 * player — his discard choice, his call/pass decision — or has ended (empty offering,
 * the loop's halt condition):
 *
 * - a window holding a claim offer for the PLAYER waits: null before anything else,
 *   because the head can be the player's OWN draw (North discards, East may chi —
 *   the turn advanced to East) and taking it would silently pass the player's claim.
 *   "A draw is never a choice" is false exactly here: this draw is the pass, and only
 *   tapClaim/passClaim may make that call (the seed-3 geometry in drive.test.ts);
 * - otherwise a draw at the head is forced, the player's included — bot-only claim
 *   offers behind it are never taken: forcing the draw lets the discard go stale,
 *   i.e. placeholder bots auto-pass every call until a real bot ticket;
 * - a non-player discard obligation forces tsumogiri: the LAST offered DISCARD, which
 *   is the drawn tile by legalActions' frozen hand-order-then-drawn-last contract.
 *   The reverse scan (not offered[offered.length - 1]) matters because kan offers
 *   follow the discards — a bot holding four of a kind must still tsumogiri, never
 *   silently kan. A real bot later replaces exactly this arm.
 *
 * Classifying by offered[0] is sound past the claim guard because the head is the
 * frozen order's anchor: the draw at pre-draw states, the first hand discard
 * otherwise, always the turn seat.
 */
export function forcedAction(
  offered: readonly HandAction[],
  player: Seat,
): HandAction | null {
  const head = offered[0]
  if (head === undefined) return null
  if (claimChoices(offered, player).length > 0) return null
  if (head.type === 'draw') return head
  if (head.seat === player) return null
  for (let i = offered.length - 1; i >= 0; i--) {
    const action = offered[i]
    if (action.type === 'discard') return action
  }
  return null
}
