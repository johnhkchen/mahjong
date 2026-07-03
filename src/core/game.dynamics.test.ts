// The multi-hand generalization of E-006's determinism/termination harness
// (selfplay.test.ts + dynamics.test.ts, both single-hand) up to game.ts's fold. Four
// invariants, the AC's own clauses: (1) total points equal 4 * 25000 after every
// settlement, (2) the same GameRecord replays byte-identically (scores, dealer, winds,
// action logs), (3) every game reaches each next hand without stalling, and (4)
// dealer/wind bookkeeping stays consistent with each hand's recorded outcome.
//
// Two doctrine debts, both deliberate (research.md/design.md): selfPlayHand below is a
// FOURTH statement of the claim-window arbitration rule (policy.test.ts, drive.ts,
// selfplay.test.ts already state it independently) — copied, not imported, per
// selfplay.test.ts's own stated policy that this codebase locks independent statements by
// test rather than sharing them. nextExpectedDealer/expectedSeatWinds independently
// RESTATE game.ts's own renchan/rotation rule and seat-wind arithmetic (never read
// foldGame's own branch for it) — otherwise a bug in that exact branch could never be
// caught by a test that only ever reads its output.
//
// foldGame requires every included hand to actually be ENDED ('agari' or 'ryuukyoku');
// dynamics.test.ts's random-legal driver reaches an end far too rarely (8/1000 seeds, its
// own win-carrier mining found) to chain reliably, so this suite drives every hand with
// the same bot pair game.test.ts already chose for its own mined fixtures (T-008-02-01
// design.md Decision 7), generalized here to many seeds and many hands per game via a
// fast-check property, closing the exact gap T-008-02-01's own review.md flagged as
// out of scope: "no property-based test drives foldGame itself end-to-end over random
// multi-hand sequences."

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  callPolicy,
  discardPolicy,
  foldGame,
  foldRecord,
  handSeedOf,
  legalActions,
  seatView,
  type GameRecord,
  type HandAction,
  type HandRecord,
  type Player,
  type Seat,
  type TableState,
} from './index'
import type { WindKind } from './yaku'

/** The selfplay.test.ts action-bound arithmetic, re-stated per that file's own doctrine. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE
const ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 * SEAT_COUNT + 2

/**
 * How many hands each built game chains. A CHOSEN suite budget, not a proven ceiling —
 * unlike ACTION_BOUND (real wall arithmetic), renchan has no true bound (a dealer could
 * keep winning forever), so there is nothing to derive. 6 keeps a 20-seed corpus, doubled
 * for the byte-identical-replay suite, comfortably under selfplay.test.ts's own 60s
 * explicit timeout, while staying high enough that a 20-seed corpus reliably exhibits both
 * a renchan and a rotation (design.md Decision 3/7).
 */
const HANDS_PER_GAME = 6

/** Re-stated module-private constant (game.ts, settlement.ts both keep their own copy). */
const STARTING_SCORE = 25000

/** The deterministic corpus — a contiguous small range, the selfplay.test.ts precedent. */
const GAME_SEEDS: readonly number[] = Array.from({ length: 20 }, (_, i) => i)

/** The claim-window call forms, test-side (selfplay.test.ts's own ClaimAction twin). */
type ClaimAction = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

function isClaimAction(action: HandAction): action is ClaimAction {
  return action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan'
}

/**
 * Drive one whole hand from a seed with every seat botted — selfplay.test.ts's selfPlay,
 * copied verbatim in shape (not imported, per that file's own stated doctrine), trimmed to
 * return only the HandRecord this suite needs. discardPolicy at own-turn points, callPolicy
 * at claim windows and houtei, with the cross-seat arbitration re-stated here in its LEAN
 * form: consult callPolicy once per seat holding a window offer, fold the earliest
 * non-draw answer in offered order, else let the window go stale on the head draw. State
 * only ever advances by refolding the longer record — foldRecord stays the single
 * authority. Every chosen action is asserted to be a REFERENCE MEMBER of the offered set,
 * and the action count is capped at ACTION_BOUND — a tripped bound throws (non-terminating
 * turn loop), never hangs.
 */
