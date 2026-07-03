// The turn-loop property suite: dynamics over RANDOM-LEGAL trajectories. record.test.ts
// proves step semantics against wall-derived expectations over tsumogiri-only records;
// legal.test.ts locks the offered set to the step. This suite drives the two together —
// a generator picks every move from legalActions, so folds reach what those suites
// cannot: hands permuted by tedashi, melds churned by claims, walls shortened by kans,
// every seat's hand carved by calls. Because the generator drives THROUGH the code
// under test, properties here assert only self-evident invariants — tile conservation,
// double-fold determinism, structural termination, throw-on-mutation — never derived
// values (those stay wall-anchored in record.test.ts). Three trajectory sources: fc
// arbitraries sampling the FULL offered set uniformly by index, a deterministic
// greedy-call corpus (kans first, then any call) whose coverage of every call form is
// asserted — call density is a pinned fact, never an fc statistic — and a win-eager
// carrier corpus (T-005-02-04) whose agari ends are pinned the same way, so the
// suite's win-state assertions can never go vacuous. The generators are test-local
// by design: bots (the future runtime consumer of random play) are a later epic
// with their own shape.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAD_WALL_SIZE,
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
  type HandAction,
  type HandRecord,
  type Seat,
  type TableState,
  type TileId,
} from './index'

/** The canonical seed domain: integers [0, 2^32). */
const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Complete draw+discard turns in a call-free full hand: one per post-deal live tile. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE // 70

/** The meld ceiling across the table: four melds per seat. */
const MAX_MELDS = 4 * SEAT_COUNT

/**
 * The hard action bound, from the vocabulary's own arithmetic: every action is a
 * draw, a kan, a chi/pon, or a discard; draws + kans ≤ FULL_TURNS (each consumes one
 * live tile — kans "eat the wall" by taking a draw's place); every draw, kan, and
 * chi/pon obliges exactly one discard; chi/pons ≤ MAX_MELDS − kans. So a legal game
 * holds at most 2·FULL_TURNS + 2·MAX_MELDS = 172 actions; the +2 headroom means the
 * bound tripping is unambiguously a non-terminating turn loop, not a long legal game.
 */
const ACTION_BOUND = 2 * FULL_TURNS + 2 * MAX_MELDS + 2

/**
 * The choice domain: 20 values covers the longest real offering (14 discards plus
 * kan offers post-draw ≈ 18), so no offer index is unreachable through the modulo —
 * fc.nat(13) would never pick index 14+, silently suppressing every kan offer.
 */
const CHOICE_MAX = 19

/**
 * The call vocabulary — chi/pon/kan forms; wins are ends, not calls, and riichi
 * (T-009-01-01) is a declare-and-DISCARD, not a call — excluded here so playGreedy's
 * call-density corpus never mistakes a tenpai-preserving discard for a claim.
 */
function isCall(action: HandAction): boolean {
  return (
    action.type !== 'draw' &&
    action.type !== 'discard' &&
    action.type !== 'riichi' &&
    action.type !== 'tsumo' &&
    action.type !== 'ron'
  )
}

/** A win offer — the endings T-005-02-02 made offerable; drivers filter by intent. */
function isWin(action: HandAction): boolean {
  return action.type === 'tsumo' || action.type === 'ron'
}

/**
 * Drive a game from the dealt table, choosing every move from the FULL offered set:
 * forced points (a single offer — the claimless pre-draw draw, mostly) auto-play, and
 * each multi-offer decision point consumes one choice by index — so claims and kans
 * are sampled exactly as legalActions offers them, and `choices` is a decision list,
 * not an action list. The walk stops cleanly when choices run out at a decision
 * point, or when the offered set empties (ryuukyoku). State only ever advances by
 * refolding the longer record — foldRecord stays the single authority, no step logic
 * is reimplemented here. The hard bound converts any future non-terminating turn
 * loop into a thrown error instead of a hung test run.
 */
function playRecord(seed: number, choices: readonly number[]): HandRecord {
  const actions: HandAction[] = []
  let c = 0
  for (;;) {
    const legal = legalActions(foldRecord({ seed, actions }))
    if (legal.length === 0) return { seed, actions }
    if (legal.length === 1) {
      actions.push(legal[0])
    } else {
      if (c >= choices.length) return { seed, actions }
      actions.push(legal[choices[c++] % legal.length])
    }
    if (actions.length > ACTION_BOUND) {
      throw new Error(
        `playRecord exceeded ${ACTION_BOUND} actions — the turn loop is not terminating`,
      )
    }
  }
}

