# T-006-02-01 — standard-form-shanten — Structure

File-level blueprint for the design's block-count backtracker. Shapes, not code.

## 1. File inventory

| File                       | Change   | Content                                       |
| -------------------------- | -------- | --------------------------------------------- |
| `src/core/shanten.ts`      | **new**  | the standard-form shanten module              |
| `src/core/shanten.test.ts` | **new**  | pinned-fixture suite                          |
| `src/core/index.ts`        | modified | one line: `export * from './shanten'`         |

Nothing else moves. No app files, no knowledge docs, no changes to agari/waits
(the shared-countsOf cleanup was explicitly rejected in design §4.4).
`purity.test.ts` picks the new module up automatically via its `src/core/*.ts`
glob — no edit needed there.

## 2. `src/core/shanten.ts` — internal organization

Order within the file (the agari.ts layout: header comment, imports, private
helpers lowest-level-first, public face last):

### 2.1 Header comment

The module's charter, in the established voice: standard-form shanten as the
block-count maximum; kind-level shape distance; melds read for ARITY ONLY (the
agari precedent, contrasted with waits' content reading); exhaustion deliberately
out of scope with a pointer to waits' convention and T-006-02-03's
reconciliation; the plain `shanten` name reserved for T-006-02-02's combinator;
consumers named (discard policy, teaching prompts, the -02 combinator).

### 2.2 Imports

```
import { KIND_COUNT, kindIndexOf, type TileKind } from './tiles'
import type { Meld } from './record'
```

Nothing else. No value import from record (Meld is type-only — arity reading).

### 2.3 Private helpers and constants

- `countsOf(concealed): number[]` — fresh 34-slot kind-count array; the third
  private copy, one-line comment naming the agari/waits precedent.
- `MAX_MELDS = 4` — the ceiling constant, same name as agari/waits.
- `bestValue(counts, from, blocksLeft, headFree): number` — the backtracker.
  Signature notes:
  - `counts` — borrowed, mutate-recurse-restore, restored on every exit path.
  - `from` — lowest kind index not yet resolved; the function first skips zero
    counts (the searchSets skip-scan).
  - `blocksLeft` — remaining set+partial slots (`4 − melds` at the root); a set
    and a partial spend the same slot, worth 2 vs 1.
  - `headFree` — whether the reserved head pair is still unclaimed.
  - Returns the max of `2·sets + partials + head` reachable from this state.
  - Branches at the first nonzero kind k, in this order (advance last, so the
    highest-value extractions are explored first for prune effectiveness):
    1. triplet (`counts[k] ≥ 3`, `blocksLeft > 0`) — +2, recurse same k
    2. run (`blocksLeft > 0`, `k < 27`, `k % 9 ≤ 6`, both successors ≥ 1) — +2,
       recurse same k
    3. head pair (`counts[k] ≥ 2`, `headFree`) — +1, recurse same k, head spent
    4. partial pair (`counts[k] ≥ 2`, `blocksLeft > 0`) — +1, recurse same k
    5. adjacent proto-run (`blocksLeft > 0`, `k < 27`, `k % 9 ≤ 7`,
       `counts[k+1] ≥ 1`) — +1, recurse same k
    6. gapped proto-run (`blocksLeft > 0`, `k < 27`, `k % 9 ≤ 6`,
       `counts[k+2] ≥ 1`) — +1, recurse same k
    7. advance — leave remaining copies at k as floaters, recurse k+1, no cost
  - Prune: an upper bound `current + 2·blocksLeft + (headFree ? 1 : 0)`; the
    implementation threads the running best (module-local via an object or a
    small closure — implementer's choice, but no module-level mutable state may
    survive a call: purity requires reentrancy).
  - Exhaustiveness invariant, stated in its doc comment: every extractable shape
    is anchored at its lowest kind, so branching only shapes anchored at k and
    advancing past k once no branch remains loses nothing — the searchSets
    argument, extended from {triplet, run} to the six block shapes.

### 2.4 Public face

```
export function standardShanten(
  concealed: readonly TileKind[],
  melds: readonly Meld[],
): number
```

Doc comment carries the contract (the decomposeAgari/waits template):

- Semantics: minimum exchanges to a standard-form win structure; −1 complete,
  0 tenpai, positive otherwise; formula named.
- Accepted arities: `13 − 3·melds` (between turns) or `14 − 3·melds` (holding a
  draw); anything else throws RangeError naming BOTH accepted counts and the got
  count; melds > 4 throws RangeError (messages pinned by tests verbatim).
- Melds arity-only; kind values trusted (compile-time union, log-parser boundary
  rule from tiles.ts).
- Pure read: no mutation, deterministic, fresh derivation per call.

Body shape: guards → `countsOf` → `8 − 2·melds.length − bestValue(counts, 0,
4 − melds.length, true)`.

No other exports. `ConcealedSet`-like structural output is deliberately absent —
shanten is a number; decomposition readings belong to agari.ts.

## 3. `src/core/shanten.test.ts` — suite organization

Header comment: fixtures with rule-derived expected values (the waits.test.ts
discipline — expectations argued in comments from the rules, never from module
output); properties deferred to T-006-02-03 by ticket design.

Test-local helpers (re-declared per suite, per house convention):

- `h(spec)` — the mpsz shorthand, copied from waits.test.ts.
- `FAKE_MELDS`-style arity stubs (the agari.test.ts pattern) — shanten reads
  arity only, so stub melds with arbitrary ids are honest here; a comment says
  exactly that, citing the agari.test.ts precedent.

Describe blocks:

1. **`complete hands`** — 14-tile complete → −1 (a standard winner); 4 melds +
   pair (2 tiles) → −1; kan-bearing arity note covered by a meld-count case.
2. **`tenpai hands (shanten 0)`** — ryanmen, tanki, shanpon 13-tile classics;
   4-melds lone tile; 14-tile hand one discard from tenpai... (a 14-tile hand
   that CONTAINS a tenpai 13 is shanten 0 — pinned explicitly).
3. **`n-shanten ladders`** — a pinned 1-shanten (e.g. complete hand with one set
   broken into a partial + floater), a 2-shanten, and the AC's scattered-13
   worst case `147m147p147s` + four distinct honors → 8.
4. **`meld discount`** — the same concealed remainder scored at 0/1/2 melds
   showing required sets shrink: e.g. concealed `23m456p789s55z` + 1 meld → 0,
   versus the meldless 13-tile completion of the same shape.
5. **`head vs partial-pair tension`** — shapes where the only pair must serve as
   head (not partial) and vice versa; the exactness edges from design §4.5,
   each with the decomposition argued in the comment.
6. **`contract`** — RangeError messages verbatim (wrong arity at 0 and 2 melds,
   naming both accepted counts; 5 melds); purity (inputs unmutated, repeated
   calls identical); both-arity acceptance.

## 4. `src/core/index.ts`

`export * from './shanten'` inserted after `'./waits'` — the barrel lists
modules in dependency-ish order (tiles → … → agari → waits → yaku); shanten
sits with its hand-reading kin.

## 5. Ordering of changes

1. `shanten.ts` (module) — compiles standalone.
2. `index.ts` barrel line — makes it public.
3. `shanten.test.ts` — pins the contract.

One commit is honest for this size (module + barrel + tests land as a unit; the
plan may split test authoring for verification but the tree stays green at each
commit). Commit scope stays off the lisa-managed ticket frontmatter files.

## 6. Interfaces this creates for the siblings

- T-006-02-02 extends `shanten.ts` in place: adds chiitoi/kokushi counters and
  the `shanten` combinator export; `standardShanten` stays exported (its AC
  compares forms explicitly, so it needs the parts visible).
- T-006-02-03 imports `standardShanten`/`shanten` and builds its OWN probe-BFS
  reference test-side (design §2.B); nothing here should leak search internals
  that would tempt reuse — only the number crosses the module face.
- T-006-03-01 (policy) reads the barrel export; both arities available as
  designed.
