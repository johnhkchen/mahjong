// App-side wiring over core's offered set — the seam between input (taps, the
// policy bots, the auto-draw) and the authoritative record. Every function here
// returns an ELEMENT of legalActions output or null; nothing in this module computes
// legality, reads the wall, or constructs an action — the app builds actions via
// legalActions, never locally (the original seam contract, tested in drive.test.ts).
// The tsumogiri placeholder and the bot auto-pass are gone (T-006-03-03): the three
// non-PLAYER seats decide through core's policy pair — discardPolicy at their own
// turns, callPolicy at claim windows and houtei. The DRIVER holds the state and each
// seat holds a VIEW (seatview.ts's doctrine): forcedAction and settleWindow take the
// folded TableState solely to project seatView(state, seat) for the policies, which
// are themselves pure selectors over `offered` — legality still comes from nowhere
// but the list. The PLAYER's claims and wins remain the exception: forcedAction
// waits on them, tapClaim/winChoice select the call or the win, and the player's
// answer (or his decline) then joins the bots' in settleWindow — one arbitration
// for every seat, offered position as the rules' precedence.

import {
  callPolicy,
  discardPolicy,
  kindOf,
  seatView,
  shanten,
  type HandAction,
  type Player,
  type Seat,
  type SeatView,
  type TableState,
  type TileId,
} from '../core'

/** The human's seat — East, the dealer. Table.svelte presents the same fact. */
export const PLAYER: Seat = 0

/**
 * GameState.scores (Player-indexed, game.ts) remapped into THIS hand's engine-Seat
 * order — the same shape ScoreBreakdown.scores (settlement.ts) already uses, and the
 * one HandEnd.svelte renders. Needed because `PLAYER` stays pinned at engine Seat 0
 * every hand (T-008-03-02's own scoped decision: the interactive seat does not
 * follow a rotating persistent identity around the table), while the OTHER three
 * seats' Player occupants still rotate hand to hand as the dealer repeats/rotates
 * (game.ts's foldGame) — passing `scores` straight through unindexed would mislabel
 * money the first time the dealer ever moves off Player 0: `scores[1]` would no
 * longer be the running total of whoever is actually sitting South. `(dealer + seat)
 * % SEAT_COUNT` is game.ts's own private `playerOfSeat`, duplicated (the
 * windKindOf-across-settlement.ts/game.ts precedent, applied one more time).
 */
export function seatScoresOf(
  scores: readonly [number, number, number, number],
  dealer: Player,
): readonly [number, number, number, number] {
  return [0, 1, 2, 3].map((seat) => scores[(dealer + seat) % 4]) as [
    number,
    number,
    number,
    number,
  ]
}

/**
 * The claim-window call forms — what a seat may take from another seat's fresh
 * discard. Ankan/shouminkan are deliberately NOT claims: they are the turn seat's
 * own-turn choices, already handled by forcedAction's player-discard null (the
 * player's kan UI is future work; a bot's own-turn kan offers pass through
 * discardPolicy unchosen — policy.ts's frozen arms).
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
 * condition, settleWindow's declinable guard, and the claim prompt's render list
 * (T-004-02-02) — the loop waits exactly when the prompt shows.
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
 * The seats other than `player` holding a ron or claim offer, deduped, in
 * first-offer order — the seats settleWindow consults and the presence test for
 * forcedAction's window arm. Tsumo and own-turn kan offers are deliberately not
 * scanned: they are own-turn decisions (discardPolicy's), never window answers.
 */
function botSeatsHoldingOffers(offered: readonly HandAction[], player: Seat): Seat[] {
  const seats: Seat[] = []
  for (const action of offered) {
    if (
      (action.type === 'ron' || isClaim(action)) &&
      action.seat !== player &&
      !seats.includes(action.seat)
    ) {
      seats.push(action.seat)
    }
  }
  return seats
}