/**
 * The deterministic greedy-call driver: at every point play a kan if one is offered,
 * else any claim, else whatever is offered — picking inside the pool with core's own
 * seeded rng stream, so the corpus is reproducible arithmetic, not fc sampling.
 * Greed maximizes call density (any concealed quad kans immediately, any pon
 * upgrades the moment its fourth copy surfaces), which is what makes the corpus's
 * every-call-form coverage assertable rather than statistical. Runs to ryuukyoku BY
 * CONSTRUCTION: win offers (tsumo/ron, offerable since T-005-02-02) are filtered
 * out up front — an eager win would truncate games and starve the call coverage
 * this corpus exists to guarantee. Wins in random trajectories are playRecord's
 * business. A non-win offer always remains while playing (the draw or a discard),
 * so the filter can empty the set only at a houtei-offering ryuukyoku — the end.
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

/**
 * The greedy corpus: one full game per seed. The range is frozen empirically —
 * ankan is the rare form (greedy pons eat copies before concealed quads assemble;
 * seeds 63/67/69 are the only carriers under 100) — and the coverage test asserts
 * every call form appears in the union, so a regression that stops generating some
 * form (or a range edit that loses one) fails loudly instead of letting the
 * call-dense suites go vacuous.
 */
const GREEDY_CORPUS_SEEDS: readonly number[] = Array.from({ length: 100 }, (_, i) => i)
const greedyCorpus: readonly HandRecord[] = GREEDY_CORPUS_SEEDS.map((seed) => playGreedy(seed))

/**
 * The win-eager driver — playGreedy's mirror image: at every point take a win if
 * one is offered (the rng picks among simultaneous rons — a legal recorder's
 * choice under the multiple-ron convention), else sample the FULL offered set
 * uniformly by index with core's own seeded rng. Where playGreedy filters wins
 * OUT to protect its call coverage, this driver hunts them: random claim churn is
 * what creates win opportunities (static tsumogiri hands measured ZERO wins in
 * 300 seeds), and eagerness converts every offered win into an agari end.
 * Terminates like its sibling: a houtei-offering ryuukyoku gets its ron taken, a
 * houtei-less ryuukyoku and an agari offer nothing — every end empties the
 * offered set, and the hard bound converts a non-terminating loop into a throw.
 */
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
 * The win carriers: seeds whose win-eager game ends in agari — mined by a
 * scratchpad scan (the frozen-anchor convention: never regenerate). RE-MINED for
 * T-009-01-01: riichi offers now sit in the offered set playWinEager samples
 * uniformly by index, which is a real, expected trajectory shift (legal.ts's own
 * doc-comment names this — inserting an offer block shifts every index after
 * it) — two of the original eight carriers (seeds 100, 731) now land in
 * ryuukyoku instead under the new offer set, so this list swaps them for two
 * freshly-mined replacements (1072, 1268) and keeps the rest. 876, 950, and 1072
 * end in tsumo; the other five in window rons — winners across seats 0/1/2/3,
 * ends from action 24 to 161. A carrier stranded in ryuukyoku by a future
 * trajectory-shifting engine change is the coverage test below failing AS
 * DESIGNED — re-mine with the scratchpad scan rather than hand-patching seeds.
 */
const WIN_CARRIER_SEEDS: readonly number[] = [277, 360, 626, 834, 876, 950, 1072, 1268]
const winCorpus: readonly HandRecord[] = WIN_CARRIER_SEEDS.map((seed) => playWinEager(seed))

/**
 * The six-zone flatten of a state — hands, melds' own tiles, ponds, the held-apart
 * drawn tile, live, dead: the zones TableState documents as partitioning the 136
 * tile ids at all times. A meld contributes only its `own` tiles; the claimed tile
 * stays counted in the discarder's pond (the Meld contract), so the zones stay
 * disjoint by construction and the AC's hands+melds+ponds+drawn+live+dead form
 * reads off literally.
 */
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

