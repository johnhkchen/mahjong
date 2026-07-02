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
  SEAT_COUNT,
  TILE_COUNT,
  foldRecord,
  legalActions,
  type HandAction,
  type HandRecord,
  type Seat,
  type TableState,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Complete draw+discard turns in a full hand: one per live-wall tile after the deal. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE // 70

/**
 * The generator's slice of the offered set: draws and discards only. legalActions now
 * offers claims and kans too, but random trajectories over the full call vocabulary
 * are T-004-01-04's charter — until that ticket grows this generator, claims stay out
 * so every property below keeps its exact draw/discard shape (140-action games, one
 * pond tile per draw, draw/discard-only mutants).
 */
function drawsAndDiscards(offered: readonly HandAction[]): HandAction[] {
  return offered.filter((a) => a.type === 'draw' || a.type === 'discard')
}

/**
 * Drive a game from the dealt table, choosing every move from legalActions' draw/
 * discard slice: one choice is consumed per post-draw point (the only point offering
 * more than one such action), so `choices.length` bounds the game at that many
 * complete turns; the walk stops cleanly pre-draw when choices run out, or when the
 * offered set empties (ryuukyoku). State only ever advances by refolding the longer
 * record — foldRecord stays the single authority, no step logic is reimplemented
 * here. The hard bound converts any future non-terminating turn loop into a thrown
 * error instead of a hung test run.
 */
function playRecord(seed: number, choices: readonly number[]): HandRecord {
  const actions: HandAction[] = []
  const bound = 2 * FULL_TURNS + 2
  let c = 0
  for (;;) {
    const legal = drawsAndDiscards(legalActions(foldRecord({ seed, actions })))
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
      const legal = drawsAndDiscards(legalActions(foldRecord(record)))
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

/**
 * Membership key for offered-set checks (mirrored from legal.test.ts): `uses` are
 * serialized SORTED, so membership is insensitive to the recorded copy order — the
 * fold accepts any order, and offers canonicalize theirs.
 */
function keyOf(action: HandAction): string {
  const uses = 'uses' in action ? `:${[...action.uses].sort((a, b) => a - b).join(',')}` : ''
  const tile = 'tile' in action ? `:${action.tile}` : ''
  return `${action.type}:${action.seat}${tile}${uses}`
}

/**
 * The mutation assertion: splice `mutant` between a legally-reachable prefix and the
 * rest of the record, then require BOTH halves of the contract to reject it — absent
 * from the offered set at that point, and thrown by the fold (before the suffix is
 * ever reached). Callers guarantee the mutant is outside legality; the only operator
 * that can accidentally stay legal (tile retarget) fc.pre-filters first.
 */
function assertMutantThrows(
  seed: number,
  prefix: readonly HandAction[],
  mutant: HandAction,
  suffix: readonly HandAction[],
): void {
  const offered = new Set(legalActions(foldRecord({ seed, actions: prefix })).map(keyOf))
  expect(offered.has(keyOf(mutant))).toBe(false)
  expect(() => foldRecord({ seed, actions: [...prefix, mutant, ...suffix] })).toThrow(RangeError)
}

describe('mutated sequences throw', () => {
  // Each operator moves ONE action of a random-legal record one rule outside
  // legality, spanning every guard in the step: wrong seat, out-of-sequence
  // draw/discard, unheld tile, action past the end.

  it('seat bump: any action reassigned to another seat throws (property)', () => {
    fc.assert(
      fc.property(gameArb, fc.nat(), fc.integer({ min: 1, max: 3 }), ({ seed, actions }, at, bump) => {
        fc.pre(actions.length > 0)
        const i = at % actions.length
        const action = actions[i]
        const seat = ((action.seat + bump) % SEAT_COUNT) as Seat
        // The generator only emits draws and discards (drawsAndDiscards filters).
        const mutant: HandAction =
          action.type === 'discard' ? { type: 'discard', seat, tile: action.tile } : { type: 'draw', seat }
        assertMutantThrows(seed, actions.slice(0, i), mutant, actions.slice(i + 1))
      }),
    )
  })

  it('type flip: a draw turned into a discard, or a discard into a draw, throws (property)', () => {
    fc.assert(
      fc.property(gameArb, fc.nat(), fc.nat(TILE_COUNT - 1), ({ seed, actions }, at, tile) => {
        fc.pre(actions.length > 0)
        const i = at % actions.length
        const action = actions[i]
        // A discard at a pre-draw point (any tile, even one genuinely held) and a
        // draw at a post-draw point are both out of sequence.
        const mutant: HandAction =
          action.type === 'draw'
            ? { type: 'discard', seat: action.seat, tile }
            : { type: 'draw', seat: action.seat }
        assertMutantThrows(seed, actions.slice(0, i), mutant, actions.slice(i + 1))
      }),
    )
  })

  it('tile retarget: a discard changed to a tile neither held nor just drawn throws (property)', () => {
    fc.assert(
      fc.property(gameArb, fc.nat(), fc.nat(TILE_COUNT - 1), ({ seed, actions }, at, tile) => {
        const discards = actions.flatMap((a, i) => (a.type === 'discard' ? [[a, i] as const] : []))
        fc.pre(discards.length > 0)
        const [action, i] = discards[at % discards.length]
        const mutant: HandAction = { type: 'discard', seat: action.seat, tile }
        // ~14 of 136 retargets land on another legally discardable tile — still a
        // legal record, so not a counterexample candidate; discard those runs.
        const offered = legalActions(foldRecord({ seed, actions: actions.slice(0, i) }))
        fc.pre(!offered.some((a) => keyOf(a) === keyOf(mutant)))
        assertMutantThrows(seed, actions.slice(0, i), mutant, actions.slice(i + 1))
      }),
    )
  })

  it('duplicate: replaying an action immediately after itself throws (property)', () => {
    fc.assert(
      fc.property(gameArb, fc.nat(), ({ seed, actions }, at) => {
        fc.pre(actions.length > 0)
        const i = at % actions.length
        // A doubled draw is a second draw in a row; a doubled discard hits the next
        // seat's turn (or the ended hand) — outside legality either way.
        assertMutantThrows(seed, actions.slice(0, i + 1), actions[i], actions.slice(i + 1))
      }),
    )
  })

  it('append after ryuukyoku: any action past the end of a full game throws (property)', () => {
    fc.assert(
      fc.property(
        fullGameArb,
        fc.nat(SEAT_COUNT - 1),
        fc.boolean(),
        fc.nat(TILE_COUNT - 1),
        (record, seatRaw, isDraw, tile) => {
          const seat = seatRaw as Seat
          const mutant: HandAction = isDraw ? { type: 'draw', seat } : { type: 'discard', seat, tile }
          assertMutantThrows(record.seed, record.actions, mutant, [])
        },
      ),
    )
  })
})
