# Progress — T-009-02-02 riichi-dynamics-suite

## Completed

- Step 1 (baseline reproduction): confirmed `npx vitest run src/core/game.dynamics.test.ts`
  failed 2/3 tests pre-change (`expected 99000 to be 100000`), matching research.md.
- Step 2 (conservation fix + pot-carry assertion): done, with one deviation — see below.
- Step 3 (riichi non-vacuity tally): done as planned; manually forced
  `expect(riichiHands).toBeGreaterThan(0)` → `toBe(0)` and confirmed the test then fails
  (assertion is live, not vacuous), then reverted.
- Step 4 (full-suite regression check): run, see "Pre-existing failures found" below —
  none attributable to this ticket's change.
- Step 5 (typecheck): `just check` → `0 ERRORS 0 WARNINGS`.

All work is a single file: `src/core/game.dynamics.test.ts`.

## Deviation from plan.md / structure.md: `expectedPotCarry` redesigned mid-implementation

Structure.md's original design (Change 1) proposed:

```ts
function expectedPotCarry(endedState: TableState): number {
  return endedState.phase === 'agari' ? 0 : endedState.pot
}
```

...where `endedState` is the existing `foldRecord({ seed, actions: hands[lastIndex] })`
call already in `expectValidBoundary` (no `RiichiContext`, defaults to `FRESH_CONTEXT`:
`potIn: 0`).

**Implemented and ran this exact version first (per plan.md step 2), and it failed
intermittently** — not on the fixed `GAME_SEEDS` corpus, but on the `fc.property` full
seed-domain test, roughly 1 run in 3-4 (`npx vitest run` repeated 5-8 times reproduced it
each time with a different counterexample seed, e.g. `1490443411`, `2071473749`,
`3701382226`; failure was always "expected N, received N + 1000 or N + 2000").

**Root cause:** `endedState.pot` from a `FRESH_CONTEXT` fold is only correct for the FIRST
hand of a game (`potIn: 0` really is the true carried-in pot). For hand index > 0 in a
multi-hand game where an earlier hand's ryuukyoku already carried a pot forward,
`FRESH_CONTEXT`'s `potIn: 0` silently understates the real carried-in pot by whatever
sticks were already sitting there — `.phase` from that same fold stays correct (natural
hand-ending logic — wall exhaustion, winning-hand detection — never reads `scoresIn`/
`potIn`), but `.pot` does not. The existing `nextExpectedDealer` helper, which the file
already had before this ticket, gets away with the same `FRESH_CONTEXT` `endedState`
precisely because it only reads `.phase`/`.win!.winner`, never `.pot` — so this bug was
latent and harmless until this ticket added the first read of `.pot` off that value.

**Fix:** replaced `expectedPotCarry` with `realPotAfter(gameSeed, hands)` — walks every
hand in the prefix from a fresh pot of 0, using each hand's own `.phase` (still
context-independent, still safe to read off a `FRESH_CONTEXT` fold) and its own action
log's riichi-action count (`× RIICHI_STICK`, newly imported from `./index`) to
independently re-derive the real running pot, agari-resets included. This is still a
restatement independent of `foldGame`'s own carry branch (per design.md Decision 3/
Decision 5's stated doctrine) — it never reads `foldGame`'s or `foldRecord`'s pot-carry
logic, only the action log and each hand's phase.

Re-ran `npx vitest run src/core/game.dynamics.test.ts` 10 times after the fix (across two
batches) — all 10 green, including the fast-check property test. Also manually re-forced
a wrong value (see Step 3 above) to confirm the new assertion still fails when it should.

This deviation does not change the final file surface named in structure.md (still one
new private helper + two edits inside `expectValidBoundary` + one tally in the corpus
`it` block) — only that helper's internal implementation and its one new import
(`RIICHI_STICK`).

## Pre-existing failures found, NOT fixed (out of scope for this ticket)

`npx vitest run` (full suite) surfaces failures in three files this ticket never
touches: `src/core/settlement.property.test.ts` (zero-sum delta check, deterministic,
same root cause class — riichi sticks not accounted for — but in a DIFFERENT single-hand
invariant this ticket's design.md explicitly scoped out), `src/core/selfplay.test.ts`
(two "mined anchor" frozen-seed fixtures, deterministic, almost certainly stale since
T-009-02-01 changed default bot discard choices), and `src/app/app.riichi.tap.svelte.test.ts`
+ `src/app/drive.test.ts` (app-layer; `src/app/App.svelte`, `src/app/drive.ts`,
`src/app/RiichiPrompt.svelte` are all present as uncommitted/untracked changes in this
working tree that predate this session — evidently a different, concurrent, in-progress
ticket's work per the RDSPI workflow's stated multi-thread-same-branch concurrency model).

Verified via `git stash` that ALL of these failures pre-exist independent of this
ticket's change (same failures with `game.dynamics.test.ts` reverted to its committed
state). Not fixing them: they belong to other tickets' scope (design.md's explicit
non-goal list), and touching `settlement.ts`/`selfplay.test.ts`/`src/app/*` here would
cross ticket boundaries this ticket has no dependency edge for. Flagged in review.md for
human attention.
