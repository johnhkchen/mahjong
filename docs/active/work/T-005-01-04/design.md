# T-005-01-04 — yakuman-and-yaku-gate — Design

Decisions for the yakuman catalog and the win-level aggregator. Grounded in
research.md: yaku.ts promised the aggregation/yakuman/gate layer to this
ticket "layered on top of this module"; T-005-02-01/-02 consume the result.

## D1. Yakuman scope: the ten shape-and-circumstance yakuman; tenhou/chiihou and double variants OUT

**In (10):** kokushi, suuankou, daisangen, shousuushii, daisuushii,
tsuuiisou, chinroutou, ryuuiisou, chuuren-poutou, suukantsu.

**Out — tenhou/chiihou:** they are facts of the deal moment (dealer's very
first draw; a non-dealer's first uninterrupted draw). Neither WinContext nor
the record vocabulary carries any first-turn/uninterrupted fact (research
§7), so including them would force a guessed widening of circumstance state
— exactly the trap -03 avoided with the riichi family. When the fold epic
can supply the fact, YakumanName widens extend-only (the HandAction
precedent). This is the concrete meaning of the ticket's "reachable without
riichi": every listed yakuman is decidable from the win itself as the engine
can express one today.

**Out — double-yakuman variant NAMES** (kokushi 13-wait, suuankou tanki,
junsei chuuren, daisuushii-as-double): valuation is the scoring epic's, and
whether this ruleset awards doubles at all is an undecided rules question.
Deferral is safe because variants can land ADDITIVELY later (a
'suuankou-tanki' name firing alongside 'suuankou', the double-wind-yakuhai
multiplicity precedent) — no reopening of the base names' semantics.

## D2. Placement: a new `src/core/yakuman.ts`, yaku.ts untouched

**Options.** (a) extend yaku.ts (~850 lines, shares private helpers);
(b) new yakuman.ts importing only public surface; (c) new module + export
yaku.ts internals.

**Decision: (b).** yaku.ts's header already frames this ticket as a layer
"on top of this module", and the standard catalog is a reviewed, closed
artifact — extending it mixes two tickets' concerns in one file. The
decisive fact from research §4: the feared helper duplication does not
materialize. Yakuman are predominantly whole-hand MULTISET facts the
aggregator's own input already carries (concealed kinds + meld kinds via
kindOf): in a legal win an honor kind held ≥3 times can only be a
triplet-class set (honors never run), so daisangen and the suushii pair
reduce to count reads; tsuuiisou/chinroutou/ryuuiisou/chuuren are pure tile
scans; suukantsu is melds-only; kokushi is already a decomposition form.
Only suuankou is per-reading, and its logic (all-triplet reading, all-ankan
melds, ron-on-tanki allowance) is simpler than yaku.ts's
concealedTripletCount because no run can absorb anything in an all-triplet
hand — a local ~10-line predicate, not duplication. So (c)'s API pollution
buys nothing and (a)'s file merge is unforced.

## D3. The aggregator input: a `Win` — concealed kinds + melds + circumstances

```ts
export interface Win {
  readonly concealed: readonly TileKind[]   // INCLUDING the completing tile
  readonly melds: readonly Meld[]
  readonly winningKind: TileKind
  readonly source: 'wall' | 'rinshan' | 'discard' | 'chankan'
  readonly lastTile: boolean
  readonly seatWind: WindKind
  readonly roundWind: WindKind
}
```

