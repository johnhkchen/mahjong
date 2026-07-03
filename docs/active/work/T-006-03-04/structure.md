# T-006-03-04 — determinism-termination-harness — Structure

## File-level changes

| File | Change |
|---|---|
| `src/core/selfplay.test.ts` | **Created.** The whole ticket: lean driver + three suites. |
| everything else | Untouched. No runtime module changes anywhere. |

One new test file; no barrel change (tests are never exported); no app changes.
The purity gate picks the new file up automatically via `import.meta.glob('./*.ts')`
and will enforce its imports (siblings + vitest/fast-check only) with no edits.

## `src/core/selfplay.test.ts` — internal organization

Order within the file (the policy.test.ts / dynamics.test.ts mold: doctrine
header, imports, constants, helpers, suites):

### 1. Header comment (~25 lines)

The P5 statement: this suite is the AI-vs-AI determinism/termination harness —
all four seats botted through the policy pair, the cross-seat arbitration
re-stated in its lean form (independent of policy.test.ts's oracle-laden
rehearsal and of drive.ts's player-shaped wiring, both locked elsewhere), the
byte-identical replay defined as serialized-whole-record equality, in-process
scope honestly stated, and the mined-anchor doctrine ("re-mine deliberately on
any behavior-changing ticket, never loosen").

### 2. Imports

From `./index` (the policy.test.ts precedent — test files import the barrel):
`DEAL_SIZE, LIVE_WALL_SIZE, SEAT_COUNT, callPolicy, discardPolicy, foldRecord,
legalActions, seatView`, types `HandAction, HandRecord, Seat`. Tooling: `vitest`
(`describe, expect, it`), `fast-check` (`fc`).

### 3. Constants (re-stated, per the re-statement doctrine)

```
const FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE            // 70
const ACTION_BOUND = 2 * FULL_TURNS + 2 * 4 * SEAT_COUNT + 2  // 174
const CORPUS_SEEDS: readonly number[]                    // literal array, 0..N
```

Corpus size is a documented runtime budget (~5s isolated); the literal is written
out or `Array.from`-built — implement decides after mining, structure reserves
"0..39, widened until non-vacuity holds."

### 4. The driver — `selfPlay(seed: number): SelfPlayEnd`

```
interface SelfPlayEnd {
  record: HandRecord          // { seed, actions } — the byte-comparison subject
  endPhase: 'agari' | 'ryuukyoku'
  claims: number              // chi/pon/daiminkan folded
  wins: { tsumo: number; ron: number }   // 0/1 each — end-form tallies
}
```

Shape (the playPolicy skeleton, oracles removed):

- `for (;;)`: `state = foldRecord({ seed, actions })`, `legal = legalActions(state)`.
- End: `state.phase === 'agari'` → return; `legal.length === 0` → return
  (ryuukyoku, no houtei ron).
- Classify the decision point exactly as playPolicy does:
  `isCallPoint = state.phase === 'ryuukyoku' || (state.drawn === null &&
  !state.mustDiscard && state.claimable !== null)`.
- Call point: consult `callPolicy(seatView(state, seat), legal)` once per seat
  holding a ron/claim offer, first-offer order; keep the earliest non-draw answer
  by offered index; if none, fold `legal[0]` (guarded: must be the draw; a
  ryuukyoku call point with all-declines is unreachable — callPolicy never
  declines a ron — and throws).
- Own-turn point: `discardPolicy(seatView(state, state.turn), legal)`.
- Soundness guards (throw with seed + step, sweep convention):
  `legal.includes(chosen)` (reference membership), and
  `actions.length > ACTION_BOUND` after the push (the termination tripwire).
- Tally claims/wins as folded.

Private helpers under the driver: `isClaimAction` (the established type-guard
twin) — nothing else should be needed.

### 5. Failure reporting helper — `firstDivergence(a, b): string`

Computed only on mismatch: walks two action arrays, names the first differing
index and both actions (JSON), so a replay failure reads as "seed S diverges at
action K: X vs Y" instead of a 150-action string diff. Plain-throw consumer.

### 6. Suite 1 — `describe('AI-vs-AI self-play: the corpus')`

One test, 60s timeout, one pass over the corpus with plain throws per seed and
aggregate expects at the end (the one-expect-per-game perf lesson):

- per seed: `a = selfPlay(seed)`, `b = selfPlay(seed)`;
  - `JSON.stringify(a.record) !== JSON.stringify(b.record)` → throw with
    `firstDivergence`;
  - endPhase not in {agari, ryuukyoku} → throw (belt over the return type);
  - `a.record.actions.length > ACTION_BOUND` → throw (explicit AC visibility —
    the driver also trips internally);
- aggregates: `expect(phases).toContain('agari')` and `'ryuukyoku'`;
  `expect(claims).toBeGreaterThan(0)`; `expect(tsumoCount).toBeGreaterThan(0)`;
  `expect(ronCount).toBeGreaterThan(0)`. Comment: "widen the corpus, never
  weaken the check."

### 7. Suite 2 — `describe('mined anchors')`

Three tests, one per anchor seed (chosen at implement time from the corpus:
one ron-agari, one tsumo-agari, one ryuukyoku). Each pins frozen literals:
`actions.length`, `endPhase`, and for wins the folded `win.by / win.winner /
kindOf(win.tile)` (win facts read from `foldRecord` of the produced record —
the double-key: literal pins arbitration, fold guarantees consistency).

### 8. Suite 3 — `describe('property: sampled seeds')`

One fc test, 60s timeout, `fc.integer({min: 0, max: 0xffffffff})`, numRuns 10:
double-play the sampled seed, assert byte-identity, ended phase, and bound —
the corpus invariants extended over the full seed domain.

## Interfaces and boundaries

- **Public interface**: none. Test-only file; nothing exported; barrel untouched.
- **Module boundary**: imports the core barrel and tooling only — purity-gate
  clean by construction.
- **Contract consumed**: legalActions' deterministic offered order (arbitration
  by index), the policies' element-of-offered purity, foldRecord's authority.
  Nothing new is frozen EXCEPT the mined anchor literals, which freeze the
  composed behavior of policy+legal+fold for three named seeds.

## Ordering of changes

1. Driver + Suite 1 (corpus) — the AC's substance; mining happens here (run the
   corpus, read the tallies, size the corpus for non-vacuity).
2. Suite 2 (anchors) — needs step 1's mined facts.
3. Suite 3 (fc layer) — independent, last because it is pure breadth.

Steps 1–2 could be one commit if mining is quick; plan decides the commit split.
