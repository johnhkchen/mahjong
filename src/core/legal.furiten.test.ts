// T-009-03-02: unit coverage for the two "why can't I win" teaching queries
// legal.ts exports alongside its furiten doctrine — furitenSeal (the physical
// discard sealing a seat's ron, across all three furiten kinds) and
// yakulessTenpai (a closed, unlocked, tenpai hand whose every current wait
// would ron with no yaku). Fixtures are reused verbatim from legal.win.test.ts's
// own frozen anchors (never regenerate, that file's own convention) — this
// suite duplicates the seed constants and prefix-building helpers rather than
// importing them, matching the codebase's per-suite-duplication precedent
// (win.test.ts vs. legal.win.test.ts already do this for the same seeds).

import { describe, expect, it } from 'vitest'
import {
  SEAT_COUNT,
  foldRecord,
  furitenSeal,
  kindOf,
  openYakulessTenpai,
  yakulessTenpai,
  type HandAction,
  type Meld,
  type Seat,
  type TableState,
  type TileId,
} from './index'

function dealtLive(seed: number): TileId[] {
  return foldRecord({ seed, actions: [] }).live
}

/** `turns` full tsumogiri turns — the legal.win.test.ts/win.test.ts helper, mirrored. */
function scriptedTurns(live: readonly TileId[], turns: number): HandAction[] {
  const actions: HandAction[] = []
  for (let t = 0; t < turns; t++) {
    const seat = (t % SEAT_COUNT) as Seat
    actions.push({ type: 'draw', seat }, { type: 'discard', seat, tile: live[t] })
  }
  return actions
}

// Seed 23798 — seat 1 dealt tenpai waiting 6p/9p; its own turn-9 draw is 58
// (6p), tsumogiri'd — self-pond (BASIC) furiten from turn 21 on (legal.win.test.ts's
// own anchor comment).
const FURITEN_SEED = 23798

// Seed 3951 — seat 3 dealt tenpai, pinfu waits 1s/4s/7s. Turn 0: seat 0
// tsumogiris live[0] = 72 (1s) into seat 3's window; left unronned, it closes
// at seat 1's turn-1 draw (temporary furiten), and clears again at seat 3's
// own turn-3 draw (legal.win.test.ts's own anchor comment).
const RON_SEED = 3951

// Seed 100 (record.test.ts's RIICHI_FURITEN_SEED) — seat 0 riichis on its very
// first draw (tile 55); post-riichi turn j=12 (seat 1's discard) opens a
// window seat 0 passes, sealing riichiFuriten permanently (legal.win.test.ts's
// own anchor comment).
const RIICHI_FURITEN_SEED = 100

// Seed 12754 — seat 2 dealt tenpai on 8s with NO yaku from the very start (the
// win.test.ts one-yaku fixture) — no actions needed to reach the probe point.
const YAKULESS_SEED = 12754

