# T-005-01-01 — agari-decomposition — Design

Decisions for the pure agari predicate in `src/core/agari.ts`. Grounded in
research.md: the module is the root of E-005's DAG — waits (-02), yaku (-03/-04),
and the win fold (-02-01) all consume its API, so the output shape is load-bearing.

## D1. Granularity: kinds, not physical tiles

**Options.** (a) `TileId[]` input, matching TableState.hands. (b) `TileKind[]`
input. (c) counts array `number[34]`.

**Decision: (b) `readonly TileKind[]` for the concealed tiles.** Decomposition is
inherently kind-level — copies are interchangeable for shape (and stay so even when
red fives arrive: a red 5 changes dora counting, never whether a hand decomposes).
The decisive consumer is T-005-01-02: waits asks "does hand + one tile of kind k
complete?" for all 34 kinds, including kinds whose four physical copies are already
visible — at TileId granularity those queries would fabricate impossible ids; at
kind level they are natural. Fold-side callers convert with `hand.map(kindOf)` —
one map at the boundary. (c) is rejected as a public shape (hostile to read, easy
to mis-index) but IS the internal working representation (D3).

## D2. Melds enter as `readonly Meld[]`, used only for arity

**Options.** (a) `meldCount: number`. (b) a new kind-level meld-summary type.
(c) the existing `Meld[]` from record.ts.

