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
  callPolicy,
  discardPolicy,
  foldRecord,
  isSimple,
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
  type TableState,
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
  claimable?: SeatView['claimable']
  phase?: SeatView['phase']
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
    phase: partial.phase ?? 'playing',
    claimable: partial.claimable ?? null,
    mustDiscard: partial.mustDiscard ?? false,
    win: null,
    riichi: [false, false, false, false],
    pot: 0,
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
// The call branch: claim windows and houtei.

/** Post-call shanten, test-side: the remainder plus the claim folded as a meld — the policy scorer's oracle twin. */
function afterClaim(
  view: SeatView,
  uses: readonly TileId[],
  meld: Meld,
): number {
  return shanten(
    view.hand.filter((t) => !uses.includes(t)).map(kindOf),
    [...view.melds[view.seat], meld],
  )
}

describe('callPolicy — ron arm', () => {
  it('returns an own window ron unconditionally, even offered after a takeable claim', () => {
    const take = tileSource()
    const [w1, w2, windowTile] = take('555z')
    const view = viewOf({
      seat: 2,
      hand: [...take('234m567p2489s1z'), w1, w2],
      claimable: { seat: 0, tile: windowTile },
    })
    const ron: HandAction = { type: 'ron', seat: 2, tile: windowTile }
    const offered: HandAction[] = [
      { type: 'draw', seat: 1 },
      { type: 'pon', seat: 2, tile: windowTile, uses: [w1, w2] },
      ron,
    ]
    expect(callPolicy(view, offered)).toBe(ron)
  })

  it('returns the houtei ron out of ryuukyoku (the rons-only offered set)', () => {
    const take = tileSource()
    const view = viewOf({ seat: 1, hand: take('123m456p789s1122z'), phase: 'ryuukyoku' })
    const ron: HandAction = { type: 'ron', seat: 1, tile: take('2z')[0] }
    expect(callPolicy(view, [ron])).toBe(ron)
  })

  it('never takes another seat\'s ron — the own claim logic runs instead', () => {
    const take = tileSource()
    const [w1, w2, windowTile] = take('555z')
    // Pon 5z here fails the strict cut (post === pre, see the declines suite), so the
    // seat passes: the draw comes back, never seat 3's ron.
    const view = viewOf({
      seat: 1,
      hand: [...take('234m567p2489s1z'), w1, w2],
      claimable: { seat: 3, tile: windowTile },
    })
    const draw: HandAction = { type: 'draw', seat: 0 }
    const offered: HandAction[] = [
      draw,
      { type: 'ron', seat: 3, tile: windowTile },
      { type: 'pon', seat: 1, tile: windowTile, uses: [w1, w2] },
    ]
    expect(callPolicy(view, offered)).toBe(draw)
  })
})

