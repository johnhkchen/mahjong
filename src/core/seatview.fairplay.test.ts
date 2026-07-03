// Fair play quantified — the T-006-01-02 property suite and the standing re-audit
// gate the seatview.ts header points at. seatview.test.ts pins the public/hidden
// partition of single real states; THIS suite proves the guarantee is structural by
// quantifying over hidden-tile siblings: take a folded TableState, permute the tiles
// the observing seat cannot see (the three other concealed hands, another seat's
// undisclosed drawn tile, the whole live wall, the unflipped dead wall) as one bag —
// slot for slot, a bijection — and the SeatView must come out DEEP-EQUAL, over
// tsumogiri breadth (fc) and over call-dense and agari corpus states (kans, kan-dora
// flips, rinshan-shortened walls, tsumo and ron wins). The dual clause is inclusion:
// every tile id a view carries is in the independently computed public set. The
// whole-object toEqual is deliberate: any later SeatView widening is dragged into the
// equivalence automatically, so a widening that leaks hidden state fails here without
// anyone remembering to update this file.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  TILE_COUNT,
  buildWall,
  createRng,
  dealHands,
  foldRecord,
  legalActions,
  nextInt,
  partitionWall,
  seatView,
  shuffleInPlace,
  type HandAction,
  type HandRecord,
  type Seat,
  type SeatView,
  type TableState,
  type TileId,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Any of the four observing seats. */
const seatArb = fc.integer({ min: 0, max: SEAT_COUNT - 1 }).map((s) => s as Seat)

/** Seeds for the sibling shuffle — same domain as wall seeds, fed to createRng. */
const permSeedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Complete draw+discard turns in a call-free full hand: one per post-deal live tile. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE // 70

/** Turn counts worth folding: 0 (dealt), mid-hand, and the full 70. */
const turnsArb = fc.integer({ min: 0, max: FULL_TURNS })

// ---------------------------------------------------------------------------
// State sources — test-local replicas per the dynamics.test.ts convention
// ("the generators are test-local by design"); origins cited on each.
// ---------------------------------------------------------------------------

/** The post-deal live wall for a seed, from the frozen upstream contracts (seatview.test.ts replica). */
function dealtLive(seed: number): number[] {
  return dealHands(partitionWall(buildWall(seed)).live).live
}

/** A tsumogiri-only record: `turns` draw+discard turns cycling E→S→W→N (seatview.test.ts replica). */
function tsumogiriRecord(seed: number, turns: number): HandRecord {
  const live = dealtLive(seed)
  const actions: HandAction[] = []
  for (let i = 0; i < turns; i++) {
    const seat = (i % SEAT_COUNT) as Seat
    actions.push({ type: 'draw', seat }, { type: 'discard', seat, tile: live[i] })
  }
  return { seed, actions }
}

/** A tsumogiri prefix optionally ending in a dangling draw (seatview.test.ts replica). */
function foldedState(seed: number, turns: number, dangleDraw: boolean): TableState {
  const record = tsumogiriRecord(seed, turns)
  if (dangleDraw && turns < FULL_TURNS) {
    record.actions = [...record.actions, { type: 'draw', seat: (turns % SEAT_COUNT) as Seat }]
  }
  return foldRecord(record)
}

/** The call vocabulary — chi/pon/kan forms (dynamics.test.ts replica). */
function isCall(action: HandAction): boolean {
  return (
    action.type !== 'draw' &&
    action.type !== 'discard' &&
    action.type !== 'tsumo' &&
    action.type !== 'ron'
  )
}

/** A win offer (dynamics.test.ts replica). */
function isWin(action: HandAction): boolean {
  return action.type === 'tsumo' || action.type === 'ron'
}

/** The hard action bound — a tripped bound is a non-terminating loop (dynamics.test.ts replica). */
const ACTION_BOUND = 2 * FULL_TURNS + 2 * (4 * SEAT_COUNT) + 2

/**
 * The deterministic greedy-call driver (dynamics.test.ts replica, verbatim): kans
 * first, then any call, wins filtered out, picks by core's own seeded rng — runs to
 * ryuukyoku with maximal call density.
 */
