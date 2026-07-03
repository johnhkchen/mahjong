// The discard-policy suite. Two layers, per the codebase convention: hand-built
// SeatView fixtures pin each arm and each tie-break key exactly (the expectations are
// computable by eye, and re-derived in-test through shanten where the tie-break is not
// the subject), and a seeded whole-game sweep — the dynamics.test.ts driver mold, but
// driven BY the policy's own choices — checks the AC at every decision point of real
// folded states: membership in the offered set, tsumo-always-taken, discard minimality,
// post-draw non-raise, termination, and byte-identical replay (the T-006-03-04
// rehearsal). Sweep checks are plain throws with one expect per game, the perf lesson
// from the inclusion sweep (T-006-01-02).

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  discardPolicy,
  foldRecord,
  kindOf,
  legalActions,
  seatView,
  shanten,
  tileId,
  type CopyIndex,
  type HandAction,
  type Meld,
  type Seat,
  type SeatView,
  type TileId,
  type TileKind,
} from './index'

/**
 * A per-fixture tile source: parses mpsz runs ('123m55p1z') and allocates copy
 * indices per kind ACROSS calls, so a hand and its drawn tile drawn from the same
 * source never collide on ids while duplicate kinds get distinct physical tiles.
 */
function tileSource(): (notation: string) => TileId[] {
  const used = new Map<TileKind, number>()
  return (notation) => {
    const tiles: TileId[] = []
    let digits: number[] = []
    for (const ch of notation) {
      if (ch >= '1' && ch <= '9') {
        digits.push(Number(ch))
      } else {
        for (const digit of digits) {
          const kind = `${digit}${ch}` as TileKind
          const copy = used.get(kind) ?? 0
          used.set(kind, copy + 1)
          tiles.push(tileId(kind, copy as CopyIndex))
        }
        digits = []
      }
    }
    return tiles
  }
}

/** A SeatView literal with inert defaults — SeatView is a plain interface, so fixtures build views directly. */
function viewOf(partial: {
  seat?: Seat
  hand: readonly TileId[]
  drawn?: TileId | null
  melds?: readonly Meld[]
  mustDiscard?: boolean
}): SeatView {
  const seat = partial.seat ?? 0
  const melds: [Meld[], Meld[], Meld[], Meld[]] = [[], [], [], []]
  melds[seat] = [...(partial.melds ?? [])]
  return {
    seat,
    hand: partial.hand,
    drawn: partial.drawn ?? null,
    ponds: [[], [], [], []],
    melds,
    doraIndicators: [],
    doras: [],
    wallCount: 40,
    turn: seat,
    phase: 'playing',
    claimable: null,
    mustDiscard: partial.mustDiscard ?? false,
    win: null,
  }
}

/** The offered discards for a view, in legal.ts's contractual order: hand order, drawn last. */
function discardsOf(view: SeatView): HandAction[] {
  const tiles = view.drawn === null ? [...view.hand] : [...view.hand, view.drawn]
  return tiles.map((tile): HandAction => ({ type: 'discard', seat: view.seat, tile }))
}

/** Shanten of the view's concealed tiles once `tile` leaves them — the test-side twin of the policy's scorer. */
function afterDiscard(view: SeatView, tile: TileId): number {
  const pool = view.drawn === null ? [...view.hand] : [...view.hand, view.drawn]
  return shanten(
    pool.filter((t) => t !== tile).map(kindOf),
    view.melds[view.seat],
  )
}

describe('tsumo arm', () => {
  it('returns an offered tsumo over every discard, wherever it sits in the offered order', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('123m456m789m123p5s'), drawn: take('5s')[0] })
    const tsumo: HandAction = { type: 'tsumo', seat: view.seat }
    const offered = [...discardsOf(view), tsumo] // legal.ts order: tsumo after the 14 discards
    expect(discardPolicy(view, offered)).toBe(tsumo)
  })

  it('ignores another seat\'s actions when finding its own tsumo', () => {
    const take = tileSource()
    const view = viewOf({ seat: 2, hand: take('123m456m789m123p5s'), drawn: take('5s')[0] })
    const tsumo: HandAction = { type: 'tsumo', seat: 2 }
    const offered = [{ type: 'tsumo', seat: 1 } as HandAction, ...discardsOf(view), tsumo]
    expect(discardPolicy(view, offered)).toBe(tsumo)
  })
})

