// The AC's app test: the tap handlers and the auto-advance loop build actions via
// legalActions rather than computing legality locally — and, since T-006-03-03, the
// three non-PLAYER seats decide through core's policy pair instead of the tsumogiri/
// auto-pass placeholder. The teeth are identity and the doctored list — a returned
// action IS an element of the offered array (toBe, not shape), and an offer removed
// from the list is rejected (and a removed bot offer never consulted) even though
// the fold would accept it — plus double-keying for every bot expectation: a frozen
// literal AND an independent oracle (the policy's own answer over a fresh seatView
// projection, or shanten re-derivation), the policy sweep's convention. forcedAction
// waits (null) exactly when the PLAYER holds a claim or win offer; bot-only windows
// settle through callPolicy (claims taken when the accept rule passes, rons always,
// declines letting the window go stale); bot turns discard by policy — tedashi, not
// tsumogiri — and take their tsumo. settleWindow is the one arbitration where the
// player's tap joins the bots' answers by offered position (the rules' precedence).
// The walks integrate all of it deal → end through the same functions App.svelte runs.

import { describe, expect, it } from 'vitest'
import {
  callPolicy,
  discardPolicy,
  foldGame,
  foldRecord,
  handSeedOf,
  kindOf,
  legalActions,
  parseGameRecord,
  seatView,
  serializeGameRecord,
  shanten,
  type HandAction,
  type TileId,
} from '../core'
import {
  buildIssueUrl,
  buildReportText,
  claimChoices,
  claimWindowInterrupts,
  forcedAction,
  GITHUB_REPO,
  loadPastedRecord,
  MAX_ISSUE_URL_LENGTH,
  PLAYER,
  ownKanChoices,
  promptChoices,
  riichiPrompt,
  seatScoresOf,
  settleWindow,
  tapClaim,
  tapDiscard,
  tenpaiHint,
  winChoice,
  windowOutcome,
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

// ——— Frozen win anchors (probe-mined like the claim windows, cross-checked at
// capture against the derivation stack — isAgari/waits/yakuOf — never against
// legalActions itself; never regenerate). Seat 0's dealt tenpai runs ~1/8000, so
// the seeds are large. Under all-tsumogiri the 13-tile hand never changes, and
// each anchor is its seed's FIRST win event, so nothing fires earlier.
// Seed 542630 — EAST dealt tenpai, pinfu, waits 6p/9p; no wait kind surfaces in
// live[0..31], so turn 32 — East's own draw live[32] = 69 (9p) — is the tsumo
// point: offered at index 14 behind the 14 discards, yaku [menzen-tsumo, pinfu].
// Seed 887141 — EAST dealt tenpai waiting 5m/8m with TWO 8m copies in hand: turn 3
// (North tsumogiri live[3] = 31, 8m) opens a window offering East the ron AND the
// pon [30, 28] AND eight chi variants (two shapes) — a win and claims in one
// prompt, with EAST'S OWN draw at the head (the race geometry again, now with a
// win at stake). The ron folds to yaku [pinfu, iipeikou].
// Seed 362857 — EAST dealt tenpai waiting 5m (yakuhai-chun): turn 26 (West
// tsumogiri live[26] = 19, 5m) opens a window whose offering is exactly
// [draw seat 3, ron seat 0] — a ron-ONLY window behind a BOT's draw obligation:
// the auto-pass regression anchor (a claim-only wait guard forces the head draw
// here, silently passing the player's ron).
// Seed 1038928 — houtei: the final discard (turn 69, South, live[69] = 21, 6m)
// completes East's chiitoitsu — the ryuukyoku offering is exactly [ron seat 0]:
// no draw at the head, nothing for a pass to build.
const TSUMO_SEED = 542630
const dealtTsumo = foldRecord({ seed: TSUMO_SEED, actions: [] })
const tsumoPointPrefix: readonly HandAction[] = [
  ...tsumogiriTurns(dealtTsumo.live, 32),
  { type: 'draw', seat: 0 },
]
const tsumoPoint = foldRecord({ seed: TSUMO_SEED, actions: [...tsumoPointPrefix] })

const SHANPON_SEED = 887141
const dealtShanpon = foldRecord({ seed: SHANPON_SEED, actions: [] })
const shanponPrefix: readonly HandAction[] = tsumogiriTurns(dealtShanpon.live, 4)
const shanponWindow = foldRecord({ seed: SHANPON_SEED, actions: [...shanponPrefix] })

const RON_ONLY_SEED = 362857
const dealtRonOnly = foldRecord({ seed: RON_ONLY_SEED, actions: [] })
const ronOnlyWindow = foldRecord({
  seed: RON_ONLY_SEED,
  actions: tsumogiriTurns(dealtRonOnly.live, 27),
})

const HOUTEI_SEED = 1038928
const dealtHoutei = foldRecord({ seed: HOUTEI_SEED, actions: [] })
const houteiEnd = foldRecord({ seed: HOUTEI_SEED, actions: tsumogiriTurns(dealtHoutei.live, 70) })

// Core's own frozen bot-win anchors (legal.win.test.ts geometries), through the
// player lens: seed 3951 turn 0 — seat 0 tsumogiris live[0] = 72 (1s) and SEAT 3
// rons it; the window is real, but none of it is East's. Seed 23798 turn 20 — the
// furiten anchor: seat 1's ron on the 9p window is withheld by the furiten gate.
// Seed 12754 turn 1 — the yakuless anchor: seat 2's completion carries no yaku.
function dealtLive(seed: number): readonly TileId[] {
  return foldRecord({ seed, actions: [] }).live
}
const botRonWindow = foldRecord({ seed: 3951, actions: tsumogiriTurns(dealtLive(3951), 1) })
const furitenWindow = foldRecord({ seed: 23798, actions: tsumogiriTurns(dealtLive(23798), 21) })
const yakulessWindow = foldRecord({ seed: 12754, actions: tsumogiriTurns(dealtLive(12754), 2) })

// The riichi-prompt anchor (T-009-03-01, scratchpad-scanned — never regenerate): seed
// 397, East's own opening draw (turn 0, before any other seat has moved) lands the
// dealer's 14-tile hand at exactly ONE tenpai-preserving discard — tile 130 (6z,
// hatsu) — a lone honor with no other copy in hand. `discardPolicy` independently
// agrees (its own shanten-minimizing tie-break lands on the identical tile), which is
// this anchor's whole point: it is NOT merely "the first riichi offer," it is also
// the recommendation an own-turn bot would make.
const RIICHI_SEED = 397
const riichiPoint = foldRecord({ seed: RIICHI_SEED, actions: [{ type: 'draw', seat: 0 }] })
const RIICHI_TILE: TileId = 130

// seatScoresOf (T-008-03-02) — the one place a game's dealer rotation becomes
// visible in the UI at all under this ticket's scope (PLAYER stays pinned at
// engine Seat 0 every hand; Table's wind labels are fixed to engine Seat, never
// to a persistent Player — design.md Decision 2/3). This is a pure remap, so it
// gets exact, fast unit coverage here rather than only through the slow,
// imprecise full-App integration drive (app.controls.svelte.test.ts).
describe('seatScoresOf', () => {
  const SCORES: readonly [number, number, number, number] = [10000, 20000, 30000, 40000]

  it('is the identity when the dealer is Player 0 — the un-rotated case', () => {
    expect(seatScoresOf(SCORES, 0)).toEqual([10000, 20000, 30000, 40000])
  })

  it('remaps by playerOfSeat once the dealer has rotated: seat s holds Player (dealer+s)%4', () => {
    // dealer=1: engine Seat 0 is Player 1, Seat 1 is Player 2, Seat 2 is Player 3,
    // Seat 3 wraps back to Player 0 — hand-verified against game.ts's own
    // playerOfSeat formula (research.md §3), not re-derived here.
    expect(seatScoresOf(SCORES, 1)).toEqual([20000, 30000, 40000, 10000])
    // dealer=3: Seat 0 is Player 3, then wraps 0, 1, 2.
    expect(seatScoresOf(SCORES, 3)).toEqual([40000, 10000, 20000, 30000])
  })

  it('is a permutation for every dealer — sum conserved, every value present exactly once', () => {
    for (const dealer of [0, 1, 2, 3] as const) {
      const remapped = seatScoresOf(SCORES, dealer)
      expect(remapped.reduce((a, b) => a + b, 0)).toBe(100000)
      expect([...remapped].sort((a, b) => a - b)).toEqual([...SCORES].sort((a, b) => a - b))
    }
  })
})

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
      // And therefore: wherever the prompt shows, the loop waits — the prompt owns
      // the state, and only its taps (through settleWindow) may resolve it.
      if (promptChoices(offered, PLAYER).length > 0) {
        expect(forcedAction(state, offered, PLAYER, true)).toBeNull()
      }
    }
  })
})

