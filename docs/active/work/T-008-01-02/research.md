# Research — T-008-01-02 han-values-and-dora-counting

## Ticket restated

The han half of scoring: attach a han value to every name in the yaku catalog
(`YakuName`, `src/core/yaku.ts`) and the yakuman catalog (`YakumanName`,
`src/core/yakuman.ts`), with open/closed variants where standard rules differ
(sanshoku-doujun, ittsuu, chanta, junchan, honitsu, chinitsu drop han when
open). Count dora + kan-dora (every flipped indicator, in `TableState.doras`)
into han, added per physical copy held. The ticket is explicit: this is a
scoring-SIDE table, exported from `src/core/`, and it must not change
`yaku.ts`'s name-only API contract — `standardYakuOf`/`yakuOf` keep returning
bare names, never han. No fu (T-008-01-01, done), no points/payment tables
(T-008-01-03), no property grid (T-008-01-04).

## What exists today

### The name catalogs (no han anywhere)

- `src/core/yaku.ts` — `YakuName` union (26 names), `STANDARD_YAKU_NAMES`
  frozen array in catalog order, `WinContext` (one decomposition + melds +
  circumstance), `standardYakuOf(ctx): YakuName[]`. Predicates are boolean
  only; the module comment states han/fu "belong to the scoring epic and
  appear nowhere in this API."
- `src/core/yakuman.ts` — `YakumanName` union (10 names), `YAKUMAN_NAMES`
  frozen array, `WinYakuName = YakuName | YakumanName`, `Win` interface (whole
  win: concealed kinds INCLUDING the winning tile, melds, source, lastTile,
  seatWind, roundWind — pre-reading, unlike WinContext), and `yakuOf(win):
  WinYakuName[]` — THE aggregator. Three frozen conventions live here: (1) the
  ONE-YAKU WIN GATE — `[]` means the completion carries no yaku and callers
  must refuse the win; (2) yakuman supersedes — any yakuman hit returns ONLY
  yakuman names; (3) yakuman stack — every satisfied yakuman is listed. No han
  anywhere; the module comment explicitly defers han valuation.
- `src/core/fu.ts` (T-008-01-01, done) — `fuOf(ctx: WinContext): number`. Pure
  read over ONE `WinContext`, no han, no yaku names, no points. This is the
  sibling module and the closest structural precedent for -02: same input
  shape idiom, same "one reading, aggregation is a later caller's job"
  stance, same private-helper-duplication style (`isMenzen`,
  `isTsumoSource`/`isTsumo`, `DRAGON_KINDS` each redefined locally rather than
  exported and shared).

### Openness (menzen) determination

Both `yaku.ts` and `fu.ts` independently define:
```ts
function isMenzen(melds: readonly Meld[]): boolean {
  return melds.every((meld) => meld.type === 'ankan')
}
```
Neither exports it. This is the established pattern for this codebase: small
derived facts are recomputed locally in each consuming module rather than
shared through an exported helper. A han module needs the same fact for the
six yaku whose han value depends on openness.

### Dora mapping and flipped indicators

- `src/core/dora.ts` — `doraKindOf(indicator: TileKind): TileKind`, the pure
  cycle-successor mapping (suit ranks wrap 9→1, winds E→S→W→N→E, dragons
  haku→hatsu→chun→haku). Kind-level only.
- `src/core/record.ts`'s `TableState` holds `doraIndicator: TileId` (the
  first flip), `dora: TileKind` (its mapped kind), `doraIndicators: TileId[]`
  (every flip in order, `[0]` = the initial one, one more per kan — kan-dora),
  and `doras: TileKind[]` (the mapped kind of every flip, same order,
  parallel array). So "dora + kan-dora" is already unified as one list —
  `state.doras` — by the time any hand ends; there is no separate "kan-dora"
  concept downstream of the fold, just more entries in `doras`. Ura-dora does
  not exist: riichi is not yet in the action vocabulary (`yaku.ts`'s header
  comment says the riichi family is "deliberately absent" until a riichi
  declaration exists), so there is nothing to flip face-down and no ura-dora
  fact to count. This ticket's dora counting is therefore just "count `doras`
  against the hand," not "count `doras` + conditionally `ura`."

### The whole-hand tile multiset, with multiplicity

Two independent private helpers already do this scan, once per module:
- `yaku.ts`'s `allKinds(ctx: WinContext): TileKind[]` — walks one
  `AgariDecomposition` (pair doubled, each concealed set expanded, meld tiles
  including the claimed tile / all four kan copies) into a flat kind list
  with multiplicity. Used by `tanyao`, `honroutou`, `honitsu`, `chinitsu`.