/** Conservation at EVERY log prefix: 136 tiles, all distinct, at each fold point. */
function expectConserved(record: HandRecord): void {
  for (let len = 0; len <= record.actions.length; len++) {
    const everything = allZones(
      foldRecord({ seed: record.seed, actions: record.actions.slice(0, len) }),
    )
    expect(everything.length).toBe(TILE_COUNT)
    expect(new Set(everything).size).toBe(TILE_COUNT)
  }
}

/** Tally a log by action type, for the termination identities. */
function countTypes(actions: readonly HandAction[]): Record<HandAction['type'], number> {
  const counts = {
    draw: 0,
    discard: 0,
    riichi: 0,
    chi: 0,
    pon: 0,
    daiminkan: 0,
    ankan: 0,
    shouminkan: 0,
    tsumo: 0,
    ron: 0,
  }
  for (const action of actions) counts[action.type]++
  return counts
}

/**
 * The end-of-game identities — exact equalities, so a generator that stops early or
 * a fold that loses a tile breaks an ===, keeping termination non-vacuous the way
 * the old exact-140 count did before kans made action counts trajectory-dependent:
 * draws + kans === FULL_TURNS − live remaining (each consumed one live tile — the
 * kan-eats-the-wall fact; a ryuukyoku end leaves zero live, an agari may end the
 * hand mid-wall); discards === draws + daiminkans + chi/pons − the one obligation a
 * tsumo leaves unmet (the winner keeps its drawn tile) — every drawn tile and every
 * claim obliges one discard, EXCEPT that an ankan/shouminkan absorbs the drawn tile
 * of the draw before it (its rinshan re-fills the slot), so closed-kan forms add no
 * obligation of their own while daiminkan (folding instead of a draw) does; melds
 * count chi+pon+daiminkan+ankan (a shouminkan replaces its pon in place). For a
 * ryuukyoku end every term reduces to the pre-win identity, exactly.
 */
function expectEndIdentities(record: HandRecord, state: TableState): void {
  const n = countTypes(record.actions)
  const kans = n.daiminkan + n.ankan + n.shouminkan
  expect(n.draw + kans).toBe(FULL_TURNS - state.live.length)
  const unmet = state.win?.by === 'tsumo' ? 1 : 0
  expect(n.discard).toBe(n.draw + n.daiminkan + n.chi + n.pon - unmet)
  expect(state.ponds.flat().length).toBe(n.discard)
  expect(state.melds.flat().length).toBe(n.chi + n.pon + n.daiminkan + n.ankan)
}

/**
 * A random-legal game: up to a full game's worth of decisions over the full offered
 * set, optionally left with a dangling draw so post-draw states stay first-class
 * final states even when the walk stops at a claimless pre-draw point.
 */
const gameArb = fc
  .record({
    seed: seedArb,
    choices: fc.array(fc.nat(CHOICE_MAX), { maxLength: ACTION_BOUND }),
    dangle: fc.boolean(),
  })
  .map(({ seed, choices, dangle }) => {
    const record = playRecord(seed, choices)
    if (dangle) {
      const offered = legalActions(foldRecord(record))
      if (offered.length > 0 && offered[0].type === 'draw') {
        return { seed, actions: [...record.actions, offered[0]] }
      }
    }
    return record
  })

/**
 * A driven-to-completion game: ACTION_BOUND choices can never be exhausted by a
 * legal game (≤ 172 actions, decisions ≤ actions), so playRecord only stops when
 * the offered set empties. That the map ever returns — rather than tripping the
 * hard bound — is itself the termination proof the AC asks for, now with claims
 * and kans in the trajectory space.
 */
const fullGameArb = fc
  .record({
    seed: seedArb,
    choices: fc.array(fc.nat(CHOICE_MAX), { minLength: ACTION_BOUND, maxLength: ACTION_BOUND }),
  })
  .map(({ seed, choices }) => playRecord(seed, choices))

/** An fc handle on the call-dense corpus, for the claim-hungry mutation operators. */
const corpusGameArb = fc.nat(greedyCorpus.length - 1).map((i) => greedyCorpus[i])

/** Random-legal or corpus: operators that need claims in the log sample from both. */
const anyGameArb = fc.oneof(gameArb, corpusGameArb)

