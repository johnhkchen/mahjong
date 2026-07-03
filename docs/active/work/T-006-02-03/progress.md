# T-006-02-03 — brute-force-reference-property-tests — Progress

## Status: COMPLETE — all plan steps done, suite green, check clean

| Plan step | State | Notes |
| --- | --- | --- |
| 1. Skeleton + reference + self-test | ✅ | `src/core/shanten.property.test.ts` created; reference pinned against 15 hand-derived values across 4 `it`s |
| 2. Divergence fixtures | ✅ | both witnesses CONFIRMED (research §3 validated): `123m456p789s2222z` and ankan-3m kanchan both read shanten 0 / waits [] / noten |
| 3. FAKE-meld builders + agreement properties | ✅ | 6 `it`s: generator self-tests, winners (−1), minus-one (0), k-perturbed (≤ k−1), random 13, random 14 (with −1 ⟺ refIsWin) |
| 4. Real-meld builders + waits-clause properties | ✅ | 4 `it`s: builder self-test, P-tenpai-sound, P-tenpai-complete (fc.pre-constrained), P-exhaustion-explains |
| 5. shanten.test.ts header amendment | ✅ | one comment line: "are T-006-02-03 by ticket design, not thinness" → "live in shanten.property.test.ts (T-006-02-03)" |
| 6. Full verification + perf pass | ✅ | see below |

## Verification results

- New file standalone: **16/16 green, 260ms test time** — far under the plan's
  ~3s budget, so numRuns stayed at the plan's initial values (150/150/150/60/60
  agreement; 200/250/250/250 waits-clause) with no tuning pass needed. The
  branch prune + present-kinds pair scan carried it.
- `just test`: **22 files / 517 tests, all green** (includes T-006-02-02's
  uncommitted combinator work and other threads' in-tree suites).
- `just check`: 175 files, **0 errors, 0 warnings**.

## Deviations from plan

1. **Step 1's fixture list corrected during authoring**: the plan listed
   `147m147p147s1234z → 8 (the ceiling)`, but 8 is `standardShanten`'s value;
   the reference mirrors the COMBINATOR, and chiitoitsu/kokushi both read that
   hand at 6. The self-test pins 6 with the three per-form W-derivations
   argued in the comment. (The plan's value was copied from a standard-only
   fixture; caught while deriving the W-side comment — exactly what
   rule-derived comments are for.)
2. **No perf tuning needed** (plan Step 6 anticipated possible numRuns
   reduction): measured 260ms total, no change made.
3. **fc.pre discard rate on P-tenpai-complete**: no fast-check warning at
   numRuns 250; the blunt `max(visible) < 4` precondition passes often enough
   (only ankan-bearing and 4-concealed-copy samples drop). The plan's
   fallback (biasing formChoices) was not needed.

None of the deviations changed design decisions D1–D8.

## Disagreement triage log (design D7)

Empty — no module-vs-reference disagreement surfaced in any run. The crown
found no inexactness in `shanten`/`standardShanten`/the combinator across all
five distributions, both arities, meld counts 0–4.

## Commit posture (design D8)

**Held — nothing committed.** Working-tree state:

- new: `src/core/shanten.property.test.ts` (untracked)
- modified: `src/core/shanten.test.ts` (one header comment line, on top of
  T-006-02-02's still-uncommitted modifications to the same file)
- new: `docs/active/work/T-006-02-03/` artifacts (this directory)

Rationale (deviation from RDSPI "commit incrementally", documented per the
workflow's own rule): the suite imports `shanten`, which does not exist at
HEAD — T-006-02-02's implementing changes sit uncommitted in the shared
working tree, and that sibling thread explicitly held its commits citing the
commit protocol ("only commit when the user asks"). Committing this ticket's
files alone would produce a HEAD whose tests cannot pass; sweeping in the
sibling's changes would commit another ticket's work uninvited. The clean
landing order when commits are requested: T-006-02-02's two files first, then
this ticket's two files + artifacts.
