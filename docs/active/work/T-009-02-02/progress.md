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

## Repair (2026-07-04) — the overseer folded those flagged failures into this ticket

The repair note (ticket file, added by the overseer after this ticket first reached
`phase: done`) reconciles: the four failures flagged above are this ticket's remit now,
not a future ticket's. `just test` was RED (4 failed / 899 passed) at repair start.

- **Step 6 (baseline):** confirmed all four failures named in the repair note, EXCEPT
  `app.controls.svelte.test.ts` — already green (`npx vitest run
  src/app/app.controls.svelte.test.ts`: 3/3 passing), fixed by an intervening commit
  (`59b81ec`) before this session. No action taken on that file.
- **Step 7 (settlement.property.test.ts):** done as planned. One assertion changed to
  `deltas.reduce(+) + unclaimedPot === 0`. Re-ran 5x consecutively, all green (fast-check
  samples a new random seed set each run — 5 green runs rules out a lucky pass).
- **Step 8 (selfplay.test.ts anchors):** done, with the seed-13 re-anchor from
  design.md Decision 7. Instrumented both anchors with temporary `console.log`, captured
  actual output, then wrote expectations from it (never guessed):
  - seed 25: `{len: 36, win: {by: 'tsumo', winner: 1, tile: 52, yaku: ['menzen-tsumo',
    'riichi']}}` — only `yaku` changed.
  - seed 13 (old): `{len: 107, win: {by: 'ron', winner: 1, from: 0, tile: 58, yaku:
    ['riichi']}}` — no longer a houtei scenario. Scanned seeds 0-39 for a replacement
    still producing `'houtei'` — zero hits. Widened to 0-499 — first hit at seed 356:
    `{len: 147, win: {by: 'ron', winner: 0, from: 2, yaku: ['houtei']}}`. Re-anchored to
    356, deleted seed 13's `it` block, all instrumentation removed before commit.
  - All 6 tests in the file pass (confirms seeds 9/19's unrelated anchors are untouched).
- **Step 9 (drive.test.ts anchor):** done. Instrumented, captured `{len: 73, win: {by:
  'ron', winner: 2, from: 0, tile: 17, yaku: ['riichi', 'ittsuu']}}` — only `yaku`
  order/membership changed (gained `'riichi'` ahead of `'ittsuu'`). All 72 tests in the
  file pass.
- **Step 10 (full-suite + typecheck):** `just test` green twice consecutively (903/903,
  0 failed). `just check`: 0 errors, 0 warnings (194 files).

No deviations from plan.md's repair steps. No production code touched — every fix is a
test-side expectation update, consistent with design.md's repair non-goals.

Committed as `7ea321f`: "Repair T-009-02-02: pot-aware settlement property, re-mined
riichi anchors" (3 files changed: `drive.test.ts`, `selfplay.test.ts`,
`settlement.property.test.ts`).