function playGreedy(seed: number): HandRecord {
  const rng = createRng(seed)
  const actions: HandAction[] = []
  for (;;) {
    const legal = legalActions(foldRecord({ seed, actions })).filter((a) => !isWin(a))
    if (legal.length === 0) return { seed, actions }
    const kans = legal.filter(
      (a) => a.type === 'daiminkan' || a.type === 'ankan' || a.type === 'shouminkan',
    )
    const calls = kans.length > 0 ? kans : legal.filter(isCall)
    const pool = calls.length > 0 ? calls : legal
    actions.push(pool[nextInt(rng, pool.length)])
    if (actions.length > ACTION_BOUND) {
      throw new Error(
        `playGreedy exceeded ${ACTION_BOUND} actions — the turn loop is not terminating`,
      )
    }
  }
}

/** The win-eager driver (dynamics.test.ts replica, verbatim): take any offered win, else sample uniformly. */
function playWinEager(seed: number): HandRecord {
  const rng = createRng(seed)
  const actions: HandAction[] = []
  for (;;) {
    const legal = legalActions(foldRecord({ seed, actions }))
    if (legal.length === 0) return { seed, actions }
    const wins = legal.filter(isWin)
    const pool = wins.length > 0 ? wins : legal
    actions.push(pool[nextInt(rng, pool.length)])
    if (actions.length > ACTION_BOUND) {
      throw new Error(
        `playWinEager exceeded ${ACTION_BOUND} actions — the turn loop is not terminating`,
      )
    }
  }
}

/**
 * Call-dense corpus seeds: 63/67/69 are the pinned ankan carriers under 100 (owned
 * and asserted by dynamics.test.ts — re-mine there first on trajectory-shifting
 * changes); 0/1/2 add ordinary chi/pon/daiminkan density. Never regenerate here.
 */
const GREEDY_SEEDS: readonly number[] = [0, 1, 2, 63, 67, 69]
const greedyCorpus: readonly HandRecord[] = GREEDY_SEEDS.map((seed) => playGreedy(seed))

/**
 * The pinned win carriers (dynamics.test.ts frozen anchors — never regenerate here):
 * win-eager games for these seeds end in agari; 876 and 950 in tsumo, the rest in
 * window rons, winners across seats 0/1/2.
 */
const WIN_CARRIER_SEEDS: readonly number[] = [100, 277, 360, 626, 731, 834, 876, 950]
const winCorpus: readonly HandRecord[] = WIN_CARRIER_SEEDS.map((seed) => playWinEager(seed))

// ---------------------------------------------------------------------------
// The surgery: hidden-tile siblings of a folded state.
// ---------------------------------------------------------------------------

/**
 * Deep-copy a TableState: every array fresh, meld elements and the claimable/win
 * records shared by reference (readonly-typed, never mutated after creation — the
 * seatview.ts sharing rationale).
 */
function copyState(state: TableState): TableState {
  return {
    hands: [[...state.hands[0]], [...state.hands[1]], [...state.hands[2]], [...state.hands[3]]],
    live: [...state.live],
    dead: [...state.dead],
    doraIndicator: state.doraIndicator,
    dora: state.dora,
    doraIndicators: [...state.doraIndicators],
    doras: [...state.doras],
    ponds: [[...state.ponds[0]], [...state.ponds[1]], [...state.ponds[2]], [...state.ponds[3]]],
    turn: state.turn,
    melds: [[...state.melds[0]], [...state.melds[1]], [...state.melds[2]], [...state.melds[3]]],
    claimable: state.claimable,
    mustDiscard: state.mustDiscard,
    drawn: state.drawn,
    drawnFrom: state.drawnFrom,
    phase: state.phase,
    win: state.win,
  }
}

/**
 * True when `state.drawn` is hidden from `seat`: someone else holds an undisclosed
 * draw. A tsumo win DISCLOSES the drawn tile — win.tile names it to the table — so
 * at agari the drawn slot is public and stays out of the hidden pool. (Ron and
 * ryuukyoku ends hold no drawn tile at all.)
 */
function drawnHiddenFrom(state: TableState, seat: Seat): boolean {
  return state.turn !== seat && state.drawn !== null && state.win === null
}

