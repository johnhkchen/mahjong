# T-006-02-03 — brute-force-reference-property-tests — Structure

## Files

| File | Change | Content |
| --- | --- | --- |
| `src/core/shanten.property.test.ts` | **created** | the whole ticket: reference + builders + property suite + divergence fixtures (~420 lines) |
| `src/core/shanten.test.ts` | modified (1 comment line) | header sentence "Property sweeps … are T-006-02-03 by ticket design" → points at the landed sibling file |

No shipped-code files change. No barrel edit (no new exports). No deletions.

## `src/core/shanten.property.test.ts` — internal organization

Ordered sections, mirroring agari.test.ts's layout (header → sugar → reference
→ builders/arbitraries → fixtures → properties):

### 1. Header comment (~20 lines)

The suite's charter: brute-force reference structurally different from the
shipped block-count backtracker (enumerates hands the query could BECOME, not
decompositions of what it HOLDS); the definitional formula
`min over W of missing(W, H) − 1` with the exchange-equivalence argument
(design D1); the UNCAPPED-W shape convention and why (design D2, pointing at
shanten.ts's own header); the reconciliation clauses against waits (design
D4). States that the reference consults no module algorithm.

### 2. Test-side sugar (~35 lines)

Per-file copies, per convention:

- `h(spec: string): TileKind[]` — the mpsz shorthand (verbatim house copy).
- `FAKE_MELDS` / `melds(count)` — arity stubs (shanten reads arity only).
- `countsOfHand(kinds): number[]` — 34-slot counts (agari.test.ts twin).
- `visibleOf(hand, melds): number[]` — concealed + meld-content counts
  (waits.test.ts:337–345 twin; used by the exhaustion-side properties).

### 3. The brute-force reference (~90 lines)

Pure functions over count arrays; no module imports beyond tile vocabulary.

- `SET_CANDIDATES: readonly (readonly number[])[]` — 34 triplets + 21 runs as
  kind-index triples (house copy).
- `refStandardBest(handCounts, wCounts, overlap, fromSet, setsLeft, best): number`
  — recursive max-overlap enumeration of set multisets (non-decreasing index
  order = multiset dedup), incremental overlap (+1 per added copy of k iff
  `wCounts[k] < handCounts[k]`), leaf = best pair gain over 34 kinds, single
  sound prune `overlap + 3·setsLeft + 2 ≤ best`.
- `refChiitoiBest(handCounts): number` — exhaustive subsets (size ≤ 7) of the
  distinct present kinds, overlap Σ min(count, 2); absent kinds argued
  interchangeable in the comment.
- `refKokushiBest(handCounts): number` — 13 pair-kind choices over the orphan
  indices; the orphan index list is a test-local copy.
- `refShanten(hand: readonly TileKind[], meldCount: number): number` — the
  face: `(14 − 3·meldCount) − bestOverlap − 1`, special forms gated on
  `meldCount === 0`. Accepts both arities implicitly (formula is arity-blind).
- `refIsWin(hand14: readonly TileKind[], meldCount: number): boolean` —
  `refShanten(...) === −1`; the reference's win predicate for structural-wait
  enumeration.

### 4. Builders and arbitraries (~110 lines)

- `buildWinner(meldCount, setChoices, pairChoice)` — FAKE-meld winner
  construction (agari.test.ts:409–428 twin).
- `buildTenpaiParts(meldCount, formChoices, setChoices, pairChoice)` —
  REAL-meld winner construction with the shared 4-copy budget
  (waits.test.ts:272–334 twin; pon/chi/ankan forms).
