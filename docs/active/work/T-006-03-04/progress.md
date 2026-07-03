# T-006-03-04 — determinism-termination-harness — Progress

## Completed

### Step 1 — corpus mining ✓

Scratch script (scratchpad only, per plan — bundled with esbuild, run under
node; never entered the repo) implementing the lean driver, run over seeds
0..39 with per-seed end facts and timing. Results:

- **agari = 37** (tsumo = 14, ron = 23), **ryuukyoku = 3**, **claims = 95** —
  every non-vacuity tally holds on the first candidate corpus; no widening
  needed.
- **No driver throw on any seed** (the plan's halt condition never fired).
- Runtime far under estimate: ~0.5s for 40 single plays (~12ms/seed avg,
  worst ~21ms) — double-played corpus ≈ 1s isolated.
- Anchor seeds chosen: **25** (menzen-tsumo, len 36 — shortest), **9** (window
  ron off a bot through 3 folded claims, len 51), **13** (houtei ron folded out
  of ryuukyoku, len 141), **19** (ryuukyoku, 2 claims, len 144).

### Step 2 + Step 3 — `src/core/selfplay.test.ts` ✓ (commit `14b0761`)

The whole file per structure.md: doctrine header (third-statement rationale,
in-process honesty, re-mine-never-loosen), re-stated bound constants, the lean
`selfPlay(seed)` driver with its two soundness guards, `firstDivergence`,
`playTwiceChecked`, and all three suites:

- **Corpus suite** — 40 seeds double-played; byte-identity via whole-record
  `JSON.stringify`; ended-phase and explicit `≤ ACTION_BOUND` assertions;
  aggregate non-vacuity expects (agari present, ryuukyoku present, claims > 0,
  tsumo wins > 0, ron wins > 0) with the widen-don't-weaken comment.
- **Anchor suite** — FOUR anchors (deviation, below): 25 / 9 / 13 / 19, each
  pinning frozen log length and end facts, win facts re-read from
  `foldRecord(record).win` (the double-key). Seed 19's length is pinned as the
  arithmetic identity `2·FULL_TURNS + 2·claims`, not a bare literal.
- **fc suite** — 10 sampled seeds over [0, 2^32), same per-seed invariant.

Verification, all done before the commit:

- `npx vitest run src/core/selfplay.test.ts` — 6 tests green, 4.8s isolated.
- **Teeth check (a), membership guard**: driver temporarily made to append a
  shape-equal CLONE of the policy's answer → all 6 tests fail with "chosen
  action is not an offered element" at step 0. Reverted.
- **Teeth check (b), anchor literals**: seed-25 length flipped 36→37 → the
  anchor test fails naming the exact mismatch. Reverted.
- `just test` — **23 files / 548 tests green** (542 → 548).
- `just check` — svelte-check + tsc, 0 errors 0 warnings.

## Deviations from the plan

1. **One code commit instead of two.** The plan split driver+corpus (commit 1)
   from anchors+fc (commit 2) in case mining was slow; mining finished in one
   pass with all anchor facts in hand, so the file was written whole and the
   split would have meant artificially staging halves of a single new file.
   One atomic commit of one new test file keeps the history honest.
2. **Four anchors, not three.** Mining surfaced seed 13 — a houtei ron, the
   fold's only ended→ended transition — which the design's three-anchor set
   (plain ron / tsumo / ryuukyoku) did not cover. Added as a fourth anchor;
   pure widening, no design decision disturbed.
3. **Plan spot-check (a) reinterpreted.** The plan's "corrupt the arbitration"
   probe (skip the offered-index comparison) was subsumed by the anchor teeth
   check: an arbitration drift changes a frozen log length/fact, which check (b)
   demonstrates directly. The membership-guard probe ran as written.

## Remaining

Nothing — implementation complete; review.md next. The RDSPI artifacts
(research → review + this file) commit together after review.md, matching the
-02/-03 pattern.