/**
 * The window settlement — ONE arbitration for every seat, at claim windows and
 * houtei (and, degenerately, anywhere the app resolves a player answer: a tsumo
 * point settles to the tsumo itself, no bot holding offers there). `chosen` is the
 * player's answer — a tapClaim/winChoice element, or null for the decline — and
 * the bots' answers come from callPolicy over per-seat views, consulted once per
 * seat holding a ron or claim offer. A callPolicy draw answer means THAT SEAT
 * DECLINED (T-006-03-02's contract), never "fold the draw now" — another seat may
 * still take the window. The earliest non-draw answer in offered order wins:
 * offered position IS the rules' precedence (legal.ts freezes rons in atamahane
 * rotation before pons before daiminkans before chis), so a bot's ron outranks the
 * player's pon and a bot's pon outranks his chi — a tap can lose the window,
 * exactly as at a real table. When every seat declines, the head draw is returned
 * when the state held anything declinable (folding it lets the window go stale —
 * there is no pass action in the vocabulary), and null otherwise: nothing to fold.
 * The null arms are the old pass geometry verbatim — a windowless state (nothing
 * to decline), a tsumo point reached defensively (its decline IS a discard tap;
 * the head is not a draw), and the declined player-only houtei (rons-only
 * offering; the decline is the prompt owner's presentation fact — the dismissal).
 * A `chosen` that is not an element of `offered` is ignored (indexOf < 0), so
 * every non-null result is an element of `offered` by construction.
 */
export function settleWindow(
  state: TableState,
  offered: readonly HandAction[],
  player: Seat,
  chosen: HandAction | null,
): HandAction | null {
  let best: HandAction | null = null
  let bestAt = Infinity
  if (chosen !== null) {
    const at = offered.indexOf(chosen)
    if (at >= 0) {
      best = chosen
      bestAt = at
    }
  }
  const bots = botSeatsHoldingOffers(offered, player)
  for (const seat of bots) {
    const answer = callPolicy(seatView(state, seat), offered)
    if (answer.type === 'draw') continue
    const at = offered.indexOf(answer)
    if (at < bestAt) {
      best = answer
      bestAt = at
    }
  }
  if (best !== null) return best
  const head = offered[0]
  if (head === undefined || head.type !== 'draw') return null
  return bots.length > 0 ||
    claimChoices(offered, player).length > 0 ||
    winChoice(offered, player) !== null
    ? head
    : null
}

/** The call forms a window can resolve to when someone OTHER than the asker wins it —
 *  never 'draw' (unreachable from a non-null `chosen`, see windowOutcome) and never
 *  'tsumo' (a bot never reaches a tsumo through callPolicy; a tsumo point and an open
 *  claim window are mutually exclusive states). */
export type CallType = 'chi' | 'pon' | 'daiminkan' | 'ron'

function isCallType(type: HandAction['type']): type is CallType {
  return type === 'chi' || type === 'pon' || type === 'daiminkan' || type === 'ron'
}

/**
 * The fact a lost window leaves behind: who actually took it, and with what — set
 * beside `playerType`, the call/win the PLAYER tapped and lost. Never built when the
 * player's own tap won (the ordinary, silent case) or when nothing was tapped at all
 * (a decline never reaches this — see windowOutcome).
 */
export interface WindowOutcome {
  readonly winner: Seat
  readonly winnerType: CallType
  readonly playerType: CallType | 'tsumo'
}

function isPlayerTapType(type: HandAction['type']): type is CallType | 'tsumo' {
  return isCallType(type) || type === 'tsumo'
}

/**
 * The console's one comparison of "what I tapped" against "what settleWindow actually
 * pushed" — null exactly when there is nothing to report: `settled` is null (only
 * reachable from a declined window, which never calls this at all — App.svelte's
 * `pass()` doesn't), or `settled` IS `chosen` (reference equality, not shape: `chosen`
 * is always an `offered` element by construction — tapClaim/winChoice results, never
 * built locally — and settleWindow seeds its own `best` as `chosen` before consulting
 * any bot, so `===` is the exact, cheap test for "the player's own tap won"). A
 * defensive `isCallType` guard keeps `winnerType` narrow even though, by the settled-
 * seat invariant above, `settled` can only ever be a call/ron here.
 */
