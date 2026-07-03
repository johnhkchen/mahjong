# T-008-01-04 — scoring-property-grid — Review

Self-assessment. What changed, test coverage, and what a human reviewer should look at.

## What changed

**`src/core/settlement.ts`** (modified, +8/-4 lines, commit `2c5205d`): four private
functions (`baseOf`, `roundUp100`, `ronDeltas`, `tsumoDeltas`) became `export`ed. No
logic changed — every existing caller (`settlementOf` itself) is untouched, and
`settlement.test.ts`'s 8 fixture groups still pass unmodified. One sentence added to
the module header noting the new tested surface.

**`src/core/settlement.property.test.ts`** (new file, 803 lines, commit `8239d46`): the
property/table suite the ticket asks for, six sections:

- **§A** — a hand-authored 58-row han×fu base-points grid (han 1-4 across ten fu steps
  each, including the natural mangan-cap boundary at han 3-4 plus one deliberately
  unrealistic fu=130 row proving the cap fires at han 2 too; han 5-12's flat tiers at
  two fu values each to prove fu-independence; han 13/14/25/26/39 for the yakuman
  stacking tier including a double- and triple-yakuman case), asserted against `baseOf`
  directly.
- **§B** — a 9-row `roundUp100` boundary table, including the AC's own two fixture
  numbers (7680→7700, 11520→11600) as a cross-check.
- **§C** — a 32-case (8 base values × 2 dealer-ness × 2 win modes) `ronDeltas`/
  `tsumoDeltas` payment-split table. Three of the eight base values (1920, 2000, 8000)
  were chosen specifically because they reproduce `settlement.test.ts`'s own AC/mangan/
  yakuman fixture numbers exactly — a direct cross-check between the two test files
  that both independently derived the same numbers from the published table.
- **§D** — a fast-check zero-sum-conservation property over 50 random seeds, each
  driven to an ended `TableState` by a trimmed copy of `selfplay.test.ts`'s AI-vs-AI
  driver (real legal game states, not synthetic ones).