describe('callPolicy — accepts', () => {
  it('takes a yakuhai pon that cuts shanten (the new meld is the anchor)', () => {
    const take = tileSource()
    const [h1, h2, windowTile] = take('555z')
    const view = viewOf({
      seat: 1,
      hand: [...take('345m24m567p889s'), h1, h2],
      claimable: { seat: 3, tile: windowTile },
    })
    const pon: HandAction = { type: 'pon', seat: 1, tile: windowTile, uses: [h1, h2] }
    const offered: HandAction[] = [{ type: 'draw', seat: 0 }, pon]
    expect(callPolicy(view, offered)).toBe(pon)
    // The cut, re-derived: 1-shanten hand reaches tenpai through the claim.
    expect(shanten(view.hand.map(kindOf), [])).toBe(1)
    expect(
      afterClaim(view, [h1, h2], { type: 'pon', claimed: windowTile, from: 3, own: [h1, h2] }),
    ).toBe(0)
  })

  it('takes a kuitan chi on an all-simples hand (the tanyao anchor)', () => {
    const take = tileSource()
    const [u1, u2] = [take('3s')[0], take('5s')[0]]
    const windowTile = take('4s')[0]
    const view = viewOf({
      seat: 1,
      hand: [...take('2346m44m678p88s'), u1, u2],
      claimable: { seat: 0, tile: windowTile },
    })
    const chi: HandAction = { type: 'chi', seat: 1, tile: windowTile, uses: [u1, u2] }
    const offered: HandAction[] = [{ type: 'draw', seat: 1 }, chi]
    expect(callPolicy(view, offered)).toBe(chi)
    expect(shanten(view.hand.map(kindOf), [])).toBe(1)
    expect(
      afterClaim(view, [u1, u2], { type: 'chi', claimed: windowTile, from: 0, own: [u1, u2] }),
    ).toBe(0)
  })

  it('takes a second call when an existing yakuhai pon already anchors the open hand', () => {
    const take = tileSource()
    const [c, o1, o2] = take('666z')
    const hatsuPon: Meld = { type: 'pon', claimed: c, from: 3, own: [o1, o2] }
    const [u1, u2] = [take('4p')[0], take('5p')[0]]
    const windowTile = take('6p')[0]
    // 1z in the remainder and a non-simple meld: the tanyao arm is dead both ways —
    // only the existing hatsu pon anchors this accept.
    const view = viewOf({
      seat: 1,
      hand: [...take('123m78p99s1z'), u1, u2],
      melds: [hatsuPon],
      claimable: { seat: 0, tile: windowTile },
    })
    const chi: HandAction = { type: 'chi', seat: 1, tile: windowTile, uses: [u1, u2] }
    const offered: HandAction[] = [{ type: 'draw', seat: 1 }, chi]
    expect(callPolicy(view, offered)).toBe(chi)
    expect(shanten(view.hand.map(kindOf), [hatsuPon])).toBe(1)
    expect(
      afterClaim(view, [u1, u2], { type: 'chi', claimed: windowTile, from: 0, own: [u1, u2] }),
    ).toBe(0)
  })
})

describe('callPolicy — declines (the pass is the offered draw)', () => {
  it('passes a shanten-cutting chi that would strand an open yakuless hand — the AC case', () => {
    const take = tileSource()
    const [u1, u2] = [take('8m')[0], take('9m')[0]]
    const windowTile = take('7m')[0]
    // No value pair anywhere, and the 789m meld holds a 9m — both anchor arms fail,
    // so the cut (1-shanten → tenpai, re-derived below) is not enough.
    const view = viewOf({
      seat: 1,
      hand: [...take('234p67p345s99s1z'), u1, u2],
      claimable: { seat: 0, tile: windowTile },
    })
    const draw: HandAction = { type: 'draw', seat: 1 }
    const chi: HandAction = { type: 'chi', seat: 1, tile: windowTile, uses: [u1, u2] }
    expect(callPolicy(view, [draw, chi])).toBe(draw)
    expect(shanten(view.hand.map(kindOf), [])).toBe(1)
    expect(
      afterClaim(view, [u1, u2], { type: 'chi', claimed: windowTile, from: 0, own: [u1, u2] }),
    ).toBe(0)
  })

  it('passes a pon that does not lower shanten, even with the yaku secured', () => {
    const take = tileSource()
    const [h1, h2, windowTile] = take('555z')
    // The 5z pair serves as the head; melding it just moves the pair out and leaves
    // the hand headless — post equals pre, and the haku anchor cannot buy the claim.
    const view = viewOf({
      seat: 1,
      hand: [...take('234m567p2489s1z'), h1, h2],
      claimable: { seat: 3, tile: windowTile },
    })
    const draw: HandAction = { type: 'draw', seat: 0 }
    const pon: HandAction = { type: 'pon', seat: 1, tile: windowTile, uses: [h1, h2] }
    expect(callPolicy(view, [draw, pon])).toBe(draw)
    const pre = shanten(view.hand.map(kindOf), [])
    expect(
      afterClaim(view, [h1, h2], { type: 'pon', claimed: windowTile, from: 3, own: [h1, h2] }),
    ).toBe(pre)
  })

  it('never takes a daiminkan — the cut-rule theorem, even with a yakuhai anchor', () => {
    const take = tileSource()
    const [k1, k2, k3, windowTile] = take('5555z')
    // The concealed 555z already counts as a set, so the kan trades it for the meld
    // discount: post === pre, structurally — the anchor (a haku kan!) never matters.
    const view = viewOf({
      seat: 1,
      hand: [...take('234m567p24s89s'), k1, k2, k3],
      claimable: { seat: 3, tile: windowTile },
    })
    const draw: HandAction = { type: 'draw', seat: 0 }
    const kan: HandAction = { type: 'daiminkan', seat: 1, tile: windowTile, uses: [k1, k2, k3] }
    expect(callPolicy(view, [draw, kan])).toBe(draw)
    const pre = shanten(view.hand.map(kindOf), [])
    expect(
      afterClaim(view, [k1, k2, k3], {
        type: 'daiminkan',
        claimed: windowTile,
        from: 3,
        own: [k1, k2, k3],
      }),
    ).toBe(pre)
  })
})

