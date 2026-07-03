// The tsumo/ron fold suite: the win vocabulary's conventions pinned over REAL
// seeded logs — an ended 'agari' phase carrying winner/tile/yaku, the corrupt-win
// throws (wrong seat, non-winning tile, yakuless — the one-yaku gate), the
// single-winner multiple-ron convention, the houtei ryuukyoku→agari arm, and
// replay determinism. Fixtures were seed-mined (the FOUR_KAN_SEED precedent):
// under all-tsumogiri play a seat's 13-tile hand never changes, so a dealt-tenpai
// seat wins the moment a wait kind arrives — each constant below names its seed,
// the winner, and where the winning tile sits in the frozen wall order. The
// haitei and rinshan fixtures add ONE scripted tedashi (swap a dealt tile for a
// draw) to reach the shapes pure tsumogiri cannot.

import { describe, expect, it } from 'vitest'
import {
  SEAT_COUNT,
  TILE_COUNT,
  foldRecord,
  legalActions,
  type HandAction,
  type Seat,
  type TableState,
  type TileId,
} from './index'

/** The post-deal live wall (draw order) — the authority the scripts read. */
function dealtLive(seed: number): TileId[] {
  return foldRecord({ seed, actions: [] }).live
}

/**
 * A scripted prefix: `turns` full turns where every seat discards its draw,
 * except turns listed in `swaps`, which tedashi the given hand tile instead
 * (keeping the draw — the one hand-shape edit the miners used).
 */
function scriptedTurns(
  live: readonly TileId[],
  turns: number,
  swaps: ReadonlyMap<number, TileId> = new Map(),
): HandAction[] {
  const actions: HandAction[] = []
  for (let t = 0; t < turns; t++) {
    const seat = (t % SEAT_COUNT) as Seat
    actions.push(
      { type: 'draw', seat },
      { type: 'discard', seat, tile: swaps.get(t) ?? live[t] },
    )
  }
  return actions
}

/** Every zone of the conservation partition — the winning tile must stay in one. */
function allZones(state: TableState): TileId[] {
  return [
    ...state.hands.flat(),
    ...state.melds.flat().flatMap((meld) => meld.own),
    ...state.ponds.flat(),
    ...(state.drawn === null ? [] : [state.drawn]),
    ...state.live,
    ...state.dead,
  ]
}

function expectConserved(state: TableState): void {
  const everything = allZones(state)
  expect(everything.length).toBe(TILE_COUNT)
  expect(new Set(everything).size).toBe(TILE_COUNT)
}

// ---------------------------------------------------------------------------
// Fixtures. Seed 3951 deals seat 3 a tenpai pinfu hand waiting on 1s/4s/7s:
// seat 0's very first tsumogiri (live[0] = 72, a 1s) is ron-able, and seat 3's
// own draw at turn 35 (live[35] = 85, a 4s) is a self-draw win.
// ---------------------------------------------------------------------------

const TSUMO_SEED = 3951
/** 35 tsumogiri turns, then seat 3 draws its wait (tile 85, 4s). */
function tsumoActions(): HandAction[] {
  return [
    ...scriptedTurns(dealtLive(TSUMO_SEED), 35),
    { type: 'draw', seat: 3 },
    { type: 'tsumo', seat: 3 },
  ]
}

/** Seat 0 tsumogiris tile 72 (1s) on turn 0; seat 3 rons it. */
function ronActions(): HandAction[] {
  return [
    { type: 'draw', seat: 0 },
    { type: 'discard', seat: 0, tile: 72 },
    { type: 'ron', seat: 3, tile: 72 },
  ]
}

/** Seed 12754: seat 2 completes on seat 1's turn-1 discard (tile 101, 8s) with NO yaku. */
const YAKULESS_SEED = 12754
function yakulessRonActions(): HandAction[] {
  return [...scriptedTurns(dealtLive(YAKULESS_SEED), 2), { type: 'ron', seat: 2, tile: 101 }]
}

/** Seed 103897: the FINAL discard (turn 69, seat 1, tile 72) is seat 2's pinfu win — houtei. */
const HOUTEI_SEED = 103897
function houteiPrefix(): HandAction[] {
  return scriptedTurns(dealtLive(HOUTEI_SEED), 70)
}

