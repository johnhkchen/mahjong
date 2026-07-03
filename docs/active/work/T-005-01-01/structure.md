# T-005-01-01 — agari-decomposition — Structure

The shape of the code. Two new files, one barrel line; nothing else moves.

## Files

| File | Change |
|---|---|
| `src/core/agari.ts` | NEW — the decomposer module (~170 lines with docs) |
| `src/core/agari.test.ts` | NEW — property suite + fixtures (~350 lines) |
| `src/core/index.ts` | MODIFIED — `export * from './agari'` after `./legal` |
| everything else | untouched (record.ts/legal.ts/deal.ts closed for this ticket) |

## src/core/agari.ts — internal organization

Order within the file (core convention: role comment, types, private helpers,
public functions last):

1. **Module role comment** — "the pure predicate everything else in E-005 stands
   on": concealed kinds + melds in, every distinct decomposition out; empty list ⇔
   not a win; kind-level deliberately (copies never affect shape); melds read for
   arity only; consumed by waits/yaku/the win fold.

2. **Imports** — `import { TILE_KINDS, kindIndexOf, ... type TileKind } from
   './tiles'` and `import type { Meld } from './record'`. Nothing else, ever
   (purity gate). Expected value imports: `TILE_KINDS`, `kindIndexOf`, `KIND_COUNT`
   plus whatever classifier reads the special forms need (terminal/honor kinds may
   be cheaper as a local frozen list of the 13 kind indices — decided at
   implementation, either is purity-legal).

3. **Public types** (exported, all-readonly like HandAction/Meld):
   - `ConcealedSet = { type: 'run'; start: TileKind } | { type: 'triplet';
     kind: TileKind }` — run = start, start+1, start+2 in start's suit. Doc note:
     this describes CONCEALED sets only; meld sets live on the caller's Melds.
   - `AgariDecomposition =` union of
     `{ form: 'standard'; pair: TileKind; sets: readonly ConcealedSet[] }`,
     `{ form: 'chiitoitsu'; pairs: readonly TileKind[] }`,
     `{ form: 'kokushi'; pair: TileKind }`.
     Doc carries the form rules: sets.length = 4 − melds; chiitoitsu = seven
     DISTINCT pairs (four-of-a-kind is not two pairs), zero melds; kokushi = the 13
     terminal/honor kinds + one duplicate (`pair`), zero melds; ryanpeikou shapes
     yield standard AND chiitoitsu entries.

4. **Private helpers**:
   - `countsOf(concealed: readonly TileKind[]): number[]` — fresh 34-slot counts
     array via kindIndexOf. (No 4-copy validation: kinds are trusted per the
     TileId-rule precedent; the wall makes >4 unreachable from real folds.)
   - `searchSets(counts: number[], remaining: number, from: number, acc:
     ConcealedSet[], out: ConcealedSet[][]): void` — the backtracker. Resolves the
     lowest nonzero kind index ≥ `from`; branches: triplet (count ≥ 3), run
     (numbered suit, rank ≤ 7, successors present — contiguous kind indices within
     a suit block, guarded by the block boundary so 9m never runs into 1p);
     consumes via mutate-recurse-restore on the shared counts array; pushes a
     frozen copy of `acc` when `remaining` hits 0. Unique-by-construction: every
     copy of the current kind is consumed before `from` advances.
   - `standardDecompositions(counts, setCount): {pair, sets}[]` — outer pair loop
     in TILE_KINDS order wrapping searchSets.
   - `chiitoitsuOf(counts): AgariDecomposition | null`, `kokushiOf(counts):
     AgariDecomposition | null` — direct scans (D4), null when the form fails.