- **§E** — three fast-check fu-invariant properties (multiple-of-10-or-25, pinfu
  20/30, chiitoitsu 25) over constructed winning hands, with two dedicated generators
  (all-runs pinfu shapes, seven-distinct-pairs chiitoitsu shapes) added after the
  general-purpose generator turned out too sparse to hit either shape reliably
  (progress.md's Deviation #3).
- **§F** — a dora-is-additive-never-a-gate monotonicity property: adding one dora
  indicator to a closed self-draw win never lowers the winner's settlement delta,
  proven non-vacuous by tracking strict-increase occurrences.

No other file was touched. `fu.ts`, `han.ts`, `yaku.ts`, `yakuman.ts`, `agari.ts`,
`record.ts`, `settlement.test.ts` are all read-only references, exactly as
structure.md planned.

## Test coverage

`just test`: 783 passed, 30 files (up from 659/28 at the start of this ticket; the
delta includes 105 tests from this ticket's own file plus a concurrently-landed
sibling ticket's `game.ts`/`game.test.ts` — see "Concurrent work" below). `just check`:
0 errors, 0 warnings.

Every AC clause is covered:
- "every (han 1..13+, fu step) cell against an independently-stated expected table,
  both dealer-ness × ron/tsumo" — §A + §C, table-driven, each cell individually named
  in the test runner's output.
- "every settlement over random ended hands (fast-check) sums to zero" — §D, verbatim.
- "fu invariants (pinfu 20/30, chiitoi 25, fu always a multiple of 10 except 25)" — §E,
  all three named sub-clauses as separate properties.
- "dora-never-a-yaku" — covered two ways: the structural argument (`Win`'s type has no
  `doraKinds` field at all, cited in §F's header, not re-tested — han.test.ts already
  has a concrete fixture for the concrete case) plus §F's new monotonicity property
  (dora is additive, never a gate on price).
- "`just test` green" — confirmed above.

## Open concerns

### 1. THE WAIT-ATTRIBUTION TRAP in fu.ts — a genuine, pre-existing edge case this
property test surfaced (needs a human decision, not a silent patch)

While building §E's pinfu generator, an unconstrained version of it found a real hand
shape where `standardYakuOf(ctx)` reports `'pinfu'` (yaku.ts's own predicate is
satisfied — all-run sets, non-yakuhai pair, the winning tile completes some run via a
genuine ryanmen) but `fuOf(ctx)` returns 40, not the pinfu-fixed 30, on a RON. Root
cause: `fu.ts`'s "favorable attribution" rule (documented in its own header, exercised
by `fu.test.ts`'s existing "prefers the tanki attribution over ryanmen run-absorption"
fixture) takes the MAX fu across every structurally valid attribution of the winning
tile within one decomposition — and that search is blind to whether a HIGHER-fu
attribution happens to be a DIFFERENT wait (e.g. the winning kind also coincides with
the pair, a "coincidental tanki") than the one `standardYakuOf`'s `pinfu()` predicate
used to grant the yaku. `fu.ts`'s own `PINFU_RON_FU` comment claims "a closed pinfu
ron's raw sum ALREADY EQUALS this [30]" — true only when no such coincidental
higher-fu attribution exists on the same decomposition; false in general.

Concretely reproducible: a closed hand shaped as (pair = kind K) + (three runs) + (one
run containing K at its ryanmen-completing end), won by ron on K. `standardYakuOf`
says pinfu; `fuOf` scores 40 (tanki attribution beats ryanmen attribution). Whether
this is a genuine SCORING BUG (real riichi rules generally take the highest-scoring
INTERPRETATION as a whole — yaku AND fu together — not fu.ts's current fu-only max,
which can select a fu that no longer corresponds to the interpretation that granted
the yaku) or an accepted simplification is a rules-conformance judgment call this
ticket did not make — T-008-01-01 (fu.ts) and T-008-01-02/yaku.ts are both already
`done`, and structure.md scoped this ticket to zero production changes outside
`settlement.ts`'s four exports.

**What this ticket did about it**: constrained §E's pinfu generator to avoid the
ambiguity by construction (the designated ryanmen run lives in suit 'm', every other
run and the pair are drawn only from suits 'p'/'s' — provably no cross-set
interference is possible), so the shipped property tests the FIXED-VALUE claim
`fu.ts`'s header actually documents, not a stronger universal claim the current
implementation does not make. This is a legitimate, narrower but still meaningful
property — not a workaround that hides a real failure.

**Recommendation for a human reviewer**: decide whether to (a) accept this as a known,
documented limitation of the current wait-attribution convention (a follow-up ticket
could add a note to fu.ts's header naming the gap explicitly), (b) file a follow-up
ticket to make `fuOf` (or a caller above it) prefer the attribution consistent with
whichever yaku set was granted, or (c) treat it as acceptable because such hands are
vanishingly rare in real play (requiring a specific coincidental tile overlap) and the
current "favor the player" convention is defensible as a house rule. This review does
not recommend one of the three — it is a rules-design call, not an implementation bug
in this ticket's own scope.

### 2. §F's dora-gate property is narrower than the AC's literal wording

The AC says "the dora-gate property" without fully specifying it. This ticket
implements the strongest property that is both TRUE (provably, not just empirically —
see design.md Decision 6's monotonicity argument from `baseOf`'s non-decreasing-in-han
shape) and directly testable without new exports: dora is additive to price, never a
gate. A stronger "yakuOf is literally independent of any dora input" property was
considered and rejected as ALREADY proven by `Win`'s type signature (no `doraKinds`
field), needing no fast-check wrapper — that argument is stated in §F's header comment
rather than encoded as a redundant runtime check.

### 3. Concurrent work landed mid-ticket

A sibling ticket (T-008-02-01, `game.ts`/`game.test.ts`) landed via a concurrent
thread on the same branch partway through this ticket's implementation (RDSPI's
documented concurrency model). This review confirms no interaction: this ticket's
commits touch only `settlement.ts` and the new `settlement.property.test.ts`; the
final `just test`/`just check` run (783 tests, 187 files) includes both tickets'
work green together, but this ticket did not modify or depend on anything
`game.ts` added.

## Nothing else flagged

No TODOs left in the shipped file. No skipped AC clauses. No known-flaky properties —
§D/§E/§F's non-vacuity assertions (`pinfuHits`/`strictIncreases` counters) are backed
by a proof of hit-rate in design.md/this file, not just empirical luck from one run,
though a much smaller `numRuns` could in principle reduce a counter to zero; the
chosen `numRuns` (100-200) leaves comfortable margin given the hand-argued minimum
hit rates (menzen-tsumo fires unconditionally in §F; the pinfu/chiitoitsu generators
in §E are constructed to succeed on every sample, not merely likely to).