/**
 * Seed 47821: seat 1 tedashis tile 41 on its first turn (keeping the draw) and
 * from then on holds a tenpai hand whose wait (1s) arrives as live[69] — the
 * last live draw. Its tsumo is haitei.
 */
const HAITEI_SEED = 47821
function haiteiActions(): HandAction[] {
  return [
    ...scriptedTurns(dealtLive(HAITEI_SEED), 69, new Map([[1, 41]])),
    { type: 'draw', seat: 1 },
    { type: 'tsumo', seat: 1 },
  ]
}

/**
 * Seed 29732: seat 1 holds a dealt 9m triplet (ids 32/33/35); a tedashi on turn
 * 45 (out 58, keeping the draw) shapes the rest, the fourth 9m (id 34) arrives
 * as its own turn-49 draw, the ankan's rinshan replacement (dead[0] = 22, a 6m)
 * completes the hand — rinshan kaihou.
 */
const RINSHAN_SEED = 29732
function rinshanPrefix(): HandAction[] {
  return [
    ...scriptedTurns(dealtLive(RINSHAN_SEED), 49, new Map([[45, 58]])),
    { type: 'draw', seat: 1 },
    { type: 'ankan', seat: 1, uses: [33, 32, 35, 34] },
  ]
}

describe('tsumo folds', () => {
  it('ends the hand in agari: winner, winning tile, and yaku recorded; the tile stays in drawn', () => {
    const state = foldRecord({ seed: TSUMO_SEED, actions: tsumoActions() })
    expect(state.phase).toBe('agari')
    expect(state.win).toEqual({
      by: 'tsumo',
      winner: 3,
      tile: 85,
      yaku: ['menzen-tsumo', 'pinfu'],
    })
    expect(state.drawn).toBe(85)
    expect(state.drawnFrom).toBe('wall')
    expect(state.turn).toBe(3)
    expect(state.claimable).toBeNull()
    expectConserved(state)
  })

  it('an ended agari offers nothing and accepts nothing', () => {
    const actions = tsumoActions()
    const state = foldRecord({ seed: TSUMO_SEED, actions })
    expect(legalActions(state)).toEqual([])
    for (const after of [
      { type: 'draw', seat: 0 },
      { type: 'discard', seat: 3, tile: 85 },
      { type: 'tsumo', seat: 3 },
      { type: 'ron', seat: 0, tile: 85 },
    ] satisfies HandAction[]) {
      expect(() =>
        foldRecord({ seed: TSUMO_SEED, actions: [...actions, after] }),
      ).toThrow('already ended in agari')
    }
  })
})

describe('ron folds', () => {
  it('ends the hand in agari with the discarder recorded; the tile stays in the pond; the turn jumps to the winner', () => {
    const state = foldRecord({ seed: TSUMO_SEED, actions: ronActions() })
    expect(state.phase).toBe('agari')
    expect(state.win).toEqual({
      by: 'ron',
      winner: 3,
      from: 0,
      tile: 72,
      yaku: ['pinfu'],
    })
    expect(state.ponds[0]).toEqual([72])
    expect(state.turn).toBe(3)
    expect(state.claimable).toBeNull()
    expect(state.drawn).toBeNull()
    expectConserved(state)
  })
})

