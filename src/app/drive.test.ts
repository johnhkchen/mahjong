// The AC's app test: the tap handler and the auto-advance loop build actions via
// legalActions rather than computing legality locally. The teeth are identity and the
// doctored list — a returned action IS an element of the offered array (toBe, not
// shape), and a tile removed from the offering is rejected even though the fold says
// the player holds it, so legality can be coming from nowhere but the list. The
// integration walk then drives a full seeded hand deal → ryuukyoku through exactly
// these two functions, every append an element of a fresh legalActions fold.

import { describe, expect, it } from 'vitest'
import { foldRecord, legalActions, type HandAction, type TileId } from '../core'
import { forcedAction, PLAYER, tapDiscard } from './drive'

// The frozen anchor seed shared with the other suites (wall golden vector, App boot).
const SEED = 1

/**
 * An all-tsumogiri script of n full turns: turn k is seat k%4 drawing and immediately
 * discarding. Draws consume the post-deal live wall head-first (the frozen wall
 * convention), so turn k's tile is live[k] — read off the empty fold, never recomputed.
 */
function tsumogiriTurns(live: readonly TileId[], n: number): HandAction[] {
  return Array.from({ length: n }, (_, k): HandAction[] => {
    const seat = (k % 4) as 0 | 1 | 2 | 3
    return [
      { type: 'draw', seat },
      { type: 'discard', seat, tile: live[k] },
    ]
  }).flat()
}

const dealt = foldRecord({ seed: SEED, actions: [] })
// East mid-turn: the player's 14-discard offering.
const afterEastDraw = foldRecord({ seed: SEED, actions: [{ type: 'draw', seat: 0 }] })
// South pre-draw and mid-turn: a non-player seat's offerings.
const eastTurnDone = tsumogiriTurns(dealt.live, 1)
const beforeSouthDraw = foldRecord({ seed: SEED, actions: eastTurnDone })
const afterSouthDraw = foldRecord({
  seed: SEED,
  actions: [...eastTurnDone, { type: 'draw', seat: 1 }],
})
// The ended hand: all 70 post-deal live tiles drawn and discarded — ryuukyoku.
const exhausted = foldRecord({ seed: SEED, actions: tsumogiriTurns(dealt.live, 70) })

describe('tapDiscard', () => {
  it('returns the offered element itself for every legally discardable tile', () => {
    const offered = legalActions(afterEastDraw)
    expect(offered).toHaveLength(14)
    for (const action of offered) {
      if (action.type !== 'discard') throw new Error('post-draw offerings are discards')
      // toBe, not toEqual: the built action IS legalActions output, never a lookalike.
      expect(tapDiscard(offered, PLAYER, action.tile)).toBe(action)
    }
  })

  it('rejects a tile missing from the offered list even though the fold says the player holds it', () => {
    const held = afterEastDraw.hands[PLAYER][0]
    const doctored = legalActions(afterEastDraw).filter(
      (action) => !(action.type === 'discard' && action.tile === held),
    )
    expect(doctored).toHaveLength(13) // the doctoring removed exactly the held tile
    expect(tapDiscard(doctored, PLAYER, held)).toBeNull()
  })

  it('rejects taps while the offering is a draw', () => {
    const offered = legalActions(dealt)
    for (const tile of dealt.hands[PLAYER]) {
      expect(tapDiscard(offered, PLAYER, tile)).toBeNull()
    }
  })

  it("rejects the player's taps on another seat's discard offering", () => {
    const offered = legalActions(afterSouthDraw)
    for (const action of offered) {
      if (action.type !== 'discard') throw new Error('post-draw offerings are discards')
      expect(tapDiscard(offered, PLAYER, action.tile)).toBeNull()
    }
  })

  it('rejects every tap once the hand has ended', () => {
    expect(exhausted.phase).toBe('ryuukyoku')
    const anyTile: TileId = exhausted.hands[PLAYER][0]
    expect(tapDiscard(legalActions(exhausted), PLAYER, anyTile)).toBeNull()
  })
})

describe('forcedAction', () => {
  it("forces the player's own draw — a draw is never a choice", () => {
    const offered = legalActions(dealt)
    expect(offered).toHaveLength(1)
    expect(forcedAction(offered, PLAYER)).toBe(offered[0])
  })

  it("forces a bot seat's draw", () => {
    const offered = legalActions(beforeSouthDraw)
    expect(offered).toEqual([{ type: 'draw', seat: 1 }])
    expect(forcedAction(offered, PLAYER)).toBe(offered[0])
  })

  it('forces bot tsumogiri: the last offered discard, which is the drawn tile', () => {
    const offered = legalActions(afterSouthDraw)
    const forced = forcedAction(offered, PLAYER)
    expect(forced).toBe(offered[offered.length - 1])
    if (forced?.type !== 'discard') throw new Error('a bot mid-turn forces a discard')
    // Cross-check against the fold's independent statement of what was drawn.
    expect(forced.tile).toBe(afterSouthDraw.drawn)
  })

  it("never forces the player's discard — that is the tap's choice", () => {
    expect(forcedAction(legalActions(afterEastDraw), PLAYER)).toBeNull()
  })

  it('returns null on the empty offering of an ended hand — the halt condition', () => {
    expect(legalActions(exhausted)).toEqual([])
    expect(forcedAction([], PLAYER)).toBeNull()
  })
})

describe('full hand driven through the seam', () => {
  it('plays deal → ryuukyoku with every action an element of legalActions output', () => {
    const actions: HandAction[] = []
    let state = foldRecord({ seed: SEED, actions })
    // 140 actions end the hand; the guard only bounds a regression, it never trips.
    for (let guard = 0; guard < 200; guard++) {
      const offered = legalActions(state)
      if (offered.length === 0) break
      const forced = forcedAction(offered, PLAYER)
      let next: HandAction
      if (forced !== null) {
        // Bot discards are pure tsumogiri: the fold's drawn tile, nothing from hand.
        if (forced.type === 'discard') expect(forced.tile).toBe(state.drawn)
        next = forced
      } else {
        // The player always taps his first offered tile — a tedashi-shaped choice,
        // exercising hand discards rather than mirroring the bots' tsumogiri.
        const first = offered[0]
        if (first.type !== 'discard') throw new Error('an unforced offering is a discard choice')
        const tapped = tapDiscard(offered, PLAYER, first.tile)
        expect(tapped).toBe(first)
        next = tapped!
      }
      // Identity containment: the appended action IS an element of this fold's offering.
      expect(offered).toContain(next)
      actions.push(next)
      state = foldRecord({ seed: SEED, actions }) // never throws — every append was offered
    }
    expect(state.phase).toBe('ryuukyoku')
    expect(actions).toHaveLength(140) // 70 draw/discard pairs — the whole live wall
    expect(state.live).toHaveLength(0)
    expect(legalActions(state)).toEqual([])
    // 70 discards across the ponds; East and South act on the two extra turns.
    expect(state.ponds.map((pond) => pond.length)).toEqual([18, 18, 17, 17])
  })
})