describe('callPolicy — tie-break: earliest offered', () => {
  it('takes the pon over an equally-cutting chi — claim precedence from the frozen order', () => {
    const take = tileSource()
    const [p1, p2] = take('55p')
    const [c1, c2] = [take('4p')[0], take('6p')[0]]
    const windowTile = take('5p')[0]
    const view = viewOf({
      seat: 1,
      hand: [...take('234m678s88m2m'), p1, p2, c1, c2],
      claimable: { seat: 0, tile: windowTile },
    })
    const pon: HandAction = { type: 'pon', seat: 1, tile: windowTile, uses: [p1, p2] }
    const chi: HandAction = { type: 'chi', seat: 1, tile: windowTile, uses: [c1, c2] }
    // Both cut 1 → 0 and both anchor through kuitan; the offered order decides.
    expect(callPolicy(view, [{ type: 'draw', seat: 1 }, pon, chi])).toBe(pon)
    expect(
      afterClaim(view, [p1, p2], { type: 'pon', claimed: windowTile, from: 0, own: [p1, p2] }),
    ).toBe(
      afterClaim(view, [c1, c2], { type: 'chi', claimed: windowTile, from: 0, own: [c1, c2] }),
    )
  })

  it('breaks a copy-variant tie by offered order, not copy index', () => {
    const take = tileSource()
    const [sFirst, sSecond] = take('33s')
    const five = take('5s')[0]
    const windowTile = take('4s')[0]
    const view = viewOf({
      seat: 1,
      hand: [...take('234m678p88m46m'), sFirst, sSecond, five],
      claimable: { seat: 0, tile: windowTile },
    })
    // Curated offered subset: the two 3s-copy variants, deliberately reversed —
    // equal cut, equal anchor, so the EARLIEST OFFERED (the later copy) must win.
    const offered: HandAction[] = [
      { type: 'draw', seat: 1 },
      { type: 'chi', seat: 1, tile: windowTile, uses: [sSecond, five] },
      { type: 'chi', seat: 1, tile: windowTile, uses: [sFirst, five] },
    ]
    expect(callPolicy(view, offered)).toBe(offered[1])
  })
})

describe('callPolicy — contract violations', () => {
  it('throws RangeError on an own-turn post-draw offered set', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('123m456m789m99s5p'), drawn: take('1z')[0] })
    const offered = discardsOf(view)
    expect(() => callPolicy(view, offered)).toThrow(RangeError)
    expect(() => callPolicy(view, offered)).toThrow(/claim windows and houtei/)
  })

  it('throws RangeError on an empty offered set', () => {
    const take = tileSource()
    const view = viewOf({ hand: take('123m456m789m99s5p') })
    expect(() => callPolicy(view, [])).toThrow(RangeError)
  })

  it('throws RangeError on a houtei set holding only another seat\'s ron', () => {
    const take = tileSource()
    const view = viewOf({ seat: 2, hand: take('123m456m789m99s5p'), phase: 'ryuukyoku' })
    const offered: HandAction[] = [{ type: 'ron', seat: 3, tile: take('5p')[0] }]
    expect(() => callPolicy(view, offered)).toThrow(RangeError)
  })
})