**Decision: (c).** Every real caller (waits over a TableState, the -02-01 win
guard, -03's WinContext assembly) already holds `Meld[]`; (a) invites callers to
pass a wrong number, and (b) invents a parallel meld vocabulary that record.ts
would then have to stay synchronized with. The decomposer reads only
`melds.length` — meld sets need no decomposing (a chi IS a run, a pon/kan IS a
triplet-class set), and their yaku-relevant structure (openness, ankan vs
daiminkan, claimed tile) lives on the Meld objects the caller keeps. The import is
type-only from `./record` — same-directory, purity-gate legal (legal.ts precedent).
The doc comment states the arity-only read explicitly so nobody "optimizes" a Meld
fabrication into a hot path.

**Output covers the concealed side only** (pair + the 4 − melds concealed sets).
The full four-sets-and-a-pair picture is `decomposition + melds`, zipped by the
caller — duplicating meld data into the output would create a second copy of facts
record.ts already owns.

## D3. Output: ALL decompositions, as a three-form discriminated union

**Options.** (a) boolean `isAgari` only. (b) one arbitrary decomposition.
(c) every distinct decomposition.

**Decision: (c).** Research §3/§6: standard decompositions are not unique
(111222333m; pair/triplet ambiguity), different decompositions carry different yaku
(pinfu vs sanankou readings), and the high-point rule downstream must choose among
ALL of them — returning one would silently fix an interpretation three tickets too
early. Ryanpeikou-shaped hands are simultaneously standard and chiitoitsu, so the
result is a list over forms, not a single tagged value:

```ts
type ConcealedSet =
  | { type: 'run'; start: TileKind }      // start, start+1, start+2 — one suit
  | { type: 'triplet'; kind: TileKind }
type AgariDecomposition =
  | { form: 'standard'; pair: TileKind; sets: readonly ConcealedSet[] }
  | { form: 'chiitoitsu'; pairs: readonly TileKind[] }   // 7 kinds, ascending
  | { form: 'kokushi'; pair: TileKind }                  // the duplicated kind
decomposeAgari(concealed, melds): AgariDecomposition[]   // [] ⇔ not a win
isAgari(concealed, melds): boolean                       // convenience wrapper
```

Empty list IS the not-a-win signal — mirrors legalActions' "offer nothing" style;
no separate null. Ordering is deterministic and documented (D5).

## D4. Algorithm: counts-array backtracking, lowest-kind-first

**Options.** (a) counts[34] backtracking that always resolves the lowest nonzero
kind. (b) precomputed per-suit shape tables / bitmask tricks. (c) generic multiset
partition search over tile positions.

**Decision: (a).** The canonical algorithm, and TILE_KINDS' doc comment already
reserved the kind order for "count-array algorithms downstream". At the lowest
nonzero kind k the choice set is tiny and exhaustive: use k's copies as a triplet
(count ≥ 3) or as run-starts (k, k+1, k+2 — numbered suits only, rank ≤ 7); every
copy of k must be consumed before moving past k, so each distinct decomposition is
generated EXACTLY once — no dedup pass, no canonicalization after the fact. Pair
choice is the outer loop: for each kind with count ≥ 2, remove the pair, decompose
the rest into (4 − melds) sets. Complexity is trivial at n ≤ 14 (the wall bounds
counts at 4), comfortably inside -02's 34-queries-per-hand budget. (b) is shanten-
grade machinery research §7 explicitly warns off pre-building; (c) is exponential
with a dedup problem — it becomes the test-side REFERENCE precisely because it is
dumb, structurally different, and obviously correct (D6).

Chiitoitsu and kokushi are direct count scans, not searches: chiitoitsu ⇔ zero
melds ∧ exactly seven kinds with count exactly 2 (four-of-a-kind is NOT two pairs —
the seven-distinct-pairs rule, documented in the module); kokushi ⇔ zero melds ∧
the 13 terminal/honor kinds all ≥ 1 with exactly one at 2 (⇒ others exactly 1 by
the 14-tile arithmetic). Both forms demand `melds.length === 0` structurally
(13 − 3k tiles can't hold them for k > 0, but the guard states the rule, not the
arithmetic accident).

## D5. Contract details (guards, purity, ordering)

- **Size guard**: `concealed.length === 14 − 3·melds.length` or throw RangeError
  naming both numbers (the nextInt precedent — a wrong-arity query is caller
  corruption, not "no win"; waits and the fold always pass exact sizes). Same guard
  rejects melds.length > 4. Kind VALUES are trusted (TileId-rule precedent:
  validation lives at program boundaries; TileKind is a compile-time union).
- **Pure read**: inputs never mutated (internal counts array is fresh), fresh
  result arrays per call, same input ⇒ same output. Stated in the doc comment,
  asserted in tests.
- **Deterministic order** (part of the contract, like legalActions' order):
  standard decompositions by pair kind ascending (TILE_KINDS order), then by the
  backtracker's own triplet-before-run branch order; each `sets` list emerges in
  ascending kind order by construction. Chiitoitsu `pairs` ascending. Form order in
  the result: standard* (all), then chiitoitsu, then kokushi — the two special
  forms are appended after the standard search since exactly one of them can ever
  coexist with standard results (chiitoitsu, via ryanpeikou shapes).
- **4-meld edge**: concealed = 2 tiles ⇒ standard decomposition with `sets: []`
  and the pair — falls out of the same code path, pinned by a fixture.

## D6. Verification: brute-force reference + constructive generators

The AC demands a property suite comparing against a brute-force reference over
randomized hands (0–4 melds), plus chiitoitsu/kokushi fixtures.

- **Reference** (test-local, never shipped — "big in tests" is the core's stated
  posture): positional exhaustive search over the sorted concealed kinds — choose
  the pair as any two equal-kind positions, then repeatedly take the first
  remaining tile and try every pair of later positions completing a run or triplet
  with it; collect complete partitions, normalize each to the ConcealedSet shape,
  sort, dedupe. Structurally different from the shipped counts backtracker (
  positions vs counts, dedup-after vs unique-by-construction), so agreement is
  evidence, not tautology. Chiitoitsu/kokushi reference reads: independent
  first-principles scans in the test file.
- **Agreement property is over SETS, not booleans**: normalized(decomposeAgari)
  === normalized(reference) as complete decomposition sets — strictly stronger
  than the AC's minimum and what -03 actually depends on.
- **Two hand distributions**, both parameterized by meld count m ∈ 0–4 drawn from
  fc: (1) constructive winners — build (4 − m) random concealed sets + pair under
  the 4-copy wall constraint (retry/mask on violation), so positives are dense;
  (2) random draws of 14 − 3m tiles from the 136-tile multiset — almost all
  negatives. Plus single-tile perturbations of constructed winners for near-miss
  negatives. Melds fabricated as minimal hand-built Meld literals (only `.length`
  is read — documented in the generator).
- **Fixtures**: chiitoitsu positive/negative (incl. the four-of-a-kind refusal),
  kokushi positive/negative (13-wait shape and a near miss), ryanpeikou dual-form,
  111222333m multiplicity (asserting the exact decomposition list), 4-meld pair-
  only, and purity (input arrays unmutated, repeat call equality).

## Rejected along the way

- Returning the winning-tile / wait-type distinction: not an input here; -03's
  WinContext carries the winning tile and re-derives its position per
  decomposition. Adding it now would force an API guess three tickets early.
- A `shanten`-capable decomposer (partial-set counting): explicitly out of scope
  (research §7); the backtracker's shape does not preclude a later sibling module.
- Kan-aware set arithmetic in the output: a kan is one set; only melds.length
  matters, and record.ts already knows which melds are kans.
