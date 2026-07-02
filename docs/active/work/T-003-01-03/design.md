# T-003-01-03 — Design: turn-loop-property-suite

Decisions for the random-legal-sequence property suite, grounded in research.md.

## Decision summary

A single new test file, `src/core/dynamics.test.ts`, containing a test-local
random-legal-game builder driven by `legalActions` + `foldRecord`, with fast-check
supplying the choice stream. Four property groups: prefix conservation, fold
determinism, termination, mutation. No runtime code changes.

## Option space and choices

### 1. Where the generator lives

- **(a) Test-local helper in the new test file** — chosen. The only consumer today
  is this suite. House convention is explicit: helpers are "mirrored per-file", not
  shared through helper modules. The purity gate stays trivially satisfied.
- (b) A runtime `randomPlayer`/`playOut` module in core — rejected. Bots are a future
  epic with their own design (stateless `state → action` peripheral, difficulty,
  seeded rng); pre-building a runtime surface from a test ticket would freeze a shape
  the bot ticket hasn't designed. Tests never ship; runtime code does.
- (c) A shared `testkit.ts` non-test helper file — rejected. It would be a runtime
  module by the purity gate's classification (imports fine, but it ships in the
  barrel-visible directory) and breaks the mirrored-per-file convention for no
  second consumer.

### 2. How randomness drives the game

- **(a) fast-check generates a fixed-length array of choice integers; the builder
  indexes the offered set with `choices[i] % legal.length`** — chosen. All
  randomness flows through fc, so shrinking works: a failing game shrinks toward
  fewer/smaller choices. A full game needs one choice per post-draw point (70);
  pre-draw points offer exactly 1 action, so no choice is consumed. Modulo keeps
  every integer valid against any offered-set size, so the arbitrary stays decoupled
  from engine internals.
- (b) Drive with the engine's own `createRng`+`nextInt` — rejected: hides the
  randomness from fc's shrinker and couples the suite to the rng stream contract.
- (c) `fc.commands`/model-based testing — rejected: fc's command machinery models
  stateful APIs; the engine's API is a pure fold, and the simpler array-of-choices
  encoding produces the same coverage with less machinery.

### 3. How the builder advances state (no public stepper exists)

