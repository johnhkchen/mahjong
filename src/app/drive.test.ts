// The AC's app test: the tap handlers and the auto-advance loop build actions via
// legalActions rather than computing legality locally. The teeth are identity and the
// doctored list — a returned action IS an element of the offered array (toBe, not
// shape), and an offer removed from the list is rejected even though the fold says
// it would hold, so legality can be coming from nowhere but the list. This ticket's
// additions: the claim window. forcedAction waits (null) exactly when the PLAYER
// holds a claim offer — bot-only windows auto-pass by forcing the head draw —
// and tapClaim/passClaim are complementary selectors over the same offered set:
// the call by (type, uses), distinct chi variants distinguishable, or the declining
// draw. Two walks integrate it: the seed-1 hand under pass-everything (trajectory
// byte-identical to unclaimed play), and a seed-3 chi driven through the seam.

import { describe, expect, it } from 'vitest'
import { foldRecord, legalActions, type HandAction, type Seat, type TileId } from '../core'
import {
  claimChoices,
  forcedAction,
  passClaim,
  PLAYER,
  promptChoices,
  tapClaim,
  tapDiscard,
} from './drive'

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

// ——— Frozen claim-window anchors (scratchpad-scanned, derivations below — never
// regenerate). All three follow North/West tsumogiri discards, so the windows are
// open at a pre-draw fold with the draw at the head.
// Seed 3 — the race window (mirrored from legal.test.ts): four tsumogiri turns
// discard 28/128/25/42; North's 42 (2p) is pon-able by South with its 3p... no —
// with its 2p pair [43, 41] (hand order), and chi-able by EAST two ways: the 1p+3p
// run with either 3p copy — uses [37, 47] and [37, 44] ([low, high] canonical order;
// duplicate-copy variants of one shape). The head is EAST'S OWN draw (the turn
// advanced past North): the geometry where taking "the player's draw" would silently
// pass the player's claim.
// Seed 5 — after seven tsumogiri turns West discards 94 (6s): EAST pons with its
// hand-order [93, 95] pair; North (chi seat) holds four bot chi variants. The head
// is NORTH's draw — a player offer behind a BOT's draw obligation.
// Seed 15 — after eight tsumogiri turns North discards 45 (3p): EAST holds a pon
// [44, 47] AND two shape-distinct chis [41, 51] (2p3p4p) and [51, 55] (3p4p5p) —
// the multi-type, multi-variant prompt in one window, frozen order pon before chis.
const dealt3 = foldRecord({ seed: 3, actions: [] })
const racePrefix3: readonly HandAction[] = tsumogiriTurns(dealt3.live, 4)
const raceWindow3 = foldRecord({ seed: 3, actions: racePrefix3 })
const EAST_CHI_A = { type: 'chi', uses: [37, 47] } as const
const EAST_CHI_B = { type: 'chi', uses: [37, 44] } as const
const SOUTH_PON_3 = { type: 'pon', uses: [43, 41] } as const

const dealt5 = foldRecord({ seed: 5, actions: [] })
const ponWindow5 = foldRecord({ seed: 5, actions: tsumogiriTurns(dealt5.live, 7) })
const EAST_PON_5 = { type: 'pon', uses: [93, 95] } as const

const dealt15 = foldRecord({ seed: 15, actions: [] })
const mixedWindow15 = foldRecord({ seed: 15, actions: tsumogiriTurns(dealt15.live, 8) })

// Seed 212 — the triplet-holder window (scratchpad-scanned like the others): after six
// tsumogiri turns South discards 103 (8s); EAST holds all three remaining 8s copies
// [100, 102, 101] (hand order), so the window offers East three identical-kind pon
// pairs [100,102]/[100,101]/[102,101] AND the daiminkan [100,102,101] — the positive
// kan anchor -02-01 left open, and the maximal dedupe case in one state. Head is
// WEST's draw.
const dealt212 = foldRecord({ seed: 212, actions: [] })
const kanWindow212 = foldRecord({ seed: 212, actions: tsumogiriTurns(dealt212.live, 6) })
const EAST_KAN_212 = { type: 'daiminkan', uses: [100, 102, 101] } as const