- `yakuman.ts`'s `allKindsOf(win: Win): TileKind[]` — walks `win.concealed`
  (already flat, includes the winning tile) plus meld tiles the same way.
  Used by the whole-hand yakuman predicates (`daisangen`, `tsuuiisou`, etc.)
  via `countOf(kinds, kind)`.

Dora counting needs exactly this shape: a flat kind multiset for the whole
14-tile hand (concealed + calls), counted against each flipped dora kind.
`allKindsOf`'s shape (pre-reading, from `Win.concealed` + melds) is the
better fit — dora counting never needs to pick a decomposition/reading, only
the raw multiset, so it should not depend on `WinContext`/`AgariDecomposition`
at all. `countOf(kinds, kind)` (linear scan, ≤18 tiles) is already the
established idiom in `yakuman.ts` for exactly this "how many copies of X"
question, not exported.

### Where a caller will assemble the inputs (not this ticket's job, but shapes what "table" must accept)

`record.ts`'s `applyWinTail` (the only current call site of `yakuOf`) builds
a `Win`-shaped object at line ~640 from `state.hands[winner]`,
`state.melds[winner]`, and the winning tile, and stores the returned
`WinYakuName[]` as `state.win.yaku`. It does NOT currently touch `state.doras`
for scoring purposes (no scoring exists yet). T-008-01-03 (payment tables,
depends on -01 and -02) is presumably the first caller that will assemble
name→han + dora count into a total han and feed fu.ts + this ticket's output
into the payment formula. This ticket does not need to wire into `record.ts`
at all — it is a standalone, exported, pure module, like `fu.ts` was for
T-008-01-01 (T-008-01-01's review confirms it added `fu.ts` without touching
`record.ts`).

### Barrel export

`src/core/index.ts` re-exports every module with `export * from './X'`, most
recently `fu.ts` (T-008-01-01's second commit, "Barrel-export fu.ts"). Module
order in the barrel roughly follows dependency order but ESM makes actual
order irrelevant to correctness; `fu.ts` was appended last. A new `han.ts`
module will be appended the same way.

### Test conventions

`fu.test.ts` and `yaku.test.ts` both build `WinContext` fixtures through the
REAL `decomposeAgari` (never hand-typed `AgariDecomposition` literals) via a
local `ctxOf(spec, overrides)` helper, an `h(spec)` mpsz-shorthand parser
(`'123m55z'` → kind array), and small `Meld` builders (`chi`, `pon`,
`daiminkan`, `shouminkan`, `ankan`) using the real `tileId`. `yakuman.test.ts`
has the same idiom but builds `Win` objects (`winOf`) instead of `WinContext`,
since `yakuOf` takes the pre-reading shape. Every expected number is derived
in a comment from the standard rule table, never reverse-engineered from a
first run (explicit convention, stated in both file headers). Whichever shape
`hanOf`/the dora counter take, the test file should reuse this same idiom
rather than inventing a new one.

## Constraints and assumptions surfaced

- **No riichi, no ura-dora, no red fives.** `TileKind` has no red-five variant
  (checked: `NumberedKind`/`HonorKind` in `tiles.ts` are plain rank+suit, no
  aka flag) — dora counting is indicator-cycle dora and kan-dora only, exactly
  as the ticket says ("all flipped indicators"). Confirmed no aka-dora
  concept exists anywhere in the codebase today.
- **Yakuman han values are needed too** (AC: "incl. yakuman"), but yakuman
  pricing conventionally bypasses han×fu entirely (fixed multiples of the
  base unit). The ticket still wants a han number attached to each yakuman
  name — standard single-yakuman value is 13 han flat, independent of
  openness (openness is not even a yakuman concept — `chuuren-poutou`
  requires zero melds by definition, others don't care). Double-yakuman
  variant naming (13-wait kokushi, suuankou tanki, junsei chuuren) is
  deliberately deferred in `yakuman.ts`'s header comment ("can land
  additively... once the scoring epic decides") — this ticket does not need
  to resolve that; every yakuman is single-value 13 han here.
- **The one-yaku win gate already lives upstream**, entirely inside
  `yakuOf`/`applyWinTail` — `[]` refusal, and dora is not even a member of
  `WinYakuName`, so it structurally cannot appear in a yaku list. This
  ticket's "yakuless dora-laden hand still cannot win" test is therefore an
  integration-style proof over the EXISTING gate (construct a hand whose
  `yakuOf` is `[]` while the new dora-counting function returns > 0 for the
  same hand), not a new gate this module must build.
- Per T-008-01-01's `review.md`, `just check` and `just test` are the
  verification commands; no build step is required for a core-only change.
