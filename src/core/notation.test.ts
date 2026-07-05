// notation.ts's own test suite: direct per-action-variant round trips, malformed-input
// line/position naming, and the AC's central property — arbitrary legally-played
// GameRecords round-trip through serializeGameRecord/parseGameRecord, folding
// (foldGame) deep-equal to the original. The multi-hand driver below is a deliberate
// RESTATEMENT of selfplay.test.ts's own selfPlay loop (that file's own header already
// calls itself "the THIRD statement of that rule" — this codebase locks independent
// statements by test rather than sharing them), generalized to take a RiichiContext so
// hands can be chained into a whole game via foldGame's own dealer/score threading.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  callPolicy,
  discardPolicy,
  foldGame,
  foldRecord,
  handSeedOf,
  legalActions,
  seatView,
  type GameRecord,
  type HandAction,
  type RiichiContext,
  type Seat,
} from './index'
import { NOTATION_VERSION, parseGameRecord, serializeGameRecord } from './notation'

/** The dynamics.test.ts/selfplay.test.ts action-bound arithmetic, re-stated. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE
const ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 * SEAT_COUNT + 2

type ClaimAction = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

function isClaimAction(action: HandAction): action is ClaimAction {
  return action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan'
}

/** One self-played hand from `seed`, under `context` (selfplay.test.ts's loop, generalized). */
function playHand(seed: number, context: RiichiContext): HandAction[] {
  const actions: HandAction[] = []
  for (;;) {
    const state = foldRecord({ seed, actions }, context)
    const legal = legalActions(state)
    if (state.phase === 'agari' || legal.length === 0) return actions
    const isCallPoint =
      state.phase === 'ryuukyoku' ||
      (state.drawn === null && !state.mustDiscard && state.claimable !== null)
    let chosen: HandAction
    if (isCallPoint) {
      const consulted = new Set<Seat>()
      let best: HandAction | null = null
      let bestAt = Infinity
      for (const offer of legal) {
        if (offer.type !== 'ron' && !isClaimAction(offer)) continue
        if (consulted.has(offer.seat)) continue
        consulted.add(offer.seat)
        const answer = callPolicy(seatView(state, offer.seat), legal)
        if (answer.type === 'draw') continue
        const at = legal.indexOf(answer)
        if (at < bestAt) {
          best = answer
          bestAt = at
        }
      }
      chosen = best ?? legal[0]
    } else {
      chosen = discardPolicy(seatView(state, state.turn), legal)
    }
    actions.push(chosen)
    if (actions.length > ACTION_BOUND) {
      throw new Error(`seed ${seed}: self-play exceeded ${ACTION_BOUND} actions`)
    }
  }
}

/**
 * `handCount` chained self-played hands from `gameSeed` — an arbitrary legally-played
 * `GameRecord`. Each hand's context (scoresIn/pot) is read off `foldGame`'s own
 * derivation for the next active hand (append an empty placeholder, fold, read
 * `table.scoresIn`/`table.pot`) rather than reimplementing dealer rotation here.
 */
function playGame(gameSeed: number, handCount: number): GameRecord {
  const hands: HandAction[][] = []
  for (let i = 0; i < handCount; i++) {
    const probe = foldGame({ seed: gameSeed, hands: [...hands, []] })
    const handSeed = handSeedOf(gameSeed, hands.length)
    const actions = playHand(handSeed, { scoresIn: probe.table.scoresIn, potIn: probe.table.pot })
    hands.push(actions)
  }
  return { seed: gameSeed, hands }
}

describe('encode/decode round trip per action type', () => {
  const cases: Record<string, HandAction> = {
    draw: { type: 'draw', seat: 0 },
    discard: { type: 'discard', seat: 1, tile: 0 },
    riichi: { type: 'riichi', seat: 2, tile: 135 },
    chi: { type: 'chi', seat: 3, tile: 61, uses: [4, 5] },
    pon: { type: 'pon', seat: 0, tile: 8, uses: [9, 10] },
    daiminkan: { type: 'daiminkan', seat: 1, tile: 12, uses: [13, 14, 15] },
    ankan: { type: 'ankan', seat: 2, uses: [16, 17, 18, 19] },
    shouminkan: { type: 'shouminkan', seat: 3, tile: 20 },
    tsumo: { type: 'tsumo', seat: 0 },
    ron: { type: 'ron', seat: 1, tile: 135 },
  }

  for (const [name, action] of Object.entries(cases)) {
    it(`round-trips a ${name} action`, () => {
      const record: GameRecord = { seed: 42, hands: [[action]] }
      const parsed = parseGameRecord(serializeGameRecord(record))
      expect(parsed.hands[0][0]).toEqual(action)
      expect(parsed.seed).toBe(42)
    })
  }

  it('round-trips a hand with zero actions (the fresh-deal active hand)', () => {
    const record: GameRecord = { seed: 7, hands: [[]] }
    const text = serializeGameRecord(record)
    expect(text.split('\n')).toEqual(['v1 7', ''])
    expect(parseGameRecord(text)).toEqual(record)
  })

  it('round-trips a fixed multi-hand record', () => {
    const record: GameRecord = {
      seed: 99,
      hands: [
        [{ type: 'draw', seat: 0 }, { type: 'discard', seat: 0, tile: 3 }],
        [{ type: 'draw', seat: 1 }],
        [],
      ],
    }
    const text = serializeGameRecord(record)
    expect(text.split('\n')).toHaveLength(4) // header + 3 hands
    expect(parseGameRecord(text)).toEqual(record)
  })
})

