# T-005-01-04 — yakuman-and-yaku-gate — Structure

The file-level blueprint for design.md's decisions. Two new files, one
appended barrel line; nothing else touched.

## Files

| File | Change | Content |
|---|---|---|
| `src/core/yakuman.ts` | NEW (~230 lines) | YakumanName, YAKUMAN_NAMES, Win, WinYakuName, ten private predicates, yakuOf |
| `src/core/yakuman.test.ts` | NEW (~330 lines) | fixture helpers, total per-yakuman table, aggregator contract suite |
| `src/core/index.ts` | +1 line | `export * from './yakuman'` appended after `./yaku` |

`src/core/yaku.ts`, `agari.ts`, `tiles.ts`, `record.ts` are consumed
read-only. No app/ change (the aggregator's consumers are S-005-02
tickets). purity.test.ts sweeps core modules generically — verify it picks
the new file up, no edit expected.

## Module: src/core/yakuman.ts

Header comment: the module's charter — the yakuman catalog reachable without
riichi plus THE aggregator (win → yaku name list); states the three
conventions the AC wants documented in the module: (1) the one-yaku win
gate — `[]` from yakuOf is the refusal signal consumers must honor, (2)
yakuman supersede standard yaku entirely, (3) multiple yakuman stack. Also
records the exclusions (tenhou/chiihou need first-turn state that does not
exist; double-variant names are additive scoring-epic widenings) mirroring
yaku.ts's riichi-family paragraph.

### Imports

- from `./tiles`: `isHonor`, `isTerminal`, `kindOf`, `rankOf`, `suitOf`,
  `type TileKind`
- from `./agari`: `decomposeAgari`, `type AgariDecomposition`
- from `./record`: `type Meld`
- from `./yaku`: `STANDARD_YAKU_NAMES`, `standardYakuOf`,
  `type WinContext`, `type WindKind`, `type YakuName`

No DOM/platform imports (purity invariant). yakuman.ts imports yaku.ts,
never the reverse.

### Internal organization (top to bottom)