- **(a) Incremental refold: append the chosen action, refold the whole record each
  step** — chosen. It is the honest statement of the architecture ("table state is
  always derived by folding"), it reuses no private API, and cost is O(n²) per game
  (~10k applyActions for 140 actions) — measured baseline leaves ample budget.
  The builder returns the full record; properties refold prefixes as needed.
- (b) Reimplement a stepping shadow of `applyAction` in the test — rejected: a
  second statement of the step is exactly what legal.test.ts already provides; a
  third would be a maintenance liability and could mask bugs by agreeing with itself.

### 4. Conservation: the five-zone reading of the AC

The AC says "hands + ponds + live + dead always partition exactly 136 distinct tile
ids at every prefix." At post-draw prefixes the drawn tile is in none of those four
zones — the frozen `TableState` contract holds it apart. **Decision: check the
five-zone partition (hands + ponds + drawn + live + dead) at every prefix**, exactly
as `record.test.ts`'s existing conservation property does. This is the only reading
under which the identity holds at *every* prefix, which is the AC's operative
demand. Additionally assert the four-zone form (drawn === null) at every even
prefix, so the AC's literal wording is honored where it is well-formed.

### 5. Prefix checking strategy

- **(a) One generated game per run; walk every prefix 0..len, refolding each** —
  chosen. O(n²) refolds ≈ 10k applies per game; with games capped at full length
  (140 actions) and fc's default 100 runs this stays well within a low-seconds
  budget (verified against the 0.5s baseline in Plan step 0 timing gate).
- (b) Sample random prefixes only — rejected: "at every prefix" is the AC's words,
  and the exhaustive walk is affordable.

### 6. Game length distribution

Generate `turns ∈ [0, 70]` complete-turn targets plus an optional dangling draw
(mirroring `prefixArb` in legal.test.ts), so properties see dealt, mid-hand, and
full-game states. Termination and full-game properties fix turns = 70 by looping
"while offered set is non-empty" with a hard iteration bound — the loop, not a
precomputed length, is what *proves* termination (a stuck or looping engine hits the
bound and fails loudly rather than hanging vitest).

Bound choice: 2 × 70 + 1 = 141 turn iterations (each iteration is one draw + one
discard). If the loop exits with actions ≠ 280… correction: 140 actions (70 draws +
70 discards); the bound is iterations > 70 → fail. Assert on exit: exactly 140
actions, `phase === 'ryuukyoku'`, `live` empty, offered set empty.

### 7. Mutation design (the illegal half)

Take a generated legal record, a mutation point `i` chosen by fc, and a mutation
operator chosen by fc. Fold the prefix before `i`, compute the offered set, build
the mutant action, then:

- if the mutant is in the offered set (possible only for tile-retarget), the run is
  discarded with `fc.pre(false)` — a mutant that is still legal is not a
  counterexample candidate (agreement suite precedent);
- otherwise assert the offered set does not contain it AND
  `foldRecord(mutated record)` throws `RangeError`.

Operators (each one rule outside legality, spanning every guard in `applyAction`):

1. **seat bump** — `seat' = (seat + k) % 4, k ∈ {1,2,3}`: wrong-seat draw/discard.
2. **type flip** — draw at `i` → discard of a random tile (discard-before-draw /
   unheld); discard at `i` → draw (draw out of sequence).
3. **tile retarget** — discard tile → random `TileId ∈ [0,136)`; only asserted when
   outside the offered set (hits "neither holds nor just drew").
4. **duplicate** — insert a copy of action `i` before itself (second draw in a row /
   double discard).
5. **append after end** — on a full game, append a random action past ryuukyoku
   (hits the ended-hand guard).

Truncation is *not* an operator: every prefix of a legal record is legal, so
deletion of a suffix produces a legal record — nothing to assert. Deleting an
*interior* action is covered in effect by (2)/(4) (the sequence desynchronizes at
the deletion point) but is harder to reason about (a deleted discard makes the next
draw out-of-sequence — same guard as duplicate); omitted to keep operators
one-rule-outside.

### 8. Determinism property scope

Fold the same random-legal record twice; assert deep equality (`toEqual`) of the two
`TableState`s, and spot-assert array freshness (`not.toBe`) at the top level.
Freshness is already proven exhaustively in record.test.ts; here the new content is
determinism over *tedashi-bearing* records, so deep equality is the headline and
freshness a one-line guard against the property passing via shared references.

### 9. What is deliberately NOT re-proven here

Value predictions (which tile lands where) stay in record.test.ts — expectations
there derive from the wall. This suite's properties are invariants over trajectories
the tsumogiri suites cannot reach (permuted hands, mixed tedashi/tsumogiri). The
one framing rule from research.md: the generator *drives* through the code under
test, so it may only assert self-evident invariants (conservation, equality of
repeated folds, structural termination, throws), never derived values.

### 10. fc run counts and budget

Default 100 runs for the cheap properties; the prefix-conservation walk and the
mutation property fold O(n²) per run, so they get an explicit `numRuns` (start at
50/100 and gate on measured time in Plan; target: whole suite adds ≲2s to the 0.5s
baseline). Explicit `numRuns` values are stated in the test file so budget intent
is reviewable.

## Rejected wholesale

- Property-testing via `fc.scheduler`/async — the engine is synchronous and pure.
- Snapshot/golden tests of random games — randomness makes goldens meaningless;
  goldens live in record.test.ts against frozen seed-1 facts.
- Touching `record.ts`/`legal.ts` to add a stepper or generator hook — the AC is
  satisfiable with tests only; runtime surface changes belong to tickets that own
  runtime behavior.

## Consequence for acceptance criteria

- Conservation at every prefix → §4 + §5 (five-zone, exhaustive walk).
- Fold determinism → §8 (deep-equal double fold of random-legal records).
- Guaranteed termination → §6 (bounded while-loop over the offered set).
- Mutated sequences throw → §7 (five one-rule-outside operators, offered-set
  membership filter).
- `just test` green → Plan defines the timing gate and the run-count dials.