describe('discard arm — minimality', () => {
  it('finds the unique tenpai-restoring discard', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('123m456p789s1122z'), drawn: take('5z')[0] })
    const chosen = discardPolicy(view, discardsOf(view))
    if (chosen.type !== 'discard') throw new Error('expected a discard')
    expect(kindOf(chosen.tile)).toBe('5z')
    expect(afterDiscard(view, chosen.tile)).toBe(0)
  })

  it('achieves the minimum over all offered discards on a shapeless hand', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('2247m3489p2367s1z'), drawn: take('5m')[0] })
    const offered = discardsOf(view)
    const chosen = discardPolicy(view, offered)
    if (chosen.type !== 'discard') throw new Error('expected a discard')
    const results = offered.map((a) => afterDiscard(view, (a as { tile: TileId }).tile))
    expect(afterDiscard(view, chosen.tile)).toBe(Math.min(...results))
  })

  it('never raises shanten past the pre-draw hand (tsumogiri is always available)', () => {
    const take = tileSource()
    const hand = take('123m456p789s1122z')
    const view = viewOf({ hand, drawn: take('5z')[0] })
    const chosen = discardPolicy(view, discardsOf(view))
    if (chosen.type !== 'discard') throw new Error('expected a discard')
    const before = shanten(hand.map(kindOf), [])
    expect(afterDiscard(view, chosen.tile)).toBeLessThanOrEqual(before)
  })
})

describe('discard arm — tie-break', () => {
  it('sheds an isolated honor over an equally-idle middle tile, earliest honor first', () => {
    const take = tileSource()
    // Minimal discards are exactly the three floaters {5p, 1z, 7z}; distances 0/5/5,
    // so the honors win and the earliest offered of them — 1z, in the hand — is chosen.
    const view = viewOf({ hand: take('123m456m789m99s5p1z'), drawn: take('7z')[0] })
    const chosen = discardPolicy(view, discardsOf(view))
    if (chosen.type !== 'discard') throw new Error('expected a discard')
    expect(kindOf(chosen.tile)).toBe('1z')
  })

  it('sheds a terminal over an equally-idle middle tile, symmetric terminals to offered order', () => {
    const take = tileSource()
    // Minimal discards are the floaters {1p, 9p, 5s}; 1p and 9p tie at distance 4 over
    // 5s at 0, and 1p is offered first (hand order).
    const view = viewOf({ hand: take('123m456m789m99s19p'), drawn: take('5s')[0] })
    const chosen = discardPolicy(view, discardsOf(view))
    if (chosen.type !== 'discard') throw new Error('expected a discard')
    expect(kindOf(chosen.tile)).toBe('1p')
  })

  it('breaks a same-kind copies tie by offered order, not copy index', () => {
    const take = tileSource()
    const [pFirst, pSecond] = take('55p')
    const view = viewOf({ hand: [...take('123m456m789m99s'), pFirst, pSecond], drawn: take('1z')[0] })
    // Curated offered subset: only the two 5p copies, deliberately reversed — equal
    // shanten, equal distance, so the EARLIEST OFFERED (the later copy) must win.
    const offered: HandAction[] = [
      { type: 'discard', seat: view.seat, tile: pSecond },
      { type: 'discard', seat: view.seat, tile: pFirst },
    ]
    expect(discardPolicy(view, offered)).toBe(offered[0])
  })
})

describe('mustDiscard branch (claim discard owed — no drawn tile)', () => {
  it('picks the tenpai-reaching discard from a melded hand', () => {
    const take = tileSource()
    const [claimed, own1, own2] = take('111z')
    const pon: Meld = { type: 'pon', claimed, from: 3, own: [own1, own2] }
    const view = viewOf({ hand: take('123m456m99s237p'), melds: [pon], mustDiscard: true })
    const offered = discardsOf(view)
    expect(offered).toHaveLength(11)
    const chosen = discardPolicy(view, offered)
    if (chosen.type !== 'discard') throw new Error('expected a discard')
    expect(kindOf(chosen.tile)).toBe('7p') // 123m 456m 99s 23p is tenpai; nothing else is
    expect(afterDiscard(view, chosen.tile)).toBe(0)
  })
})

describe('draw arm', () => {
  it('takes the offered draw at a pre-draw point, ignoring other seats\' claim offers', () => {
    const take = tileSource()
    const view = viewOf({ seat: 1, hand: take('123m456m789m99s5p') })
    const draw: HandAction = { type: 'draw', seat: 1 }
    const [claimTile, u1, u2] = take('333s')
    const offered: HandAction[] = [
      draw,
      { type: 'ron', seat: 3, tile: claimTile },
      { type: 'pon', seat: 2, tile: claimTile, uses: [u1, u2] },
    ]
    expect(discardPolicy(view, offered)).toBe(draw)
  })

  it('takes the draw over its own pre-draw ron — the deliberate deferral to the call branch (T-006-03-02)', () => {
    const take = tileSource()
    const view = viewOf({ seat: 1, hand: take('123m456m789m99s5p') })
    const draw: HandAction = { type: 'draw', seat: 1 }
    const offered: HandAction[] = [draw, { type: 'ron', seat: 1, tile: take('5p')[0] }]
    expect(discardPolicy(view, offered)).toBe(draw)
  })
})

describe('contract violations', () => {
  it('throws RangeError on an offered set holding nothing for this seat', () => {
    const take = tileSource()
    const view = viewOf({ seat: 2, hand: take('123m456m789m99s5p') })
    const [claimTile, u1, u2] = take('333s')
    const offered: HandAction[] = [
      { type: 'draw', seat: 1 },
      { type: 'pon', seat: 3, tile: claimTile, uses: [u1, u2] },
    ]
    expect(() => discardPolicy(view, offered)).toThrow(RangeError)
    expect(() => discardPolicy(view, offered)).toThrow(/own-turn/)
  })

  it('throws RangeError on an empty offered set', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('123m456m789m99s5p') })
    expect(() => discardPolicy(view, [])).toThrow(RangeError)
  })
})