describe('furitenSeal', () => {
  it('names the self-pond (basic) seal — the seat discarded its own current wait', () => {
    const live = dealtLive(FURITEN_SEED)
    const state = foldRecord({ seed: FURITEN_SEED, actions: scriptedTurns(live, 21) })
    const seal = furitenSeal(state, 1)
    expect(seal).not.toBeNull()
    expect(kindOf(seal!)).toBe('6p')
    expect(state.ponds[1]).toContain(seal)
  })

  it('names the cross-pond (temporary) seal — a passed win from another seat', () => {
    const live = dealtLive(RON_SEED)
    const sealed = foldRecord({ seed: RON_SEED, actions: scriptedTurns(live, 2) })
    expect(sealed.tempFuriten[3]).toBe(true)
    const seal = furitenSeal(sealed, 3)
    expect(seal).not.toBeNull()
    expect(kindOf(seal!)).toBe('1s')
    // The sealing tile sits in the DISCARDER's pond (seat 0), never seat 3's own —
    // sealPassedWins (record.ts) never seals a seat from its own discard.
    expect(sealed.ponds[0]).toContain(seal)
    expect(sealed.ponds[3]).not.toContain(seal)
  })

  it('clears on the seat’s own next draw — the temporary variant lifting', () => {
    const live = dealtLive(RON_SEED)
    const cleared = foldRecord({ seed: RON_SEED, actions: scriptedTurns(live, 4) })
    expect(cleared.tempFuriten[3]).toBe(false)
    expect(furitenSeal(cleared, 3)).toBeNull()
  })

  it('names the riichi-furiten seal and never clears it', () => {
    const live = dealtLive(RIICHI_FURITEN_SEED)
    const riichiActions: HandAction[] = [
      { type: 'draw', seat: 0 },
      { type: 'riichi', seat: 0, tile: 55 },
    ]
    function postRiichiTurns(count: number): HandAction[] {
      const actions: HandAction[] = []
      for (let j = 0; j < count; j++) {
        const s = ((1 + j) % SEAT_COUNT) as Seat
        actions.push({ type: 'draw', seat: s }, { type: 'discard', seat: s, tile: live[1 + j] })
      }
      return actions
    }
    const justSealed = foldRecord({
      seed: RIICHI_FURITEN_SEED,
      actions: [...riichiActions, ...postRiichiTurns(13), { type: 'draw', seat: 2 }],
    })
    expect(justSealed.riichiFuriten[0]).toBe(true)
    const seal = furitenSeal(justSealed, 0)
    expect(seal).not.toBeNull()
    expect(justSealed.ponds[1]).toContain(seal) // seat 1's turn-12 discard, per record.test.ts's fixture

    // Seat 0's own next draw does NOT clear a riichi seal, unlike temporary furiten.
    const afterOwnDraw = foldRecord({
      seed: RIICHI_FURITEN_SEED,
      actions: [...riichiActions, ...postRiichiTurns(16)],
    })
    expect(afterOwnDraw.tempFuriten[0]).toBe(false)
    expect(afterOwnDraw.riichiFuriten[0]).toBe(true)
    expect(furitenSeal(afterOwnDraw, 0)).not.toBeNull()
  })

  it('is null for a seat holding no furiten fact at all', () => {
    const state = foldRecord({ seed: RON_SEED, actions: [] })
    expect(furitenSeal(state, 3)).toBeNull()
  })
})

describe('yakulessTenpai', () => {
  it('true for a closed, unlocked tenpai hand whose only wait carries no yaku', () => {
    const state = foldRecord({ seed: YAKULESS_SEED, actions: [] })
    expect(state.melds[2]).toEqual([])
    expect(state.riichi[2]).toBe(false)
    expect(yakulessTenpai(state, 2)).toBe(true)
  })

  it('false when the tenpai wait DOES carry a yaku (pinfu)', () => {
    const state = foldRecord({ seed: RON_SEED, actions: [] })
    expect(yakulessTenpai(state, 3)).toBe(false)
  })

  it('false once the seat is locked into riichi — riichi is itself a yaku', () => {
    const live = dealtLive(RIICHI_FURITEN_SEED)
    const riichiActions: HandAction[] = [
      { type: 'draw', seat: 0 },
      { type: 'riichi', seat: 0, tile: 55 },
    ]
    const state = foldRecord({ seed: RIICHI_FURITEN_SEED, actions: riichiActions })
    expect(state.riichi[0]).toBe(true)
    expect(yakulessTenpai(state, 0)).toBe(false)
  })

  it('false for an open hand, even one that would be yakuless closed — riichi is unavailable', () => {
    // Synthetic: fold the yakuless fixture's own 4z (North) triplet — not a
    // yakuhai for seat 2's West/round-East wind — into an open pon, otherwise
    // untouched. isMenzen alone must gate this false; the underlying shape
    // still has no yaku for either seat wind.
    const state = foldRecord({ seed: YAKULESS_SEED, actions: [] })
    const trip: TileId[] = [120, 122, 123]
    const openHand = state.hands[2].filter((tile) => !trip.includes(tile))
    const openMelds: Meld[] = [{ type: 'pon', claimed: 123, from: 1 as Seat, own: [120, 122] }]
    const openState: TableState = {
      ...state,
      hands: [state.hands[0], state.hands[1], openHand, state.hands[3]],
      melds: [state.melds[0], state.melds[1], openMelds, state.melds[3]],
    }
    expect(yakulessTenpai(openState, 2)).toBe(false)
  })
})