5. **Public functions** (last, the module's face):
   - `decomposeAgari(concealed: readonly TileKind[], melds: readonly Meld[]):
     AgariDecomposition[]` — the size/arity RangeError guard first
     (`concealed.length !== 14 − 3·melds.length` or `melds.length > 4`, message
     naming both numbers); then standard results, then chiitoitsu, then kokushi
     appended (frozen result order, documented as contract like legalActions').
     Doc states: pure read, fresh arrays, melds read for arity only, [] ⇔ no win.
   - `isAgari(concealed, melds): boolean` — `decomposeAgari(...).length > 0`,
     doc-noted as the convenience read for guards that don't need structure.

No constants exported beyond the types/functions above — 14/3/4 arithmetic stays
inline with the guard (they are the shape definition, not tunables). If a named
list of the 13 kokushi kinds is used, it stays private; -04 can lift it later if
the yakuman ticket wants it (extend-only precedent).

## src/core/agari.test.ts — internal organization

Header comment: what the suite proves (agreement with a structurally different
reference, form fixtures, purity) and why the reference is test-local (ships
nothing; "big in tests" posture). Imports: `fast-check`, `vitest`, `./index`
(barrel — test convention) or `./agari` + `./tiles`; follows dynamics.test.ts's
barrel style.

1. **Reference implementation** (test-local): `referenceDecompositions(kinds:
   readonly TileKind[], setCount): normalized sets` — positional search per D6
   (sort kinds; choose pair positions; repeatedly bind first remaining position
   with every later pair completing run/triplet; normalize + dedupe via JSON key
   set). Plus `referenceChiitoitsu`, `referenceKokushi` first-principles scans.
   `normalize(decomposition)` shared by both sides for comparison keys.

2. **Generators** (test-local, fc):
   - `meldCountArb = fc.integer({min: 0, max: 4})`.
   - `fabricatedMelds(m)` — minimal hand-built Meld literals (pon shapes with
     arbitrary distinct ids); comment: the module reads only `.length`.
   - `winningHandArb(m)` — constructive: draw (4 − m) sets + a pair as choices
     over a counts mask honoring the 4-copy cap (fc integers → deterministic
     mapping; reject/retry-free by masking exhausted choices).
   - `randomHandArb(m)` — 14 − 3m kinds drawn from the 136-tile multiset via
     fc.shuffledSubarray over allTileIds-style pool, mapped through kindOf.
   - perturbation arb: winner + one index + one replacement kind.

3. **Property blocks** (`describe` per concern):
   - `agreement with the brute-force reference` — the AC's core: constructed
     winners (m 0–4) and random hands (m 0–4), full normalized-set equality;
     winners additionally assert `length > 0` (density guard so the property
     can't pass vacuously) and every reported standard decomposition replays to
     the input multiset (sets + pair re-expand to the concealed counts).
   - `special forms` — chiitoitsu fixtures: positive, four-of-a-kind refusal,
     six-pairs-plus-triplet-refusal (that one may still be standard? no — 2·6+3
     ≠ 14; a plain negative), meld-bearing refusal; kokushi fixtures: positive
     (single-wait shape), thirteen-wait shape (each duplicate choice), near-miss
     negative (missing one honor), meld-bearing refusal; random-hand agreement
     against the two reference scans.
   - `multiplicity and overlap` — 111222333m + pair: exact expected decomposition
     list (frozen fixture, derivation in comment); ryanpeikou dual-form fixture;
     pair/triplet ambiguity fixture (e.g. 111z22z…).
   - `contract` — RangeError on wrong arity (each message asserted), 4-meld
     pair-only fixture, purity (inputs unmutated after call; two calls deep-equal),
     deterministic order fixture (asserts the documented result order literally).

## src/core/index.ts

One line appended after `export * from './legal'`:
`export * from './agari'`. Keeps the barrel's file order = dependency-ish order;
purity.test.ts needs no change (glob picks the new file up automatically; its
sanity list doesn't enumerate agari and shouldn't — it guards against empty scans,
not completeness).

## Ordering of changes

1. `agari.ts` types + decomposer + special forms (compiles standalone).
2. Barrel line (purity gate now covers the module).
3. `agari.test.ts` reference + fixtures, then generators + agreement properties.
   Test-last is safe here because the reference implementation is the oracle — it
   gets written fresh against the rules, not against the module's behavior.
4. Full `just test` + `just check` green.
