# T-008-01-04 — scoring-property-grid — Design

Explore options, evaluate tradeoffs, decide with rationale. Grounded in research.md.

## Decision 1 — export `baseOf`, `roundUp100`, `ronDeltas`, `tsumoDeltas` from settlement.ts

**The question** (research.md §4): the AC's han×fu grid and dealer-ness×ron/tsumo split
need a pure-formula test seam. Three options:

- **A. Hand-construct a TableState/Win per grid cell.** Rejected: impractical for "every"
  han/fu step (research.md §4 — many cells are unreachable by any legal hand at all, and
  reachable ones need fiddly multi-yaku hand construction per cell). Also couples a pure
  arithmetic property to the whole engine (agari decomposition, meld legality, dora
  bookkeeping) for no reason — a table test over a formula should not need a working
  wall/deal/fold to exercise a `Math.ceil`.
- **B. Re-derive the formula independently inside the test file, and never call
  settlement.ts's private functions at all** — i.e. write a second implementation of
  `baseOf`/`roundUp100`/`ronDeltas`/`tsumoDeltas` in the test, and only cross-check it
  against `settlementOf` output for the handful of points settlement.test.ts already
  covers. Rejected: this tests the TEST's own formula, not settlement.ts's — a bug in the
  real `baseOf` (say, an off-by-one in the mangan boundary) would never be caught unless
  it also happens to break one of the 8 existing hand-built fixtures. The "independently-
  stated expected table" clause in the AC means the EXPECTED VALUES must be independently
  authored (never copied from the source), not that the function under test must be
  reimplemented — han.test.ts's own header makes exactly this distinction ("Expected
  values transcribed BY HAND... never read off han.ts's own YAKU_HAN — a second
  independent spelling" — of the table, not of `hanOf` itself).
- **C. Export the four pure functions** (`baseOf`, `roundUp100`, `ronDeltas`,
  `tsumoDeltas`) from settlement.ts, call them directly with synthetic (han, fu, seats)
  inputs, and assert against expected values hand-transcribed in the test from
  research.md's own restatement of the published table (never derived from a first run).
  **Chosen.** This is the minimal-diff option (four `export` keywords, zero logic
  changes, zero new abstractions — no renaming, no new merged API) and it tests the REAL
  implementation the same way `fuOf`/`hanOf` are already tested: a small pure function,
  table-driven, independent of hand construction. It matches the codebase's existing
  precedent that `core/`'s scoring modules expose their arithmetic building blocks as
  named pure functions (`fuOf`, `hanOf`, `doraHanOf` are all already public in exactly
  this shape) — `settlement.ts`'s own header already frames itself as "the payment
  epic's entrypoint... fu.ts/han.ts both explicitly defer to," i.e. one layer above two
  already-public pure-function modules; keeping its own pure sub-steps private while
  those below it are public is the actual inconsistency this decision fixes.

`notenBappuOf`/`tenpaiFlagsOf`/`winOf`/`bestBaseOf`/`pricedReadingsOf`/`readingYakuOf`/
`hanOfNames`/`windKindOf` stay private — no AC clause needs them tested independent of a
real `TableState`/`Win`, and settlement.test.ts's existing fixtures already exercise
`bestBaseOf`'s reading-selection logic end to end (fixture 6). Exporting only the four
functions the grid genuinely needs keeps the public surface minimal.

**Rejected variant**: renaming `baseOf` to a "nicer" public name (`basePointsOf`) while
exporting. Rejected — renaming a working, already-well-named private function purely to
make it "read better" as a public export is an unrequested cleanup or abstraction that a
future ticket has no reason to want; every other module in this codebase exports its pure
functions under their existing internal names (`fuOf`, `hanOf` were never private, so
there is no renaming precedent to follow either way) — leave `baseOf` named `baseOf`.

## Decision 2 — the han×fu grid: table-driven, not fast-check

**The question**: should the han×fu grid itself be a `fc.property` over random (han, fu)
pairs, or a plain nested-loop `describe`/`it` table?

**Chosen: a plain nested loop over explicit, hand-listed han/fu values**, not
`fc.integer`-generated. Rationale: the published table (research.md §3, restated from
-03's research.md) is a small, EXACT step function — han 1-13+ tiers, fu steps of 10 (plus
25 for chiitoitsu, though chiitoitsu never reaches `baseOf` with han<2 in practice; the
grid still exercises the formula at that point since it is a pure arithmetic function, not
a hand-reachability check) from 20 to 110. There are finitely few (han, fu) cells worth
covering (13 han values × ~10 fu steps ≈ 130 cells, well within a synchronous test's
budget), and every cell's expected value is a DETERMINISTIC closed-form (no randomness
needed to explore the space — unlike shanten, where the domain is combinatorially too
large to enumerate and fast-check's random sampling is the only tractable coverage
strategy). A random-sampling property here would either (a) under-cover by sampling only
a handful of the ~130 cells per run, weakening the "every cell" AC clause, or (b) require
`fc.integer` ranges wide enough to reconstruct the same 130-cell enumeration by hand
anyway, adding indirection with no coverage benefit. `Array.from`-generated nested loops
(the `hanOf` table test's own `for (const name of STANDARD_YAKU_NAMES)` precedent, one
level deeper) give exhaustive, readable, individually-named test cases instead.