describe('corrupt win actions throw instead of folding silently', () => {
  it('tsumo by a seat out of turn', () => {
    const prefix = tsumoActions().slice(0, -1)
    expect(() =>
      foldRecord({ seed: TSUMO_SEED, actions: [...prefix, { type: 'tsumo', seat: 0 }] }),
    ).toThrow("tsumo by seat 0, but it is seat 3's turn")
  })

  it('tsumo before the seat drew', () => {
    const prefix = tsumoActions().slice(0, -2)
    expect(() =>
      foldRecord({ seed: TSUMO_SEED, actions: [...prefix, { type: 'tsumo', seat: 3 }] }),
    ).toThrow('tsumo before seat 3 drew')
  })

  it('tsumo while a claim discard is owed', () => {
    // Walk the tsumogiri script until legality offers a chi or pon; fold it and
    // let the caller "declare tsumo" while owing the claim discard.
    const live = dealtLive(TSUMO_SEED)
    for (let turns = 1; turns <= 70; turns++) {
      const prefix = scriptedTurns(live, turns)
      const claim = legalActions(foldRecord({ seed: TSUMO_SEED, actions: prefix })).find(
        (offer) => offer.type === 'chi' || offer.type === 'pon',
      )
      if (claim === undefined) continue
      expect(() =>
        foldRecord({
          seed: TSUMO_SEED,
          actions: [...prefix, claim, { type: 'tsumo', seat: claim.seat }],
        }),
      ).toThrow(`tsumo out of sequence — seat ${claim.seat} owes a discard for its claim`)
      return
    }
    throw new Error('no claim offer arose over the whole scripted hand')
  })

  it('tsumo on a drawn tile that completes nothing', () => {
    expect(() =>
      foldRecord({
        seed: TSUMO_SEED,
        actions: [{ type: 'draw', seat: 0 }, { type: 'tsumo', seat: 0 }],
      }),
    ).toThrow("does not complete seat 0's hand")
  })

  it('ron with no claimable discard — nothing discarded, or gone stale on the next draw', () => {
    expect(() =>
      foldRecord({
        seed: TSUMO_SEED,
        actions: [{ type: 'draw', seat: 0 }, { type: 'ron', seat: 3, tile: 72 }],
      }),
    ).toThrow('ron by seat 3 with no claimable discard')
    expect(() =>
      foldRecord({
        seed: TSUMO_SEED,
        actions: [
          { type: 'draw', seat: 0 },
          { type: 'discard', seat: 0, tile: 72 },
          { type: 'draw', seat: 1 },
          { type: 'ron', seat: 3, tile: 72 },
        ],
      }),
    ).toThrow('ron by seat 3 with no claimable discard')
  })

  it('ron of the seat\'s own discard', () => {
    const prefix = ronActions().slice(0, -1)
    expect(() =>
      foldRecord({ seed: TSUMO_SEED, actions: [...prefix, { type: 'ron', seat: 0, tile: 72 }] }),
    ).toThrow('ron by seat 0 of its own discard')
  })

  it('ron naming a tile other than the fresh discard', () => {
    const prefix = ronActions().slice(0, -1)
    expect(() =>
      foldRecord({ seed: TSUMO_SEED, actions: [...prefix, { type: 'ron', seat: 3, tile: 73 }] }),
    ).toThrow('ron of tile 73, but the claimable discard is tile 72')
  })

  it('ron by a seat the tile does not complete', () => {
    const prefix = ronActions().slice(0, -1)
    expect(() =>
      foldRecord({ seed: TSUMO_SEED, actions: [...prefix, { type: 'ron', seat: 1, tile: 72 }] }),
    ).toThrow("does not complete seat 1's hand")
  })

  it('a yakuless completion is not a win — the one-yaku gate throws', () => {
    expect(() => foldRecord({ seed: YAKULESS_SEED, actions: yakulessRonActions() })).toThrow(
      'completes the hand with no yaku — a yakuless win is not a win (the one-yaku gate)',
    )
  })
})

describe('the multiple-ron convention: exactly one ron ends a hand', () => {
  it('a single ron folds to that winner; a second ron on the same discard throws', () => {
    const actions = ronActions()
    expect(foldRecord({ seed: TSUMO_SEED, actions }).win?.winner).toBe(3)
    for (const seat of [1, 2] as const) {
      expect(() =>
        foldRecord({ seed: TSUMO_SEED, actions: [...actions, { type: 'ron', seat, tile: 72 }] }),
      ).toThrow('already ended in agari')
    }
  })
})

