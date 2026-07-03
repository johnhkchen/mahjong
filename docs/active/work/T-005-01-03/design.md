# T-005-01-03 — standard-yaku-catalog — Design

Decisions for the closed non-yakuman yaku catalog in a new `src/core/yaku.ts`.
Grounded in research.md: -04 (yakuman + aggregator) and -02-01 (win fold) consume
this module's WinContext and predicates; the AC forbids han/fu anywhere in the API.

## D1. Evaluation unit: ONE decomposition per call, circumstances supplied

**Options.** (a) `standardYakuOf(ctx)` where ctx carries one AgariDecomposition +
circumstances. (b) catalog takes (concealed, melds, circumstances) and decomposes
internally, returning the union over readings. (c) catalog reads TableState.

**Decision: (a).** -04's ticket owns "the single aggregator (win → yaku name
list)" — cross-decomposition conventions (union vs best-reading, chiitoitsu vs
ryanpeikou across forms) are exactly the aggregator's job, and decomposition-
dependent yaku (pinfu, iipeikou, toitoi, sanshoku, ittsuu, chanta family,
sanankou, shousangen, chiitoitsu) are facts OF a reading, not of the tile
multiset. (b) re-decomposes on every call (the catalog sits on -02-02's legality
hot path; decomposeAgari already returns all readings once to whoever iterates)
and quietly pre-empts -04's aggregation conventions. (c) is impossible today —
TableState records no win, no tsumo/ron, no round wind (research §3) — and would
weld the catalog to fold internals. Decomposition-independent predicates (tanyao,
honitsu, circumstances…) simply ignore the sets they don't need.

## D2. WinContext shape

```ts
type WindKind = '1z' | '2z' | '3z' | '4z'
interface WinContext {
  readonly decomposition: AgariDecomposition   // ONE reading of the win
  readonly melds: readonly Meld[]              // the winner's melds, kinds read
  readonly winningKind: TileKind               // the completing tile, kind-level
  readonly source: 'wall' | 'rinshan' | 'discard' | 'chankan'
  readonly lastTile: boolean                   // live wall empty at the win
  readonly seatWind: WindKind                  // the winner's wind
  readonly roundWind: WindKind                 // caller-supplied; no match state exists
}
```

- **`source` is one field, not three flags.** Tsumo/ron is derivable (wall/rinshan
  = tsumo; discard/chankan = ron), and the illegal combinations (rinshan ron,
  chankan tsumo, rinshan+chankan) are unrepresentable instead of guarded. The
  rinshan-empties-the-wall edge falls out: haitei reads `source === 'wall' &&
  lastTile`, so a rinshan win never doubles as haitei (the standard convention);
  `lastTile` is only consulted for wall/discard sources — documented, not policed.
- **Winds as WindKind, not Seat + round.** Seat→wind needs only `${seat+1}z`
  (deal.ts anchors Seat 0–3 to 1z–4z), but round wind exists nowhere in the engine
  (single-hand records) — so BOTH arrive as plain wind kinds and the catalog stays
  independent of match structure. WindKind lives in yaku.ts, not tiles.ts: tiles.ts
  stays untouched (concurrency with -02, research §6); migration later is cheap.
- **No raw concealed-tile list.** The decomposition's pair+sets (or pairs, or
  kokushi shape) already determine the concealed kinds exactly; meld kinds come off
  the Meld objects via kindOf. A redundant tile list is a second copy that can
  disagree with the first (the record.ts draw-records-no-tile principle).
- **Kind-level winning tile.** Copies never affect any catalog predicate (the -01
  precedent); red-five dora is scoring-epic han counting, not a yaku.

## D3. The closed catalog — 27 names, riichi family excluded, chankan included

`YakuName` is a string-literal union in the traditional table order:

menzen-tsumo, pinfu, tanyao, iipeikou, yakuhai-haku, yakuhai-hatsu, yakuhai-chun,
yakuhai-seat-wind, yakuhai-round-wind, sanshoku-doujun, sanshoku-doukou, ittsuu,
chanta, junchan, toitoi, sanankou, sankantsu, chiitoitsu, honroutou, shousangen,
honitsu, chinitsu, ryanpeikou, haitei, houtei, rinshan, chankan.