// Owner report #3 (2026-07-05, build 83506ca): "Persistent prompt on pon not
// disappearing." A seat that has JUST claimed holds one extra tile until it discards
// (post-pon: 11 concealed + 1 meld, not the 10 `waits` demands). furitenSeal and
// yakulessTenpai run on EVERY folded state the view derives, including that transient;
// before the isWaitShaped guard they threw there, and a throw inside a Svelte $derived
// aborts the reactive update — freezing the DOM with the stale claim prompt still up.
describe('the post-claim must-discard transient (report #3)', () => {
  // A hand-built post-pon state: seat 0 pons, holding 11 concealed + 1 meld, owing a
  // discard. The exact over-count that made `waits` throw.
  function postPonState(seed: number): TableState {
    const dealt = foldRecord({ seed, actions: [] })
    const meld: Meld = { type: 'pon', claimed: dealt.hands[0][10], from: 2 as Seat, own: [
      dealt.hands[0][11],
      dealt.hands[0][12],
    ] }
    const concealed = dealt.hands[0].slice(0, 11) // 11 tiles, one short of a discard
    return {
      ...dealt,
      turn: 0 as Seat,
      hands: [concealed, dealt.hands[1], dealt.hands[2], dealt.hands[3]],
      melds: [[meld], dealt.melds[1], dealt.melds[2], dealt.melds[3]],
    }
  }

  it('furitenSeal returns null instead of throwing on an 11-concealed, 1-meld hand', () => {
    const state = postPonState(1)
    expect(state.hands[0]).toHaveLength(11)
    expect(() => furitenSeal(state, 0)).not.toThrow()
    expect(furitenSeal(state, 0)).toBeNull()
  })

  it('yakulessTenpai returns false instead of throwing on the same shape', () => {
    const state = postPonState(1)
    expect(() => yakulessTenpai(state, 0)).not.toThrow()
    expect(yakulessTenpai(state, 0)).toBe(false)
  })
})

// Owner report #4 (2026-07-06, build 73c9b68): "Couldn't tenpai" — an OPEN tenpai
// hand whose every wait was yakuless got no warning (yakulessTenpai's menzen gate)
// and no tenpai signal at all. openYakulessTenpai is the open-hand sibling.
describe('openYakulessTenpai', () => {
  // A hand-built open cannot-win tenpai: seat 0 holds a claimed 456m chi and
  // concealed 234p 789s 99p + 46p — kanchan wait on 5p; the completion is all
  // runs + a simple pair on an OPEN hand touching a 9: no tanyao, no yakuhai,
  // no menzen tsumo. Kinds → first tile id of each kind (kind k -> id 4k).
  function openYakulessState(): TableState {
    const dealt = foldRecord({ seed: 1, actions: [] })
    const id = (kindIndex: number, copy = 0) => (4 * kindIndex + copy) as TileId
    // man kinds 0..8, pin 9..17, sou 18..26; 456m = kinds 3,4,5; pins 2,3,4 = kinds 10,11,12
    const meld: Meld = { type: 'chi', claimed: id(3), from: 3 as Seat, own: [id(4), id(5)] }
    const concealed: TileId[] = [
      id(10), id(11), id(12), // 234p
      id(24), id(25), id(26), // 789s
      id(16, 0), id(16, 1),   // 99p pair
      id(12, 1), id(14),      // 4p 6p — kanchan 5p
    ]
    return {
      ...dealt,
      hands: [concealed, dealt.hands[1], dealt.hands[2], dealt.hands[3]],
      melds: [[meld], dealt.melds[1], dealt.melds[2], dealt.melds[3]],
    }
  }

  it('is true for an open tenpai hand whose every wait completes yakuless', () => {
    const state = openYakulessState()
    expect(openYakulessTenpai(state, 0)).toBe(true)
    // The closed-hand notice stays silent here (menzen gate) — the whole gap.
    expect(yakulessTenpai(state, 0)).toBe(false)
  })

  it('is false for closed hands, non-wait shapes, and the post-claim transient', () => {
    const dealt = foldRecord({ seed: 1, actions: [] })
    expect(openYakulessTenpai(dealt, 0)).toBe(false) // closed (menzen) hand
    const state = openYakulessState()
    const midClaim: TableState = {
      ...state,
      hands: [[...state.hands[0], (4 * 20) as TileId], state.hands[1], state.hands[2], state.hands[3]],
    }
    expect(openYakulessTenpai(midClaim, 0)).toBe(false) // 11 concealed + meld: not at rest
  })
})