describe('purity and determinism', () => {
  it('returns the identical element on repeated calls and never mutates its inputs', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('123m456m789m99s5p1z'), drawn: take('7z')[0] })
    const offered = discardsOf(view)
    const viewSnapshot = JSON.stringify(view)
    const offeredSnapshot = JSON.stringify(offered)
    const first = discardPolicy(view, offered)
    const second = discardPolicy(view, offered)
    expect(second).toBe(first)
    expect(offered).toContain(first)
    expect(JSON.stringify(view)).toBe(viewSnapshot)
    expect(JSON.stringify(offered)).toBe(offeredSnapshot)
  })

  it('returns a structurally equal action from structurally equal inputs', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('123m456m789m99s5p1z'), drawn: take('7z')[0] })
    const offered = discardsOf(view)
    const chosen = discardPolicy(view, offered)
    const cloned = discardPolicy(
      structuredClone(view) as SeatView,
      offered.map((a) => ({ ...a }) as HandAction),
    )
    expect(cloned).toEqual(chosen)
  })
})

// ---------------------------------------------------------------------------------
// The seeded sweep: whole games driven by the policy itself.

/** The dynamics.test.ts action-bound arithmetic — a tripped bound is a non-terminating loop, not a long game. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE
const ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 * SEAT_COUNT + 2

/**
 * Drive a full hand from a seed with every own-turn decision made by discardPolicy
 * (during 'playing', every non-empty offered set IS an own-turn point: pre-draw sets
 * lead with the turn seat's draw, post-draw and mustDiscard sets are the turn seat's).
 * The walk stops at an ended phase — ryuukyoku's houtei-only offered set is the one
 * class the policy must never be shown. Checks are plain throws so the sweep stays
 * one-expect-per-game; state advances only by refolding the longer record.
 */
function playPolicy(seed: number): { actions: HandAction[]; endPhase: string } {
  const actions: HandAction[] = []
  for (;;) {
    const state = foldRecord({ seed, actions })
    const legal = legalActions(state)
    if (state.phase !== 'playing' || legal.length === 0) {
      return { actions, endPhase: state.phase }
    }
    const seat = state.turn
    const chosen = discardPolicy(seatView(state, seat), legal)
    if (!legal.includes(chosen)) {
      throw new Error(`seed ${seed} step ${actions.length}: chosen action is not an offered element`)
    }
    const tsumo = legal.find((a) => a.type === 'tsumo' && a.seat === seat)
    if (tsumo && chosen !== tsumo) {
      throw new Error(`seed ${seed} step ${actions.length}: offered tsumo was not taken`)
    }
    if (chosen.type === 'discard') {
      const pool = state.drawn === null ? [...state.hands[seat]] : [...state.hands[seat], state.drawn]
      const melds = state.melds[seat]
      const score = (tile: TileId): number =>
        shanten(pool.filter((t) => t !== tile).map(kindOf), melds)
      const best = Math.min(
        ...legal
          .filter((a): a is Extract<HandAction, { type: 'discard' }> => a.type === 'discard')
          .map((a) => score(a.tile)),
      )
      if (score(chosen.tile) !== best) {
        throw new Error(`seed ${seed} step ${actions.length}: discard is not shanten-minimal`)
      }
      if (state.drawn !== null && score(chosen.tile) > shanten(state.hands[seat].map(kindOf), melds)) {
        throw new Error(`seed ${seed} step ${actions.length}: discard raised shanten past the pre-draw hand`)
      }
    }
    actions.push(chosen)
    if (actions.length > ACTION_BOUND) {
      throw new Error(`seed ${seed}: policy-driven game is not terminating`)
    }
  }
}

describe('property: the policy over seeded whole games', () => {
  // Corpus size is a runtime budget: each seed costs ~150ms (every prefix refolds —
  // the dynamics.test.ts O(n²) shape — plus the oracle re-scores every discard).
  const CORPUS_SEEDS = Array.from({ length: 12 }, (_, i) => i)

  it('plays every corpus seed to an end under the AC at every decision point', () => {
    for (const seed of CORPUS_SEEDS) {
      const { endPhase } = playPolicy(seed)
      expect(['ryuukyoku', 'agari']).toContain(endPhase)
    }
  })

  it('replays byte-identically — same seed, same action list (the T-006-03-04 rehearsal)', () => {
    for (const seed of [0, 7, 23]) {
      expect(playPolicy(seed).actions).toEqual(playPolicy(seed).actions)
    }
  })

  it('holds across sampled seeds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const { endPhase } = playPolicy(seed)
        expect(['ryuukyoku', 'agari']).toContain(endPhase)
      }),
      { numRuns: 6 },
    )
  })
})