- **Chankan is IN.** The ticket text names haitei/houtei/rinshan; chankan is the
  fourth member of that circumstance family, shouminkan already folds, and
  record.ts:479 explicitly promised chankan to "an agari epic". A closed catalog
  that omits it must reopen in -02 — worse than one predicate whose flag arrives
  with ron. The `source: 'chankan'` value makes it a one-line predicate now.
- **Riichi, double riichi, ippatsu are OUT.** No riichi declaration exists in the
  action vocabulary; encoding riichi state into WinContext today would freeze a
  guess about an unbuilt feature. The riichi epic widens YakuName (extend-only,
  the HandAction precedent) — that widening is additive, not a reopening of
  decided semantics.
- **Dora is not a yaku; yakuman are -04's; nagashi mangan is not a yaku.**
- **Yakuhai are five distinct names**, and a double-east hand fires BOTH
  yakuhai-seat-wind and yakuhai-round-wind — the name list preserves the han
  multiplicity fact without carrying han values (AC), and the teaching UI (P2)
  can name each honor. Names are romanized Japanese per the codebase vocabulary.

## D4. API surface

```ts
export type YakuName = …                          // the 27-literal union
export type WindKind = …
export interface WinContext { … }
export const STANDARD_YAKU_NAMES: readonly YakuName[]   // catalog order, frozen
export function standardYakuOf(ctx: WinContext): YakuName[]
```

One evaluation function returning names in catalog order (deterministic order is
contract — legalActions/decomposeAgari precedent), plus the frozen name list so
-04, the UI's yaku glossary, and this ticket's own closure meta-test can iterate
the catalog without a parallel hand-maintained copy. Individual predicates stay
module-private: exporting 27 functions freezes 27 signatures for no consumer —
-04 needs names, tests assert through membership. No han, no fu, anywhere (AC).

