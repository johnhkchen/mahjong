// The AI-vs-AI self-play harness — P5's determinism/termination invariant made
// executable (charter: "AI-vs-AI determinism doubling as attract mode"; CLAUDE.md:
// full hands must be deterministically simulatable). All FOUR seats are botted
// through the policy pair over per-seat views, with the cross-seat arbitration
// re-stated here in its LEAN form: consult callPolicy once per seat holding a
// window offer, fold the earliest non-draw answer in offered order (legal.ts froze
// that order as the rules' precedence), else let the window go stale on the head
// draw. This is deliberately the THIRD statement of that rule — policy.test.ts's
// sweep carries it wrapped in per-step oracles (the -02 pins), drive.ts ships it
// shaped around a human player (the -03 pins) — because the codebase locks
// independent statements by test rather than sharing them; the lock here is that
// the driver only ever appends membership-checked offered elements (any drift
// still folds legally) plus the mined anchors below, which freeze the composed
// end-to-end behavior for named seeds. On any behavior-changing policy/legal
// ticket the anchors break LOUDLY and are re-mined deliberately — never loosened.
//
// The invariant, stated honestly: two INDEPENDENT in-process playthroughs of the
// same seed produce byte-identical serialized records (JSON of {seed, actions} —
// the artifact localStorage persistence and bug-report logs round-trip), and every
// game ends (agari or ryuukyoku) within the vocabulary's own action bound.
// Cross-process/cross-platform determinism rests on the frozen conventions this
// composes — integer rng, no ambient reads, fold/legality determinism — each
// pinned by its own suite (rng.test.ts, record.test.ts, legal.test.ts).

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEAL_SIZE,
  LIVE_WALL_SIZE,
  SEAT_COUNT,
  callPolicy,
  discardPolicy,
  foldRecord,
  kindOf,
  legalActions,
  seatView,
  type HandAction,
  type HandRecord,
  type Seat,
  type TableState,
} from './index'

/** The dynamics.test.ts action-bound arithmetic, re-stated per the re-statement doctrine. */
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE
const ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 * SEAT_COUNT + 2

/**
 * The corpus, sized as a runtime budget and mined for non-vacuity: seeds 0..39
 * hold 37 agari (14 tsumo, 23 ron), 3 ryuukyoku, and 95 folded claims, and a
 * double-played pass runs ~1s isolated. If a policy/legal change ever zeroes one
 * of the aggregate tallies asserted below, WIDEN the corpus (or substitute
 * individually-mined tail seeds) — never weaken the check.
 */
const CORPUS_SEEDS = Array.from({ length: 40 }, (_, i) => i)

/** The claim-window call forms, test-side (the policy module's ClaimOffer twin). */
type ClaimAction = Extract<HandAction, { type: 'chi' | 'pon' | 'daiminkan' }>

function isClaimAction(action: HandAction): action is ClaimAction {
  return action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan'
}

/** What one self-played hand ends as — the record is the byte-comparison subject. */
interface SelfPlayEnd {
  record: HandRecord
  endPhase: TableState['phase']
  /** chi/pon/daiminkan folded — the corpus non-vacuity tallies. */
  claims: number
  win: TableState['win']
}

/**
 * Drive one whole hand from a seed with every seat botted: discardPolicy at
 * own-turn points, callPolicy at claim windows and houtei, arbitration per the
 * header. State advances only by refolding the longer record — foldRecord stays
 * the single authority, no step logic is reimplemented here. Two soundness guards
 * (plain throws, the sweep convention): every folded action is a REFERENCE MEMBER
 * of the offered set, and the action count never passes the bound — a trip is a
 * non-terminating turn loop, not a long game.
 */
function selfPlay(seed: number): SelfPlayEnd {
  const actions: HandAction[] = []
  let claims = 0
  for (;;) {
    const state = foldRecord({ seed, actions })
    const legal = legalActions(state)
    if (state.phase === 'agari' || legal.length === 0) {
      return { record: { seed, actions }, endPhase: state.phase, claims, win: state.win }
    }
    const step = actions.length
    let chosen: HandAction
    const isCallPoint =
      state.phase === 'ryuukyoku' ||
      (state.drawn === null && !state.mustDiscard && state.claimable !== null)
    if (isCallPoint) {
      // Consult each offer-holding seat once, in offered (rotation) order; the
      // earliest non-draw answer by offered index wins; a draw answer means that
      // seat DECLINED (the -02 contract), never "fold the draw now".
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
      if (best === null) {
        if (state.phase === 'ryuukyoku') {
          // Unreachable: callPolicy never declines a ron, and a ronless ryuukyoku
          // offers nothing (the walk already returned). Kept loud, not silent.
          throw new Error(`seed ${seed} step ${step}: ryuukyoku call point declined every ron`)
        }
        chosen = legal[0] // every consulted seat passed — the window goes stale
        if (chosen.type !== 'draw') {
          throw new Error(`seed ${seed} step ${step}: pre-draw offered set does not lead with the draw`)
        }
      } else {
        if (isClaimAction(best)) claims += 1
        chosen = best
      }
    } else {
      chosen = discardPolicy(seatView(state, state.turn), legal)
    }
    if (!legal.includes(chosen)) {
      throw new Error(`seed ${seed} step ${step}: chosen action is not an offered element`)
    }
    actions.push(chosen)
    if (actions.length > ACTION_BOUND) {
      throw new Error(`seed ${seed}: self-play exceeded ${ACTION_BOUND} actions — the turn loop is not terminating`)
    }
  }
}