export function windowOutcome(
  chosen: HandAction,
  settled: HandAction | null,
): WindowOutcome | null {
  if (settled === null || settled === chosen || !isCallType(settled.type)) return null
  if (!isPlayerTapType(chosen.type)) return null
  return { winner: settled.seat, winnerType: settled.type, playerType: chosen.type }
}

/**
 * The player's win offer — the tsumo on his own draw, or the ron on the window (or
 * reconstructed houtei) discard — an element of `offered` itself, or null when no
 * win is offered. At most ONE exists per state by the enumeration's shape (zero or
 * one tsumo post-draw; one ron per seat per window; ryuukyoku offers only houtei
 * rons), so this one function is both the prompt's visibility predicate and the
 * tap's selector: a win action carries no `uses` to choose between — the offer IS
 * the selection, and the owner appends the returned element verbatim. Furiten and
 * yakuless completions are never offered (core's gates, legal.ts), so they can
 * never be appended through this seam — THE FURITEN DIVERGENCE consumed: the fold
 * would accept a furiten ron, but a driver that only appends offered elements
 * cannot build one. This selector is the PLAYER's lens only: the bots' wins go
 * through callPolicy (settleWindow for rons, discardPolicy for tsumo), and the
 * atamahane (head-bump) arbitration between simultaneous rons is settleWindow's
 * offered-index rule — rons are offered in rotation order from the discarder, so
 * the earliest offered ron is the head-bump winner. A seat holds at most one win
 * offer, so this scan only ever skips other seats'.
 */
export function winChoice(offered: readonly HandAction[], player: Seat): HandAction | null {
  return (
    offered.find(
      (action) => (action.type === 'tsumo' || action.type === 'ron') && action.seat === player,
    ) ?? null
  )
}

/**
 * The riichi decision point (T-009-03-01) — "you're tenpai, declare riichi?" made
 * concrete: the ONE candidate tile the console asks about, plus both fold targets,
 * every one an element of `offered` itself. Null unless `offered` holds a riichi
 * offer for `player` at all (most turns; the ordinary case) or a win is offered
 * instead (winChoice takes precedence — discarding into a riichi when the drawn tile
 * already completes the hand is never the moment this prompt owns). The candidate
 * tile is NOT "first offered" (an arbitrary tile when several tenpai-preserving
 * discards exist): it is whichever tile `discardPolicy` — the identical, already-
 * exported bot decision — would choose for this seat's own turn, so the prompt never
 * shows a different tile than the one the AI itself would play, and the one
 * documented exception (a dead wait, policy.ts's own isDeadWait) resolves for free —
 * discardPolicy still names the SAME tile, just returning its plain discard instead
 * of the riichi action, so `decline` is `discardPolicy`'s own result and `declare` is
 * looked up alongside it (or vice versa when discardPolicy does declare). Every
 * lookup is `offered.find`, never a constructed literal — legality stays legal.ts's
 * alone, per this module's own header.
 */
export interface RiichiPrompt {
  /** The physical tile both fold targets discard — the prompt's one subject. */
  readonly tile: TileId
  /** The 'riichi' element of `offered` for this tile. */
  readonly declare: HandAction
  /** The plain 'discard' element of `offered` for the identical tile. */
  readonly decline: HandAction
}