// T-012-01-02: the fourth member of the "one predicate family" — whether a claim
// window interrupts with a prompt at all. Every fixture below is cross-checked
// directly against callPolicy (never a hardcoded true/false), the double-keyed
// oracle convention this file uses throughout.
describe('claimWindowInterrupts', () => {
  it('is false at every windowless state, without ever invoking callPolicy (it would throw)', () => {
    for (const state of [dealt, afterEastDraw, beforeSouthDraw, afterSouthDraw, exhausted]) {
      const offered = legalActions(state)
      expect(claimWindowInterrupts(state, offered, PLAYER, false)).toBe(false)
      expect(claimWindowInterrupts(state, offered, PLAYER, true)).toBe(false)
    }
  })

  it('is false by default at a window callPolicy would decline every offer of (seed 3)', () => {
    const offered = legalActions(raceWindow3)
    expect(claimChoices(offered, PLAYER).length).toBeGreaterThan(0)
    expect(callPolicy(seatView(raceWindow3, PLAYER), offered).type).toBe('draw')
    expect(claimWindowInterrupts(raceWindow3, offered, PLAYER, false)).toBe(false)
  })

  it('the toggle restores true regardless of the policy verdict, at the same declined window', () => {
    const offered = legalActions(raceWindow3)
    expect(claimWindowInterrupts(raceWindow3, offered, PLAYER, true)).toBe(true)
  })

  it('is true by default at a window callPolicy would accept an offer of (seed 212, the kan anchor)', () => {
    const offered = legalActions(kanWindow212)
    expect(callPolicy(seatView(kanWindow212, PLAYER), offered).type).not.toBe('draw')
    expect(claimWindowInterrupts(kanWindow212, offered, PLAYER, false)).toBe(true)
    expect(claimWindowInterrupts(kanWindow212, offered, PLAYER, true)).toBe(true)
  })

  it('quiet mode never hides a pon/kan window, whatever the policy verdict (owner report #5)', () => {
    // A held pair meeting its third tile is deliberate — the player's plan (toitoi,
    // a yakuhai pair) may be one the bot heuristic doesn't credit. Only chi-only
    // windows stay policy-gated; raceWindow3 above pins that half.
    const offered = legalActions(mixedWindow15)
    expect(claimChoices(offered, PLAYER).some((c) => c.type === 'pon')).toBe(true)
    expect(claimWindowInterrupts(mixedWindow15, offered, PLAYER, false)).toBe(true)
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

describe('settleWindow', () => {
  it("resolves the player's decline to an accepting bot's claim — seed 3: South's pon", () => {
    const offered = legalActions(raceWindow3)
    const settled = settleWindow(raceWindow3, offered, PLAYER, null)
    // Frozen (mined): South's pon strictly cuts its shanten and keeps a yaku
    // anchor, so the accept rule takes it — the window does not go stale.
    expect(settled).toEqual({ type: 'pon', seat: 1, tile: 42, uses: SOUTH_PON_3.uses })
    expect(offered).toContain(settled) // identity: an element, never a lookalike
    // Oracle: the settled element IS South's own callPolicy answer, by reference.
    expect(settled).toBe(callPolicy(seatView(raceWindow3, 1), offered))
  })

  it("outranks the player's tapped chi with the bot's pon — offered position is precedence", () => {
    const offered = legalActions(raceWindow3)
    const chi = tapClaim(offered, PLAYER, EAST_CHI_A)!
    const settled = settleWindow(raceWindow3, offered, PLAYER, chi)
    expect(settled).not.toBe(chi)
    expect(settled).toMatchObject({ type: 'pon', seat: 1 })
    // The winner sits earlier in the frozen order — pons before chis, per legal.ts.
    expect(offered.indexOf(settled!)).toBeLessThan(offered.indexOf(chi))
  })

  it('folds the player claim itself when no bot holds an offer — seed 15, the pure player window', () => {
    const offered = legalActions(mixedWindow15)
    // Mined: every ron/claim offer at this window is East's own.
    expect(
      offered.some(
        (a) =>
          (a.type === 'ron' || a.type === 'chi' || a.type === 'pon' || a.type === 'daiminkan') &&
          a.seat !== PLAYER,
      ),
    ).toBe(false)
    const pon = tapClaim(offered, PLAYER, { type: 'pon', uses: [44, 47] })!
    expect(settleWindow(mixedWindow15, offered, PLAYER, pon)).toBe(pon)
  })

  it('returns the head draw when the player and every consulted bot decline — seed 5', () => {
    const offered = legalActions(ponWindow5)
    expect(offered[0]).toEqual({ type: 'draw', seat: 3 })
    // Oracle: North's four chi variants all fail the accept rule (mined) — its own
    // callPolicy answer is the decline, the offered draw.
    expect(callPolicy(seatView(ponWindow5, 3), offered)).toBe(offered[0])
    expect(settleWindow(ponWindow5, offered, PLAYER, null)).toBe(offered[0])
  })

  it('settles the tsumo to itself — no window, no bot offers, the degenerate arbitration', () => {
    const offered = legalActions(tsumoPoint)
    const win = winChoice(offered, PLAYER)!
    expect(settleWindow(tsumoPoint, offered, PLAYER, win)).toBe(win)
  })

  it('settles the shanpon ron to itself and its decline to the head draw', () => {
    const offered = legalActions(shanponWindow) // no bot offers here (mined)
    const win = winChoice(offered, PLAYER)!
    expect(settleWindow(shanponWindow, offered, PLAYER, win)).toBe(win)
    // Declining the ron AND the coexisting claims is the one head draw — East's own.
    expect(shanponWindow.drawn).toBeNull()
    expect(settleWindow(shanponWindow, offered, PLAYER, null)).toBe(offered[0])
    // The ron-only window declines the same way: into the bot's head draw.
    const ronOnly = legalActions(ronOnlyWindow)
    expect(settleWindow(ronOnlyWindow, ronOnly, PLAYER, null)).toBe(ronOnly[0])
  })

  it('returns null at the declined player-only houtei — the dismissal — and the ron when taken', () => {
    const offered = legalActions(houteiEnd)
    // No draw exists to decline into: nothing to fold, the prompt owner dismisses.
    expect(settleWindow(houteiEnd, offered, PLAYER, null)).toBeNull()
    const ron = winChoice(offered, PLAYER)!
    expect(settleWindow(houteiEnd, offered, PLAYER, ron)).toBe(ron)
  })

  it('returns null where nothing is declinable — windowless states (the old pass geometry)', () => {
    for (const state of [dealt, afterEastDraw, afterSouthDraw, exhausted]) {
      expect(settleWindow(state, legalActions(state), PLAYER, null)).toBeNull()
    }
    // Declining a tsumo IS discarding — the tap surface is live; nothing settles.
    expect(settleWindow(tsumoPoint, legalActions(tsumoPoint), PLAYER, null)).toBeNull()
  })

  it('never consults a doctored-away bot offer — the accept comes from nowhere but the list', () => {
    const offered = legalActions(raceWindow3)
    const doctored = offered.filter((a) => !(a.type === 'pon' && a.seat === 1))
    // With South's pon gone from the list, the decline settles to the head draw
    // even though the fold would accept the pon (it is this window's whole point).
    expect(settleWindow(raceWindow3, doctored, PLAYER, null)).toBe(doctored[0])
    // And the player's chi now wins the window it loses with the pon present.
    const chi = tapClaim(doctored, PLAYER, EAST_CHI_A)!
    expect(settleWindow(raceWindow3, doctored, PLAYER, chi)).toBe(chi)
  })

  it('ignores a lookalike chosen — only elements of the offered list settle', () => {
    const offered = legalActions(mixedWindow15)
    const pon = tapClaim(offered, PLAYER, { type: 'pon', uses: [44, 47] })!
    const lookalike: HandAction = { ...pon }
    // Shape-equal to the offered pon but not the element itself: ignored, and the
    // decline path settles instead (the head draw — the player held offers).
    expect(settleWindow(mixedWindow15, offered, PLAYER, lookalike)).toBe(offered[0])
  })

  it('is complementary to forcedAction at every anchored state — the loop never races the prompt', () => {
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
      tsumoPoint,
      shanponWindow,
      ronOnlyWindow,
      houteiEnd,
      botRonWindow,
      furitenWindow,
      yakulessWindow,
    ]
    for (const state of anchors) {
      const offered = legalActions(state)
      const forced = forcedAction(state, offered, PLAYER, true)
      const prompts =
        claimChoices(offered, PLAYER).length > 0 || winChoice(offered, PLAYER) !== null
      // The prompt up ⇒ the loop waits; its taps and its decline own the state.
      expect(forced === null || !prompts).toBe(true)
      // The prompt's decline always resolves — a fold, or the houtei dismissal.
      if (prompts) {
        const declined = settleWindow(state, offered, PLAYER, null)
        expect(declined === null).toBe(offered[0]?.type !== 'draw')
        if (declined !== null) expect(offered).toContain(declined)
      }
      // Neither driver ⇒ a tap or halt state: the player's discard choice (the
      // tsumo point included — its decline IS a discard tap) or the ended hand.
      if (forced === null && !prompts) {
        const head = offered[0]
        expect(
          head === undefined || (head.type === 'discard' && head.seat === PLAYER),
        ).toBe(true)
      }
    }
  })
})

describe('windowOutcome', () => {
  it("names South and pon as the winner when the player's tapped chi loses — seed 3", () => {
    const offered = legalActions(raceWindow3)
    const chi = tapClaim(offered, PLAYER, EAST_CHI_A)!
    const settled = settleWindow(raceWindow3, offered, PLAYER, chi)
    expect(windowOutcome(chi, settled)).toEqual({ winner: 1, winnerType: 'pon', playerType: 'chi' })
  })

  it("returns null when the player's own tap wins the window outright — seed 15", () => {
    const offered = legalActions(mixedWindow15)
    const pon = tapClaim(offered, PLAYER, { type: 'pon', uses: [44, 47] })!
    const settled = settleWindow(mixedWindow15, offered, PLAYER, pon)
    expect(windowOutcome(pon, settled)).toBeNull()
  })

  it('returns null when the tsumo settles to itself — no bot offer coexists with a tsumo point', () => {
    const offered = legalActions(tsumoPoint)
    const win = winChoice(offered, PLAYER)!
    expect(windowOutcome(win, settleWindow(tsumoPoint, offered, PLAYER, win))).toBeNull()
  })

  it('returns null when settled is null — the declined-window/houtei-dismissal shape', () => {
    const offered = legalActions(houteiEnd)
    const ron = winChoice(offered, PLAYER)!
    expect(windowOutcome(ron, null)).toBeNull()
  })

  // T-011-02-03: the two remaining named call-type combinations (the epic's own
  // "chi/pon/ron" AC wording) — chi-loses-to-pon is already covered above (seed 3).
  it("names South and ron as the winner when the player's tapped pon loses — mined game seed 2654435812 (core seed 85)", () => {
    // Verbatim the two HandAction values window-outcome-notice.tap.svelte.test.ts's
    // own "the pon/ron window ends the hand" fixture actually produces at its
    // 78-action mark (cross-checked, not independently invented) — South's ron on
    // 3s (tile 82) outranks the player's pon [83, 80] on the same tile.
    const chosen: HandAction = { type: 'pon', seat: PLAYER, tile: 82, uses: [83, 80] }
    const settled: HandAction = { type: 'ron', seat: 1, tile: 82 }
    expect(windowOutcome(chosen, settled)).toEqual({ winner: 1, winnerType: 'ron', playerType: 'pon' })
  })

  it("names the winner as ron when the player's own tapped ron loses the atamahane (head-bump) — synthetic, no fixture", () => {
    // windowOutcome is a pure comparison of two already-built HandAction values
    // (see its own header) — it never touches the fold, so this is a legitimate,
    // fixture-free unit case for the one combination this ticket does NOT mine an
    // interactive fixture for (design.md Decision 5): two simultaneous ron offers
    // on the same discard, the player's own not the earliest in rotation order.
    const chosen: HandAction = { type: 'ron', seat: PLAYER, tile: 55 }
    const settled: HandAction = { type: 'ron', seat: 2, tile: 55 }
    expect(windowOutcome(chosen, settled)).toEqual({ winner: 2, winnerType: 'ron', playerType: 'ron' })
  })
})

describe('winChoice', () => {
  it('returns the tsumo offer itself at the tsumo point — offered index 28, behind the discards and riichi offers', () => {
    const offered = legalActions(tsumoPoint)
    const win = winChoice(offered, PLAYER)
    // toBe, not toEqual: the choice IS legalActions output, never a lookalike.
    // T-009-01-01: every one of the 14 discard candidates here also leaves this
    // hand at tenpai, so 14 riichi offers now sit between the discards and the
    // win (14 discards + 14 riichi + the win, index 28) — re-verified against
    // legalActions directly, not hand-derived; never regenerate by hand.
    expect(win).toBe(offered[28])
    expect(win).toEqual({ type: 'tsumo', seat: PLAYER })
  })

  it('returns the ron itself at the ron-only window', () => {
    const offered = legalActions(ronOnlyWindow)
    expect(offered).toEqual([
      { type: 'draw', seat: 3 },
      { type: 'ron', seat: PLAYER, tile: 19 },
    ])
    expect(winChoice(offered, PLAYER)).toBe(offered[1])
  })

  it('returns the ron beside live claim offers — a win and calls in one window', () => {
    const offered = legalActions(shanponWindow)
    const win = winChoice(offered, PLAYER)
    expect(win).toBe(offered[1]) // draw at the head, the ron right behind it
    expect(win).toEqual({ type: 'ron', seat: PLAYER, tile: 31 })
    // The claim family stays claims-only: the shanpon pon and the chis are there,
    // the ron is NOT among them — the two selector families partition the offers.
    const claims = claimChoices(offered, PLAYER)
    expect(claims.length).toBeGreaterThan(0)
    expect(claims.every((c) => c.type !== 'ron')).toBe(true)
    expect(tapClaim(offered, PLAYER, { type: 'pon', uses: [30, 28] })).toBe(claims[0])
  })

  it('returns the houtei ron at a ryuukyoku offering', () => {
    expect(houteiEnd.phase).toBe('ryuukyoku')
    const offered = legalActions(houteiEnd)
    expect(offered).toEqual([{ type: 'ron', seat: PLAYER, tile: 21 }])
    expect(winChoice(offered, PLAYER)).toBe(offered[0])
  })

  it('is null for the player at every windowless and claim-only anchor', () => {
    for (const state of [
      dealt,
      afterEastDraw,
      beforeSouthDraw,
      afterSouthDraw,
      raceWindow3,
      ponWindow5,
      mixedWindow15,
      kanWindow212,
      exhausted,
    ]) {
      expect(winChoice(legalActions(state), PLAYER)).toBeNull()
    }
  })

  it("is null for the player at a BOT's win window — seat-scoped; the loop folds the bot's ron", () => {
    const offered = legalActions(botRonWindow)
    // The offer is real — for seat 3. Through the player lens there is nothing.
    expect(winChoice(offered, 3)).toEqual({ type: 'ron', seat: 3, tile: 72 })
    expect(winChoice(offered, PLAYER)).toBeNull()
    // And the loop takes it: a bot never declines its ron (callPolicy's first arm).
    expect(forcedAction(botRonWindow, offered, PLAYER, true)).toBe(offered[1])
  })

  it('is null where core withholds the offer: furiten and yakuless completions', () => {
    // Never when furiten: seat 1's 9p ron (seed 23798) completes with pinfu, but
    // its own pond holds its 6p wait — no offer, so no prompt, on any seat's lens.
    const furitenOffered = legalActions(furitenWindow)
    expect(furitenOffered.some((a) => a.type === 'ron')).toBe(false)
    expect(winChoice(furitenOffered, 1)).toBeNull()
    // Never when yakuless: seat 2's completion (seed 12754) carries no yaku.
    const yakulessOffered = legalActions(yakulessWindow)
    expect(yakulessOffered.some((a) => a.type === 'ron')).toBe(false)
    expect(winChoice(yakulessOffered, 2)).toBeNull()
  })

  it('rejects a win removed from a doctored list even though the fold would accept it', () => {
    const doctored = legalActions(ronOnlyWindow).filter((a) => a.type !== 'ron')
    expect(winChoice(doctored, PLAYER)).toBeNull()
    // The legality is coming from nowhere but the list: the fold WOULD accept the
    // ron (it is this anchor's whole point), but the seam can no longer build it.
  })
})

describe('riichiPrompt', () => {
  it('resolves the one tenpai-preserving tile at the RIICHI_SEED anchor — declare and decline both elements of offered', () => {
    const offered = legalActions(riichiPoint)
    const riichiOffers = offered.filter((a) => a.type === 'riichi')
    expect(riichiOffers).toEqual([{ type: 'riichi', seat: PLAYER, tile: RIICHI_TILE }])
    const found = riichiPrompt(riichiPoint, offered, PLAYER)
    expect(found).not.toBeNull()
    expect(found!.tile).toBe(RIICHI_TILE)
    // toBe, not toEqual: both fold targets ARE legalActions output, never lookalikes.
    expect(found!.declare).toBe(riichiOffers[0])
    expect(found!.decline).toBe(
      offered.find((a) => a.type === 'discard' && a.tile === RIICHI_TILE),
    )
    expect(found!.declare).toEqual({ type: 'riichi', seat: PLAYER, tile: RIICHI_TILE })
    expect(found!.decline).toEqual({ type: 'discard', seat: PLAYER, tile: RIICHI_TILE })
    // Independent oracle: discardPolicy's own answer over the same view agrees —
    // the prompt's tile is never a different one than the AI itself would play.
    expect(discardPolicy(seatView(riichiPoint, PLAYER), offered)).toEqual(found!.declare)
  })

  it('is null wherever no riichi offer exists for the player', () => {
    for (const state of [dealt, afterEastDraw, beforeSouthDraw, afterSouthDraw, exhausted]) {
      expect(riichiPrompt(state, legalActions(state), PLAYER)).toBeNull()
    }
  })

  it('is null when a win is offered too — the win prompt owns that moment, not this one', () => {
    // The tsumoPoint anchor (winChoice's own fixture): every one of the 14 discard
    // candidates also leaves this hand at tenpai, so 14 riichi offers sit alongside
    // the tsumo — riichiPrompt defers to winChoice rather than naming a tile here.
    const offered = legalActions(tsumoPoint)
    expect(offered.filter((a) => a.type === 'riichi').length).toBe(14)
    expect(winChoice(offered, PLAYER)).not.toBeNull()
    expect(riichiPrompt(tsumoPoint, offered, PLAYER)).toBeNull()
  })

  it('rejects a riichi offer removed from a doctored list even though the fold would accept it', () => {
    const doctored = legalActions(riichiPoint).filter((a) => a.type !== 'riichi')
    expect(riichiPrompt(riichiPoint, doctored, PLAYER)).toBeNull()
  })
})

describe('tenpaiHint', () => {
  it('reads the fold-derived shanten count at a real mid-hand, pre-tenpai point', () => {
    // The app.ssr.test.ts "mid-hand table view" anchor, verbatim: 8 tsumogiri turns
    // with East's first discard swapped to tedashi, then a pending 9th draw by East.
    const midHandActions = tsumogiriTurns(dealt.live, 8)
    midHandActions[1] = { type: 'discard', seat: 0, tile: dealt.hands[0][0] }
    midHandActions.push({ type: 'draw', seat: 0 })
    const midHand = foldRecord({ seed: SEED, actions: midHandActions })
    expect(midHand.riichi[0]).toBe(false)
    const hint = tenpaiHint(seatView(midHand, PLAYER))
    // Independent oracle: shanten itself, over the identical 14-tile arity.
    expect(hint).toBe(shanten([...midHand.hands[0], midHand.drawn!].map(kindOf), []))
    expect(hint).toBe(2)
  })

  it('is null before this seat holds a draw — nothing to hint between turns', () => {
    expect(tenpaiHint(seatView(dealt, PLAYER))).toBeNull()
    expect(tenpaiHint(seatView(beforeSouthDraw, 1))).toBeNull()
  })

  it('is 0 at tenpai (the console may say so when no riichi prompt owns the moment) and null at completion', () => {
    // Owner report #4: an OPEN tenpai hand gets no riichi prompt, so 0 must reach the
    // console rather than vanish. Closed hands still see the riichi prompt first —
    // App's cascade, not this selector, owns that preference.
    expect(tenpaiHint(seatView(riichiPoint, PLAYER))).toBe(0) // shanten 0
    expect(tenpaiHint(seatView(tsumoPoint, PLAYER))).toBeNull() // shanten -1, complete
  })

  it('is null once this seat is locked into riichi — forced tsumogiri, nothing left to hint', () => {
    const live397 = foldRecord({ seed: RIICHI_SEED, actions: [] }).live
    const locked = foldRecord({
      seed: RIICHI_SEED,
      actions: [
        { type: 'draw', seat: 0 },
        { type: 'riichi', seat: 0, tile: RIICHI_TILE },
        { type: 'draw', seat: 1 },
        { type: 'discard', seat: 1, tile: live397[1] },
        { type: 'draw', seat: 2 },
        { type: 'discard', seat: 2, tile: live397[2] },
        { type: 'draw', seat: 3 },
        { type: 'discard', seat: 3, tile: live397[3] },
        { type: 'draw', seat: 0 },
      ],
    })
    expect(locked.riichi[0]).toBe(true)
    expect(tenpaiHint(seatView(locked, PLAYER))).toBeNull()
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
    expect(forcedAction(dealt, offered, PLAYER, true)).toBe(offered[0])
  })

  it('settles a bot-only window whose consulted bot declines — the draw is forced, the window stales', () => {
    // East's fresh 8s discard is chi-able by South here, so the offering is no
    // longer a singleton — but the accept rule declines the chi (mined), so the
    // settle falls to the head draw: the decline doctrine, now a decision rather
    // than the placeholder's blanket auto-pass.
    const offered = legalActions(beforeSouthDraw)
    expect(offered[0]).toEqual({ type: 'draw', seat: 1 })
    // Oracle: South's own callPolicy answer is the decline (the offered draw).
    expect(callPolicy(seatView(beforeSouthDraw, 1), offered)).toBe(offered[0])
    expect(forcedAction(beforeSouthDraw, offered, PLAYER, true)).toBe(offered[0])
  })

  it('waits (null) when the player may claim — even though a bot claim is accepted behind the prompt', () => {
    // Seed 3 holds offers for BOTH sides (East's chis, South's pon — an accept,
    // mined): the player guard precedes the bot settle, so the state waits, and
    // South's pon folds only through the prompt's answer (the settleWindow suite).
    const offered = legalActions(raceWindow3)
    expect(offered[0]).toEqual({ type: 'draw', seat: 0 })
    expect(forcedAction(raceWindow3, offered, PLAYER, true)).toBeNull()
  })

  it("waits (null) when the player's pon sits behind a bot's draw obligation", () => {
    const offered = legalActions(ponWindow5)
    expect(offered[0]).toEqual({ type: 'draw', seat: 3 })
    expect(forcedAction(ponWindow5, offered, PLAYER, true)).toBeNull()
  })

  // T-012-01-02: the SAME seed-3 window as the "waits (null)" case just above,
  // contrasted at promptEveryLegalCall: false — callPolicy declines both of the
  // player's own chi variants (claimWindowInterrupts's own describe block), so the
  // window is no longer interrupt-worthy for the player, and settles immediately
  // to whatever the bots' own answers resolve to (South's pon here) — the EXACT
  // action settleWindow(state, offered, PLAYER, null) independently computes, never
  // a hardcoded literal (this file's double-keyed-oracle convention).
  it('auto-settles (non-null) a window the player could claim, once policy declines every player offer and the toggle is off', () => {
    const offered = legalActions(raceWindow3)
    expect(callPolicy(seatView(raceWindow3, PLAYER), offered).type).toBe('draw')
    const oracle = settleWindow(raceWindow3, offered, PLAYER, null)
    expect(oracle).not.toBeNull()
    expect(forcedAction(raceWindow3, offered, PLAYER, false)).toBe(oracle)
    // The unfiltered toggle still waits at the identical state — the two calls
    // differ ONLY in the 4th argument.
    expect(forcedAction(raceWindow3, offered, PLAYER, true)).toBeNull()
  })

  it("routes a bot's discard obligation to discardPolicy — a tedashi, not tsumogiri", () => {
    const offered = legalActions(afterSouthDraw)
    const forced = forcedAction(afterSouthDraw, offered, PLAYER, true)
    // Identity with the policy's own choice over South's projected view.
    expect(forced).toBe(discardPolicy(seatView(afterSouthDraw, 1), offered))
    if (forced?.type !== 'discard') throw new Error('a bot mid-turn forces a discard')
    // Frozen (mined): tile 120 — a HAND tile, not the drawn 60. The placeholder's
    // tsumogiri is gone: the drawn tile ties at shanten 3 but loses the
    // center-distance tie-break.
    expect(forced.tile).toBe(120)
    expect(forced.tile).not.toBe(afterSouthDraw.drawn)
    // Oracle: no offered discard beats the chosen one's resulting shanten.
    const pool = [...afterSouthDraw.hands[1], afterSouthDraw.drawn!]
    const after = (tile: TileId) =>
      shanten(pool.filter((t) => t !== tile).map(kindOf), afterSouthDraw.melds[1])
    const discards = offered.filter(
      (a): a is Extract<HandAction, { type: 'discard' }> => a.type === 'discard',
    )
    expect(after(forced.tile)).toBe(Math.min(...discards.map((a) => after(a.tile))))
  })

  it("never forces the player's discard — that is the tap's choice", () => {
    expect(forcedAction(afterEastDraw, legalActions(afterEastDraw), PLAYER, true)).toBeNull()
  })

  it('returns null on the empty offering of an ended hand — the halt condition', () => {
    expect(legalActions(exhausted)).toEqual([])
    expect(forcedAction(exhausted, [], PLAYER, true)).toBeNull()
  })

  it("waits (null) at a ron-ONLY window behind a bot's draw — the auto-pass regression", () => {
    // Seed 362857: no claim offer exists, so a claim-only wait guard sees a
    // "bot-only" window and forces the head draw — silently passing the player's
    // ron after the timer. The win guard is what makes this state wait.
    const offered = legalActions(ronOnlyWindow)
    expect(offered[0]).toEqual({ type: 'draw', seat: 3 })
    expect(claimChoices(offered, PLAYER)).toEqual([])
    expect(forcedAction(ronOnlyWindow, offered, PLAYER, true)).toBeNull()
  })

  it("waits (null) at the shanpon window — a win and claims behind the player's own draw", () => {
    const offered = legalActions(shanponWindow)
    expect(offered[0]).toEqual({ type: 'draw', seat: 0 })
    expect(forcedAction(shanponWindow, offered, PLAYER, true)).toBeNull()
  })

  it('waits (null) at the tsumo point — the discard choice and the win are both taps', () => {
    expect(forcedAction(tsumoPoint, legalActions(tsumoPoint), PLAYER, true)).toBeNull()
  })

  it("waits (null) at the player's houtei; folds a BOT's houtei ron — the carve-out win", () => {
    // The player's: the guard owns it (rons-only offering, his among them).
    expect(forcedAction(houteiEnd, legalActions(houteiEnd), PLAYER, true)).toBeNull()
    // A bot's: seed 147508 (core's houtei anchor, seat 3 wins). The placeholder
    // rested the hand here; a bot never declines its offered ron, so the loop now
    // folds the win out of the ended hand.
    const prefix = tsumogiriTurns(dealtLive(147508), 70)
    const botHoutei = foldRecord({ seed: 147508, actions: prefix })
    expect(botHoutei.phase).toBe('ryuukyoku')
    const offered = legalActions(botHoutei)
    expect(offered).toHaveLength(1)
    expect(offered[0]).toEqual({ type: 'ron', seat: 3, tile: 43 })
    expect(winChoice(offered, PLAYER)).toBeNull()
    expect(forcedAction(botHoutei, offered, PLAYER, true)).toBe(offered[0])
    // And the fold accepts the settled ron into agari — the hand does not rest.
    const won = foldRecord({ seed: 147508, actions: [...prefix, offered[0]] })
    expect(won.phase).toBe('agari')
    expect(won.win?.winner).toBe(3)
  })

  it("folds a bot's window ron immediately — no player offer, no wait", () => {
    const offered = legalActions(botRonWindow)
    expect(offered).toEqual([
      { type: 'draw', seat: 1 },
      { type: 'ron', seat: 3, tile: 72 },
    ])
    expect(forcedAction(botRonWindow, offered, PLAYER, true)).toBe(offered[1])
  })

  it('takes a bot tsumo through the policy — the placeholder never-win rule is gone', () => {
    // Seed 3951 turn 35: seat 3 draws its 4s tsumo point (core's frozen anchor).
    // The placeholder tsumogiried past this; discardPolicy's first arm takes it.
    const state = foldRecord({
      seed: 3951,
      actions: [...tsumogiriTurns(dealtLive(3951), 35), { type: 'draw', seat: 3 }],
    })
    const offered = legalActions(state)
    const tsumo = offered.find((a) => a.type === 'tsumo' && a.seat === 3)
    expect(tsumo).toBeDefined()
    const forced = forcedAction(state, offered, PLAYER, true)
    expect(forced).toBe(tsumo)
    // Oracle: identical to the policy's own answer over seat 3's view.
    expect(forced).toBe(discardPolicy(seatView(state, 3), offered))
  })
})

describe('full hand driven through the seam', () => {
  it('plays deal → ryuukyoku with policy bots: S/W/N draw, discard, and call on their own', () => {
    const actions: HandAction[] = []
    let state = foldRecord({ seed: SEED, actions })
    let declines = 0
    let botTedashi = 0
    // 144 actions end the hand; the guard only bounds a regression, it never trips.
    for (let guard = 0; guard < 300; guard++) {
      const offered = legalActions(state)
      if (offered.length === 0) break
      const forced = forcedAction(state, offered, PLAYER, true)
      let next: HandAction
      if (forced !== null) {
        // The bots' hand discards are the tsumogiri placeholder's disproof.
        if (forced.type === 'discard' && forced.seat !== PLAYER && forced.tile !== state.drawn) {
          botTedashi++
        }
        next = forced
      } else if (
        claimChoices(offered, PLAYER).length > 0 ||
        winChoice(offered, PLAYER) !== null
      ) {
        // The player's prompt — this walk always declines; the decline may still
        // fold a bot's accepted claim (that is the point of the arbitration).
        declines++
        const settled = settleWindow(state, offered, PLAYER, null)
        if (settled === null) throw new Error('a mid-hand decline always has a fold')
        next = settled
      } else {
        // The player's tap: tsumogiri the drawn tile (keeps his 13 tiles frozen).
        const tapped = tapDiscard(offered, PLAYER, state.drawn!)
        if (tapped === null) throw new Error('the walk has no driver — a wait with no tap')
        next = tapped
      }
      // Identity containment: the appended action IS an element of this fold's offering.
      expect(offered).toContain(next)
      actions.push(next)
      state = foldRecord({ seed: SEED, actions }) // never throws — every append was offered
    }
    expect(state.phase).toBe('ryuukyoku')
    expect(state.win).toBeNull()
    expect(state.live).toHaveLength(0)
    expect(legalActions(state)).toEqual([])
    // Frozen walk facts (mined): 70 draw/discard pairs plus South's two chis and
    // their claim discards; the player's prompt fired and was declined 3 times.
    expect(actions).toHaveLength(144)
    expect(declines).toBe(3)
    // S/W/N act on their own: South called twice — both chis claim EAST's fresh
    // discards, folded by the loop with no player input...
    expect(state.melds).toEqual([
      [],
      [
        { type: 'chi', claimed: 20, from: 0, own: [26, 28] },
        { type: 'chi', claimed: 18, from: 0, own: [13, 21] },
      ],
      [],
      [],
    ])
    // ...and the bots discard by policy, not tsumogiri: hand discards happened.
    expect(botTedashi).toBeGreaterThan(0)
    expect(state.ponds.map((pond) => pond.length)).toEqual([18, 18, 18, 18])
  })
})

describe('a claim driven through the seam', () => {
  it("folds the player's pon at a pure player window: call → claim discard → bots resume (seed 15)", () => {
    const actions: HandAction[] = [...tsumogiriTurns(dealt15.live, 8)]
    const atWindow = foldRecord({ seed: 15, actions })
    const offered = legalActions(atWindow)
    // The prompt is up, and no bot holds an offer (mined): the settle is the tap's.
    expect(forcedAction(atWindow, offered, PLAYER, true)).toBeNull()
    const pon = tapClaim(offered, PLAYER, { type: 'pon', uses: [44, 47] })
    expect(pon).toBe(claimChoices(offered, PLAYER)[0])
    const settled = settleWindow(atWindow, offered, PLAYER, pon)
    expect(settled).toBe(pon)
    actions.push(settled!)

    // The fold accepts the call: the meld is East's, claimed from North's pond mark.
    const claimed = foldRecord({ seed: 15, actions })
    expect(claimed.melds[PLAYER]).toEqual([
      { type: 'pon', claimed: 45, from: 3, own: [44, 47] },
    ])
    // The claim discard is owed: not forced, nothing settles — the player's tap only.
    const mustDiscard = legalActions(claimed)
    expect(forcedAction(claimed, mustDiscard, PLAYER, true)).toBeNull()
    expect(settleWindow(claimed, mustDiscard, PLAYER, null)).toBeNull()
    const out = tapDiscard(mustDiscard, PLAYER, claimed.hands[PLAYER][0])
    expect(out).toBe(mustDiscard[0])
    actions.push(out!)

    // Play resumes without player input: the next seat's draw is forced again.
    const resumed = foldRecord({ seed: 15, actions })
    const offeredResumed = legalActions(resumed)
    const forced = forcedAction(resumed, offeredResumed, PLAYER, true)
    expect(forced).not.toBeNull()
    expect(offeredResumed).toContain(forced)
  })

  it("loses the seed-3 race to South's pon: the tapped chi settles to the bot's claim", () => {
    const actions: HandAction[] = [...racePrefix3]
    const atWindow = foldRecord({ seed: 3, actions })
    const offered = legalActions(atWindow)
    expect(forcedAction(atWindow, offered, PLAYER, true)).toBeNull() // the prompt is up
    const chi = tapClaim(offered, PLAYER, EAST_CHI_A)!
    const settled = settleWindow(atWindow, offered, PLAYER, chi)
    // South's pon strictly cuts its shanten and keeps a yaku anchor (mined), and a
    // pon is offered before any chi: the player's call loses the window.
    expect(settled).toEqual({ type: 'pon', seat: 1, tile: 42, uses: SOUTH_PON_3.uses })
    actions.push(settled!)

    const claimed = foldRecord({ seed: 3, actions })
    expect(claimed.melds[1]).toEqual([{ type: 'pon', claimed: 42, from: 3, own: [43, 41] }])
    expect(claimed.melds[PLAYER]).toEqual([])
    // South owes the claim discard; the loop drives it by policy without any tap.
    const mustDiscard = legalActions(claimed)
    const forced = forcedAction(claimed, mustDiscard, PLAYER, true)
    expect(forced).toBe(discardPolicy(seatView(claimed, 1), mustDiscard))
  })
})

describe('wins driven through the seam', () => {
  /**
   * The eager-winner walk under policy bots: take the player's win when offered
   * (through settleWindow — a bot's atamahane-earlier ron could outrank it),
   * otherwise let forcedAction drive, decline every player claim prompt, and
   * tsumogiri every player turn. Returns the actions it appended; every append is
   * asserted to be an element of its fold's offering (the identity containment
   * that makes the walk a seam test). The mined trajectories differ from the old
   * all-tsumogiri ones — the bots now shape every hand they sit in.
   */
  function playToWin(seed: number, guardLimit: number): HandAction[] {
    const actions: HandAction[] = []
    for (let guard = 0; guard < guardLimit; guard++) {
      const state = foldRecord({ seed, actions })
      const offered = legalActions(state)
      if (offered.length === 0) break
      const win = winChoice(offered, PLAYER)
      let next: HandAction | null
      if (win !== null) {
        next = settleWindow(state, offered, PLAYER, win)
      } else {
        next = forcedAction(state, offered, PLAYER, true)
        if (next === null && claimChoices(offered, PLAYER).length > 0) {
          next = settleWindow(state, offered, PLAYER, null)
        }
        if (next === null) next = tapDiscard(offered, PLAYER, state.drawn!)
      }
      if (next === null) throw new Error('the walk has no driver — a wait with no tap')
      expect(offered).toContain(next)
      actions.push(next)
    }
    return actions
  }

  it('plays deal → the player rons: the mined 6p/9p wait now arrives as a bot discard', () => {
    // Seed 542630 was the all-tsumogiri TSUMO geometry (turn 32, live[32]); with
    // the bots discarding by policy the wait surfaces much earlier as North's
    // discard, and the win folds as a ron (frozen walk facts, re-mined).
    const actions = playToWin(TSUMO_SEED, 300)
    expect(actions).toHaveLength(41)
    const won = foldRecord({ seed: TSUMO_SEED, actions })
    expect(won.phase).toBe('agari')
    expect(won.win).toEqual({ by: 'ron', winner: PLAYER, from: 3, tile: 71, yaku: ['pinfu'] })
    // Quiescence through the seam: the won hand offers nothing and drives nothing.
    const offered = legalActions(won)
    expect(offered).toEqual([])
    expect(forcedAction(won, offered, PLAYER, true)).toBeNull()
    expect(settleWindow(won, offered, PLAYER, null)).toBeNull()
    expect(winChoice(offered, PLAYER)).toBeNull()
  })

  it('plays deal → ron over coexisting claims: the shanpon geometry survives the policy bots', () => {
    const actions = playToWin(SHANPON_SEED, 300)
    // The same winning tile and yaku as the all-tsumogiri geometry, on a longer
    // mined trajectory — the bots reshaped the road, not the destination.
    expect(actions).toHaveLength(31)
    const won = foldRecord({ seed: SHANPON_SEED, actions })
    expect(won.phase).toBe('agari')
    expect(won.win).toEqual({
      by: 'ron',
      winner: PLAYER,
      from: 3,
      tile: 31,
      yaku: ['pinfu', 'iipeikou'],
    })
    expect(legalActions(won)).toEqual([])
  })

  it('plays deal → the player tsumos: the ron-only geometry becomes a live tsumo', () => {
    // Seed 362857 was the ron-ONLY window anchor; under policy bots the 5m never
    // leaves a bot's hand at that turn — East draws it himself instead (re-mined).
    const actions = playToWin(RON_ONLY_SEED, 300)
    expect(actions).toHaveLength(56)
    const won = foldRecord({ seed: RON_ONLY_SEED, actions })
    expect(won.phase).toBe('agari')
    expect(won.win).toEqual({
      by: 'tsumo',
      winner: PLAYER,
      tile: 19,
      yaku: ['menzen-tsumo', 'yakuhai-chun'],
    })
  })

  it('plays deal → a BOT rons the player: the bots win through the same driver', () => {
    // Seed 1038928 was the houtei walk; under policy bots West completes ittsuu
    // off the player's tsumogiri long before the wall empties (re-mined). The
    // bots' wins end hands now — the placeholder's never-win rule is dead.
    const actions = playToWin(HOUTEI_SEED, 300)
    expect(actions).toHaveLength(73)
    const won = foldRecord({ seed: HOUTEI_SEED, actions })
    expect(won.phase).toBe('agari')
    // Re-mined (T-009-02-02 repair): West is now in riichi at the win — same
    // walk/winner/tile, yaku gains 'riichi' alongside 'ittsuu'.
    expect(won.win).toEqual({ by: 'ron', winner: 2, from: PLAYER, tile: 17, yaku: ['riichi', 'ittsuu'] })
    expect(legalActions(won)).toEqual([])
  })

  it('folds the houtei ron out of the ended hand — the carve-out pinned at state level', () => {
    // The fixed all-tsumogiri prefix still reaches the houtei state (folds are
    // driver-independent); only the WALK no longer gets there. The settle takes
    // the rons-only offering's win and the fold accepts it into agari.
    const offered = legalActions(houteiEnd)
    const ron = winChoice(offered, PLAYER)!
    const settled = settleWindow(houteiEnd, offered, PLAYER, ron)
    expect(settled).toBe(ron)
    const won = foldRecord({
      seed: HOUTEI_SEED,
      actions: [...tsumogiriTurns(dealtHoutei.live, 70), settled!],
    })
    expect(won.phase).toBe('agari')
    expect(won.win).toEqual({
      by: 'ron',
      winner: PLAYER,
      from: 1,
      tile: 21,
      yaku: ['chiitoitsu', 'houtei'],
    })
  })
})

describe('buildReportText', () => {
  it('formats the message, context block, and notation in one deterministic string', () => {
    const text = buildReportText({
      message: 'the chi button disappeared\nafter I tapped pass',
      notation: 'v1 25evpds\nD0 K0af',
      terminology: 'romaji',
      handIndex: 2,
      actionCount: 5,
      origin: 'https://mahjong.b28.dev',
      build: 'abc1234',
      calls: 'quiet',
    })
    expect(text).toBe(
      [
        'the chi button disappeared',
        'after I tapped pass',
        '',
        '---',
        'terminology: romaji',
        'hand: 2',
        'actions: 5',
        'origin: https://mahjong.b28.dev',
        'build: abc1234',
        'calls: quiet',
        '---',
        'v1 25evpds',
        'D0 K0af',
      ].join('\n'),
    )
  })

  it('accepts an empty message', () => {
    const text = buildReportText({
      message: '',
      notation: 'v1 7',
      terminology: 'zh-hant',
      handIndex: 0,
      actionCount: 0,
      origin: 'offline',
      build: 'abc1234',
      calls: 'quiet',
    })
    expect(text.startsWith('\n\n---\nterminology: zh-hant')).toBe(true)
    expect(text.endsWith('v1 7')).toBe(true)
  })
})

describe('buildIssueUrl', () => {
  it('encodes a short title/body into a github.com new-issue URL', () => {
    const link = buildIssueUrl('Bug report', 'line one\nline two')
    expect(link.clipboardFirst).toBe(false)
    expect(link.url).toBe(
      `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent('Bug report')}&body=${encodeURIComponent('line one\nline two')}`,
    )
  })

  it('falls back to a short clipboard-first body past the length threshold', () => {
    const longBody = 'x'.repeat(6500)
    const link = buildIssueUrl('Bug report', longBody)
    expect(link.clipboardFirst).toBe(true)
    expect(link.url).not.toContain('x'.repeat(100))
    expect(link.url).toContain(encodeURIComponent('paste the copied report'))
    expect(link.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH)
  })

  it('takes the full-body branch exactly at the threshold boundary', () => {
    // Binary-search-free construction: grow the body until the FULL encoded URL
    // lands exactly at MAX_ISSUE_URL_LENGTH, then confirm that exact length still
    // takes the <= branch (the full body survives, not the fallback).
    const title = 'Bug report'
    const base = `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=`
    const target = MAX_ISSUE_URL_LENGTH - base.length
    const body = 'y'.repeat(target)
    const link = buildIssueUrl(title, body)
    expect(link.url.length).toBe(MAX_ISSUE_URL_LENGTH)
    expect(link.clipboardFirst).toBe(false)
    expect(link.url).toContain('y'.repeat(target))
  })
})

describe('loadPastedRecord', () => {
  // foldGame folds hand 0 from handSeedOf(gameSeed, 0), NOT gameSeed directly
  // (game.ts's own per-hand seed derivation) — the fixture's actions must be built
  // against THAT wall, or foldGame (not parseGameRecord) rejects the fixture itself.
  const dealtHand0 = foldRecord({ seed: handSeedOf(SEED, 0), actions: [] })
  const fixture = { seed: SEED, hands: [tsumogiriTurns(dealtHand0.live, 4)] }

  it('parses a raw serializeGameRecord paste with no wrapper', () => {
    const notation = serializeGameRecord(fixture)
    const result = loadPastedRecord(notation)
    expect(result.ok).toBe(true)
    expect(result.record).toEqual(fixture)
    expect(result.message).toBeNull()
  })

  it('extracts the notation out of a full buildReportText-shaped paste', () => {
    const notation = serializeGameRecord(fixture)
    const blob = buildReportText({
      message: 'the chi button disappeared',
      notation,
      terminology: 'romaji',
      handIndex: 0,
      actionCount: fixture.hands[0].length,
      origin: 'https://mahjong.b28.dev',
      build: 'abc1234',
      calls: 'quiet',
    })
    const result = loadPastedRecord(blob)
    expect(result.ok).toBe(true)
    expect(result.record).toEqual(fixture)
  })

  it('picks the LAST header-shaped line, not a fake one embedded in free text', () => {
    const notation = serializeGameRecord(fixture)
    const blob = ['a message that happens to contain v1 abc', 'more context', notation].join('\n')
    const result = loadPastedRecord(blob)
    expect(result.ok).toBe(true)
    expect(result.record).toEqual(fixture)
  })

  it('surfaces parseGameRecord\'s exact message on malformed notation', () => {
    const malformed = 'v1 1\nZZ00'
    let expectedMessage = ''
    try {
      parseGameRecord(malformed)
      throw new Error('expected parseGameRecord to throw for this fixture')
    } catch (error) {
      expectedMessage = (error as Error).message
    }
    const result = loadPastedRecord(malformed)
    expect(result.ok).toBe(false)
    expect(result.record).toBeNull()
    expect(result.message).toBe(expectedMessage)
  })

  it('surfaces the whole trimmed text through parseGameRecord when no header line exists', () => {
    const noHeader = 'not notation at all'
    let expectedMessage = ''
    try {
      parseGameRecord(noHeader)
      throw new Error('expected parseGameRecord to throw for this fixture')
    } catch (error) {
      expectedMessage = (error as Error).message
    }
    const result = loadPastedRecord(noHeader)
    expect(result.ok).toBe(false)
    expect(result.message).toBe(expectedMessage)
  })

  it("surfaces foldGame's own message for a syntactically valid but illegal record", () => {
    // Two empty hand lines: hand 0 never ends (an empty action log stays 'playing'
    // forever), so a second hand line is corruption foldGame itself rejects — the
    // fold-validation step this loader adds beyond parseGameRecord's own checks.
    const illegal = { seed: SEED, hands: [[], []] }
    const notation = serializeGameRecord(illegal)
    let expectedMessage = ''
    try {
      foldGame(parseGameRecord(notation))
      throw new Error('expected foldGame to throw for this fixture')
    } catch (error) {
      expectedMessage = (error as Error).message
    }
    const result = loadPastedRecord(notation)
    expect(result.ok).toBe(false)
    expect(result.message).toBe(expectedMessage)
  })
})

describe('ownKanChoices', () => {
  it('surfaces the ankan offer on four held/drawn copies, and nothing elsewhere (owner report #6)', () => {
    // Hand-built four-copies state: East holds three 1m copies with the fourth drawn.
    const base = dealt.hands[0].filter((tile) => tile > 3).slice(0, 10)
    expect(base).toHaveLength(10)
    const state = {
      ...dealt,
      turn: 0 as const,
      drawn: 3 as TileId,
      drawnFrom: 'wall' as const,
      hands: [
        [0, 1, 2, ...base] as TileId[],
        dealt.hands[1],
        dealt.hands[2],
        dealt.hands[3],
      ] as typeof dealt.hands,
    }
    const offered = legalActions(state)
    const kans = ownKanChoices(offered, PLAYER)
    expect(kans).toHaveLength(1)
    expect(kans[0]!.type).toBe('ankan')
    // Elements of offered itself, never rebuilt.
    expect(offered).toContain(kans[0])
    // And silence everywhere it should be silent: the dealt state offers no kan.
    expect(ownKanChoices(legalActions(dealt), PLAYER)).toHaveLength(0)
  })
})