**Guards** (the nextInt precedent — corruption throws, "no yaku" returns `[]`):
standard form requires `sets.length + melds.length === 4`; chiitoitsu/kokushi
require zero melds. A kokushi decomposition returns `[]` from the standard
catalog (it is a yakuman, -04's) — legal input, empty answer, not a throw.

## D5. Predicate semantics — the interaction conventions, stated per yaku

Combined sets = decomposition.sets + kind-level readings of melds (chi → run of
min kind; pon/all kans → triplet). An internal `meldSetOf(meld)` does this read —
record.ts validated the shapes at claim time, so min-kind arithmetic is safe.
Menzen ⇔ every meld is an ankan.

- **menzen-tsumo**: tsumo source ∧ menzen (ankan does not break concealment; a
  rinshan self-draw is still a self-draw).
- **pinfu**: menzen ∧ NO melds at all (an ankan is a triplet — fails all-runs
  anyway, but the zero-meld read keeps it honest) ∧ all four sets runs ∧ pair not
  yakuhai (not a dragon, not seatWind, not roundWind — an otakaze wind pair is
  fine) ∧ the winning tile completes SOME run two-sidedly: kind = start with
  rank(start) ≤ 6, or kind = start+2 with rank(start) ≥ 2 (kanchan/penchan/tanki
  excluded by construction).
- **tanyao**: every tile simple — pair, sets, and meld tiles. Kuitan (open
  tanyao) ALLOWED — the common default; the convention is documented at the
  predicate.
- **iipeikou / ryanpeikou**: menzen; count duplicated concealed runs as
  Σ⌊count(start)/2⌋ — iipeikou ⇔ exactly 1, ryanpeikou ⇔ exactly 2 (never both:
  the supersession is encoded as disjoint predicates, not aggregator cleanup).
- **yakuhai-⋆**: some combined triplet of 5z/6z/7z/seatWind/roundWind. Pair never
  counts. Seat and round tested independently (double-east double-fire).
- **sanshoku-doujun / -doukou**: same start-rank run / same rank triplet in all
  three numbered suits, over combined sets.
- **ittsuu**: runs starting 1, 4, 7 of ONE suit, over combined sets.
- **chanta / junchan / honroutou** are made mutually exclusive in the catalog
  (the standard no-stacking convention, encoded as disjoint predicates):
  junchan = every set and the pair contain a terminal ∧ at least one run;
  chanta = every set/pair contains a terminal or honor ∧ ≥1 run ∧ ≥1 honor;
  honroutou = every TILE terminal-or-honor (⇒ no runs; true over toitoi shapes
  AND chiitoitsu form). The no-run all-terminal shape is chinroutou (yakuman,
  -04) — junchan's ≥1-run clause keeps the catalog silent on it by design.
- **toitoi**: standard form, all four combined sets triplet-class (any kan
  counts; chi disqualifies).
- **sanankou**: ≥3 CONCEALED triplets = decomposition triplets + ankan, minus the
  ron adjustment: a triplet of winningKind completed by ron (source discard/
  chankan) is NOT concealed — unless the same decomposition also holds a run
  containing winningKind, in which case the tile is attributed to the run (the
  favorable reading; the pair can never absorb it — pair kind = triplet kind is
  five copies). "≥3" not "= 3": a four-concealed-triplet tsumo is suuankou and
  -04's gate suppresses standard yaku under yakuman anyway; monotone semantics
  keeps this predicate free of yakuman knowledge.
- **sankantsu**: ≥3 kans among melds (any kan form) — same monotone reasoning
  under suukantsu.
- **chiitoitsu**: decomposition form is 'chiitoitsu'. (Menzen is structural.)
- **shousangen**: exactly 2 dragon triplets (combined) ∧ dragon pair. (Three is
  daisangen, -04.)
- **honitsu / chinitsu**: one numbered suit over ALL tiles, with (honitsu) vs
  without (chinitsu) honors — disjoint by the ≥1-honor clause; both true over
  chiitoitsu-form hands too.
- **haitei**: source wall ∧ lastTile. **houtei**: source discard ∧ lastTile.
  **rinshan**: source rinshan. **chankan**: source chankan.

## D6. Verification: per-yaku fixture table + interaction and purity tests

The AC is per-yaku rigor, not reference-agreement (research §8) — no brute-force
oracle exists for "the yaku rules" other than restating them.

- **A `CASES: Record<YakuName, { positive, negative }>` table drives the core
  suite**: iterating STANDARD_YAKU_NAMES over the table makes "every yaku has ≥1
  positive and ≥1 negative case" structurally true — a missing case is a type
  error/test failure, not a review catch. Negatives are near-misses (pinfu with
  kanchan wait; tanyao with one terminal; chanta shape missing its honor; sanankou
  with the third triplet ron-completed), never unrelated hands.
- **Contexts are built through decomposeAgari**, not hand-written decompositions:
  a `ctxOf(concealedSpec, { melds, source, … })` helper folds the real decomposer
  and selects the reading that maximizes the predicate under test's chance (or by
  explicit index where ambiguity is the point) — fixture typos then fail as
  "not a win" instead of silently testing an impossible shape. Meld fixtures are
  real tileId() constructions via small chi/pon/ankan/… builders (kinds matter
  here, unlike agari.test.ts's arity-only fakes — research §8).
- **Interaction tests beyond the table**: ryanpeikou hand fires ryanpeikou but
  not iipeikou; junchan/chanta/honroutou pairwise exclusivity on boundary hands;
  double-east fires both wind names; pinfu×3 wait-shape negatives (kanchan,
  penchan, tanki); sanankou ron-adjustment BOTH ways (run absorbs the tile vs
  doesn't); honroutou over chiitoitsu; kokushi → `[]`; order of returned names
  equals catalog order; purity (inputs unmutated, repeat call equality); guard
  throws on arity corruption.

## Rejected along the way

- **Predicate objects `{ name, test }[]` as the public API** — freezes 27
  signatures; consumers need names only. The table exists privately.
- **A `winType: 'tsumo' | 'ron'` field beside rinshan/chankan booleans** — makes
  rinshan-ron representable and forces guards; `source` subsumes it.
- **Wind yakuhai as one `yakuhai-wind` name** — erases the double-wind
  multiplicity fact the scoring epic and the teaching UI both need.
- **Putting WindKind in tiles.ts** — touches a shared foundation file mid-flight
  with -02 for zero functional gain now.
- **Evaluating pinfu/sanankou over a caller-declared wait shape** — the fold
  won't know waits; -02's waits module answers a different question. Deriving
  placement from (decomposition, winningKind, source) is complete and local.