**Rejected**: `fc.property` over `fc.integer({min:1,max:20})` × `fc.constantFrom(20,30,
...,110)`. Rejected per the above — no randomness is needed to cover a small closed
domain exhaustively, and `fc.assert` would either report failures batched/shrunk (hiding
which of 130 cells failed) versus a table test's per-cell `it()` naming the exact failing
(han, fu) pair directly in the test runner's output.

## Decision 3 — dealer-ness × ron/tsumo split: also table-driven, over the SAME base grid

Once `baseOf` is exported and grid-tested, the payment-split half (`ronDeltas`/
`tsumoDeltas`) is tested the same way: a nested loop over a representative sample of base
points (not every one of the 130 han/fu cells recomputed — reusing a handful of round
numbers, e.g. 400/1000/2000/3000/4000/6000/8000, covers every rounding-boundary shape
`roundUp100` can produce) × {dealer win, non-dealer win} × {ron, tsumo}, asserting the
full `SeatDeltas` 4-tuple (winner index, discarder/payer indices, and that non-participant
seats are exactly 0) against hand-computed expected values. This is a much smaller table
(8 base values × 2 dealer-ness × 2 win-modes = 32 cells) than the han/fu grid because the
split logic itself has few branches (dealer-pays-more vs not); table-driving it the same
way keeps the whole grid suite one uniform style rather than switching techniques
mid-file.

## Decision 4 — zero-sum conservation over random ended hands: fast-check, reusing selfPlay's shape

**The question**: how to generate "random ended hands" for the zero-sum property. Two
options:

- **A. Duplicate `selfplay.test.ts`'s `selfPlay` driver** (full four-seat AI-vs-AI,
  claim arbitration and all) into this file, matching the codebase's own no-shared-
  test-utils convention (research.md §5), and fast-check over seeds.
- **B. Write a leaner walker** that still folds real records via `foldRecord`/
  `legalActions`/`discardPolicy`/`callPolicy`/`seatView` but drops everything
  `selfplay.test.ts` needs only for ITS OWN assertions (the claims tally, the
  double-play byte-identical replay check, the `SelfPlayEnd` summary shape) — this
  ticket only needs the FINAL `TableState`, nothing about the path taken to reach it.

**Chosen: B.** The full `selfPlay` including double-play-and-diff is disproportionate
machinery for a property that only reads the terminal state; a leaner walker (same
per-step arbitration rule, since that rule is what makes the generated states REAL
legal endings — a wrong arbitration could fold an illegal action and throw before
reaching an end) keeps this file focused on what it tests. This is still "duplication,"
per the codebase's own convention (every scoring test file already duplicates `h()` and
meld builders rather than sharing them) — not a shared module, just a smaller copy scoped
to what this file needs, matching (not violating) the established precedent.

`fc.integer({min: 0, max: 0xffffffff})` drives the seed, `numRuns` around 40-60 (matching
`selfplay.test.ts`'s own corpus scale and the shanten property file's 60-250 band) with an
explicit `{timeout: 60_000}` — the same generous-timeout convention `selfplay.test.ts`
already uses for its heaviest suite, since folding+re-folding a whole hand per step, times
tens of seeds, is the same cost shape.

The property itself: `settlementOf(state)` on the walker's terminal state — guaranteed
`'agari'` or `'ryuukyoku'` by the same termination argument `selfplay.test.ts`'s own
`ACTION_BOUND` throw already proves — has all four deltas sum to exactly 0. No epsilon
needed: every quantity here is an integer (points, `roundUp100` outputs, `NOTEN_BAPPU_POT`
divisions all land on integers by construction — 3000/1,3000/2,3000/3 are all whole).

## Decision 5 — fu invariants: property test over real winning hands, reusing shanten.property.test.ts's builder shape

**The question**: how to generate the "random ended hands" (really: random `WinContext`s)
the fu-invariant property needs, and how to independently detect "is this reading
pinfu-shaped" without re-deriving `fu.ts`'s own `isPinfuShape`.