1. **`YakumanName`** — 10-literal union in catalog order: `'kokushi'`,
   `'suuankou'`, `'daisangen'`, `'shousuushii'`, `'daisuushii'`,
   `'tsuuiisou'`, `'chinroutou'`, `'ryuuiisou'`, `'chuuren-poutou'`,
   `'suukantsu'`. ('kokushi' matches the decomposition form's spelling.)
2. **`YAKUMAN_NAMES`** — frozen readonly array, same order (the
   STANDARD_YAKU_NAMES pattern; doc: iterated by the test table and the
   teaching glossary).
3. **`WinYakuName`** — `YakuName | YakumanName`, the fold's record-side
   name type.
4. **`Win`** — interface per design D3, field docs matching WinContext's
   where shared (concealed INCLUDES the completing tile; melds; winningKind;
   source; lastTile; seatWind; roundWind).
5. **Multiset helpers** (private):
   - `allKindsOf(win): TileKind[]` — concealed kinds ++ meld tile kinds via
     kindOf (ankan: own only has all four; open melds: claimed + own). Same
     four-copies-per-kan caveat comment as yaku.ts's allKinds.
   - `countOf(kinds, kind): number` — occurrences of one kind (used by
     daisangen/suushii; a Map-free linear count is fine at 14–18 tiles).
6. **The ten predicates** (private), each `(win, readings, kinds) =>
   boolean` where `kinds` is the precomputed multiset — signature uniform so
   the table stays homogeneous; predicates ignore arguments they don't need
   (the -03 style). Order = catalog order. Each carries its rule + fixed
   convention doc:
   - `kokushi`: `readings.some(form === 'kokushi')`.
   - `suuankou`: `readings.some(standard ∧ melds all ankan ∧ sets all
     triplets ∧ (source wall/rinshan ∨ winningKind === pair))`. Comment: the
     ron-demotion and why no run-absorption case exists here.
   - `daisangen`: 5z/6z/7z each ≥3 in `kinds`. Comment: honors never run, so
     ≥3 copies in a WIN is necessarily a triplet-class set.
   - `shousuushii`: exactly 3 of 1z–4z ≥3 ∧ the remaining wind exactly 2.
   - `daisuushii`: all of 1z–4z ≥3.
   - `tsuuiisou`: every kind isHonor.
   - `chinroutou`: every kind isTerminal.
   - `ryuuiisou`: every kind ∈ GREEN_KINDS (`2s 3s 4s 6s 8s 6z`, a private
     frozen const beside the predicate; hatsu-optional convention doc).
   - `chuurenPoutou`: zero melds ∧ one numbered suit, no honors ∧ rank
     counts ≥[3,1,1,1,1,1,1,1,3]. Comment: ankan breaks the form.
   - `suukantsu`: melds.filter(kan).length === 4.
7. **`YAKUMAN` table** (private) — `{ name, test }[]` in catalog order, the
   STANDARD_YAKU pattern.
8. **`yakuOf(win: Win): WinYakuName[]`** — the module's face. Contract doc:
   gate semantics, supersession, stacking, union-across-readings (with the
   ryanpeikou/chiitoitsu example), result order, purity, RangeError cases.
   Body:
   1. `decomposeAgari(win.concealed, win.melds)` (its arity guards pass
      through); empty ⇒ RangeError "not a winning hand".
   2. Guard: `win.concealed.includes(win.winningKind)` else RangeError.
   3. `kinds = allKindsOf(win)`; filter YAKUMAN → names. Nonempty ⇒ return
      (already catalog-ordered by table order).
   4. Union: for each reading, `standardYakuOf({ decomposition, melds:
      win.melds, winningKind, source, lastTile, seatWind, roundWind })` into
      a Set; return `STANDARD_YAKU_NAMES.filter(set.has)` (canonical order
      without a sort).

## Test module: src/core/yakuman.test.ts

Imports everything through `./index` (the yaku.test.ts precedent). Header:
per-yakuman rigor + the gate/supersession conventions, expected values
derived from rules in comments.

1. **Helpers** — `h(spec)` mpsz parser, `chi/pon/daiminkan/shouminkan/ankan`
   meld builders: copied from yaku.test.ts (test-side sugar; ~60 lines;
   duplication accepted — a shared test-util file is a refactor neither
   ticket owns, and -03's file is closed). New `winOf(spec, overrides)`
   builder: assembles a `Win` (defaults mirroring ctxOf: wall source,
   mid-hand, East/East, winningKind = first tile of spec) and asserts via
   isAgari that the fixture IS a win — typos fail loudly. Unlike ctxOf, no
   `pick`: the aggregator's whole job is all readings.
2. **`CASES: Record<YakumanName, { positive: Win; negative: Win }>`** —
   total by type; each negative a near-miss that still wins (design D7
   list). Derivation comments per entry.
3. **`describe('yakuOf per-yakuman cases')`** — meta-test (keys ≡
   YAKUMAN_NAMES, 10 distinct, frozen, disjoint from STANDARD_YAKU_NAMES);
   for each name: positive `toContain(name)`, negative `not.toContain(name)`.
4. **`describe('yakuOf gate and supersession')`** — yakuless open completion
   → `[]` exactly; suuankou tsumo hides menzen-tsumo/toitoi/sanankou;
   ron-demoted suuankou hand answers standard names (sanankou+toitoi
   visible, no yakuman); daisuushii+tsuuiisou+suuankou stack as an exact
   YAKUMAN_NAMES-order list; kokushi hand → `['kokushi']` exactly.
5. **`describe('yakuOf union across readings')`** — the ryanpeikou/
   chiitoitsu shape: exact catalog-order list containing both; a
   single-reading hand for the plain order contract.
6. **`describe('yakuOf contract')`** — purity (snapshot, repeat-call
   equality, fresh array); RangeError on not-a-win, on winningKind absent
   from concealed, and decomposeAgari's arity throw passing through.

## Ordering of changes

1. `yakuman.ts` types + helpers + the eight multiset/meld predicates +
   kokushi/suuankou + table + yakuOf, barrel line — the module compiles and
   is importable in one commit.
2. `yakuman.test.ts` complete suite — second commit. (Two commits, not
   three: unlike -03's 27 predicates, ten predicates + one aggregator do not
   warrant a split module landing.)

Each commit leaves `just test` and `just check` green.
