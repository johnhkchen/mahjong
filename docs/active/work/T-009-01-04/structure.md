# Structure: T-009-01-04 riichi-property-suite

No new files, no production code files touched. Two test files modified:
`src/core/dynamics.test.ts`, `src/core/legal.test.ts`. No changes to `record.ts`,
`legal.ts`, `settlement.ts`, `game.ts`, or any other `src/core/` module (design.md's
Decision D — the mechanic is complete; this ticket adds coverage only, unless
Implement surfaces a real bug, documented as a deviation if so).

## `src/core/dynamics.test.ts`

Insertion points, in file order (no existing code moves or is deleted):

1. **Imports** (top of file, existing `import { ... } from './index'` block): add
   `kindOf`, `scoreBreakdownOf`, `shanten`. `createRng`/`nextInt`/`foldRecord`/
   `legalActions`/`SEAT_COUNT` already imported.

2. **New driver + corpus**, placed immediately after the existing `winCorpus`
   definition (line ~205, before the `allZones`/`expectConserved` helpers) — keeps
   all three "eager driver + frozen corpus" blocks (`playGreedy`/`greedyCorpus`,
   `playWinEager`/`winCorpus`, `playRiichiEager`/`riichiCorpus`) adjacent, matching the
   file's existing grouping:
   - `bestDiscardOf(state, offers, rng)` — the shanten-minimizing mechanical tie-break
     (design.md).
   - `playRiichiEager(seed)` — the driver (design.md).
   - `RIICHI_CORPUS_SEEDS` (contiguous `[0, 30)`, design.md's Decision E) and
     `riichiCorpus` (module-scope, eagerly built — the `greedyCorpus`/`winCorpus`
     precedent).

3. **Widen `anyGameArb`** (existing line ~325): add
   `riichiCorpusGameArb = fc.nat(riichiCorpus.length - 1).map((i) => riichiCorpus[i])`
   beside the existing `corpusGameArb`, and add it as a third arm of
   `fc.oneof(gameArb, corpusGameArb, riichiCorpusGameArb)`. This single edit is what
   gives clause 4 (determinism) to the existing `'fold determinism over random play'`
   test for free, and strengthens every existing mutation property in
   `'mutated sequences throw'` for riichi actions specifically — no other edit needed
   in that describe block except the new operator below.

4. **New describe block** `'riichi over random play (T-009-01-04)'`, placed after the
   existing `'wins over random play'` describe block (keeps the four "describe over a
   named corpus" blocks — conservation, termination, wins, riichi — grouped in the
   order the corpora were introduced) and before the "dead-wall exhaustion anchors"
   section comment banner:
   - `it('the riichi-eager corpus reaches real declarations, both endings, within the
     action bound')` — clause 5 (non-vacuity + termination), the `greedyCorpus`
     combined-assertion shape.
   - `it('every locked seat's own discard equals its drawn tile, read from the prior
     fold (property over the corpus)')` — clause 1.
   - `it('scores plus the carried pot conserve to 4 x STARTING_SCORE at every corpus
     ending, restated from game.ts's own carry rule (property over the corpus)')` —
     clause 2.

5. **New mutation operator** in the existing `describe('mutated sequences throw', ...)`
   block, placed after the existing `'uses retarget'` test and before `'stale claim'`
   (keeps the "rewrite one field of a real action" operators — tile retarget, uses
   retarget, riichi retarget — adjacent; stale claim/duplicate/append are a
   structurally different kind of mutant, sequence-position rather than field-rewrite):
   - `it('riichi retarget: a discard turned into a riichi declaration outside the
     offered set throws (property)')` — clause 3b, over the now-widened `anyGameArb`.

6. **Widen two existing `menu` literal arrays** (design.md's 3b, the "action after the
   end" gap): `'append after ryuukyoku'` (the `fullGameArb`-based test, line ~610) and
   `'after a win nothing is offered and every action form throws'` (the win-corpus
   test, line ~680) each gain one more `{ type: 'riichi', seat, tile }` entry in their
   `menu` array. Both tests already loop `menu` generically — no other line changes.

## `src/core/legal.test.ts`

1. **Imports**: add `createRng`, `nextInt`, `scoreBreakdownOf`? — NOT needed here
   (this file only walks corpus prefixes for the folds-agreement check, no scoring
   assertions). Actually needed: `createRng`, `nextInt`, `kindOf`, `shanten` (for the
   duplicated driver) — `foldRecord`/`legalActions`/`SEAT_COUNT`/`HandAction`/
   `HandRecord`/`Seat`/`TableState`/`TileId` already imported.

2. **New driver + small corpus**, duplicated/trimmed from `dynamics.test.ts`'s copy
   (design.md's Decision B — no shared import), placed after the file's existing
   `ANCHORS` array and before `describe('the set is the closed form', ...)` — this
   file's existing convention groups all corpus/fixture data before the first
   `describe`:
   - `bestDiscardOf` + `playRiichiEager` — identical logic to `dynamics.test.ts`'s
     copy (trimmed: this file's copy does not need to distinguish call-point
     arbitration beyond ron-first-else-rng, same as the source).
   - `RIICHI_AGREEMENT_SEEDS` (contiguous `[0, 16)` — design.md's smaller-corpus call,
     since this file's new test is `O(n²)` per record; widened from an initial `[0,
     12)` plan after scratch validation showed too few riichi-bearing seeds there —
     see progress.md) and `riichiAgreementCorpus`.

3. **New test**, appended to the existing `describe('offered actions fold', ...)`
   block (after `'every offered action folds at each frozen claim/kan anchor'`):
   - `it('every offered action folds, over every prefix of the riichi-eager corpus
     (property)')` — clause 3a, the exact shape design.md specifies.

## Ordering rationale (why Implement can commit these as two atomic units)

The two files' changes are independent of each other (no shared symbol, no import
between them) and each internally ordered so that earlier insertions (driver/corpus,
`anyGameArb` widening) are prerequisites for later ones (new describe block, new
mutation operator) within the SAME file. This makes a natural two-commit split:

1. `dynamics.test.ts`: driver + corpus + `anyGameArb` widening + new describe block +
   new mutation operator + widened menus — one coherent unit (clauses 1, 2, 3b, 4, 5).
2. `legal.test.ts`: duplicated driver + corpus + one new test — one coherent unit
   (clause 3a).

Either commit alone leaves `just test` green (each file's new code is additive; commit
1 does not depend on commit 2 or vice versa) — satisfying the RDSPI "each step small
enough to commit atomically" plan requirement without forcing a single-file diff.
