# T-006-02-03 — brute-force-reference-property-tests — Review

Self-assessment and handoff. Test-only ticket: the P5 shanten-correctness
crown — `shanten` agrees with an independent brute-force reference, and
shanten 0 is reconciled with the enumerated waits.

## 1. What changed

| File | Change | Size |
| --- | --- | --- |
| `src/core/shanten.property.test.ts` | **created** | 668 lines: reference (~120), builders/arbitraries (~180), 16 tests across 4 describe blocks |
| `src/core/shanten.test.ts` | modified | 1 header-comment line (the "property sweeps are T-006-02-03" deferral now points at the landed file) |

No shipped code changed. No new exports, no barrel edit, nothing in
`src/app/`. Not committed (see §5).

## 2. Acceptance-criteria check

**"A property test where shanten equals a brute-force reference across
constrained samples"** — ✅. The reference reads the definition directly
(`min over winning multisets W of missing-tiles − 1`, enumerating the hands a
query could BECOME), structurally disjoint from the shipped block-count
backtracker (which decomposes what the hand HOLDS), consulting no module
algorithm. Agreement `shanten === refShanten` is asserted over five
distributions — constructed winners (read −1), winners-minus-one (read 0),
k-perturbed winners (≤ k−1, the near-miss band), random 13-tile and 14-tile
draws (the full 0..8 band) — at both arities and meld counts 0–4, 580
sampled hands per run plus anti-vacuity self-tests on every generator.

**"shanten === 0 iff waits()/isTenpai reports a non-empty wait set (0 agrees
with the enumerated waits at tenpai)"** — ✅, as three properties + two pinned
fixtures, because the raw iff is provably FALSE under the modules' frozen
conventions (shanten is kind-level shape distance; waits excludes
self-exhausted kinds — the reconciliation shanten.ts:8–11 explicitly deferred
to this ticket):

- soundness, unconstrained: `isTenpai ⟹ shanten === 0`;
- the full biconditional on exhaustion-free samples (the AC's "constrained
  samples", via `fc.pre(max(visible) < 4)`);
- the explanation property: every `shanten === 0 ∧ noten` sample has ONLY
  self-exhausted structural waits (enumerated reference-side via `refIsWin`) —
  no third cause of divergence exists;
- fixtures pinning both divergence witnesses with rule-derived comments:
  `123m456p789s2222z` (the fifth-2z tanki) and kanchan-on-own-ankan
  (`ankan('3m')` + `24m456p789s55z`).

Verification: new file 16/16 green in **260ms**; `just test` 22 files / 517
tests green; `just check` 0 errors / 0 warnings. **No module-vs-reference
disagreement surfaced — the crown found no inexactness in the shipped
calculator.**

## 3. Test coverage assessment

Covered: the reference itself is self-tested against 15 hands whose values
are rule-derived in comments (reusing shanten.test.ts's argued fixtures,
never module output); real melds (pon/chi/ankan from a shared 4-copy budget,
the waits.test.ts builder twin) wherever `waits` is a comparand; FAKE
arity-stubs where both sides read arity only (each precedent used where it
applies); generator anti-vacuity throughout (winners verified as wall-legal
winners, perturbed hands within the k−1 bound reference-side).

Gaps, known and judged acceptable:

- **Random-draw buckets run melds = 0 only** (constructed buckets cover melds
  1–4). Random MELDED noten hands do reach the waits-clause properties via
  `randomRealMeldArb`, so the gap is only random-melded × reference-equality;
  the winner/minus-one/perturbed buckets exercise those meld counts near the
  boundary where the module's cap-and-head logic actually branches.
- **numRuns are modest** (60 for the expensive m=0 random buckets, 150–250
  elsewhere) — headroom exists (260ms measured vs ~3s budget) if anyone wants
  a deeper soak; a one-line numRuns bump is the whole change.
- **`refIsWin` inside the explanation property costs a full m=0 enumeration
  per kind probe** on triggering samples; triggers are rare (shanten-0 noten)
  and the measured time absorbs it. Flagged in case future arbitraries make
  triggers dense.
- The kind-uniform (not multiset-uniform) draw in `randomRealMeldArb` is a
  deliberately simple distribution — documented at the arbitrary.

## 4. Open concerns for a human reviewer

1. **The reference's equivalence argument is the load-bearing 10 lines** (file
   header): shanten = min over W of missing − 1, exchange-realizability both
   directions. It is the standard definitional formulation, but if you review
   one thing, review that argument and the UNCAPPED-W convention note under
   it (design D2) — cap-vs-uncap is exactly where a reviewer could
   plausibly disagree with the codebase's frozen shape convention.
2. **One plan-time expected value was wrong and corrected during
   implementation** (progress.md deviation 1): the scattered-13 hand reads 6
   via the special forms, not standard's 8 — evidence the self-test comments
   were genuinely re-derived rather than copied. Worth a spot-check.
3. **The biconditional's constraint** (`max(visible) < 4`) is blunter than
   strictly necessary (a hand with an exhausted kind that ISN'T its only
   structural wait would still satisfy the iff). The explanation property
   covers exactly the excluded territory, so nothing is unobserved — but a
   reviewer preferring the sharp constraint should know the blunt one was a
   deliberate simplicity choice (design D4).
4. `refStandardBest`'s prune (`overlap + 3·setsLeft + 2 ≤ best`) and the
   pair-scan early-exit at gain 2 are the ONLY search smarts, both argued
   sound in one comment line each; anything cleverer was rejected by design
   to keep the reference reviewable.

## 5. Commit posture — needs a human decision

**Nothing committed** (progress.md has the full rationale): this suite
imports `shanten`, which does not exist at HEAD — dependency T-006-02-02's
implementing changes are still uncommitted in the shared working tree, and
that thread held its commits citing the commit protocol. Landing order when
commits are wanted: T-006-02-02's `shanten.ts`/`shanten.test.ts` first, then
this ticket's `shanten.property.test.ts` + the one-line `shanten.test.ts`
header edit + `docs/active/work/T-006-02-03/`.

## 6. Downstream handoff

- **T-006-03-01** (`discard-policy`): the datum it minimizes is now
  property-certified against an independent reference across the full band —
  "shanten-minimizing" is trustworthy language.
- **Teaching prompts / tenpai UI**: the exhaustion-boundary fixtures are the
  citable statement of when "shanten 0" and "tenpai" may disagree (hand's own
  ankan holding the last wait, four concealed copies as triplet+tanki). Any
  UI that says "tenpai" should read `isTenpai`, not `shanten === 0` — the
  fixtures make the difference concrete.
- The reference (`refShanten`) is test-local by design but is the natural
  oracle to copy for any future shanten-adjacent ticket (ukeire counting,
  discard-hint verification).

TL;DR: one new 668-line property suite + a one-line comment edit; the
brute-force reference reads the shanten definition by enumeration, agrees
with the shipped combinator everywhere it was pointed (580 hands/run, both
arities, melds 0–4, zero disagreements), and the shanten⇔waits relationship
is pinned as sound + complete-modulo-exhaustion with both divergence
witnesses fixed as fixtures; all suites green (517/517), check clean, commits
held pending the dependency's landing.