describe('conservation over random play', () => {
  it('hands + melds + ponds + drawn + live + dead partition the 136 tile ids at every prefix (property)', () => {
    fc.assert(
      fc.property(gameArb, (record) => {
        expectConserved(record)
      }),
      { numRuns: 50 }, // each run folds every prefix — O(n²) applies; the timing dial
    )
  })

  it('the greedy corpus conserves the partition at every prefix of every game', () => {
    for (const record of greedyCorpus) expectConserved(record)
  })
})

describe('termination', () => {
  it('every randomly driven full game ends in ryuukyoku or agari with the matching closed end shape (property)', () => {
    // Since T-005-02-02 the random driver's trajectory space includes the win
    // offers, so a full game ends either way; playRecord stops only when the
    // offered set empties, so a lone houtei ron is auto-taken into agari and a
    // final ryuukyoku is houtei-less — both ends offer nothing.
    fc.assert(
      fc.property(fullGameArb, (record) => {
        const state = foldRecord(record)
        if (state.phase === 'agari') {
          expect(state.win).not.toBeNull()
          if (state.win!.by === 'tsumo') {
            expect(state.drawn).toBe(state.win!.tile)
          } else {
            expect(state.drawn).toBeNull()
            expect(state.ponds[state.win!.from].at(-1)).toBe(state.win!.tile)
          }
          expect(state.turn).toBe(state.win!.winner)
        } else {
          expect(state.phase).toBe('ryuukyoku')
          expect(state.live).toEqual([])
          expect(state.drawn).toBeNull()
        }
        expect(state.mustDiscard).toBe(false)
        expect(state.claimable).toBeNull()
        expect(state.dead.length).toBe(DEAD_WALL_SIZE)
        expect(legalActions(state)).toEqual([])
        expectEndIdentities(record, state)
      }),
      { numRuns: 60 }, // every run plays a whole game through per-action refolds
    )
  })

  it('the greedy corpus terminates, satisfies the identities, and covers every call form', () => {
    const seen = new Set<string>()
    for (const record of greedyCorpus) {
      const state = foldRecord(record)
      expect(state.phase).toBe('ryuukyoku')
      expect(state.live).toEqual([])
      expectEndIdentities(record, state)
      for (const action of record.actions) seen.add(action.type)
    }
    // The corpus's reason to exist: every call form actually occurs in random-legal
    // play — including shouminkan, whose generative coverage -03 flagged as missing.
    for (const form of ['chi', 'pon', 'daiminkan', 'ankan', 'shouminkan']) {
      expect(seen.has(form), `the greedy corpus generated no ${form}`).toBe(true)
    }
  })
})