function selfPlayHand(seed: number): HandRecord {
  const actions: HandAction[] = []
  for (;;) {
    const state = foldRecord({ seed, actions })
    const legal = legalActions(state)
    if (state.phase === 'agari' || legal.length === 0) {
      return { seed, actions }
    }
    const isCallPoint =
      state.phase === 'ryuukyoku' ||
      (state.drawn === null && !state.mustDiscard && state.claimable !== null)
    let chosen: HandAction
    if (isCallPoint) {
      const consulted = new Set<Seat>()
      let best: HandAction | null = null
      let bestAt = Infinity
      for (const offer of legal) {
        if (offer.type !== 'ron' && !isClaimAction(offer)) continue
        if (consulted.has(offer.seat)) continue
        consulted.add(offer.seat)
        const answer = callPolicy(seatView(state, offer.seat), legal)
        if (answer.type === 'draw') continue
        const at = legal.indexOf(answer)
        if (at < bestAt) {
          best = answer
          bestAt = at
        }
      }
      if (best === null) {
        if (state.phase === 'ryuukyoku') {
          throw new Error(`seed ${seed}: ryuukyoku call point declined every ron`)
        }
        chosen = legal[0]
        if (chosen.type !== 'draw') {
          throw new Error(`seed ${seed}: pre-draw offered set does not lead with the draw`)
        }
      } else {
        chosen = best
      }
    } else {
      chosen = discardPolicy(seatView(state, state.turn), legal)
    }
    if (!legal.includes(chosen)) {
      throw new Error(`seed ${seed}: chosen action is not an offered element`)
    }
    actions.push(chosen)
    if (actions.length > ACTION_BOUND) {
      throw new Error(`seed ${seed}: self-play exceeded ${ACTION_BOUND} actions — the turn loop is not terminating`)
    }
  }
}

/**
 * Chain handCount bot-driven hands from the same gameSeed, using the REAL handSeedOf (pure
 * math, already covered by game.test.ts's own dedicated suite — only the turn-by-turn bot
 * loop above is duplicated, per design.md Decision 2). No game-level randomness is
 * introduced: same gameSeed in, same GameRecord out, end to end, because every per-hand
 * seed and every bot decision is a pure function of state already shown deterministic.
 * Every returned hand is ENDED — no trailing empty "just dealt" entry; boundary checks
 * below append that themselves per prefix.
 */
function playGame(gameSeed: number, handCount: number): GameRecord {
  const hands: (readonly HandAction[])[] = []
  for (let handIndex = 0; handIndex < handCount; handIndex++) {
    hands.push(selfPlayHand(handSeedOf(gameSeed, handIndex)).actions)
  }
  return { seed: gameSeed, hands }
}

/** The next Player in rotation order — game.ts's own private nextPlayer, restated. */
function nextPlayer(player: Player): Player {
  return ((player + 1) % SEAT_COUNT) as Player
}

/**
 * game.ts's OWN renchan/rotation rule (design.md Decision 5 in T-008-02-01), restated
 * independently here — never read from foldGame's own branch — so a regression in that
 * exact branch is caught by a test that does not merely echo it back.
 */
function nextExpectedDealer(prevDealer: Player, endedState: TableState): Player {
  const dealerWon = endedState.phase === 'agari' && endedState.win!.winner === 0
  return dealerWon ? prevDealer : nextPlayer(prevDealer)
}

/** A seat's own wind kind — record.ts/settlement.ts/game.ts's windKindOf, duplicated again. */
function windKindOf(seat: Seat): WindKind {
  return `${seat + 1}z` as WindKind
}

/** The engine seat `player` occupies when `dealer` deals — game.ts's seatOfPlayer, restated. */
function seatOfPlayer(dealer: Player, player: Player): Seat {
  return ((player - dealer + SEAT_COUNT) % SEAT_COUNT) as Seat
}

/** Every player's current wind under `dealer` — game.ts's seatWindsOf, restated independently. */
function expectedSeatWinds(dealer: Player): readonly [WindKind, WindKind, WindKind, WindKind] {
  return [0, 1, 2, 3].map((player) =>
    windKindOf(seatOfPlayer(dealer, player as Player)),
  ) as [WindKind, WindKind, WindKind, WindKind]
}

/**
 * The suite's core assertion, called once per prefix length for every game built. `hands`
 * is a prefix that is ALL real/ended hands (never a trailing []); `prevDealer` is the
 * PREVIOUSLY-checked prefix's own Player, threaded by the caller starting at 0 for the
 * first hand — never re-derived from foldGame, keeping the whole walk independent of the
 * rotation logic under test. Returns the new dealer, threading the walk forward.
 */
