# Structure — T-009-02-02 riichi-dynamics-suite

## Files touched

**Modified: `src/core/game.dynamics.test.ts` only.** No other file changes — confirmed by
research.md (`game.ts`/`record.ts`/`settlement.ts`/`policy.ts` are all already correct and
already tested at the single-hand level; the gap is purely this suite's own conservation
formula and missing riichi/pot-carry assertions).

No new files. No fixtures. No changes to `docs/active/tickets/*` or `phase`/`status`
frontmatter (Lisa's job, not this ticket's).

## Change 1 — `expectedPotCarry` (new private function)

Placed beside the file's other independently-restated boundary helpers
(`nextExpectedDealer`, `windKindOf`, `seatOfPlayer`, `expectedSeatWinds` — lines 156-186),
same shape and doc-comment convention (one line of prose, references which module fact it
restates and why it's restated rather than read from the code under test):

```ts
/**
 * The pot a fresh boundary should carry in, restated independently from settlement.ts's
 * own conservation law (module header) / game.ts's own foldGame carry rule — never read
 * from foldGame's own branch, same reasoning as nextExpectedDealer above. 0 after an
 * agari (the winner's settlement delta already absorbed the whole pot); the ended hand's
 * own state.pot after a ryuukyoku (unclaimed, carries forward untouched).
 */
function expectedPotCarry(endedState: TableState): number {
  return endedState.phase === 'agari' ? 0 : endedState.pot
}
```

Signature/placement mirrors `nextExpectedDealer(prevDealer, endedState)` exactly (same
input shape: the just-ended `TableState`), so it reads as the same family of helper.

## Change 2 — `expectValidBoundary` (modified, lines ~195-217)

Two edits inside the existing function body, no signature change:

1. Line 206 (`(1) conservation` comment + assertion): the formula changes from
   `state.scores.reduce((a, b) => a + b, 0)).toBe(4 * STARTING_SCORE)` to
   `state.scores.reduce((a, b) => a + b, 0) + state.pot).toBe(4 * STARTING_SCORE)`. The
   comment above it updates to name the pot explicitly (currently says only "total points
   equal 4 * 25000" — becomes "total points plus the carried pot equal 4 * 25000,
   settlement.ts's own corrected conservation law").

2. New assertion inserted after the existing `(4) dealer/wind bookkeeping` block (after
   line 214, before the `return state.dealer` line), numbered `(5)` in the comment
   sequence for consistency with the file's existing `(1)`/`(2)`/`(4)` numbering (there is
   no `(3)` currently in this function — `(3)` belongs to a check this function doesn't
   perform; leave the numbering gap as-is, do not renumber existing comments):

   ```ts
   // (5) pot carry: a fresh boundary's pot equals the just-ended hand's own carry rule.
   expect(state.pot).toBe(expectedPotCarry(endedState))
   ```

`endedState` is already computed and in scope at that point (used by the existing `(4)`
block), so no new parameter or refold is needed.

## Change 3 — corpus non-vacuity `it` block (modified, `'multi-hand dynamics: corpus'`
describe, lines ~228-260)

Inside the existing `for (const gameSeed of GAME_SEEDS)` / `for (let len = 1; len <=
hands.length; len++)` loop, which already computes `endedState` for `prefix[len-1]` each
iteration:

- add `let riichiHands = 0` alongside the existing `renchanCount`/`rotationCount`/
  `finalPhases` tally declarations,
- inside the loop, alongside the existing `if (nextDealer === dealer) ... else ...`
  branch: `if (prefix[len - 1].some((a) => a.type === 'riichi')) riichiHands += 1`,
- after the loop, alongside the existing `expect(renchanCount).toBeGreaterThan(0)` /
  `expect(rotationCount).toBeGreaterThan(0)` non-vacuity assertions:
  `expect(riichiHands).toBeGreaterThan(0)`.

This is additive only — every existing tally, loop structure, and assertion in this block
stays untouched; the riichi tally is one more counter alongside the two that already
exist, incremented from data (`prefix[len - 1]`, the just-ended hand's action log) the
loop already has in scope.

## Ordering

Single-file change, three edits in one commit — they are not independently meaningful
(the pot-carry helper exists only to serve the boundary assertion; the conservation fix
and the new assertion both live in the same function; the riichi tally is a one-line
addition to an existing block). No sequencing risk: Change 2's formula fix must land
before or together with Change 3 conceptually (both are "restate the truth correctly"),
but nothing in the file imports across these three edits in a way that requires a
particular commit order — they will land as one commit per plan.md.

## Verification surface

`npx vitest run src/core/game.dynamics.test.ts` — currently 2 of 3 tests fail
(`expected 99000 to be 100000`). After these changes, all three must pass, and the new
`riichiHands`/pot-carry assertions must be exercised (not just present but actually
tested — the corpus is already confirmed non-vacuous by research.md's probe, no corpus
widening required). `just test` (full `src/core/` suite) must stay green — no other file
changes, so no other suite should be affected.

## Repair (2026-07-04) — three more files, no production code

**Modified: `src/core/settlement.property.test.ts`, `src/core/selfplay.test.ts`,
`src/app/drive.test.ts`.** Still no production-code changes (design.md Decision 6-8; all
four pre-repair failures are stale test-side expectations).

### Change 4 — `settlement.property.test.ts`, one `it` block (line ~460)

Rename the test to name the corrected law (`'every random seed folds to an ended
TableState whose deltas plus the unclaimed pot sum to zero'`) and change its one
assertion from `expect(deltas.reduce(+)).toBe(0)` to computing `unclaimedPot = phase ===
'agari' ? 0 : state.pot` and asserting `expect(deltas.reduce(+) + unclaimedPot).toBe(0)`
— the same `expectedPotCarry` shape as Change 1 above, restated at this file's own
`state`/`deltas` variables rather than imported (this file has no dependency on
`game.dynamics.test.ts`, and the codebase's restate-don't-share convention applies).

### Change 5 — `selfplay.test.ts`, two `it` blocks inside `'mined anchors'`

- Seed 25's `it`: one-line change, `expect(win.yaku).toEqual(['menzen-tsumo'])` →
  `expect(win.yaku).toEqual(['menzen-tsumo', 'riichi'])`. No other field changes.
- Seed 13's `it`: replaced wholesale — new seed (356), new pinned length (147), new win
  facts (`ron`, winner 0, from 2, `yaku: ['houtei']`), title/comment updated to say "seed
  356" and drop the "re-mined" framing once landed (design.md Decision 7). The
  `if (win.by === 'ron') expect(win.from).toBe(2)` guard follows the existing
  seed-9 anchor's own pattern in this same file (type-narrowing before reading a
  ron-only field) rather than inventing a new shape.

### Change 6 — `drive.test.ts`, one `it` block (`'plays deal → a BOT rons the player'`)

One-line change to the `won.win` expectation: `yaku: ['ittsuu']` →
`yaku: ['riichi', 'ittsuu']` (order matches the mined fact, not asserted independently).
Everything else in the block (`actions` length 73, `by`/`winner`/`from`/`tile`) is
unchanged.

## Verification surface (repair)

Each of the three files' previously-failing test(s) must pass in isolation
(`npx vitest run <file>`), and `just test` (full suite, all 35 files) must be green with
no other regressions. `just check` must stay clean (no new types introduced, no signature
changes to any exported function).