describe('claimChoices', () => {
  it("returns exactly the player's offers, elements of the offered array itself", () => {
    const offered = legalActions(raceWindow3)
    const choices = claimChoices(offered, PLAYER)
    expect(choices).toHaveLength(2) // East's two chi variants; South's pon excluded
    for (const choice of choices) {
      if (choice.type !== 'chi') throw new Error("East's race-window offers are chis")
      expect(choice.seat).toBe(PLAYER)
      // toBe, not toEqual: the choice IS legalActions output, never a lookalike.
      expect(offered).toContain(choice)
    }
    expect(choices.map((c) => (c.type === 'chi' ? c.uses : null))).toEqual([
      EAST_CHI_A.uses,
      EAST_CHI_B.uses,
    ])
  })

  it('preserves the offered (frozen) order across call forms: pon before chis', () => {
    const choices = claimChoices(legalActions(mixedWindow15), PLAYER)
    expect(
      choices.map((c) => (c.type === 'pon' || c.type === 'chi' ? [c.type, ...c.uses] : null)),
    ).toEqual([
      ['pon', 44, 47],
      ['chi', 41, 51],
      ['chi', 51, 55],
    ])
  })

  it('is empty at a bot-only window — the placeholder bots never call', () => {
    // South's chi offer on East's fresh 8s is real (the offering is not a singleton),
    // but none of it belongs to the player.
    expect(legalActions(beforeSouthDraw).length).toBeGreaterThan(1)
    expect(claimChoices(legalActions(beforeSouthDraw), PLAYER)).toEqual([])
  })

  it('is empty at windowless states: fresh deal, post-draw, ended hand', () => {
    expect(claimChoices(legalActions(dealt), PLAYER)).toEqual([])
    expect(claimChoices(legalActions(afterEastDraw), PLAYER)).toEqual([])
    expect(claimChoices(legalActions(exhausted), PLAYER)).toEqual([])
  })
})

describe('promptChoices', () => {
  it('collapses duplicate-copy chi variants to the first offered — one button per meaning', () => {
    // Seed 3: East's two variants are one shape (1p+3p) through different 3p copies —
    // indistinguishable buttons until red fives. The survivor is the enumeration's
    // first, an element of the offered array itself.
    const offered = legalActions(raceWindow3)
    const prompt = promptChoices(offered, PLAYER)
    expect(prompt).toHaveLength(1)
    expect(prompt[0]).toBe(claimChoices(offered, PLAYER)[0])
    expect(prompt[0]).toEqual({ type: 'chi', seat: PLAYER, tile: 42, uses: EAST_CHI_A.uses })
  })

  it('collapses a triplet holder\'s three pon pairs and keeps the kan — distinct forms survive', () => {
    const offered = legalActions(kanWindow212)
    expect(claimChoices(offered, PLAYER)).toHaveLength(4) // 3 pons + 1 daiminkan
    const prompt = promptChoices(offered, PLAYER)
    expect(prompt.map((c) => c.type)).toEqual(['pon', 'daiminkan'])
    expect(prompt[0]).toBe(claimChoices(offered, PLAYER)[0]) // the first pair, [100, 102]
    expect(prompt[1]).toBe(claimChoices(offered, PLAYER)[3])
  })

  it('passes shape-distinct variants and mixed forms through untouched, order preserved', () => {
    // Seed 15: pon + two chis of DIFFERENT shapes — every choice means something
    // different, so the prompt list IS the claim list, same elements, same order.
    const offered = legalActions(mixedWindow15)
    expect(promptChoices(offered, PLAYER)).toEqual(claimChoices(offered, PLAYER))
    promptChoices(offered, PLAYER).forEach((choice, i) => {
      expect(choice).toBe(claimChoices(offered, PLAYER)[i])
    })
  })

  it('is empty exactly where claimChoices is empty — prompt visibility IS the loop\'s wait', () => {
    const anchors = [
      dealt,
      afterEastDraw,
      beforeSouthDraw,
      afterSouthDraw,
      raceWindow3,
      ponWindow5,
      mixedWindow15,
      kanWindow212,
      exhausted,
    ]
    for (const state of anchors) {
      const offered = legalActions(state)
      expect(promptChoices(offered, PLAYER).length === 0).toBe(
        claimChoices(offered, PLAYER).length === 0,
      )
      // And therefore: the prompt shows ⇔ forcedAction waits on a claim (pass exists).
      expect(promptChoices(offered, PLAYER).length > 0).toBe(
        passClaim(offered, PLAYER) !== null,
      )
    }
  })
})