/** Computed only on mismatch: name the first diverging action instead of diffing ~150 lines of JSON. */
function firstDivergence(a: readonly HandAction[], b: readonly HandAction[]): string {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      return `action ${i}: ${JSON.stringify(a[i])} vs ${JSON.stringify(b[i])}`
    }
  }
  return `lengths ${a.length} vs ${b.length} (equal up to action ${n})`
}

/** Double-play one seed and assert the per-seed invariant by plain throw; return the first run. */
function playTwiceChecked(seed: number): SelfPlayEnd {
  const first = selfPlay(seed)
  const second = selfPlay(seed)
  if (JSON.stringify(first.record) !== JSON.stringify(second.record)) {
    throw new Error(
      `seed ${seed}: replay is not byte-identical — ${firstDivergence(first.record.actions, second.record.actions)}`,
    )
  }
  if (first.endPhase !== 'agari' && first.endPhase !== 'ryuukyoku') {
    throw new Error(`seed ${seed}: self-play stopped in phase '${first.endPhase}'`)
  }
  return first
}

describe('AI-vs-AI self-play: the corpus', () => {
  // Explicit generous timeout, the sweep convention: CI-adjacent machines run
  // suites concurrently; isolated runtime is ~1s.
  it('replays every corpus seed byte-identically to an ended phase within the bound', { timeout: 60_000 }, () => {
    const phases = new Set<string>()
    let claims = 0
    let tsumoWins = 0
    let ronWins = 0
    let longest = 0
    for (const seed of CORPUS_SEEDS) {
      const end = playTwiceChecked(seed)
      phases.add(end.endPhase)
      claims += end.claims
      if (end.win?.by === 'tsumo') tsumoWins += 1
      if (end.win?.by === 'ron') ronWins += 1
      longest = Math.max(longest, end.record.actions.length)
    }
    // The AC's bound, stated visibly (the driver also trips internally).
    expect(longest).toBeLessThanOrEqual(ACTION_BOUND)
    // Non-vacuity — pinned facts, never statistics: termination must be proven
    // over games that actually win (both forms) AND actually exhaust the wall,
    // with the call branch and its arbitration exercised. Zeroed by a corpus
    // change? Widen the corpus, never weaken the check.
    expect(phases).toContain('agari')
    expect(phases).toContain('ryuukyoku')
    expect(claims).toBeGreaterThan(0)
    expect(tsumoWins).toBeGreaterThan(0)
    expect(ronWins).toBeGreaterThan(0)
  })
})

describe('mined anchors — the composed behavior frozen for named seeds', () => {
  // Each anchor pins the log length and end facts mined from the corpus run; the
  // win facts are read from the FOLD of the produced record (the double-key: the
  // literal freezes arbitration drift, the fold guarantees the facts are the
  // record's own derivation, so a wrong mine cannot freeze a wrong behavior).
  it('seed 25 — a menzen-tsumo agari (now composed with riichi, T-009-02-02 repair)', () => {
    const { record, endPhase } = selfPlay(25)
    expect(record.actions).toHaveLength(36)
    expect(endPhase).toBe('agari')
    const win = foldRecord(record).win!
    expect(win.by).toBe('tsumo')
    expect(win.winner).toBe(1)
    expect(kindOf(win.tile)).toBe('5p')
    expect(win.yaku).toEqual(['menzen-tsumo', 'riichi'])
  })

  it('seed 9 — a window ron off another bot, through folded claims', () => {
    const { record, endPhase, claims } = selfPlay(9)
    expect(record.actions).toHaveLength(51)
    expect(endPhase).toBe('agari')
    expect(claims).toBe(3)
    const win = foldRecord(record).win!
    expect(win.by).toBe('ron')
    expect(win.winner).toBe(1)
    if (win.by === 'ron') expect(win.from).toBe(2)
    expect(kindOf(win.tile)).toBe('6s')
    expect(win.yaku).toEqual(['yakuhai-haku'])
  })

  // Re-mined (T-009-02-02 repair): seed 13 no longer reaches houtei under riichi-eager
  // bots — a normal ron ends the hand long before the wall empties (win.yaku ['riichi']
  // only, record length 107 vs the old 141). Seed 356, scanned fresh out to the full
  // corpus range, still produces the same "ron pulled out of what would be ryuukyoku"
  // shape this anchor exists to pin — re-anchored there instead of weakening the check.
  it('seed 356 — a houtei ron folded OUT of ryuukyoku (the ended→ended transition)', () => {
    const { record, endPhase } = selfPlay(356)
    expect(record.actions).toHaveLength(147)
    expect(endPhase).toBe('agari')
    const win = foldRecord(record).win!
    expect(win.by).toBe('ron')
    expect(win.winner).toBe(0)
    if (win.by === 'ron') expect(win.from).toBe(2)
    expect(win.yaku).toEqual(['houtei'])
  })

  it('seed 19 — a ryuukyoku, its length the call arithmetic (140 + 2 per claim)', () => {
    const { record, endPhase, claims } = selfPlay(19)
    expect(endPhase).toBe('ryuukyoku')
    expect(claims).toBe(2)
    // A claim adds a discard without consuming a draw: 2·FULL_TURNS + 2·claims.
    expect(record.actions).toHaveLength(2 * FULL_TURNS + 2 * claims)
    expect(foldRecord(record).win).toBeNull()
  })
})

describe('property: sampled seeds over the full domain', () => {
  it('replays byte-identically to an ended phase within the bound', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const end = playTwiceChecked(seed)
        expect(end.record.actions.length).toBeLessThanOrEqual(ACTION_BOUND)
      }),
      { numRuns: 10 },
    )
  })
})