- Arbitraries:
  - `winnerArb` — { meldCount 0–4, hand at 14−3m } via buildWinner.
  - `minusOneArb` — winnerArb minus one tile (13−3m; tenpai by construction).
  - `perturbedArb` — winnerArb with k ∈ 1..4 distinct-position replacements
    (14−3m arity; shanten ≤ k−1 by construction, carried for the self-test).
  - `randomHand13Arb` / `randomHand14Arb` — `fc.shuffledSubarray` of the
    136-tile POOL, m = 0.
  - `realPartsArb` — buildTenpaiParts record (for the waits-clause
    properties); `realMinusOneArb` — its minus-one projection.
  - `randomRealMeldArb` — melds built from the budget as in buildTenpaiParts,
    concealed 13−3m drawn from the REMAINING pool (the one genuinely new
    builder; needed so the waits clause sees noten-dense melded hands).

### 5. Divergence fixtures (~35 lines)

`describe('the exhaustion boundary — shanten is shape, waits is physics')`:

- `123m456p789s2222z`, 0 melds: `shanten === 0`, `waits === []`,
  `isTenpai === false` — rule-derived comment walks the fifth-2z tanki.
- `ankan('3m')` + `24m456p789s55z`: same triple of assertions — the kanchan
  whose only wait sits inside the hand's own ankan. Real ankan built with the
  waits.test.ts `ankan()` helper shape (test-local copy).

### 6. Properties (~130 lines)

`describe('agreement with the brute-force reference')` — every assertion is
`expect(shanten(hand, melds(m))).toBe(refShanten(hand, m))`:

- generator self-tests (one `it`): winners are wall-legal and read −1 by
  construction; perturbed hands respect `shanten ≤ k − 1`; minus-one hands
  read 0 — the anti-vacuity block.
- winners agree (14−3m, m 0–4).
- minus-one tenpai hands agree (13−3m, m 0–4).
- perturbed near-misses agree (14−3m, m 0–4).
- random 13-tile draws agree (m = 0; the full 0..8 band, small numRuns).
- random 14-tile draws agree (m = 0; includes `−1 ⟺ refIsWin` for free).

`describe('shanten 0 and the enumerated waits')` — design D4's three
properties, real melds throughout:

- P-tenpai-sound over `realMinusOneArb` ∪ `randomRealMeldArb`:
  `isTenpai ⟹ shanten === 0`.
- P-tenpai-complete over the same arbitraries FILTERED to
  `max(visibleOf(...)) < 4`: `(shanten === 0) === isTenpai` (the AC
  biconditional on constrained samples; ankan-bearing samples are excluded by
  the filter and covered by the other two).
- P-exhaustion-explains over unfiltered samples where
  `shanten === 0 && !isTenpai`: for all 34 kinds,
  `refIsWin([...hand, kind]) ⟹ visible[kind] ≥ 4`.

numRuns per property are set in Plan (budgeted) and tuned by measurement
during Implement.

## `src/core/shanten.test.ts` — the one-line touch

Header lines 7–8 currently read "Property sweeps against a brute-force
reference are T-006-02-03 by ticket design, not thinness." — amend to name
`shanten.property.test.ts` as where they landed. No test bodies change.

## Boundaries and dependency direction

- The new file imports ONLY from `./index` (module under test + tile
  vocabulary + waits/isTenpai) and `fast-check`/`vitest` — the house import
  shape for core test files.
- The reference layer (§3) must not call `shanten`, `standardShanten`,
  `isAgari`, `waits`, or `decomposeAgari` — independence is the point. The
  waits-clause properties (§6) DO call `waits`/`isTenpai` as comparands;
  that is cross-module agreement, not reference contamination.
- Nothing in `src/app/` or shipped `src/core/` moves.

## Ordering of changes

1. Create the file skeleton with header, sugar, and reference (§1–3) — the
   reference is testable against hand-derived fixtures immediately.
2. Divergence fixtures (§5) — cheap, pin the convention before the sweeps.
3. Builders/arbitraries (§4), then the agreement properties (§6a).
4. The waits-clause properties (§6b).
5. The shanten.test.ts header amendment.
6. Perf pass: measure, set final numRuns.

Rationale: reference-first lets every later step assert against it; fixtures
before properties give shrunk counterexamples a familiar vocabulary.
