# T-008-02-02 — multi-hand-dynamics-suite — Plan

Ordered, independently-verifiable steps. Each is small enough to commit atomically.

## Step 1 — scaffold `src/core/game.dynamics.test.ts`: header, imports, constants

Write the module header comment (structure.md §2), imports, and constants
(`FULL_TURNS`/`ACTION_BOUND`/`HANDS_PER_GAME`/`STARTING_SCORE`/`GAME_SEEDS`). No driver
functions yet — file should still fail `tsc` on unused-nothing (empty body is fine) or, more
usefully, include a placeholder `describe.skip` block so `just test` stays green through
intermediate steps.

**Verify:** `just check` passes; `just test` still green (nothing new asserted yet).

## Step 2 — `selfPlayHand` (the per-hand bot driver)

Port `selfplay.test.ts`'s `selfPlay` body verbatim (design.md Decision 1 / structure.md §2),
trimmed to return `HandRecord` only (this suite doesn't need `claims`/`endPhase`/`win`
separately — the boundary checker re-derives whatever it needs from the folded
`TableState`). Add one throwaway smoke assertion (`it('smoke: seed 0 self-plays to an ended
hand', ...)`, deleted or kept minimal) to confirm the port works before building on it.

**Verify:** the smoke test passes in isolation (`npx vitest run src/core/game.dynamics.test.ts`).

## Step 3 — `playGame` (the multi-hand chain driver)

Implement `playGame(gameSeed, handCount)` per structure.md §2, using the real `handSeedOf`.
Extend the smoke test: `playGame(0, HANDS_PER_GAME).hands` has length `HANDS_PER_GAME`, every
hand's folded `TableState.phase` is `'agari'` or `'ryuukyoku'`.

**Verify:** smoke test green in isolation.

## Step 4 — `nextExpectedDealer` / `expectedSeatWinds` (the independent rotation restatement)

Implement both per structure.md §2 — plain functions, no test framework involvement yet.
Spot-check inline in the smoke test against ONE hand-picked seed/hand-index combination
whose outcome (dealer-win vs. not) is known by inspection, to catch a transcription slip
in the restated rule before it's load-bearing for every other test.

**Verify:** smoke test green.

## Step 5 — `expectValidBoundary` (the core assertion, structure.md §2 steps 1-6)

Implement the full boundary checker. Write ONE test exercising it directly over a single
mined-feeling but arbitrary seed (e.g. `expectValidBoundary` walked across all
`HANDS_PER_GAME` prefixes of `playGame(0, HANDS_PER_GAME)`, threading `prevDealer` from `0`)
to validate the function's own plumbing (argument shapes, `foldGame` call shape) before
wiring it into the corpus/property suites.

**Verify:** this single-seed test passes; if it doesn't, the bug is isolated to one seed's
worth of output, not a whole corpus of fast-check-shrunk noise.

## Step 6 — the corpus suite (`describe('multi-hand dynamics: corpus')`)

Wire `GAME_SEEDS` through `playGame` + `expectValidBoundary` per structure.md §3.1, with the
`renchanCount`/`rotationCount`/end-phase tallies and non-vacuity assertions. Remove the
scaffolding smoke tests from Steps 2-5 once this subsumes them (or fold their seed-0 case
into `GAME_SEEDS` so no coverage is lost — `GAME_SEEDS` already starts at 0).

**Verify:** `npx vitest run src/core/game.dynamics.test.ts` green; tallies printed via a
temporary `console.log` during development (removed before commit) to confirm non-vacuity
isn't accidentally trivial (e.g. every seed renchans and none rotate).

## Step 7 — the byte-identical replay suite (`describe('...byte-identical replay')`)

Per structure.md §3.2: `GAME_SEEDS` looped, `playGame` called twice per seed, `JSON.stringify`
equality plus `foldGame`-deep-equality on both independently-built records.

**Verify:** green; deliberately break `selfPlayHand`'s determinism locally for one manual run
(e.g. inject `Math.random()` into a tie-break) to confirm the test actually fails before
reverting — a sanity check on the check itself, not committed.

## Step 8 — the full-domain property suite (`describe('...property over the full seed domain')`)

Per structure.md §3.3: `fc.integer({ min: 0, max: 0xffffffff })`, `numRuns: 8`,
`{ timeout: 60_000 }`, same boundary walk as Step 6 minus the tallies, plus the explicit
`ACTION_BOUND` assertion on the final hand.

**Verify:** green; timing checked (`npx vitest run --reporter=verbose
src/core/game.dynamics.test.ts`) to confirm total suite runtime stays well under the 60s
timeout (informing whether `numRuns`/`HANDS_PER_GAME` need adjusting down before commit).

## Step 9 — full-suite verification pass

Re-run `just test` and `just check` from a clean state. Confirm:
- No `src/core/` file gained a DOM/Svelte import.
- `game.dynamics.test.ts` is the ONLY new/changed file (`git status`/`git diff --stat`).
- No leftover `console.log`/`it.only`/`describe.only` survives.
- Total suite wall time is still reasonable (compare `just test`'s reported duration before
  vs. after — flag if this suite alone adds more than a few seconds).

**Verify:** both commands exit 0; `git status` confirms the file list.

## Testing strategy summary

- This ticket's deliverable IS a test file — there is no separate "unit test the
  implementation" step; Steps 2-5 build the driver/checker incrementally with throwaway
  smoke assertions specifically so a bug in the SUITE's own plumbing (not `game.ts`) is
  caught early and cheaply, before it's buried under fast-check shrinking output.
- Corpus (deterministic, tallied, non-vacuity-checked) + property (full-domain, universal-
  only) — both required per design.md Decision 7, mirroring `selfplay.test.ts`'s own shape.
- `just check` is cheap and run after Step 1 to catch import/type drift early; `just test`
  is the gate from Step 6 onward.

## Commit boundaries

One commit: the whole new test file (Steps 1-8 folded together — this ticket adds no
production code, so there is no natural "scaffold vs. logic" split the way `game.ts` itself
had; a partial suite mid-steps has no independent value to commit separately). Step 9's
clean verification pass folds into the same commit if nothing surfaces, per the
T-008-01-03/T-008-02-01 precedent of not leaving a separate empty verification commit.
