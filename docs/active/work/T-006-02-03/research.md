# T-006-02-03 — brute-force-reference-property-tests — Research

Descriptive map of everything this ticket touches. The ticket lands the P5
shanten-correctness crown: property tests where `shanten` agrees with an
independent brute-force reference across constrained samples, and
`shanten === 0` agrees with the enumerated waits at tenpai.

## 1. The module under test: `src/core/shanten.ts` (198 lines)

Two exports, both landed by the dependency chain and both re-exported through
the `src/core/index.ts` barrel (`export * from './shanten'`, added T-006-02-01):

- `standardShanten(concealed, melds): number` (T-006-02-01) — block-count
  backtracker `8 − 2·melds − max(2·sets + partials + head)` over exhaustive
  disjoint decompositions, with the block cap `sets + partials ≤ 4 − melds` and
  an explicit reserved-head flag (`bestValue`, shanten.ts:57–114).
- `shanten(concealed, melds): number` (T-006-02-02) —
  `min(standardShanten, chiitoiShanten, kokushiShanten)`; the special forms are
  private closed-form scans (`6 − pairs + max(0, 7 − kinds)`;
  `13 − kinds − hasPair`) evaluated only when `melds.length === 0`.

Contract facts the tests must respect:

- **Arity**: both functions accept `13 − 3·melds` OR `14 − 3·melds` concealed
  kinds; anything else throws `RangeError` naming both counts. More than 4
  melds throws. Range: −1 (complete) … 8. A 13-tile query can never read −1
  (12 tiles at most form 4 sets; the 13th cannot complete a pair).
- **Melds are read for ARITY ONLY** — each call discounts one required set;
  content is ignored (the agari.ts convention). `FAKE_MELDS` arity stubs are
  honest inputs for shanten (shanten.test.ts:29–38 uses them).
- **KIND-level SHAPE distance** — no 4-copy discount. The header
  (shanten.ts:8–11) states it explicitly: "a kind whose four copies are all
  visible is never discounted — 4-copy exhaustion is waits' convention,
  reconciled with shanten by the property crown (T-006-02-03), not re-derived
  here." This ticket IS that reconciliation.
- Pure read: inputs unmutated, deterministic.

## 2. The waits side: `src/core/waits.ts` (75 lines)

- `waits(concealed, melds): TileKind[]` — probes each of the 34 kinds through
  `isAgari([...concealed, kind], melds)`, SKIPPING any kind all four of whose
  copies are visible to the hand itself (concealed + own melds' tiles, claimed
  included — `visibleCounts`, waits.ts:25–33). Ascending order. Strict arity:
  `13 − 3·melds` ONLY (no 14-tile form).
- `isTenpai(concealed, melds): boolean` — `waits(...).length > 0`.
- **Melds are read for CONTENT** — exhaustion counts the copies a call
  consumed. Property tests comparing shanten (arity-only) with waits
  (content-read) must therefore build REAL melds; waits.test.ts:272–334
  (`buildTenpaiParts`) already solves exactly this with a shared 4-copy budget
  across concealed sets, meld tiles, and the pair.

## 3. The known divergence the AC's "constrained samples" must handle

`shanten === 0 ⟺ isTenpai` is NOT unconditionally true under the two modules'
frozen conventions. Divergence witness (constructed from the two contracts):

- Hand `123m456p789s2222z` (13 tiles, 0 melds): `bestValue` reads sets
  123m/456p/789s/222z (value 8, blocks full, head unclaimed) → shape tanki on
  the fourth 2z → `standardShanten = 0`. But `waits` sees `counts[2z] = 4 ≥ 4`
  and never probes it → `waits = []` → noten. (Structurally the completion
  needs a FIFTH 2z — 222z triplet + 2z2z pair — which shape distance permits
  and physical tenpai forbids.)

So the biconditional holds in one direction unconditionally
(`isTenpai ⟹ shanten === 0`, since a physically arriving completion is in
particular a shape completion) and in the other only for hands whose
structural waits are not all self-exhausted. Under zero melds, exhaustion
requires 4 concealed copies of the wait kind itself; with melds, a meld's own
tiles also count (waits.test.ts's "both self-exhaustion producers" fixtures
pin ankan- and pon-based cases).

## 4. The direct precedent: agari.test.ts's brute-force reference (lines 1–187, 387–546)

The suite this ticket's AC is modeled on ("agreement with a BRUTE-FORCE
REFERENCE that is structurally different from the shipped algorithm … so
agreement is evidence, not tautology"). Reusable machinery, all test-local:

- `h(spec)` mpsz shorthand — duplicated per test file by convention (agari,
  waits, shanten suites each carry their own copy).
- `FAKE_MELDS` / `melds(count)` arity stubs (agari.test.ts:42–51).
- `SET_CANDIDATES` — all 55 legal sets as kind-index triples (34 triplets + 21
  runs), duplicated in waits.test.ts:249–254.
- `buildWinner(meldCount, setChoices, pairChoice)` — deterministic 4-copy-capped
  winner construction, no rejection loops (agari.test.ts:409–428).
- Arbitraries: `winnerArb` (constructed winners, positive-dense),
  `randomHandArb` (`fc.shuffledSubarray` of the 136-tile `POOL`,
  negative-dense), `perturbedArb` (winner with one tile swapped — near
  misses). numRuns 200–300 per property.