describe('tapClaim', () => {
  it('returns the offered daiminkan itself — the positive kan selection', () => {
    const offered = legalActions(kanWindow212)
    const kan = tapClaim(offered, PLAYER, EAST_KAN_212)
    expect(kan).toBe(claimChoices(offered, PLAYER)[3])
    expect(kan).toEqual({ type: 'daiminkan', seat: PLAYER, tile: 103, uses: [100, 102, 101] })
    // The identical-kind pon pairs stay individually selectable by exact copies.
    expect(tapClaim(offered, PLAYER, { type: 'pon', uses: [102, 101] })).toBe(
      claimChoices(offered, PLAYER)[2],
    )
  })

  it('returns the offered element itself for each chi variant — variants distinguished by uses', () => {
    const offered = legalActions(raceWindow3)
    const [variantA, variantB] = claimChoices(offered, PLAYER)
    expect(tapClaim(offered, PLAYER, EAST_CHI_A)).toBe(variantA)
    expect(tapClaim(offered, PLAYER, EAST_CHI_B)).toBe(variantB)
  })

  it('selects across call forms at a mixed window: the pon and each shape-distinct chi', () => {
    const offered = legalActions(mixedWindow15)
    const [pon, chiLow, chiHigh] = claimChoices(offered, PLAYER)
    expect(tapClaim(offered, PLAYER, { type: 'pon', uses: [44, 47] })).toBe(pon)
    expect(tapClaim(offered, PLAYER, { type: 'chi', uses: [41, 51] })).toBe(chiLow)
    expect(tapClaim(offered, PLAYER, { type: 'chi', uses: [51, 55] })).toBe(chiHigh)
  })

  it("rejects another seat's real offer passed under the player's seat", () => {
    // South's pon [43, 41] IS offered at the race window — but not to the player.
    const offered = legalActions(raceWindow3)
    expect(offered.some((a) => a.type === 'pon' && a.seat === 1)).toBe(true)
    expect(tapClaim(offered, PLAYER, SOUTH_PON_3)).toBeNull()
  })

  it('rejects a claim missing from a doctored list even though the fold would accept it', () => {
    const doctored = legalActions(raceWindow3).filter(
      (a) => !(a.type === 'chi' && a.seat === PLAYER && a.uses[1] === 44),
    )
    expect(tapClaim(doctored, PLAYER, EAST_CHI_B)).toBeNull()
    // The undoctored sibling variant is still selectable — the rejection is per-offer.
    expect(tapClaim(doctored, PLAYER, EAST_CHI_A)).not.toBeNull()
  })

  it('rejects lookalikes: reordered uses, unoffered combinations, wrong call form', () => {
    const offered = legalActions(raceWindow3)
    // Ordered matching is the contract: [high, low] is a lookalike, not a selection.
    expect(tapClaim(offered, PLAYER, { type: 'chi', uses: [47, 37] })).toBeNull()
    expect(tapClaim(offered, PLAYER, { type: 'chi', uses: [37, 43] })).toBeNull()
    expect(tapClaim(offered, PLAYER, { type: 'pon', uses: [44, 47] })).toBeNull()
    expect(tapClaim(offered, PLAYER, { type: 'daiminkan', uses: [37, 44, 47] })).toBeNull()
  })

  it('rejects every claim choice at windowless states', () => {
    for (const state of [dealt, afterEastDraw, exhausted]) {
      expect(tapClaim(legalActions(state), PLAYER, EAST_CHI_A)).toBeNull()
    }
  })
})

