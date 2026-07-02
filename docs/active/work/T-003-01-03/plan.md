# T-003-01-03 — Plan: turn-loop-property-suite

Ordered steps, each independently verifiable and committable green. All work lands
in one new file (`src/core/dynamics.test.ts`), so steps grow that file; artifacts
commit at the end with review.md.

## Step 0 — Baseline (no commit)

Run `just test` and note the timing. Done during research: 81 tests green, ~0.5s
test time (~1s wall). This is the budget reference for step 6's timing gate.

## Step 1 — Generator core + conservation property

Create `src/core/dynamics.test.ts` with:

- file-top comment (why this suite exists: dynamics over random-legal trajectories,
  composition of record.ts + legal.ts, generator is test-local by design),
- imports from `./index`, constants (`FULL_TURNS`, `seedArb`),
- `playRecord(seed, choices)` with the hard iteration bound (throws past
  `2 * FULL_TURNS + 2` appended actions),
- `allZones(state)`,
- `gameArb` (seed + up to 70 choices + dangle),
- describe `conservation over random play`:
  - property: every prefix of a random-legal game folds to a five-zone partition of
    exactly 136 distinct tile ids (length 136, Set size 136); where the prefix state
    has `drawn === null`, also assert the four-zone literal (AC wording) — i.e.
    `state.drawn === null` implies four zones flat to 136 already,
  - explicit `numRuns: 50` to start (timing-gated at step 6).

Verify: `just test` green; new property fails if `allZones` is tampered (spot-check
by momentarily breaking the helper locally — not committed).

Commit: `T-003-01-03: random-legal generator + conservation at every prefix`

## Step 2 — Fold determinism property

Add describe `fold determinism over random play`:

- property over `gameArb`: `foldRecord` twice on the same record → `toEqual` deep
  equality; `not.toBe` freshness spot-checks on `hands`, `ponds`, `live`.

Verify: `just test` green.

Commit: `T-003-01-03: fold determinism over tedashi-bearing random records`

## Step 3 — Termination property

Add `fullGameArb` (exactly 70 choices) and describe `termination`:

- property: the driven game stops with exactly `2 * FULL_TURNS` (140) actions,
  `phase === 'ryuukyoku'`, `live` empty, `drawn` null, `legalActions(folded)`
  empty, ponds flatten to 70 tiles. The proof of "terminates rather than looping"
  is `playRecord`'s internal hard bound: a non-terminating regression throws there
  instead of hanging vitest.

Verify: `just test` green.

Commit: `T-003-01-03: every random legal game terminates in ryuukyoku`

## Step 4 — Mutation property

Add `keyOf` (mirrored from legal.test.ts), the `mutate` switch (five operators:
seat-bump, type-flip, tile-retarget, duplicate, append-after-end), and describe
`mutated sequences throw`:

- arbitraries: `gameArb` (mutation of mid-hand games) for ops 1–4 with fc-chosen
  index/seat-delta/tile; `fullGameArb` for op 5 (append past ryuukyoku),
- `fc.pre(record.actions.length > 0)` where an action index is required,
- tile-retarget mutants that land inside the offered set are `fc.pre`-discarded,
- assertions per mutant: absent from `legalActions` at the mutation point (via
  `keyOf` set) and `foldRecord(mutant)` throws `RangeError`.

Structure this as one property parameterized by an operator arbitrary, or a small
describe with one `it` per operator — decide at implementation for readability;
one `it` per operator is the default (matches the throw-matrix style, and a failure
names the operator).

Verify: `just test` green; each operator's `it` observed to actually run its
assertions (no vacuous all-discarded properties — assert at least a floor of
non-discarded runs via fc's own reporting or a sanity counter if cheap).

Commit: `T-003-01-03: five-operator mutation matrix — illegal mutants all throw`

## Step 5 — Cross-checks

- `just check` (svelte-check + tsc) — new file typechecks with no unused imports.
- Confirm `purity.test.ts` still passes (it now also scans dynamics.test.ts).
- Re-read acceptance criteria against the describes (traceability table in
  review.md).

No commit (nothing should change; if something does, fold the fix into a
`T-003-01-03: <fix>` commit).

## Step 6 — Timing gate

Run `just test` 2–3 times; compare against the 0.5s baseline.

- Target: total test time ≤ ~2.5s wall. The two O(n²) properties (conservation
  walk, mutation) are the dials: `numRuns` 50 and 100 respectively to start.
- If over budget: halve the heavier `numRuns` (floor 25) before touching anything
  else; note final numbers in progress.md.
- If comfortably under: consider raising conservation to 100 runs; not required.

Commit only if dials changed: `T-003-01-03: tune property run counts`

## Step 7 — Artifacts + review

Write `progress.md` (running throughout; finalize) and `review.md` (changes,
coverage vs AC, open concerns). Commit all six artifacts:

`T-003-01-03: add RDSPI artifacts (research/design/structure/plan/progress/review)`

## Testing strategy summary

This ticket IS tests; the strategy is the design. What guards the tests themselves:

- **Non-vacuity**: termination asserts exact counts (140 actions, 70 pond tiles) so
  a generator that silently stops early fails; mutation `it`s must not be able to
  pass by discarding every run (fc raises on excessive `pre` rejection by default —
  rejection ratio is the built-in floor).
- **No self-agreement**: no step logic is reimplemented; `foldRecord` is the only
  state-advancer, `legalActions` the only offer-authority, and the two were locked
  together by T-003-01-02. This suite adds trajectories, not authorities.
- **Loud failure**: `playRecord`'s bound converts any future non-terminating
  vocabulary bug (e.g. a call action that doesn't consume wall) into a thrown
  error inside a normal test failure.

## Verification criteria (definition of done)

- [ ] `just test` green, total wall time ≤ ~2.5s.
- [ ] `just check` green.
- [ ] Conservation asserted at every prefix of random-legal games (five-zone, plus
      four-zone at pre-draw prefixes).
- [ ] Determinism: double-fold deep equality over tedashi-bearing records.
- [ ] Termination: bounded loop, exact 140-action ryuukyoku endings.
- [ ] Mutation: five operators, offered-set filtered, all throw RangeError.
- [ ] No runtime source touched; purity gate green.
- [ ] Incremental commits as above; artifacts committed last.

## Risks / contingencies

- **fc rejection blow-up in tile-retarget** (mutant legal too often): 14 of 136
  tiles are legal post-draw (~10%) — rejection ratio is safe. If fc still flags it,
  bias the retarget arbitrary away from the acting seat's tiles.
- **O(n²) surprises**: if the conservation walk is unexpectedly slow under vitest's
  transform, drop `numRuns` per step 6 before restructuring; never sample prefixes
  (AC says every prefix).
- **Flaky shrink times on failure**: only manifests when a property fails (CI red
  anyway); no mitigation needed.
