# Plan: T-009-01-04 riichi-property-suite

Two commits, matching structure.md's split. Each step is independently verifiable via
`just test`/`just check` before moving to the next.

## Step 1 — `dynamics.test.ts`: driver, corpus, widened `anyGameArb`

1. Add the three new imports (`kindOf`, `scoreBreakdownOf`, `shanten`).
2. Write `bestDiscardOf` and `playRiichiEager`.
3. Write `RIICHI_CORPUS_SEEDS`/`riichiCorpus` at module scope.
4. **Checkpoint (scratch, not committed):** run a throwaway `tsx` scratchpad script
   (this codebase's own established mining discipline — `settlement.property.test.ts`/
   `record.test.ts` reviews both name "a throwaway tsx scratchpad script, never
   committed") importing the new driver, logging per-seed: does the log contain
   `'riichi'`, and the ending phase. Confirms design.md's sizing bet (30 contiguous
   seeds) before writing any assertions against it — if riichi-bearing seeds are rare
   or one ending dominates, widen the range or fall back to a mined list (design.md's
   Decision E) BEFORE the property tests are written, not after a red run.
5. Widen `anyGameArb` with the third `fc.oneof` arm.
6. Run `just test` — the existing suite must stay green with no new assertions yet
   (widening `anyGameArb` alone should not break anything, but the corpus build runs
   at import time, so this step also proves the driver never trips `ACTION_BOUND` or
   throws across the full seed range — a real check, not a formality).

## Step 2 — `dynamics.test.ts`: the three new assertions + one mutation operator

1. `describe('riichi over random play (T-009-01-04)', ...)` — three `it`s, in the
   order structure.md lists (non-vacuity/termination, tsumogiri lock, points+pot).
   Write the non-vacuity one first and run it alone (`vitest -t "riichi over random
   play"`-style targeted run) — it is the cheapest signal that step 1's sizing bet
   paid off before investing in the other two.
2. Tsumogiri-lock property: implement exactly as design.md specifies (refold every
   prefix, read `priorState.riichi[seat]`/`priorState.drawn` directly). Run.
3. Points+pot property: implement exactly as design.md specifies (`scoreBreakdownOf`
   + the `game.ts`-restated carry rule). Run — this is the property most likely to
   reveal a genuine surprise (either in the test's own arithmetic or, less likely
   given T-009-01-02's thorough settlement fixtures, in `settlement.ts` itself); if it
   fails, diagnose which side is wrong before touching either file, and if the
   diagnosis points at `settlement.ts`/`game.ts`, STOP and document rather than
   silently patch — a production fix is out of this ticket's planned scope
   (structure.md) and would need to be called out as a deviation.
4. `'riichi retarget'` mutation operator in `'mutated sequences throw'`. Run.
5. Widen the two `menu` arrays with a `riichi` entry each. Run.
6. Full `just test` + `just check`. Commit 1.

## Step 3 — `legal.test.ts`: duplicated driver, corpus, agreement test

1. Duplicate `bestDiscardOf`/`playRiichiEager` (trimmed per structure.md — this file
   doesn't need the call-point ron-vs-rng distinction to differ from
   `dynamics.test.ts`'s copy; same logic, just re-typed against this file's own
   already-imported symbols).
2. `RIICHI_AGREEMENT_SEEDS`/`riichiAgreementCorpus` at module scope, smaller range
   (12 contiguous seeds per design.md — re-tune from step 1's scratch findings: if
   riichi-bearing seeds are common in `[0,30)`, a 12-seed prefix of that same range is
   almost certainly enough; if step 1 needed a mined list, reuse SOME of that list
   here directly, since both corpora exist to prove the same underlying fact about the
   same driver).
3. New `it` in `describe('offered actions fold', ...)`. Run.
4. Full `just test` + `just check`. Commit 2.

## Testing strategy

- **Unit-level**: every new `it` is itself a property (`fc.property` or a direct loop
  over a frozen corpus) — this ticket adds no hand-typed single-fixture tests, matching
  the AC's own framing ("properties hold over random legal sequences").
- **Regression**: `just test` after every step (not just at the end) — this codebase's
  own established rhythm (every prior T-009-01-0x review.md reports running the FULL
  suite, repeatedly, not just the new file).
- **Verification criteria** (mirrors the AC directly): `just test` green, with the new
  `describe`/`it` blocks visibly present in the run output and none skipped; the
  non-vacuity assertions are the load-bearing proof that the new corpus isn't
  accidentally empty of riichi (a property suite that never exercises its own subject
  passes for the wrong reason — this codebase's own repeated "never a zeroed tally"
  discipline).
- **What does NOT get a new test**: clause 4 (determinism) — verified by confirming
  the EXISTING `'fold determinism over random play'` test still passes after
  `anyGameArb` is widened (design.md: this is intentionally "free," not a gap).

## Deviation protocol

If the scratch mining pass (Step 1.4) shows the shanten-minimizing driver rarely
reaches riichi within `[0, 30)`, widen the range first (cheap), then fall back to a
mined+frozen list only if widening alone doesn't help — document whichever path was
taken, and why, in progress.md as it happens (not retroactively), per this codebase's
own established discipline for every prior T-009-01-0x ticket's progress.md.

If Step 2.3 (points+pot) or the tsumogiri-lock property fails against real
`record.ts`/`settlement.ts` behavior (not a test-authoring bug), STOP: this would mean
a landed, `phase: done` ticket (T-009-01-01/02) shipped a real defect. Document the
failing case precisely (seed + prefix length + expected vs actual), do not silently
"fix" settlement.ts/record.ts inside this ticket's diff without flagging it — the RDSPI
convention (T-009-01-03's review.md) is that a real bug found during Implement gets a
dedicated writeup, not a quiet patch buried in an unrelated commit.