describe('passClaim', () => {
  it("returns the head draw — the player's own — at the race window", () => {
    // Declining IS taking the next draw; here the next draw is East's, and taking it
    // is precisely what lets the claim go stale.
    const offered = legalActions(raceWindow3)
    expect(offered[0]).toEqual({ type: 'draw', seat: 0 })
    expect(passClaim(offered, PLAYER)).toBe(offered[0])
  })

  it("returns the head draw — a bot's — when the player's pon sits behind it", () => {
    const offered = legalActions(ponWindow5)
    expect(offered[0]).toEqual({ type: 'draw', seat: 3 })
    expect(passClaim(offered, PLAYER)).toBe(offered[0])
  })

  it('returns null when there is nothing of the player\'s to decline', () => {
    for (const state of [beforeSouthDraw, dealt, afterEastDraw, afterSouthDraw, exhausted]) {
      expect(passClaim(legalActions(state), PLAYER)).toBeNull()
    }
  })

  it('is complementary to forcedAction at every anchored state — exactly one driver applies', () => {
    const anchors = [
      dealt,
      afterEastDraw,
      beforeSouthDraw,
      afterSouthDraw,
      raceWindow3,
      ponWindow5,
      mixedWindow15,
      exhausted,
    ]
    for (const state of anchors) {
      const offered = legalActions(state)
      const forced = forcedAction(offered, PLAYER)
      const pass = passClaim(offered, PLAYER)
      // Never both: the loop cannot race the prompt.
      expect(forced === null || pass === null).toBe(true)
      // The prompt waits ⇔ the player holds a claim offer.
      expect(pass !== null).toBe(claimChoices(offered, PLAYER).length > 0)
      // Both null only at the two tap/halt states: the player's discard, or the end.
      if (forced === null && pass === null) {
        const head = offered[0]
        expect(head === undefined || (head.type === 'discard' && head.seat === PLAYER)).toBe(
          true,
        )
      }
    }
  })
})

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

  it("forces a bot seat's draw through a bot-only window — placeholder bots auto-pass", () => {
    // East's fresh 8s discard is chi-able by South here, so the offering is no longer
    // a singleton — but no offer is the player's, so the draw at the head still wins
    // and the window goes stale.
    const offered = legalActions(beforeSouthDraw)
    expect(offered[0]).toEqual({ type: 'draw', seat: 1 })
    expect(forcedAction(offered, PLAYER)).toBe(offered[0])
  })

  it("waits (null) when the player may claim — even though the head is the player's own draw", () => {
    // The seed-3 geometry: North discarded, the turn advanced to East, and East may
    // chi. Forcing "the player's draw" here would silently pass the player's claim;
    // the claim guard precedes the draw arm for exactly this state.
    const offered = legalActions(raceWindow3)
    expect(offered[0]).toEqual({ type: 'draw', seat: 0 })
    expect(forcedAction(offered, PLAYER)).toBeNull()
  })

  it("waits (null) when the player's pon sits behind a bot's draw obligation", () => {
    const offered = legalActions(ponWindow5)
    expect(offered[0]).toEqual({ type: 'draw', seat: 3 })
    expect(forcedAction(offered, PLAYER)).toBeNull()
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
  it('plays deal → ryuukyoku, the player passing every claim, byte-identical to unclaimed play', () => {
    const actions: HandAction[] = []
    let state = foldRecord({ seed: SEED, actions })
    let passes = 0
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
        const pass = passClaim(offered, PLAYER)
        if (pass !== null) {
          // The player's claim prompt — this walk always declines, so the trajectory
          // is exactly the unclaimed one: the pass IS the head draw the old loop took.
          passes++
          expect(pass).toBe(offered[0])
          next = pass
        } else {
          // The player always taps his first offered tile — a tedashi-shaped choice,
          // exercising hand discards rather than mirroring the bots' tsumogiri.
          const first = offered[0]
          if (first.type !== 'discard') throw new Error('an unforced offering is a discard choice')
          const tapped = tapDiscard(offered, PLAYER, first.tile)
          expect(tapped).toBe(first)
          next = tapped!
        }
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
    // Seed 1 opens exactly two East-claimable windows on this trajectory (both chis
    // on North 7s/5m discards — scratchpad scan, actions #96 and #104): the prompt
    // fired and was declined twice, and nothing else moved.
    expect(passes).toBe(2)
    // 70 discards across the ponds; East and South act on the two extra turns.
    expect(state.ponds.map((pond) => pond.length)).toEqual([18, 18, 17, 17])
  })
})

describe('a claim driven through the seam', () => {
  it('takes the seed-3 chi: call → forced claim discard choice → bots resume', () => {
    const actions: HandAction[] = [...racePrefix3]
    const atWindow = legalActions(foldRecord({ seed: 3, actions }))
    // The prompt is up: the loop waits, the choices are East's two variants.
    expect(forcedAction(atWindow, PLAYER)).toBeNull()
    const chi = tapClaim(atWindow, PLAYER, EAST_CHI_A)
    expect(chi).toBe(claimChoices(atWindow, PLAYER)[0])
    actions.push(chi!)

    // The fold accepts the call: the meld is East's, claimed from North's pond mark.
    const claimed = foldRecord({ seed: 3, actions })
    expect(claimed.melds[PLAYER]).toEqual([
      { type: 'chi', claimed: 42, from: 3, own: [37, 47] },
    ])
    // The claim discard is owed: not forced, not passable — the player's tap only.
    const mustDiscard = legalActions(claimed)
    expect(forcedAction(mustDiscard, PLAYER)).toBeNull()
    expect(passClaim(mustDiscard, PLAYER)).toBeNull()
    const out = tapDiscard(mustDiscard, PLAYER, claimed.hands[PLAYER][0])
    expect(out).toBe(mustDiscard[0])
    actions.push(out!)

    // Play resumes without player input: the next seat's draw is forced again.
    const resumed = legalActions(foldRecord({ seed: 3, actions }))
    const forced = forcedAction(resumed, PLAYER)
    expect(forced).not.toBeNull()
    expect(resumed).toContain(forced)
  })
})