WinContext minus `decomposition`, plus the raw concealed kinds — because
aggregation across readings is precisely this ticket's job (-03 D1), the
aggregator runs decomposeAgari itself and builds one WinContext per reading
internally. The circumstance fields reuse -03's exact names and types so the
fold assembles one object and spreads it. Guards (corruption throws, the
nextInt precedent): decomposeAgari's arity RangeErrors pass through;
`winningKind` must appear among the concealed kinds (the completing tile is
concealed-side by decomposeAgari's contract) — a cheap read that catches
caller/fixture desync.

## D4. Aggregation semantics: yakuman supersede; standard yaku union across readings; `[]` is the gate's refusal; not-a-win THROWS

`yakuOf(win: Win): WinYakuName[]` where
`type WinYakuName = YakuName | YakumanName`:

1. `decomposeAgari(concealed, melds)`. Empty ⇒ **RangeError** — "what yaku
   does this win have" over a non-win is caller corruption. This keeps `[]`
   unambiguous: the AC names `[]` as the refusal signal for YAKULESS
   COMPLETIONS, and -02-01 wants corrupt win actions to "throw loudly".
   Callers asking "is this a win at all" have isAgari.
2. Evaluate the ten yakuman over (win, readings). **Any hit ⇒ return only
   the yakuman names**, in YAKUMAN_NAMES order — the yakuman-supersedes
   convention, documented in the module header (AC). Multiple yakuman STACK
   (all returned): suuankou + tsuuiisou etc. are independent facts the
   scoring epic values later; suppressing all-but-one would erase names it
   needs.
3. Otherwise return the UNION of standardYakuOf over every reading, in
   STANDARD_YAKU_NAMES order.

**Union, not best-reading.** "Best" is undefined without han (out of scope
by epic AC); any han-free proxy (yaku count) smuggles scoring in and gets it
wrong. The union is exactly the gate's question — nonempty ⇔ some reading
carries a yaku — and is deterministic and monotone. Documented consequence:
a ryanpeikou-shaped hand lists both ryanpeikou and chiitoitsu ("every yaku
some reading supports"); the scoring epic picks its single best reading
per-reading via standardYakuOf, which stays public for exactly that.

## D5. Per-yakuman semantics (conventions fixed here)

All scans below run over the whole-hand kind multiset = concealed kinds +
meld tile kinds (kindOf over Meld tiles; a kan contributes four copies —
harmless, membership/≥3 questions only, the allKinds precedent).

- **kokushi**: some reading has form 'kokushi'. (The decomposer already owns
  the shape.)
- **suuankou**: some standard reading with every meld an ankan, every
  concealed set a triplet, and (tsumo — wall/rinshan — or
  `winningKind === pair`, the tanki allowance). A ron completing a triplet
  demotes it (only 3 concealed → sanankou + toitoi territory); no run
  exists to absorb, so no favorable-attribution subtlety.
- **daisangen**: each dragon (5z/6z/7z) held ≥3 times.
- **shousuushii**: exactly three winds held ≥3 times and the fourth held
  exactly 2 (the wind pair).
- **daisuushii**: all four winds held ≥3 times. Disjoint from shousuushii by
  construction (the fourth wind cannot be both =2 and ≥3).
- **tsuuiisou**: every tile an honor. Fires over the all-honor chiitoitsu
  form too (daichiisei is not distinguished — a valuation question).
- **chinroutou**: every tile a terminal.
- **ryuuiisou**: every tile green — 2s/3s/4s/6s/8s/6z. Hatsu NOT required
  (the common modern convention; an all-green hand without 6z counts).
- **chuuren-poutou**: zero melds (even an ankan breaks the form — the
  standard convention: the nine-gates multiset must sit concealed in hand),
  all 14 tiles one numbered suit, counts ≥3/≥1/≥1/≥1/≥1/≥1/≥1/≥1/≥3 across
  ranks 1–9 (14 tiles ⇒ exactly one surplus).
- **suukantsu**: four kan melds (any mix of ankan/daiminkan/shouminkan).

Kokushi/suuankou consult readings; the other eight are multiset/meld scans —
each predicate documents its rule and convention at the definition (yaku.ts
style).

## D6. API surface

```ts
export type YakumanName = /* 10-literal union */
export const YAKUMAN_NAMES: readonly YakumanName[]   // frozen, catalog order
export type WinYakuName = YakuName | YakumanName
export interface Win { … }
export function yakuOf(win: Win): WinYakuName[]
```

Individual yakuman predicates stay module-private (-03's rejected-predicate-
objects rationale); tests assert through yakuOf membership. YAKUMAN_NAMES
feeds the total test table and the teaching UI's glossary the same way
STANDARD_YAKU_NAMES does. No han, no fu, anywhere. One appended barrel line
in index.ts.

## D7. Verification

- **Total table** `Record<YakumanName, { positive, negative }>` — compiler-
  enforced coverage of the AC's "each in-scope yakuman has positive and
  negative tests"; a meta-test pins keys ≡ YAKUMAN_NAMES ≡ 10, frozen, and
  disjoint from STANDARD_YAKU_NAMES. Negatives are near-misses that are
  STILL WINS (yakuOf throws on non-wins): ron-demoted fourth triplet for
  suuankou, shousangen for daisangen, the missing wind pair for shousuushii,
  the one 5s in the greens for ryuuiisou, the broken 1/9 count for chuuren,
  the third-kan pon downgrade for suukantsu, terminal-honor chiitoitsu for
  kokushi…
- **Aggregator contract**: supersession (a suuankou tsumo lists no
  menzen-tsumo/toitoi/sanankou — the convention test); yakuman stacking
  (daisuushii + tsuuiisou + suuankou in YAKUMAN_NAMES order, exact list);
  cross-form union (ryanpeikou shape lists ryanpeikou AND chiitoitsu, exact
  catalog-order list); yakuless completion → `[]` exactly; kokushi hand →
  `['kokushi']`; not-a-win and winningKind-not-in-hand → RangeError; purity
  (unmutated input, repeat-call equality, fresh arrays).
- Fixtures through the real decomposeAgari via a win-builder mirroring -03's
  ctxOf (typos fail as "not a win"), reusing the h()/meld-builder idioms.

## Rejected along the way

- **Extending WinContext with a first-turn flag to admit tenhou/chiihou** —
  widens a reviewed -03 type for state no producer can supply yet.
- **Best-reading aggregation by yaku count** — count ≠ han; wrong proxy,
  nondeterministic ties.
- **Returning `[]` for non-wins** — conflates "cannot win" with "may not win
  yakuless"; the gate's teaching story (P5) needs the two distinguishable.
- **Exporting concealedTripletCount from yaku.ts for suuankou** — the
  all-triplet case needs none of its subtlety; a local predicate is smaller
  than the API widening.
- **A separate exported yakumanOf()** — no consumer needs yakuman severed
  from the gate; tests reach every branch through yakuOf.