describe('charset — single suit of printable ASCII', () => {
  it('emits only printable ASCII and newlines', () => {
    const record = playGame(123, 2)
    const text = serializeGameRecord(record)
    expect(text).toMatch(/^[\x20-\x7e\n]*$/)
  })
})

describe('versioning', () => {
  it('round-trips NOTATION_VERSION', () => {
    const text = serializeGameRecord({ seed: 1, hands: [[]] })
    expect(text.startsWith(`v${NOTATION_VERSION} `)).toBe(true)
  })

  it('rejects an unsupported version, naming it', () => {
    expect(() => parseGameRecord('v2 5\n')).toThrow(/line 1, position 1.*unsupported format version 2/)
  })
})

describe('malformed input throws naming line and position', () => {
  it('rejects an empty document', () => {
    expect(() => parseGameRecord('')).toThrow(/line 1, position 1/)
  })

  it('rejects a header with no seed', () => {
    expect(() => parseGameRecord('v1')).toThrow(/line 1, position 1/)
  })

  it('rejects a header seed with an invalid character', () => {
    expect(() => parseGameRecord('v1 5_\n')).toThrow(/line 1, position 1/)
  })

  it('rejects a header seed decoding out of uint32 range', () => {
    // '2' * 8 in base 36 decodes well past 0xffffffff (4294967295).
    expect(() => parseGameRecord('v1 zzzzzzzz\n')).toThrow(/line 1, position \d+.*out of range/)
  })

  it('rejects a document with a header but no hand lines', () => {
    expect(() => parseGameRecord('v1 5')).toThrow(/line 2, position 1/)
  })

  it('rejects an unknown action type letter', () => {
    expect(() => parseGameRecord('v1 5\nZ0')).toThrow(/line 2, position 1.*unknown action type/)
  })

  it('rejects a wrong-length token for a known type', () => {
    expect(() => parseGameRecord('v1 5\nK0')).toThrow(/line 2, position 1.*must be exactly 4 characters/)
  })

  it('rejects a malformed seat digit', () => {
    expect(() => parseGameRecord('v1 5\nD4')).toThrow(/line 2, position 2.*malformed seat/)
  })

  it('rejects malformed tile characters', () => {
    expect(() => parseGameRecord('v1 5\nK0G!')).toThrow(/line 2, position 3.*malformed tile/)
  })

  it('rejects a tile value one past the maximum', () => {
    // '3s' decodes to 136 (3*36+28) — one past the max tile id, 135 ('3r').
    expect(() => parseGameRecord('v1 5\nK03s')).toThrow(/line 2, position 3.*out of range/)
  })

  it('rejects a stray doubled space between tokens', () => {
    expect(() => parseGameRecord('v1 5\nD0  D1')).toThrow(/line 2, position 4.*empty action token/)
  })
})

describe('property: arbitrary legally-played GameRecords round-trip', () => {
  it(
    'parse(serialize(record)) folds deep-equal to the record itself',
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 0xffffffff }),
          fc.integer({ min: 1, max: 4 }),
          (seed, handCount) => {
            const record = playGame(seed, handCount)
            const parsed = parseGameRecord(serializeGameRecord(record))
            expect(foldGame(parsed)).toEqual(foldGame(record))
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  // Fixed anchors for fast, deterministic failure signal (selfplay.test.ts's own mined
  // seeds 25/9, each wrapped as a single-hand game, plus one genuinely multi-hand case).
  it.each([
    { seed: 25, handCount: 1 },
    { seed: 9, handCount: 1 },
    { seed: 7, handCount: 3 },
  ])('anchor: seed $seed, $handCount hand(s)', ({ seed, handCount }) => {
    const record = playGame(seed, handCount)
    const parsed = parseGameRecord(serializeGameRecord(record))
    expect(foldGame(parsed)).toEqual(foldGame(record))
  })
})