export function riichiPrompt(
  state: TableState,
  offered: readonly HandAction[],
  player: Seat,
): RiichiPrompt | null {
  if (winChoice(offered, player) !== null) return null
  const anyRiichi = offered.some((action) => action.type === 'riichi' && action.seat === player)
  if (!anyRiichi) return null
  const recommendation = discardPolicy(seatView(state, player), offered)
  if (recommendation.type === 'riichi' && recommendation.seat === player) {
    const decline = offered.find(
      (action) =>
        action.type === 'discard' && action.seat === player && action.tile === recommendation.tile,
    )
    if (decline === undefined) return null
    return { tile: recommendation.tile, declare: recommendation, decline }
  }
  if (recommendation.type === 'discard' && recommendation.seat === player) {
    const declare = offered.find(
      (action) =>
        action.type === 'riichi' && action.seat === player && action.tile === recommendation.tile,
    )
    if (declare === undefined) return null
    return { tile: recommendation.tile, declare, decline: recommendation }
  }
  return null
}

/**
 * The pre-tenpai teaching hint (T-009-03-01): "N away from tenpai," reading `shanten`
 * directly — no engine logic of its own, only the arity choice `shanten` itself
 * requires. Null whenever there is nothing to hint: `view.drawn === null` (not this
 * seat's own discard decision right now — between turns or another seat's point),
 * `view.riichi[view.seat]` (locked; every later turn is forced tsumogiri, hinting is
 * moot), or the computed shanten is `<= 0` (tenpai or an outright completion — the
 * riichi prompt or the win offer owns that moment, never this hint).
 */
export function tenpaiHint(view: SeatView): number | null {
  const seat = view.seat
  if (view.drawn === null || view.riichi[seat]) return null
  const value = shanten([...view.hand, view.drawn].map(kindOf), view.melds[seat])
  return value <= 0 ? null : value
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
 * player — his discard choice, his window answer, his win — or has ended (empty
 * offering, the loop's halt condition):
 *
 * - a state holding a claim OR WIN offer for the PLAYER waits: null before anything
 *   else, because the head can be the player's OWN draw (North discards, East may
 *   chi — or RON — the turn advanced to East) and taking it would silently pass the
 *   player's claim or win. "A draw is never a choice" is false exactly here: this
 *   draw is the pass, and only the prompt's taps — through settleWindow — may make
 *   that call (the seed-3 and seed-362857 geometries in drive.test.ts). The guard
 *   also owns the player's houtei: a ryuukyoku offering holding his ron waits by
 *   intent, not by the fallthrough coincidence of the seat check below;
 * - a state holding ron/claim offers for BOT seats only settles immediately:
 *   settleWindow with no player answer — the earliest accepted bot answer in
 *   offered order, else the head draw (every consulted seat declined; the window
 *   goes stale — the decline doctrine), else null. This arm replaces the
 *   placeholder auto-pass, and it is where the bots call, ron, and take their
 *   houtei rons (a bot never declines an offered ron, so a bot-only houtei always
 *   settles to its ron rather than resting the hand);
 * - otherwise a draw at the head is forced, the player's included — a draw is
 *   never a choice, for any seat;
 * - a player discard obligation waits — that is the tap's choice (the tsumo point
 *   included: the win button and the discard surface are both live);
 * - a non-player discard obligation routes to discardPolicy over the bot's own
 *   view: the offered tsumo when the draw won the hand, else the shanten-minimizing
 *   discard by the frozen tie-break. This arm replaces the tsumogiri placeholder;
 *   own-turn kan offers still pass through unchosen (policy.ts's frozen arms).
 *
 * Classifying by offered[0] is sound past the two window guards because the head is
 * the frozen order's anchor: the draw at pre-draw states, the first hand discard
 * otherwise, always the turn seat — and every ryuukyoku offering (rons only) was
 * consumed by the guards above.
 */
export function forcedAction(
  state: TableState,
  offered: readonly HandAction[],
  player: Seat,
): HandAction | null {
  const head = offered[0]
  if (head === undefined) return null
  if (claimChoices(offered, player).length > 0 || winChoice(offered, player) !== null) {
    return null
  }
  if (botSeatsHoldingOffers(offered, player).length > 0) {
    return settleWindow(state, offered, player, null)
  }
  if (head.type === 'draw') return head
  if (head.seat === player) return null
  return discardPolicy(seatView(state, head.seat), offered)
}