**Chosen**: duplicate (locally, per convention) a trimmed version of
`shanten.property.test.ts`'s `buildWinner`/`buildMelds`/`buildTenpaiParts` toolkit — only
what is needed to produce a complete 14-tile winning hand with real melds, fed through the
REAL `decomposeAgari` (never hand-typed decomposition literals, the fu.test.ts precedent)
— to generate `WinContext`s across both tsumo and ron sources and every meld count 0-4.
For pinfu detection, use `standardYakuOf(ctx).includes('pinfu')` (from `yaku.ts`, already
public) as the oracle rather than re-implementing the shape test a third time — this is a
genuine cross-module invariant (does `fu.ts`'s independently-written `isPinfuShape` agree
with `yaku.ts`'s independently-written `pinfu` predicate on every generated hand?), which
is a stronger and more valuable check than a same-module self-consistency test would be.

**Rejected**: generating hands via the `winnerArb`/`randomHand14Arb` PURELY RANDOM tile
draw (shanten.property.test.ts's other generator family). Rejected because most random
14-tile draws are not winning hands at all (`decomposeAgari` returns `[]`), so this
generator would need a `fc.pre(isAgari(...))` filter with a very low hit rate — the
`buildWinner`-style CONSTRUCTED generator is the one shanten.property.test.ts itself
prefers for exactly this reason (it is deterministic-by-construction, no rejection loop
needed) and is reused here for the same reason.

The three invariant clauses, each its own `fc.property`:

1. **Every fu value is a multiple of 10, or exactly 25.** `fuOf(ctx) % 10 === 0 ||
   fuOf(ctx) === 25` over every generated `WinContext` (standard and chiitoitsu forms both
   — chiitoitsu fixed at 25 satisfies the same disjunction trivially, so one property
   covers both AC-named cases without a form-conditional split).
2. **Pinfu tsumo is exactly 20, pinfu ron is exactly 30** (the two named fixed values):
   whenever `standardYakuOf(ctx)` includes `'pinfu'`, `fuOf(ctx)` equals `PINFU_TSUMO_FU`
   (20) or `PINFU_RON_FU` (30) per `isTsumo(ctx.source)` — both constants re-stated by
   value in the test (independently, never imported from fu.ts, matching every other
   scoring test file's "never derived from the module's own constants" convention).
3. **Chiitoitsu is always exactly 25.** Already covered by clause 1's disjunction as a
   NECESSARY condition; stated again as its own SUFFICIENT-direction property
   (`decomposition.form === 'chiitoitsu' ⟹ fuOf(ctx) === 25`, not just "25 or a multiple
   of 10") since chiitoitsu could otherwise vacuously satisfy clause 1 by landing on 20 or
   30 by coincidence — the AC names this as a distinct fact from the rounding rule, so it
   gets a distinct assertion.

## Decision 6 — the dora-gate property: monotonicity, layered on the existing han.test.ts fixture

**The question**: han.test.ts already has one fixture proving a specific yakuless
dora-rich hand cannot win (research.md §2). What does THIS ticket's property add, and at
what layer (han.ts's `doraHanOf`, or settlement.ts's `bestBaseOf`)?

**Chosen**: two small properties, at the settlement layer (since this is the settlement
crown ticket and `state.doras` is what a real game thread through `settlementOf`):

1. **Structural, not tested — cited as evidence.** `Win`'s type (yakuman.ts) carries no
   `doraKinds` field; `yakuOf(win: Win)` has no dora parameter at all. This means dora
   cannot influence the one-yaku win gate BY CONSTRUCTION, independent of any test run —
   design.md records this as the reason no NEW test is needed to re-prove "dora cannot
   satisfy the win gate" (han.test.ts already covers the one case worth a concrete
   fixture; a property here would just be re-asserting a type-level fact with an
   expensive fast-check wrapper for no additional confidence).
2. **Monotonicity property (new, this ticket's actual contribution):** for the same `Win`,
   adding MORE dora indicators never LOWERS `settlementOf`'s priced base — i.e. dora is
   purely additive to price, never a gate. Formalized by generating a winning `Win` (via
   Decision 5's builder) that already carries ≥1 yaku (filtered via `yakuOf(win).length >
   0` — a real win always does, per the fold's own gate, so this filter is nearly always
   true and only guards the theoretical zero case), then comparing `bestBaseOf`-via-
   `settlementOf` at `doras = []` against `doras = [oneExtraDoraKind]` for some kind drawn
   from the hand's own tiles (guaranteeing the extra dora actually matches ≥1 held tile,
   so the comparison is non-vacuous) — `settlementOf` is not itself exported at the
   `Win`-level, so this property is expressed by constructing two `TableState`s that
   differ only in `doras` (via the ronState/tsumoState builder pattern settlement.test.ts
   already uses) and asserting the deltas' magnitude is non-decreasing.

## Summary of settlement.ts changes

Four `export` keywords added to already-implemented, already-correct private functions
(`baseOf`, `roundUp100`, `ronDeltas`, `tsumoDeltas`). No behavior change, no renaming, no
new functions in the module itself — settlement.ts's header comment gets one added
sentence noting the four names are now part of the tested public surface. All other work
is new test code in a new file.