function expectValidBoundary(
  gameSeed: number,
  hands: readonly (readonly HandAction[])[],
  prevDealer: Player,
): Player {
  const lastIndex = hands.length - 1
  const endedState = foldRecord({ seed: handSeedOf(gameSeed, lastIndex), actions: hands[lastIndex] })
  const record: GameRecord = { seed: gameSeed, hands: [...hands, []] }
  const state = foldGame(record)

  // (1) conservation: total points equal 4 * 25000 after every settlement.
  expect(state.scores.reduce((a, b) => a + b, 0)).toBe(4 * STARTING_SCORE)

  // (2) fold purity, restated per prefix (dynamics.test.ts's "assert at every prefix").
  expect(foldGame(record)).toEqual(state)

  // (4) dealer/wind bookkeeping stays consistent with the just-ended hand's outcome.
  const expectedDealer = nextExpectedDealer(prevDealer, endedState)
  expect(state.dealer).toBe(expectedDealer)
  expect(state.seatWinds).toEqual(expectedSeatWinds(state.dealer))

  return state.dealer
}

/** Walk every prefix of a built game, threading the dealer forward from Player 0. */
function walkGame(gameSeed: number, hands: readonly (readonly HandAction[])[]): Player {
  let dealer: Player = 0
  for (let len = 1; len <= hands.length; len++) {
    dealer = expectValidBoundary(gameSeed, hands.slice(0, len), dealer)
  }
  return dealer
}

describe('multi-hand dynamics: corpus', () => {
  it(
    'every corpus seed conserves points and keeps dealer/wind bookkeeping consistent at every hand boundary',
    { timeout: 60_000 },
    () => {
      let renchanCount = 0
      let rotationCount = 0
      const finalPhases = new Set<TableState['phase']>()
      for (const gameSeed of GAME_SEEDS) {
        const { hands } = playGame(gameSeed, HANDS_PER_GAME)
        let dealer: Player = 0
        for (let len = 1; len <= hands.length; len++) {
          const prefix = hands.slice(0, len)
          const endedState = foldRecord({
            seed: handSeedOf(gameSeed, len - 1),
            actions: prefix[len - 1],
          })
          const nextDealer = expectValidBoundary(gameSeed, prefix, dealer)
          if (nextDealer === dealer) renchanCount += 1
          else rotationCount += 1
          dealer = nextDealer
          if (len === hands.length) finalPhases.add(endedState.phase)
        }
      }
      // Non-vacuity, the selfplay.test.ts/dynamics.test.ts precedent restated: a zeroed
      // tally must widen the corpus, never weaken the check.
      expect(renchanCount).toBeGreaterThan(0)
      expect(rotationCount).toBeGreaterThan(0)
      expect(finalPhases).toContain('agari')
      expect(finalPhases).toContain('ryuukyoku')
    },
  )
})

describe('multi-hand dynamics: byte-identical replay', () => {
  it(
    'two independently-built games from the same seed replay byte-identically end to end',
    { timeout: 60_000 },
    () => {
      for (const gameSeed of GAME_SEEDS) {
        const first = playGame(gameSeed, HANDS_PER_GAME)
        const second = playGame(gameSeed, HANDS_PER_GAME)
        expect(JSON.stringify(second)).toBe(JSON.stringify(first))

        const firstState = foldGame({ seed: gameSeed, hands: [...first.hands, []] })
        const secondState = foldGame({ seed: gameSeed, hands: [...second.hands, []] })
        expect(secondState.scores).toEqual(firstState.scores)
        expect(secondState.dealer).toBe(firstState.dealer)
        expect(secondState.seatWinds).toEqual(firstState.seatWinds)
      }
    },
  )
})

describe('multi-hand dynamics: property over the full seed domain', () => {
  it(
    'every game reaches each next hand without stalling, conserving points and dealer/wind bookkeeping',
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 0xffffffff }), (gameSeed) => {
          const { hands } = playGame(gameSeed, HANDS_PER_GAME)
          expect(hands).toHaveLength(HANDS_PER_GAME)
          for (const actions of hands) {
            expect(actions.length).toBeLessThanOrEqual(ACTION_BOUND)
          }
          walkGame(gameSeed, hands)
        }),
        { numRuns: 8 },
      )
    },
  )
})
