# T-006-02-03 — brute-force-reference-property-tests — Plan

Six steps, each leaving the suite green (`just test`) and type-clean
(`just check`). Commit posture per design D8: hold commits, document here and
in progress.md. Every step's verification is stated up front.

## Step 1 — Skeleton + the brute-force reference, self-tested on pinned hands

Create `src/core/shanten.property.test.ts` with the header charter, test-side
sugar (`h`, `FAKE_MELDS`/`melds`, `countsOfHand`, `visibleOf`), the reference
(`SET_CANDIDATES`, `refStandardBest`, `refChiitoiBest`, `refKokushiBest`,
`refShanten`, `refIsWin`), and one `describe('reference self-test')` block
asserting `refShanten` against ~10 hands whose shanten values are ALREADY
rule-derived in shanten.test.ts's fixture comments (never against module
output at authoring time — the values are copied from the argued comments):

- `123m456p789s111z22z` → −1; `55z` @ m4 → −1
- `23m456p789s111z55z` → 0; `123m456p789s111z2z` → 0 (tanki); `3p` @ m4 → 0
- `23m456p789s111z5z7z` → 1; `123m456p789s1s2z5z7z` → 2
- `147m147p147s1234z` → 8 (the ceiling)
- `1122m3344p5566s7z` → 0 (chiitoitsu binds); `1122m3344p5566s77z` → −1
- `19m19p19s1234567z` → 0 (kokushi binds); `119m19p19s1234567z` → −1
- meld arities: `23m456p789s55z` @ m1 → 0; `123m5z` @ m3 → 0

**Verify**: new file's self-test green; whole suite still 483+ green; check
clean. **Risk watched**: reference correctness bugs surface HERE against
hand-argued values, before any module comparison exists.

## Step 2 — Divergence fixtures (the exhaustion boundary)

Add the `describe('the exhaustion boundary…')` block: the 0-meld
`123m456p789s2222z` witness and the `ankan('3m')` kanchan witness (test-local
`ankan()` builder), each asserting the triple
`shanten === 0` / `waits» []` / `isTenpai === false`, comments walking the
fifth-copy completion and the convention split (shanten.ts:8–11's promise).

**Verify**: fixtures green — this CONFIRMS the researched divergence is real
before the properties encode it; if either fixture fails, stop and re-derive
(a failure would falsify research §3 and change design D4).

## Step 3 — FAKE-meld builders + agreement properties

Add `buildWinner`, `winnerArb`, `minusOneArb`, `perturbedArb` (k ∈ 1..4
replacements), `randomHand13Arb`/`randomHand14Arb`, plus:

1. generator self-tests (anti-vacuity): winners wall-legal and
   `shanten === −1`; minus-one `shanten === 0`; perturbed `shanten ≤ k − 1`.
2. `winners agree` — numRuns 150
3. `minus-one tenpai hands agree` — numRuns 150
4. `perturbed near-misses agree` — numRuns 150
5. `random 13-tile draws agree (m=0)` — numRuns 60
6. `random 14-tile draws agree (m=0)` — numRuns 60

All assert `shanten(hand, melds(m)) === refShanten(hand, m)`.

**Verify**: green; and record per-property wall time from vitest output.
**Budget**: whole new file ≤ ~3s. If over: first lower the two random-draw
numRuns (the m=0-heavy buckets), then strengthen nothing else — do NOT add
cleverness to the reference beyond the design's one prune.

**Disagreement triage** (design D7): if a property fails, extract the shrunk
hand as a pinned fixture, hand-derive the true value from the rules in a
comment, and only then decide module-bug vs reference-bug; document in
progress.md either way. A module bug is a FINDING this ticket exists to
surface — fix in shanten.ts with its own rule-derived fixture.

## Step 4 — Real-meld builders + the waits-clause properties

Add `buildTenpaiParts` (waits.test.ts twin), `realPartsArb`,
`realMinusOneArb`, `randomRealMeldArb` (melds from the budget, concealed
drawn from the remaining pool), then design D4's three properties:

1. `P-tenpai-sound` — over realMinusOne (numRuns 150) and randomRealMeld
   (numRuns 100): `isTenpai ⟹ shanten === 0`.
2. `P-tenpai-complete` — same arbitraries pre-filtered
   `max(visibleOf) < 4` (fc `.filter`): `(shanten === 0) === isTenpai`.
3. `P-exhaustion-explains` — unfiltered; when `shanten === 0 && !isTenpai`,
   all 34 kinds: `refIsWin([...hand, k], m) ⟹ visible[k] ≥ 4`.

Generator self-test: realParts winners are wall-legal (`max(visibleOf) ≤ 4`)
and `isAgari` — the waits.test.ts anti-vacuity block, replayed here because
the builder is a fresh copy.

**Verify**: green within budget. Watch the `.filter` discard rate on
P-tenpai-complete (ankan-bearing samples are dropped); if fast-check warns of
excessive filtering, bias `formChoices` away from ankan for that property's
arbitrary instead of raising maxSkips.

## Step 5 — shanten.test.ts header amendment

One-line edit: "Property sweeps against a brute-force reference are
T-006-02-03 by ticket design, not thinness." → "…landed in
shanten.property.test.ts (T-006-02-03)." No test bodies.

**Verify**: `just check` (comment-only, but the file is in the tree with
T-006-02-02's uncommitted changes — touch carefully, edit only that line).

## Step 6 — Full verification + perf pass

- `just test` — whole repo green, no other suite disturbed.
- `just check` — 0 errors, 0 warnings.
- Record the new file's total time; tune numRuns per Step 3's budget rule if
  needed and re-run.
- Update progress.md to final state.

## Testing strategy summary

The ticket IS tests; the strategy above layers them so each layer certifies
the next: reference vs hand-argued fixtures (Step 1) → convention witnesses
(Step 2) → module vs reference over five distributions × both arities × meld
counts 0–4 (Step 3) → module vs waits with real melds, split biconditional +
exhaustion explanation (Step 4). Anti-vacuity self-tests guard every
generator. Nothing asserts module output against module output.

## AC traceability

- "shanten equals a brute-force reference across constrained samples" —
  Step 3 (properties 2–6; 'constrained' = constructed near-tenpai densities
  plus bounded random buckets, per design D5).
- "shanten === 0 iff waits()/isTenpai reports a non-empty wait set (0 agrees
  with the enumerated waits at tenpai)" — Step 4's P-tenpai-complete states
  the iff on exhaustion-free samples; P-tenpai-sound + P-exhaustion-explains
  + Step 2's fixtures pin why the raw iff cannot be unconditional under the
  two modules' frozen conventions (shanten.ts:8–11 promised this ticket that
  reconciliation).

## Rollback / contingency

- Reference too slow even at floor numRuns (~30): fall back to restricting
  the random buckets to 13-tile only and note the 14-tile coverage lives in
  the winner/perturbed buckets — do not weaken the constructed buckets.
- buildTenpaiParts copy drifts from waits.test.ts's: acceptable (per-file
  copies are convention), but keep the shared-budget invariant — the
  generator self-test enforces it.
- If Step 2's fixtures FAIL (divergence not real): design D4 collapses to the
  plain biconditional everywhere; simplify Step 4 accordingly and rewrite the
  affected artifacts before proceeding (that would be a research error worth
  the rewind).
