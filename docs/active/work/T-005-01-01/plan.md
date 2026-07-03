# T-005-01-01 — agari-decomposition — Plan

Ordered, independently verifiable steps. Commit prefix convention: `T-005-01-01:`.
Verification commands: `just test` (vitest over src/), `just check` (svelte-check +
tsc). Baseline before step 1: both green on main (~192 tests).

## Step 1 — module skeleton: types, guard, barrel

Create `src/core/agari.ts` with the role comment, `ConcealedSet` and
`AgariDecomposition` types, the `decomposeAgari` size/arity guard throwing
RangeError, `isAgari` wrapper, and stub-empty search (returns [] past the guard).
Add `export * from './agari'` to `src/core/index.ts`.

**Verify**: `just check` green; `just test` green — specifically purity.test.ts
(the AC's standing requirement) now covers agari.ts via the glob and must pass
with the type-only `./record` import.

**Commit 1**: `T-005-01-01: agari.ts skeleton — types, arity guard, barrel export`
(May fold into commit 2 if the skeleton and search land together cleanly — the
split exists to isolate a purity-gate surprise, not as ceremony.)

## Step 2 — the standard-form backtracker

`countsOf`, `searchSets` (lowest-kind-first, triplet/run branches, suit-block
boundary guard, mutate-recurse-restore, unique-by-construction),
`standardDecompositions` (pair loop in TILE_KINDS order), wired into
`decomposeAgari`. Document the frozen result ordering.

**Verify**: `just check`; quick inline sanity via a scratch vitest run or node
eval — 123m456p789s11122z decomposes (1 way), 4-meld pair-only works, an obvious
non-win returns []. Not yet the real suite.

**Commit 2**: `T-005-01-01: standard-form counts backtracker`

## Step 3 — chiitoitsu and kokushi scans

`chiitoitsuOf` (zero melds, exactly seven kinds at count 2 — the seven-DISTINCT-
pairs rule in the doc), `kokushiOf` (zero melds, 13 terminal/honor kinds all
present, exactly one duplicated), appended to the result in the frozen order
standard → chiitoitsu → kokushi.

**Verify**: `just check`; inline sanity: a chiitoitsu hand, a kokushi hand, the
ryanpeikou dual-form shape returns 2+ entries with both forms present.

**Commit 3**: `T-005-01-01: chiitoitsu + kokushi forms`

## Step 4 — test suite part 1: reference oracle + fixtures

`src/core/agari.test.ts`: header comment, the positional brute-force reference
(`referenceDecompositions` + normalize/dedupe), `referenceChiitoitsu`,
`referenceKokushi`, and the deterministic fixture blocks from structure.md §test:
special forms (positive/negative per AC), multiplicity (111222333m exact list,
derivation in comment), ryanpeikou dual-form, 4-meld pair-only, contract block
(RangeError messages, purity, result order).

The reference is written from the rules in design.md D6 — NOT by eyeballing
module output. Fixture expected values that are decomposition lists get a
derivation comment (drive.test.ts anchor precedent).

**Verify**: `just test` — fixtures green; intentionally break the module (local,
uncommitted — e.g. drop the run branch) and confirm fixtures fail, then restore
(cheap oracle-validity check).

**Commit 4**: `T-005-01-01: agari fixtures + brute-force reference oracle`

## Step 5 — test suite part 2: generators + agreement properties

fc generators (meld count 0–4, fabricated Meld literals, constructive winners
under the 4-copy mask, random multiset draws, single-tile perturbations) and the
agreement properties: full normalized-set equality vs the reference on winners,
random hands, and perturbed winners; winners assert non-emptiness (anti-vacuity)
and re-expansion to the input counts; special-form random agreement vs the two
reference scans.

**Runtime budget**: the positional reference is exponential-ish at n=14; pick fc
numRuns per property (explicit, commented) to keep the whole suite comfortably
inside the repo's ~1s test culture — target < 3s added, measured, tuned before
commit. If the 14-tile random case is the hog, constrain its numRuns hardest; the
constructive-winner property is the one that must stay dense.

**Verify**: `just test` full suite green; run twice for flake surface; `just
check` green.

**Commit 5**: `T-005-01-01: property suite — decomposer vs brute-force reference`

## Step 6 — final pass

Re-read agari.ts docs against what got built (contract comments drift during
implementation); confirm barrel order; `just test` + `just check` one last time;
verify AC line by line: property suite w/ 0–4 melds ✓, chiitoitsu/kokushi
positive+negative fixtures ✓, purity.test.ts green with barrel export ✓. Commit
any doc-comment tidy-up with the review artifact.

**Commit 6** (with review.md): `T-005-01-01: RDSPI artifacts`

## Testing strategy summary

- **Unit/fixture**: special forms, multiplicity, contract guards, ordering,
  purity — deterministic, derivation-commented.
- **Property**: decomposition-set agreement with a structurally different oracle
  across constructed winners / random hands / near-misses, meld arity 0–4.
- **Integration**: none — the module has no fold coupling yet by design;
  T-005-02-01 owns wiring it into record.ts and its integration surface.
- **Out of scope**: waits, yaku, winning-tile identity, shanten, performance
  beyond the suite budget.

## Risks / watchpoints

- Reference-oracle bugs mirror-imaging module bugs: mitigated by writing it from
  the rules, the break-one-branch check in step 4, and hand-derived fixtures that
  bind BOTH implementations to externally-computed expected lists.
- Suit-block boundary (9m→1p run leak) — covered by a dedicated fixture; the
  contiguous-kind-index trick is the one place the counts encoding can lie.
- fc generator validity (4-copy cap violations) — winners generated by masked
  choice, never rejection-heavy filtering; a generator self-test asserts produced
  hands respect the cap.
- Test runtime blowup from the exponential reference — explicit numRuns with a
  measured budget (step 5).