describe('callPolicy — purity and determinism', () => {
  it('returns the identical element on repeated calls and never mutates its inputs', () => {
    const take = tileSource()
    const [h1, h2, windowTile] = take('555z')
    const view = viewOf({
      seat: 1,
      hand: [...take('345m24m567p889s'), h1, h2],
      claimable: { seat: 3, tile: windowTile },
    })
    const offered: HandAction[] = [
      { type: 'draw', seat: 0 },
      { type: 'pon', seat: 1, tile: windowTile, uses: [h1, h2] },
    ]
    const viewSnapshot = JSON.stringify(view)
    const offeredSnapshot = JSON.stringify(offered)
    const first = callPolicy(view, offered)
    const second = callPolicy(view, offered)
    expect(second).toBe(first)
    expect(offered).toContain(first)
    expect(JSON.stringify(view)).toBe(viewSnapshot)
    expect(JSON.stringify(offered)).toBe(offeredSnapshot)
  })

  it('returns a structurally equal action from structurally equal inputs', () => {
    const take = tileSource()
    const [h1, h2, windowTile] = take('555z')
    const view = viewOf({
      seat: 1,
      hand: [...take('345m24m567p889s'), h1, h2],
      claimable: { seat: 3, tile: windowTile },
    })
    const offered: HandAction[] = [
      { type: 'draw', seat: 0 },
      { type: 'pon', seat: 1, tile: windowTile, uses: [h1, h2] },
    ]
    const chosen = callPolicy(view, offered)
    const cloned = callPolicy(
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

/** The claim-window call forms, test-side (the policy module's ClaimOffer twin). */
type ClaimAction = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

function isClaimAction(action: HandAction): action is ClaimAction {
  return action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan'
}

/**
 * The oracle twin of the accept rule: a claim the sweep is about to fold must
 * strictly cut shanten and keep a yaku anchor — re-derived here from the folded
 * state, independently of the policy's own arithmetic.
 */
function assertClaimSound(state: TableState, claim: ClaimAction, seed: number, step: number): void {
  const seat = claim.seat
  const hand = state.hands[seat]
  const melds = state.melds[seat]
  const from = state.claimable!.seat
  const meld: Meld =
    claim.type === 'daiminkan'
      ? { type: 'daiminkan', claimed: claim.tile, from, own: claim.uses }
      : { type: claim.type, claimed: claim.tile, from, own: claim.uses }
  const remainder = hand.filter((t) => !(claim.uses as readonly TileId[]).includes(t)).map(kindOf)
  const allMelds = [...melds, meld]
  const pre = shanten(hand.map(kindOf), melds)
  const post = shanten(remainder, allMelds)
  if (post >= pre) {
    throw new Error(`seed ${seed} step ${step}: folded claim does not cut shanten (${pre} → ${post})`)
  }
  const valueKinds: TileKind[] = ['5z', '6z', '7z', `${seat + 1}z` as TileKind, '1z']
  const tilesOf = (m: Meld): readonly TileId[] => (m.type === 'ankan' ? m.own : [m.claimed, ...m.own])
  const yakuhai =
    allMelds.some((m) => m.type !== 'chi' && valueKinds.includes(kindOf(m.own[0]))) ||
    valueKinds.some((v) => remainder.filter((k) => k === v).length >= 2)
  const tanyao =
    allMelds.every((m) => tilesOf(m).every((t) => isSimple(kindOf(t)))) &&
    remainder.filter((k) => !isSimple(k)).length <= post + 1
  if (!yakuhai && !tanyao) {
    throw new Error(`seed ${seed} step ${step}: folded claim keeps no yaku anchor`)
  }
}

/**
 * Drive a full hand from a seed with every decision made by the policy pair —
 * discardPolicy at own-turn points, callPolicy at claim windows and houtei — and the
 * driver arbitrating across seats exactly as T-006-03-03 will: consult callPolicy
 * once per seat holding a window offer, fold the earliest non-draw answer in offered
 * order (ron-before-claims, atamahane among rons, pon-before-chi), else the draw.
 * Checks are plain throws so the sweep stays one-expect-per-game; state advances
 * only by refolding the longer record.
 */
function playPolicy(seed: number): {
  actions: HandAction[]
  endPhase: string
  claimsFolded: number
  ronsFolded: number
} {
  const actions: HandAction[] = []
  let claimsFolded = 0
  let ronsFolded = 0
  for (;;) {
    const state = foldRecord({ seed, actions })
    const legal = legalActions(state)
    if (state.phase === 'agari' || legal.length === 0) {
      return { actions, endPhase: state.phase, claimsFolded, ronsFolded }
    }
    const step = actions.length
    let chosen: HandAction
    const isCallPoint =
      state.phase === 'ryuukyoku' ||
      (state.drawn === null && !state.mustDiscard && state.claimable !== null)
    if (isCallPoint) {
      // Consult each offer-holding seat once, in offered order (rotation order).
      const consulted = new Set<number>()
      let best: HandAction | null = null
      let bestAt = Infinity
      for (const offer of legal) {
        if (offer.type !== 'ron' && !isClaimAction(offer)) continue
        if (consulted.has(offer.seat)) continue
        consulted.add(offer.seat)
        const answer = callPolicy(seatView(state, offer.seat), legal)
        if (!legal.includes(answer)) {
          throw new Error(`seed ${seed} step ${step}: call answer is not an offered element`)
        }
        const ron = legal.find((a) => a.type === 'ron' && a.seat === offer.seat)
        if (ron && answer !== ron) {
          throw new Error(`seed ${seed} step ${step}: offered ron was not taken`)
        }
        if (answer.type === 'draw') continue
        const at = legal.indexOf(answer)
        if (at < bestAt) {
          best = answer
          bestAt = at
        }
      }
      if (best === null) {
        if (state.phase === 'ryuukyoku') {
          // Every houtei ron holder must have answered with its ron above; with no
          // ron offers at all the legal set was empty and the walk already returned.
          throw new Error(`seed ${seed} step ${step}: ryuukyoku call point declined every ron`)
        }
        chosen = legal[0] // the draw at the head — every consulted seat passed
        if (chosen.type !== 'draw') {
          throw new Error(`seed ${seed} step ${step}: pre-draw offered set does not lead with the draw`)
        }
      } else {
        if (isClaimAction(best)) {
          assertClaimSound(state, best, seed, step)
          claimsFolded += 1
        } else {
          ronsFolded += 1
        }
        chosen = best
      }
    } else {
      const seat = state.turn
      chosen = discardPolicy(seatView(state, seat), legal)
      if (!legal.includes(chosen)) {
        throw new Error(`seed ${seed} step ${step}: chosen action is not an offered element`)
      }
      const tsumo = legal.find((a) => a.type === 'tsumo' && a.seat === seat)
      if (tsumo && chosen !== tsumo) {
        throw new Error(`seed ${seed} step ${step}: offered tsumo was not taken`)
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
          throw new Error(`seed ${seed} step ${step}: discard is not shanten-minimal`)
        }
        if (state.drawn !== null && score(chosen.tile) > shanten(state.hands[seat].map(kindOf), melds)) {
          throw new Error(`seed ${seed} step ${step}: discard raised shanten past the pre-draw hand`)
        }
      }
    }
    actions.push(chosen)
    if (actions.length > ACTION_BOUND) {
      throw new Error(`seed ${seed}: policy-driven game is not terminating`)
    }
  }
}

describe('property: the policy pair over seeded whole games', () => {
  // Corpus size is a runtime budget: each seed costs ~150ms (every prefix refolds —
  // the dynamics.test.ts O(n²) shape — plus the oracle re-scores every discard and
  // every folded claim). Explicit timeouts because CI-adjacent machines run suites
  // concurrently — the budget is generous headroom, not expected runtime.
  const CORPUS_SEEDS = Array.from({ length: 12 }, (_, i) => i)

  it('plays every corpus seed to an end under the AC at every decision point', { timeout: 60_000 }, () => {
    let claims = 0
    for (const seed of CORPUS_SEEDS) {
      const { endPhase, claimsFolded } = playPolicy(seed)
      expect(['ryuukyoku', 'agari']).toContain(endPhase)
      claims += claimsFolded
    }
    // The branch must actually be exercised: a driver that silently never consults
    // callPolicy would pass every per-step oracle. If a corpus change ever zeroes
    // this, widen the corpus rather than weakening the check.
    expect(claims).toBeGreaterThan(0)
  })

  it('replays byte-identically — same seed, same action list (the T-006-03-04 rehearsal)', { timeout: 60_000 }, () => {
    for (const seed of [0, 7, 23]) {
      expect(playPolicy(seed).actions).toEqual(playPolicy(seed).actions)
    }
  })

  it('holds across sampled seeds', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const { endPhase } = playPolicy(seed)
        expect(['ryuukyoku', 'agari']).toContain(endPhase)
      }),
      { numRuns: 6 },
    )
  })
})
