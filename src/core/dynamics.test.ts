// The turn-loop property suite: dynamics over RANDOM-LEGAL trajectories. record.test.ts
// proves step semantics against wall-derived expectations over tsumogiri-only records;
// legal.test.ts locks the offered set to the step. This suite drives the two together —
// a generator picks every move from legalActions, so folds reach what those suites
// cannot: hands permuted by tedashi, mixed discard patterns, every seat's hand churned.
// Because the generator drives THROUGH the code under test, properties here assert only
// self-evident invariants — tile conservation, double-fold determinism, structural
// termination, throw-on-mutation — never derived values (those stay wall-anchored in
// record.test.ts). The generator is test-local by design: bots (the future runtime
// consumer of random play) are a later epic with their own shape.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  TILE_COUNT,
  foldRecord,
  legalActions,
  type HandAction,
  type HandRecord,
  type TableState,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Complete draw+discard turns in a full hand: one per live-wall tile after the deal. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE // 70

/**
 * Drive a game from the dealt table, choosing every move from legalActions: one choice
 * is consumed per post-draw point (the only point offering more than one action), so
 * `choices.length` bounds the game at that many complete turns; the walk stops cleanly
 * pre-draw when choices run out, or when the offered set empties (ryuukyoku). State
 * only ever advances by refolding the longer record — foldRecord stays the single
 * authority, no step logic is reimplemented here. The hard bound converts any future
 * non-terminating turn loop into a thrown error instead of a hung test run.
 */
function playRecord(seed: number, choices: readonly number[]): HandRecord {
  const actions: HandAction[] = []
  const bound = 2 * FULL_TURNS + 2
  let c = 0
  for (;;) {
    const legal = legalActions(foldRecord({ seed, actions }))
    if (legal.length === 0) return { seed, actions }
    if (legal.length === 1) {
      if (c >= choices.length) return { seed, actions }
      actions.push(legal[0])
    } else {
      actions.push(legal[choices[c++] % legal.length])
    }
    if (actions.length > bound) {
      throw new Error(`playRecord exceeded ${bound} actions — the turn loop is not terminating`)
    }
  }
}

/**
 * The five-zone flatten of a state — hands, ponds, the held-apart drawn tile, live,
 * dead: the zones TableState documents as partitioning the 136 tile ids at all times.
 * At a pre-draw prefix drawn is null and this IS the AC's literal four-zone form.
 */
function allZones(state: TableState): number[] {
  return [
    ...state.hands.flat(),
    ...state.ponds.flat(),
    ...(state.drawn === null ? [] : [state.drawn]),
    ...state.live,
    ...state.dead,
  ]
}

/**
 * A random-legal game: up to FULL_TURNS complete turns of legalActions-driven play,
 * optionally left with a dangling draw so post-draw states are first-class inputs.
 * fc.nat(13) matches the largest offered set (14 discards), so the modulo in
 * playRecord is usually the identity and shrinking maps onto low hand indexes.
 */
const gameArb = fc
  .record({
    seed: seedArb,
    choices: fc.array(fc.nat(13), { maxLength: FULL_TURNS }),
    dangle: fc.boolean(),
  })
  .map(({ seed, choices, dangle }) => {
    const record = playRecord(seed, choices)
    if (dangle) {
      const legal = legalActions(foldRecord(record))
      if (legal.length === 1) return { seed, actions: [...record.actions, legal[0]] }
    }
    return record
  })

/**
 * A driven-to-completion game: exactly FULL_TURNS choices, so playRecord only stops
 * when the offered set empties. That the map ever returns — rather than tripping
 * playRecord's hard bound — is itself the termination proof the AC asks for.
 */
const fullGameArb = fc
  .record({
    seed: seedArb,
    choices: fc.array(fc.nat(13), { minLength: FULL_TURNS, maxLength: FULL_TURNS }),
  })
  .map(({ seed, choices }) => playRecord(seed, choices))

describe('conservation over random play', () => {
  it('hands + ponds + drawn + live + dead partition the 136 tile ids at every prefix (property)', () => {
    fc.assert(
      fc.property(gameArb, ({ seed, actions }) => {
        for (let len = 0; len <= actions.length; len++) {
          const everything = allZones(foldRecord({ seed, actions: actions.slice(0, len) }))
          expect(everything.length).toBe(TILE_COUNT)
          expect(new Set(everything).size).toBe(TILE_COUNT)
        }
      }),
      { numRuns: 50 }, // each run folds every prefix — O(n²) applies; the timing dial
    )
  })
})

describe('termination', () => {
  it('every randomly driven full game ends in ryuukyoku after exactly 140 actions (property)', () => {
    fc.assert(
      fc.property(fullGameArb, (record) => {
        // Exact counts keep this non-vacuous: a generator stopping early fails here.
        expect(record.actions.length).toBe(2 * FULL_TURNS)
        const state = foldRecord(record)
        expect(state.phase).toBe('ryuukyoku')
        expect(state.live).toEqual([])
        expect(state.drawn).toBeNull()
        expect(legalActions(state)).toEqual([])
        expect(state.ponds.flat().length).toBe(FULL_TURNS)
      }),
    )
  })
})

describe('fold determinism over random play', () => {
  it('folding the same record twice yields deeply-equal state in fresh arrays (property)', () => {
    // record.test.ts proves this exhaustively for tsumogiri records; the new ground
    // here is tedashi-bearing records, whose folds splice and permute the hands.
    fc.assert(
      fc.property(gameArb, ({ seed, actions }) => {
        const record = { seed, actions }
        const first = foldRecord(record)
        const second = foldRecord(record)
        expect(second).toEqual(first)
        expect(second.hands).not.toBe(first.hands)
        expect(second.ponds).not.toBe(first.ponds)
        expect(second.live).not.toBe(first.live)
      }),
    )
  })
})