/**
 * The hidden pool for `seat`, in THE frozen slot order shared with writeHidden —
 * the one definition both sides use, so collect∘write is a bijection slot-for-slot:
 * other seats' hands in seat order (each in hand order), the undisclosed drawn tile,
 * the live wall in order, the unflipped dead wall in order (flipped indicators are
 * public and stay fixed; membership by doraIndicators ids, not positions).
 */
function collectHidden(state: TableState, seat: Seat): TileId[] {
  const pool: TileId[] = []
  for (let other = 0; other < SEAT_COUNT; other++) {
    if (other !== seat) pool.push(...state.hands[other])
  }
  if (drawnHiddenFrom(state, seat)) pool.push(state.drawn!)
  pool.push(...state.live)
  const flipped = new Set(state.doraIndicators)
  for (const id of state.dead) {
    if (!flipped.has(id)) pool.push(id)
  }
  return pool
}

/** Write a permuted pool back into the same slots, in collectHidden's frozen order. */
function writeHidden(state: TableState, seat: Seat, pool: readonly TileId[]): void {
  let i = 0
  for (let other = 0; other < SEAT_COUNT; other++) {
    if (other === seat) continue
    const hand = state.hands[other]
    for (let at = 0; at < hand.length; at++) hand[at] = pool[i++]
  }
  if (drawnHiddenFrom(state, seat)) state.drawn = pool[i++]
  for (let at = 0; at < state.live.length; at++) state.live[at] = pool[i++]
  const flipped = new Set(state.doraIndicators)
  for (let at = 0; at < state.dead.length; at++) {
    if (!flipped.has(state.dead[at])) state.dead[at] = pool[i++]
  }
}

/**
 * The rotate-by-1 sibling: slot i receives pool[(i+1) % n]. All 136 tile ids are
 * distinct, so for pool size ≥ 2 EVERY hidden slot changes — non-vacuity is
 * structural, never an fc statistic (the pinned-fact house rule).
 */
function rotatedSibling(state: TableState, seat: Seat): TableState {
  const mutant = copyState(state)
  const pool = collectHidden(state, seat)
  writeHidden(
    mutant,
    seat,
    pool.map((_, i) => pool[(i + 1) % pool.length]),
  )
  return mutant
}

/** The seeded-shuffle sibling: the pool through core's own frozen Fisher–Yates. */
function shuffledSibling(state: TableState, seat: Seat, permSeed: number): TableState {
  const mutant = copyState(state)
  writeHidden(mutant, seat, shuffleInPlace(createRng(permSeed), collectHidden(state, seat)))
  return mutant
}

// ---------------------------------------------------------------------------
// Collectors for the inclusion clause and the sibling guards.
// ---------------------------------------------------------------------------

/**
 * Every tile id a SeatView can carry, by explicit field (seatview.test.ts replica —
 * explicit rather than a recursive number scan because wallCount/turn/seat are
 * numbers that may collide with tile-id values).
 */
function exposedTileIds(view: SeatView): TileId[] {
  return [
    ...view.hand,
    ...(view.drawn === null ? [] : [view.drawn]),
    ...view.ponds.flat(),
    ...view.melds.flat().flatMap((meld) => [...meld.own, ...('claimed' in meld ? [meld.claimed] : [])]),
    ...view.doraIndicators,
    ...(view.claimable === null ? [] : [view.claimable.tile]),
    ...(view.win === null ? [] : [view.win.tile]),
  ]
}

/**
 * The public tile-id universe for `seat`, computed from STATE independently of the
 * projection: own hand, own drawn (iff holding the turn), all ponds, all melds'
 * own+claimed, flipped indicators. claimable/win tiles are marks into those zones,
 * included so the set is the full lawful universe (a tsumo's win.tile lives in the
 * winner's drawn slot, disclosed by the win announcement).
 */
function publicIds(state: TableState, seat: Seat): Set<TileId> {
  return new Set([
    ...state.hands[seat],
    ...(state.turn === seat && state.drawn !== null ? [state.drawn] : []),
    ...state.ponds.flat(),
    ...state.melds.flat().flatMap((meld) => [...meld.own, ...('claimed' in meld ? [meld.claimed] : [])]),
    ...state.doraIndicators,
    ...(state.claimable === null ? [] : [state.claimable.tile]),
    ...(state.win === null ? [] : [state.win.tile]),
  ])
}