describe('houtei and haitei — winning at the exhausted wall', () => {
  it('houtei: a ron folds OUT of ryuukyoku against the reconstructed final discard', () => {
    const prefix = houteiPrefix()
    const before = foldRecord({ seed: HOUTEI_SEED, actions: prefix })
    expect(before.phase).toBe('ryuukyoku')
    expect(before.claimable).toBeNull()
    const state = foldRecord({
      seed: HOUTEI_SEED,
      actions: [...prefix, { type: 'ron', seat: 2, tile: 72 }],
    })
    expect(state.phase).toBe('agari')
    expect(state.win).toEqual({
      by: 'ron',
      winner: 2,
      from: 1,
      tile: 72,
      yaku: ['pinfu', 'houtei'],
    })
    expectConserved(state)
  })

  it('the houtei arm keeps the ron guards: own discard, wrong tile, non-completing seat', () => {
    const prefix = houteiPrefix()
    expect(() =>
      foldRecord({ seed: HOUTEI_SEED, actions: [...prefix, { type: 'ron', seat: 1, tile: 72 }] }),
    ).toThrow('ron by seat 1 of its own discard')
    expect(() =>
      foldRecord({ seed: HOUTEI_SEED, actions: [...prefix, { type: 'ron', seat: 2, tile: 71 }] }),
    ).toThrow('but the claimable discard is tile 72')
    expect(() =>
      foldRecord({ seed: HOUTEI_SEED, actions: [...prefix, { type: 'ron', seat: 0, tile: 72 }] }),
    ).toThrow(RangeError)
  })

  it('only ron crosses ryuukyoku — every other action still throws', () => {
    const prefix = houteiPrefix()
    expect(() =>
      foldRecord({ seed: HOUTEI_SEED, actions: [...prefix, { type: 'draw', seat: 2 }] }),
    ).toThrow('already ended in ryuukyoku')
    expect(() =>
      foldRecord({ seed: HOUTEI_SEED, actions: [...prefix, { type: 'tsumo', seat: 2 }] }),
    ).toThrow('already ended in ryuukyoku')
  })

  it('haitei: the last live draw wins as a self-draw with the wall empty', () => {
    const state = foldRecord({ seed: HAITEI_SEED, actions: haiteiActions() })
    expect(state.live).toEqual([])
    expect(state.phase).toBe('agari')
    expect(state.win).toEqual({
      by: 'tsumo',
      winner: 1,
      tile: 73,
      yaku: ['menzen-tsumo', 'haitei'],
    })
    expectConserved(state)
  })
})

describe('rinshan — the win rides a kan replacement', () => {
  it('the kan tail marks drawnFrom rinshan, and the tsumo carries rinshan kaihou', () => {
    const prefix = rinshanPrefix()
    const afterKan = foldRecord({ seed: RINSHAN_SEED, actions: prefix })
    expect(afterKan.drawn).toBe(22)
    expect(afterKan.drawnFrom).toBe('rinshan')
    const state = foldRecord({
      seed: RINSHAN_SEED,
      actions: [...prefix, { type: 'tsumo', seat: 1 }],
    })
    expect(state.phase).toBe('agari')
    expect(state.win).toEqual({
      by: 'tsumo',
      winner: 1,
      tile: 22,
      yaku: ['menzen-tsumo', 'rinshan'],
    })
    expectConserved(state)
  })

  it('an ordinary discard clears drawnFrom with drawn', () => {
    const state = foldRecord({
      seed: TSUMO_SEED,
      actions: [
        { type: 'draw', seat: 0 },
        { type: 'discard', seat: 0, tile: 72 },
      ],
    })
    expect(state.drawn).toBeNull()
    expect(state.drawnFrom).toBeNull()
  })
})

describe('replay determinism — the same log reproduces the identical win', () => {
  const cases: readonly [string, number, () => HandAction[]][] = [
    ['tsumo', TSUMO_SEED, tsumoActions],
    ['ron', TSUMO_SEED, ronActions],
    ['houtei', HOUTEI_SEED, () => [...houteiPrefix(), { type: 'ron', seat: 2, tile: 72 }]],
    ['haitei', HAITEI_SEED, haiteiActions],
    ['rinshan', RINSHAN_SEED, () => [...rinshanPrefix(), { type: 'tsumo', seat: 1 }]],
  ]
  for (const [name, seed, build] of cases) {
    it(`${name}: fold twice → deep-equal states with fresh win arrays`, () => {
      const record = { seed, actions: build() }
      const first = foldRecord(record)
      const second = foldRecord(record)
      expect(second).toEqual(first)
      expect(second.win).not.toBeNull()
      expect(second.win).not.toBe(first.win)
      expect(second.win!.yaku).not.toBe(first.win!.yaku)
    })
  }
})