- The reference itself: positional partition search over sorted kind indices
  (`refPartitions`, `refSetOf`) plus first-principles chiitoitsu/kokushi
  scans — existence and full enumeration of winning decompositions.

waits.test.ts adds the REAL-meld variants (`buildTenpaiParts`, `partsArb`,
`minusOneArb` — a winner minus one tile is tenpai by construction with the
removed kind a construction-guaranteed wait, waits.test.ts:360–364).

## 5. Candidate reference formulations (feasibility facts, decision deferred to Design)

The definitional statement both formulations implement: for hand H and target
winning multisets W compatible with the meld count,
`shanten(H) = min over W of (tiles of W missing from H) − 1`, where
missing = Σ_k max(0, W[k] − H[k]). This yields −1 for a complete 14-tile hand
and 0 exactly at (shape) tenpai — the same uniform both-arities semantics the
module implements. Two brute-force realizations:

- **Exchange-distance search** (recursive: tenpai? else 1 + min over
  discard×draw): branching ≈ 13 distinct kinds × 34 draws per level; depth =
  shanten. Infeasible beyond depth ~2 without memoization (depth 2 ≈ 2·10⁵
  states × a 34-probe tenpai check each); random 13-tile hands run up to
  shanten 8. Only usable with samples constrained to very low shanten.
- **W-enumeration with overlap** (enumerate winning multisets as
  non-decreasing combinations of `4 − melds` sets from the 55 candidates plus
  a pair kind; track Σ min(H[k], W[k])): for melds = 0, C(58,4) = 424,270 set
  combinations × an O(34) best-pair scan ≈ 14M cheap ops per sample — tens of
  ms in JS, hundreds of ms at numRuns ≈ 100 without any pruning; smaller for
  every meld count above 0. Handles ALL shanten values, so random
  (unconstrained-shanten) hands are also checkable. Chiitoitsu/kokushi W-sides
  have tiny closed enumerations (7-of-34 kind choices maximizing
  Σ min(H[k], 2), a separable objective; 13 orphan kinds + pair choice).

A semantics fact either reference must fix: the module's shape distance
permits completions using a FIFTH copy of a kind (the §3 witness — module
reads 0 where every physical W is out of copies). A reference that caps W at
4 copies per kind would diverge from the module on exactly those hands; an
uncapped-W reference matches the module's documented KIND-level convention.
This is a design decision to make explicitly and document.

## 6. Existing shanten fixtures (shanten.test.ts, 281 lines)

29 tests: rule-derived fixtures for complete/tenpai/n-shanten ladders, meld
discounts, head-vs-partial exactness edges, the combinator's binding cases,
contract (arity errors, purity). The header (lines 7–8) explicitly defers
"property sweeps against a brute-force reference" to this ticket. Several
fixtures deliberately echo waits.test.ts fixtures — cross-module agreement is
already house style at fixture grain; this ticket lifts it to property grain.

## 7. Test infrastructure and perf discipline

- vitest 4.1.9 + fast-check 4.8.0 (both already devDependencies; agari, waits,
  deal, legal, wall, rng, seatview.fairplay suites all use fc).
- `just test` → `flox activate -- npm run test` → `vitest run` over the repo
  (no separate vitest config file; defaults). Current suite: 20 files / 483
  tests, green. `just check` → svelte-check + tsc, 0/0.
- Separate-file precedent exists for a ticket-sized property suite:
  `seatview.fairplay.test.ts` (T-006-01-02). Perf discipline precedent from
  the same ticket: a 2.6s sweep was reworked to 0.13s — slow property loops
  get flagged, so per-sample reference cost × numRuns needs budgeting.

## 8. Repo state constraints

- **T-006-02-02's work is complete (review.md written) but UNCOMMITTED** —
  `src/core/shanten.ts` / `shanten.test.ts` sit modified in the shared working
  tree; `shanten` (the combinator) does not exist at HEAD. That thread's
  review cites the commit protocol ("only commit when the user asks") — the
  most recent precedent, though earlier threads (T-006-02-01, T-006-01-02) did
  commit with `T-XXX:` prefixes. Any commit this ticket makes that imports
  `shanten` would be broken at HEAD until -02's changes land. The Implement
  phase must decide commit behavior against this state and document it.
- Ticket dependency `depends_on: [T-006-02-02]` is satisfied in tree (all six
  artifacts present in `docs/active/work/T-006-02-02/`).

## 9. Downstream consumers of this ticket's guarantee

- T-006-03-01 (`discard-policy`) consumes `shanten` as the value it minimizes —
  the crown is what makes "shanten-minimizing" trustworthy.
- Teaching prompts (vision: riichi/shanten prompts) read the same datum; the
  waits agreement clause is what lets "tenpai" UI language and shanten-0 UI
  language coexist without contradiction.

## 10. Assumptions surfaced

- fast-check's default seed handling is deterministic per run configuration in
  CI; existing suites rely on it, so this ticket can too.
- The 13/14-arity duality means the reference must be checked at BOTH arities
  and all meld counts 0–4 to cover the module's whole domain.
- `waits`' strict 13-tile arity means the shanten⇔waits clause only quantifies
  over waiting-arity hands.