/** The six-zone flatten of the conservation partition (dynamics.test.ts replica). */
function allZones(state: TableState): number[] {
  return [
    ...state.hands.flat(),
    ...state.melds.flat().flatMap((meld) => meld.own),
    ...state.ponds.flat(),
    ...(state.drawn === null ? [] : [state.drawn]),
    ...state.live,
    ...state.dead,
  ]
}

/** Corpus sampling for the guards: the dealt state, mid-game, and the final fold. */
function samplePrefixLengths(record: HandRecord): number[] {
  const n = record.actions.length
  return [...new Set([0, Math.floor(n / 2), n])]
}

/** Fold a prefix of a record — the only way any suite here advances state. */
function foldPrefix(record: HandRecord, length: number): TableState {
  return foldRecord({ seed: record.seed, actions: record.actions.slice(0, length) })
}

const corpus: readonly HandRecord[] = [...greedyCorpus, ...winCorpus]

/** Frozen sibling-shuffle seeds for the deterministic corpus sweeps — arbitrary, never regenerate. */
const CORPUS_PERM_SEEDS: readonly number[] = [1, 2]

describe('the surgery is a valid sibling constructor', () => {
  it('the corpus reaches every call form and both win forms (local non-vacuity)', () => {
    const meldTypes = new Set<string>()
    for (const record of greedyCorpus) {
      for (const melds of foldRecord(record).melds) {
        for (const meld of melds) meldTypes.add(meld.type)
      }
    }
    for (const form of ['chi', 'pon', 'daiminkan', 'ankan', 'shouminkan']) {
      expect(meldTypes, `greedy corpus lost call form ${form}`).toContain(form)
    }
    const winForms = new Set(winCorpus.map((record) => foldRecord(record).win?.by))
    expect(winForms).toContain('tsumo')
    expect(winForms).toContain('ron')
  })

  it('both siblings conserve all 136 distinct tile ids across the six zones', () => {
    for (const record of corpus) {
      for (const length of samplePrefixLengths(record)) {
        const state = foldPrefix(record, length)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          for (const mutant of [
            rotatedSibling(state, seat as Seat),
            shuffledSibling(state, seat as Seat, CORPUS_PERM_SEEDS[0]),
          ]) {
            const everything = allZones(mutant)
            expect(everything.length).toBe(TILE_COUNT)
            expect(new Set(everything).size).toBe(TILE_COUNT)
          }
        }
      }
    }
  })

  it('both siblings leave the public part of the state untouched', () => {
    for (const record of corpus) {
      for (const length of samplePrefixLengths(record)) {
        const state = foldPrefix(record, length)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          for (const mutant of [
            rotatedSibling(state, seat as Seat),
            shuffledSibling(state, seat as Seat, CORPUS_PERM_SEEDS[0]),
          ]) {
            expect(mutant.hands[seat]).toEqual(state.hands[seat])
            expect(mutant.ponds).toEqual(state.ponds)
            expect(mutant.melds).toEqual(state.melds)
            expect(mutant.doraIndicators).toEqual(state.doraIndicators)
            expect(mutant.doras).toEqual(state.doras)
            expect(mutant.turn).toBe(state.turn)
            expect(mutant.phase).toBe(state.phase)
            expect(mutant.claimable).toBe(state.claimable)
            expect(mutant.mustDiscard).toBe(state.mustDiscard)
            expect(mutant.win).toBe(state.win)
            expect(mutant.live.length).toBe(state.live.length)
            if (!drawnHiddenFrom(state, seat as Seat)) {
              expect(mutant.drawn).toBe(state.drawn)
            }
          }
        }
      }
    }
  })

  it('rotation changes EVERY hidden slot (the vacuity kill), pools always ≥ 2', () => {
    for (const record of corpus) {
      for (const length of samplePrefixLengths(record)) {
        const state = foldPrefix(record, length)
        for (let seat = 0; seat < SEAT_COUNT; seat++) {
          const before = collectHidden(state, seat as Seat)
          expect(before.length).toBeGreaterThanOrEqual(2)
          const after = collectHidden(rotatedSibling(state, seat as Seat), seat as Seat)
          expect(after.length).toBe(before.length)
          for (let i = 0; i < before.length; i++) {
            expect(after[i]).not.toBe(before[i])
          }
        }
      }
    }
  })
})