describe('fold determinism over random play', () => {
  it('folding the same record twice yields deeply-equal state in fresh arrays (property)', () => {
    // record.test.ts proves this exhaustively for tsumogiri records; the new ground
    // here is claim-bearing records, whose folds splice hands into melds and jump
    // turns — determinism must survive the whole widened vocabulary.
    fc.assert(
      fc.property(anyGameArb, ({ seed, actions }) => {
        const record = { seed, actions }
        const first = foldRecord(record)
        const second = foldRecord(record)
        expect(second).toEqual(first)
        expect(second.hands).not.toBe(first.hands)
        expect(second.ponds).not.toBe(first.ponds)
        expect(second.melds).not.toBe(first.melds)
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
 * ever reached). Callers guarantee the mutant is outside legality; operators that
 * can accidentally stay legal (tile/uses retargets) fc.pre-filter first.
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

/** The same action re-seated — the shape-preserving wrong-seat mutation. */
function withSeat(action: HandAction, seat: Seat): HandAction {
  switch (action.type) {
    case 'draw':
      return { type: 'draw', seat }
    case 'discard':
      return { type: 'discard', seat, tile: action.tile }
    case 'riichi':
      return { type: 'riichi', seat, tile: action.tile }
    case 'chi':
      return { type: 'chi', seat, tile: action.tile, uses: action.uses }
    case 'pon':
      return { type: 'pon', seat, tile: action.tile, uses: action.uses }
    case 'daiminkan':
      return { type: 'daiminkan', seat, tile: action.tile, uses: action.uses }
    case 'ankan':
      return { type: 'ankan', seat, uses: action.uses }
    case 'shouminkan':
      return { type: 'shouminkan', seat, tile: action.tile }
    case 'tsumo':
      return { type: 'tsumo', seat }
    case 'ron':
      return { type: 'ron', seat, tile: action.tile }
  }
}

/** The claim forms whose `tile` must name the open window's fresh discard. */
type WindowClaim = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

/** Indexed occurrences of the window-bound claim forms in a log. */
function windowClaims(
  actions: readonly HandAction[],
): ReadonlyArray<readonly [WindowClaim, number]> {
  return actions.flatMap((a, i) =>
    a.type === 'chi' || a.type === 'pon' || a.type === 'daiminkan' ? [[a, i] as const] : [],
  )
}

describe('mutated sequences throw', () => {
  // Each operator moves ONE action of a random-legal record one rule outside
  // legality, spanning the AC's matrix: wrong seat, wrong tiles (discard, claim
  // tile, claim uses), stale discard, out-of-sequence forms, action past the end —
  // dead-wall exhaustion follows as directed anchors, since random play cannot
  // reach four kans or a haitei quad.

  it('seat bump: any action reassigned to another seat throws (property)', () => {
    fc.assert(
      fc.property(
        anyGameArb,
        fc.nat(),
        fc.integer({ min: 1, max: 3 }),
        ({ seed, actions }, at, bump) => {
          fc.pre(actions.length > 0)
          const i = at % actions.length
          const action = actions[i]
          const seat = ((action.seat + bump) % SEAT_COUNT) as Seat
          // Always illegal: draws/discards/ankans/shouminkans hit the turn guard, a
          // bumped chi is never the window's chi seat, and a bumped pon/daiminkan
          // either claims its own discard or names uses only the original seat holds.
          assertMutantThrows(seed, actions.slice(0, i), withSeat(action, seat), actions.slice(i + 1))
        },
      ),
    )
  })

  it('type flip: a draw turned into a discard, or a discard into a draw, throws (property)', () => {
    fc.assert(
      fc.property(gameArb, fc.nat(), fc.nat(TILE_COUNT - 1), ({ seed, actions }, at, tile) => {
        const spots = actions.flatMap((a, i) => (a.type === 'draw' || a.type === 'discard' ? [i] : []))
        fc.pre(spots.length > 0)
        const i = spots[at % spots.length]
        const action = actions[i]
        // A discard at a pre-draw point (any tile, even one genuinely held) and a
        // draw at a post-draw or claim-discard point are both out of sequence.
        const mutant: HandAction =
          action.type === 'draw'
            ? { type: 'discard', seat: action.seat, tile: tile as TileId }
            : { type: 'draw', seat: action.seat }
        assertMutantThrows(seed, actions.slice(0, i), mutant, actions.slice(i + 1))
      }),
    )
  })

  it('tile retarget: a discard changed to a tile neither held nor just drawn throws (property)', () => {
    fc.assert(
      fc.property(anyGameArb, fc.nat(), fc.nat(TILE_COUNT - 1), ({ seed, actions }, at, tile) => {
        const discards = actions.flatMap((a, i) => (a.type === 'discard' ? [[a, i] as const] : []))
        fc.pre(discards.length > 0)
        const [action, i] = discards[at % discards.length]
        const mutant: HandAction = { type: 'discard', seat: action.seat, tile: tile as TileId }
        // ~14 of 136 retargets land on another legally discardable tile — still a
        // legal record, so not a counterexample candidate; discard those runs.
        const offered = legalActions(foldRecord({ seed, actions: actions.slice(0, i) }))
        fc.pre(!offered.some((a) => keyOf(a) === keyOf(mutant)))
        assertMutantThrows(seed, actions.slice(0, i), mutant, actions.slice(i + 1))
      }),
    )
  })

  it('claim retarget: a claim naming a tile other than the fresh discard throws (property)', () => {
    fc.assert(
      fc.property(anyGameArb, fc.nat(), fc.nat(TILE_COUNT - 1), ({ seed, actions }, at, tileRaw) => {
        const claims = windowClaims(actions)
        fc.pre(claims.length > 0)
        const [action, i] = claims[at % claims.length]
        const tile = tileRaw as TileId
        // The window guard compares physical ids, so ANY other tile — even another
        // copy of the same kind — is a corrupt claim; only the identity retarget
        // stays legal, and is excluded.
        fc.pre(tile !== action.tile)
        const mutant: HandAction = { ...action, tile }
        assertMutantThrows(seed, actions.slice(0, i), mutant, actions.slice(i + 1))
      }),
    )
  })

  it('uses retarget: a claim or kan exposing a wrong tile throws (property)', () => {
    fc.assert(
      fc.property(
        anyGameArb,
        fc.nat(),
        fc.nat(),
        fc.nat(TILE_COUNT - 1),
        ({ seed, actions }, at, slot, tileRaw) => {
          const claims = actions.flatMap((a, i) => ('uses' in a ? [[a, i] as const] : []))
          fc.pre(claims.length > 0)
          const [action, i] = claims[at % claims.length]
          const uses = [...action.uses]
          uses[slot % uses.length] = tileRaw as TileId
          // Arity is preserved by the modulo, so the cast only widens the tuple type.
          const mutant = { ...action, uses: uses as unknown as typeof action.uses } as HandAction
          // A retarget onto another held copy of the right kind is still legal —
          // pre-filter through the offered set, the discard-retarget precedent.
          const offered = legalActions(foldRecord({ seed, actions: actions.slice(0, i) }))
          fc.pre(!offered.some((a) => keyOf(a) === keyOf(mutant)))
          assertMutantThrows(seed, actions.slice(0, i), mutant, actions.slice(i + 1))
        },
      ),
    )
  })

  it('stale claim: a claim delayed past the next draw throws (property)', () => {
    fc.assert(
      fc.property(anyGameArb, fc.nat(), ({ seed, actions }, at) => {
        const claims = windowClaims(actions)
        fc.pre(claims.length > 0)
        const [action, i] = claims[at % claims.length]
        // The draw is offered first at every claim-window point; taking it closes
        // the window, so the once-legal claim now meets a stale discard.
        const state = foldRecord({ seed, actions: actions.slice(0, i) })
        const draw: HandAction = { type: 'draw', seat: state.turn }
        assertMutantThrows(seed, [...actions.slice(0, i), draw], action, [])
      }),
    )
  })

  it('duplicate: replaying an action immediately after itself throws (property)', () => {
    fc.assert(
      fc.property(anyGameArb, fc.nat(), ({ seed, actions }, at) => {
        fc.pre(actions.length > 0)
        const i = at % actions.length
        // A doubled draw is a second draw in a row; a doubled discard hits the next
        // seat's turn (or the ended hand); a doubled chi/pon/daiminkan meets its own
        // consumed window; a doubled kan names uses already melded away.
        assertMutantThrows(seed, actions.slice(0, i + 1), actions[i], actions.slice(i + 1))
      }),
    )
  })

  it('append after ryuukyoku: any action form past the end of a full game throws (property)', () => {
    fc.assert(
      fc.property(
        fullGameArb,
        fc.nat(6),
        fc.nat(SEAT_COUNT - 1),
        fc.nat(TILE_COUNT - 1),
        fc.array(fc.nat(TILE_COUNT - 1), { minLength: 4, maxLength: 4 }),
        (record, form, seatRaw, tileRaw, us) => {
          const seat = seatRaw as Seat
          const tile = tileRaw as TileId
          const u = us as TileId[]
          const menu: HandAction[] = [
            { type: 'draw', seat },
            { type: 'discard', seat, tile },
            { type: 'chi', seat, tile, uses: [u[0], u[1]] },
            { type: 'pon', seat, tile, uses: [u[0], u[1]] },
            { type: 'daiminkan', seat, tile, uses: [u[0], u[1], u[2]] },
            { type: 'ankan', seat, uses: [u[0], u[1], u[2], u[3]] },
            { type: 'shouminkan', seat, tile },
          ]
          assertMutantThrows(record.seed, record.actions, menu[form], [])
        },
      ),
      { numRuns: 60 }, // every run plays a whole game through per-action refolds
    )
  })
})

describe('wins over random play', () => {
  // The epic's rigor loop closed (T-005-02-04): the suite's invariants exhibited
  // on trajectories that actually END IN WINS. All facts here are deterministic
  // corpus loops over the frozen carriers — pinned, never fc statistics.

  it('every carrier ends in agari, both end forms occur, and the end identities hold', () => {
    const ends = new Set<string>()
    for (const record of winCorpus) {
      const state = foldRecord(record)
      expect(state.phase).toBe('agari')
      expect(state.win).not.toBeNull()
      ends.add(state.win!.by)
      expectEndIdentities(record, state)
    }
    // The corpus's reason to exist: driven wins of BOTH forms are a pinned fact —
    // a regression that stops offering wins strands a carrier in ryuukyoku here.
    for (const form of ['tsumo', 'ron']) {
      expect(ends.has(form), `the carrier corpus reached no ${form} end`).toBe(true)
    }
  })

  it('the 136-tile partition holds at every prefix of every won game, through the ended state', () => {
    // The winning tile never changes zone (a tsumo's stays in `drawn`, a ron's
    // stays counted in the discarder's pond) — so the same six-zone flatten that
    // covers playing states must read 136 distinct ids off the won state too.
    for (const record of winCorpus) expectConserved(record)
  })

  it('refolding a won record reproduces the identical winner, tile, and yaku', () => {
    // Nothing about the win is in the log — winner, tile, and yaku are re-derived
    // on every fold — which is exactly what makes this a property and not a
    // tautology: replay IS re-derivation, and it must land on the same win.
    for (const { seed, actions } of winCorpus) {
      const first = foldRecord({ seed, actions })
      const second = foldRecord({ seed, actions })
      expect(first.win).not.toBeNull()
      expect(second.win).toEqual(first.win)
      expect(second).toEqual(first)
    }
  })

  it('after a win nothing is offered and every action form throws — ron included', () => {
    // Two-sided quiescence: the offered set is empty, and the fold rejects every
    // form appended past the win — including ron, pinning that the ended-phase
    // carve-out (ron out of ryuukyoku, houtei) never extends to agari, and that a
    // second ron after a win is the multiple-ron convention's documented throw.
    for (const record of winCorpus) {
      const state = foldRecord(record)
      expect(legalActions(state)).toEqual([])
      const tile = state.win!.tile
      const uses = [0, 1, 2, 3] as const
      for (let s = 0; s < SEAT_COUNT; s++) {
        const seat = s as Seat
        const menu: HandAction[] = [
          { type: 'draw', seat },
          { type: 'discard', seat, tile },
          { type: 'chi', seat, tile, uses: [uses[0], uses[1]] },
          { type: 'pon', seat, tile, uses: [uses[0], uses[1]] },
          { type: 'daiminkan', seat, tile, uses: [uses[0], uses[1], uses[2]] },
          { type: 'ankan', seat, uses: [uses[0], uses[1], uses[2], uses[3]] },
          { type: 'shouminkan', seat, tile },
          { type: 'tsumo', seat },
          { type: 'ron', seat, tile },
        ]
        for (const mutant of menu) {
          assertMutantThrows(record.seed, record.actions, mutant, [])
        }
      }
    }
  })
})

// ————————————————————————————————————————————————————————————————————————————
// Dead-wall exhaustion anchors — mirrored from legal.test.ts (frozen, scratchpad-
// derived, never regenerate): random play cannot reach four kans or a haitei quad,
// so the exhaustion arm of the matrix is pinned on constructed states whose kan
// material is real — the same states the agreement suite proved suppression on.
// ————————————————————————————————————————————————————————————————————————————

/** The post-deal live wall for a seed, from the frozen upstream contracts. */
function dealtLive(seed: number): number[] {
  return dealHands(partitionWall(buildWall(seed)).live).live
}

/** The frozen 14-tile dead wall for a seed, same upstream derivation. */
function dealtDead(seed: number): number[] {
  return partitionWall(buildWall(seed)).dead
}

/** A tsumogiri-only record: `turns` draw+discard turns, the i-th tile live[i]. */
function tsumogiriRecord(seed: number, turns: number): HandRecord {
  const live = dealtLive(seed)
  const actions: HandAction[] = []
  for (let i = 0; i < turns; i++) {
    const seat = (i % SEAT_COUNT) as Seat
    actions.push({ type: 'draw', seat }, { type: 'discard', seat, tile: live[i] })
  }
  return { seed, actions }
}

const FOUR_KAN_SEED = 101033
const FOUR_KAN_GEOMS: ReadonlyArray<{
  holder: Seat
  source: Seat
  fourth: TileId
  uses: readonly [TileId, TileId, TileId]
}> = [
  { holder: 0, source: 2, fourth: 6, uses: [7, 4, 5] },
  { holder: 0, source: 1, fourth: 69, uses: [68, 70, 71] },
  { holder: 1, source: 0, fourth: 16, uses: [18, 17, 19] },
  { holder: 3, source: 0, fourth: 130, uses: [129, 131, 128] },
]

/** The seed-101033 four-daiminkan chain: tsumogiri to each source, kan, rinshan out. */
function fourKanChain(): HandAction[] {
  const live = dealtLive(FOUR_KAN_SEED)
  const dead = dealtDead(FOUR_KAN_SEED)
  const actions: HandAction[] = []
  let turn: Seat = 0
  let liveAt = 0
  FOUR_KAN_GEOMS.forEach((geom, kan) => {
    while (turn !== geom.source) {
      actions.push(
        { type: 'draw', seat: turn },
        { type: 'discard', seat: turn, tile: live[liveAt++] },
      )
      turn = ((turn + 1) % SEAT_COUNT) as Seat
    }
    actions.push(
      { type: 'draw', seat: geom.source },
      { type: 'discard', seat: geom.source, tile: geom.fourth },
      { type: 'daiminkan', seat: geom.holder, tile: geom.fourth, uses: geom.uses },
      { type: 'discard', seat: geom.holder, tile: dead[kan] }, // rinshan tsumogiri
    )
    liveAt++
    turn = ((geom.holder + 1) % SEAT_COUNT) as Seat
  })
  return actions
}

/**
 * The fifth-kan window: the four-kan chain, then pure tsumogiri until tile 122 —
 * the fourth 4z — lands as a fresh discard. West still holds copies 120/121/123,
 * so the window has real daiminkan material while the kan ceiling bars it.
 */
function fifthKanWindowRecord(): readonly HandAction[] {
  const live = dealtLive(FOUR_KAN_SEED)
  const actions = fourKanChain()
  let turn: Seat = 0 // the last holder was North; play resumes at East
  let liveAt = 11
  for (;;) {
    const tile = live[liveAt++]
    actions.push({ type: 'draw', seat: turn }, { type: 'discard', seat: turn, tile })
    if (tile === 122) return actions
    turn = ((turn + 1) % SEAT_COUNT) as Seat
  }
}

describe('dead-wall exhaustion throws', () => {
  it('a fifth kan at the seed-101033 window is unoffered and throws the rinshan guard', () => {
    const actions = fifthKanWindowRecord()
    const offered = new Set(legalActions(foldRecord({ seed: FOUR_KAN_SEED, actions })).map(keyOf))
    const mutant: HandAction = { type: 'daiminkan', seat: 2, tile: 122, uses: [120, 121, 123] }
    expect(offered.has(keyOf(mutant))).toBe(false)
    // Non-vacuity: the same three copies pon — the window's kan material is real,
    // only the exhausted dead wall bars the kan.
    expect(offered.has(keyOf({ type: 'pon', seat: 2, tile: 122, uses: [120, 121] }))).toBe(true)
    expect(() => foldRecord({ seed: FOUR_KAN_SEED, actions: [...actions, mutant] })).toThrow(
      'no rinshan tile remaining',
    )
  })

  it('an ankan on the emptied live wall at the seed-1004 haitei draw is unoffered and throws', () => {
    // South's dealt hand holds the 5p quad [55,52,53,54]; dropping the final discard
    // leaves the haitei draw in hand with the live wall empty — no replacement exists.
    const actions = tsumogiriRecord(1004, FULL_TURNS).actions.slice(0, -1)
    const state = foldRecord({ seed: 1004, actions })
    expect(state.live).toEqual([])
    expect(state.phase).toBe('playing')
    const mutant: HandAction = { type: 'ankan', seat: 1, uses: [55, 52, 53, 54] }
    expect(new Set(legalActions(state).map(keyOf)).has(keyOf(mutant))).toBe(false)
    expect(() => foldRecord({ seed: 1004, actions: [...actions, mutant] })).toThrow(
      'on an empty live wall',
    )
  })
})
