# T-005-01-01 — agari-decomposition — Review

Handoff summary: what changed, how it is tested, what a human should look at.

## What changed

| File | Change |
|---|---|
| `src/core/agari.ts` | NEW (~215 lines) — the pure agari decomposer |
| `src/core/agari.test.ts` | NEW (~460 lines) — fixtures + brute-force-reference property suite |
| `src/core/index.ts` | +1 line — `export * from './agari'` |

Commits, in order: `7a726ac` (types, guards, standard backtracker, barrel),
`0e7844e` (chiitoitsu + kokushi), `bbbbe99` (fixtures + reference oracle),
`6f96208` (property suite). No other file touched; record.ts/legal.ts stay
closed as planned — the fold learns about wins in T-005-02-01.

## The API (what downstream tickets consume)

`decomposeAgari(concealed: readonly TileKind[], melds: readonly Meld[]):
AgariDecomposition[]` — every distinct reading of a winning hand; `[]` ⇔ not a
win. `isAgari` is the emptiness read. Three forms in the result union:
`standard` (pair + concealed sets; `sets.length` = 4 − melds), `chiitoitsu`
(seven distinct pairs, ascending), `kokushi` (the duplicated kind). Key contract
points, all documented in the module:

- **Kind-level deliberately** — copies never affect shape; waits (-02) can ask
  about completions whose four physical copies are visible. Fold-side callers
  map `kindOf` at the boundary.
- **Melds read for ARITY only** — meld sets are the caller's Melds (a chi IS a
  run); the output covers the concealed side only.
- **Result order is frozen contract** (legalActions precedent): standard by pair
  kind ascending, sets ascending by kind with triplet before runs of the same
  kind, then chiitoitsu, then kokushi.
- **Wrong arity throws RangeError** naming the numbers; kind values trusted
  (compile-time union + log-parser-boundary rule).

## Acceptance criteria — verified

1. *"Property suite green comparing the decomposer to a brute-force reference
   over randomized hands (with 0–4 melds)"* — ✔. Four properties, meld arity
   drawn from 0–4: constructed winners (positive-dense, 300 runs), random
   136-multiset draws (negative-dense, 300 runs), one-tile perturbations of
   winners (near misses, 200 runs), generator self-test (200 runs). The
   comparison is stronger than the AC asks: full normalized decomposition-KEY
   set equality across all three forms, not a boolean — plus output uniqueness,
   winner anti-vacuity, and re-expansion of every standard reading to the
   queried counts.
2. *"Positive/negative fixtures for chiitoitsu and kokushi"* — ✔. Chiitoitsu:
   positive, four-of-a-kind refusal, six-pairs-plus-remainder refusal. Kokushi:
   all 13 duplicate choices positive (the thirteen-wait family), missing-kind
   near miss, simple-tile intruder.
3. *"purity.test.ts still passes with the new module exported from the core
   barrel"* — ✔. agari.ts imports only `./tiles` and (type-only) `./record`;
   the glob-driven gate covers it automatically; full suite 236/236 green,
   `just check` 0 errors.

## Test coverage assessment

- **Fixtures (18)**: one-reading hand, 111222333m multiplicity with the exact
  branch order, pair-choice multiplicity in the documented ascending order,
  suit-boundary refusal (8m9m1p — the one place the contiguous kind-index
  encoding could lie), honor-run refusal, 1-meld and 4-meld (pair-only) arity,
  ryanpeikou dual-form (standard AND chiitoitsu, order pinned), both RangeError
  messages, purity (input unmutated, repeat-call equality), isAgari.
- **Oracle independence**: the reference is positional search over sorted tiles
  with dedup-after — structurally different from the shipped counts backtracker
  (unique-by-construction). Validity was spot-checked by breaking the module
  both ways: suit-boundary guard widened → 2 failures; triplet branch dropped →
  6 failures (recorded in `6f96208`'s message).
- **Runtime**: the whole agari suite adds ~35ms of test time (budget was <3s);
  the exponential reference never bites at n ≤ 14 with the pruned binding.

### Gaps (known, accepted)

- Property distributions never exercise counts > 4 of a kind (the wall makes
  them unreachable from real folds; countsOf deliberately doesn't validate).
- The reference and module could in principle share a blind spot in the KEY
  normalization (both map through the same `setToken`/`standardKey` helpers in
  the test file). Mitigated by the exact-list fixtures, which bypass keys and
  assert raw output shapes against hand-derived expectations.
- No fold-integration test — deliberate; T-005-02-01 owns wiring wins into
  record.ts and will integration-test through real records.

## Open concerns for a human reviewer

1. **The result ORDER is now frozen** (documented as contract). If -03/-04 turn
   out to want a different canonical order, changing it later is a breaking
   change to a documented contract — cheap to change today, expensive after the
   yaku catalog lands. I believe pair-ascending + triplet-before-run is the
   natural order (it falls out of TILE_KINDS), but it is worth a deliberate nod.
2. **`isAgari` does the full decomposition** — no early-exit path. At ~µs per
   query this is fine for -02's 34-queries-per-hand loops (measured: 1000
   property queries + reference in 35ms), so I chose one code path over a
   second, faster, divergence-prone predicate. Flagging in case waits' property
   suite budget disagrees.
3. **Chiitoitsu/kokushi zero-meld gating is structural** (`melds.length === 0`
   branch in decomposeAgari), and the arity guard makes meld-bearing 14-tile
   queries impossible — so "chiitoitsu with a meld" is unrepresentable rather
   than tested-false directly. The random-hand property asserts the visible
   consequence (no special forms at meldCount > 0).
4. **Guard message grammar** — "with 1 melds" (no singularization). Matches the
   fold's terse RangeError style; trivially fixable if it grates.
5. The ticket frontmatter still shows `phase: research` / `status: open` — left
   untouched per the RDSPI rule that lisa advances phases on artifact detection.

## TODOs handed to later tickets

- -02 (waits): kind-level completion queries; consider lifting a shared mpsz
  test helper (`h()`) if a third suite wants it — two copies is below the
  extraction bar.
- -03 (yaku): reads `sets` + the caller's Melds; the KOKUSHI kind list is
  module-private today — -04 can export it if the yakuman ticket wants it
  (extend-only precedent).
- -02-01 (fold): maps `kindOf` over hands + drawn/claimed at the boundary.
