# T-005-01-04 — yakuman-and-yaku-gate — Research

What exists in the codebase that this ticket builds on, and the constraints it
inherits. Descriptive only; decisions live in design.md.

## 1. The ticket in one line

The yakuman forms reachable without riichi, plus the single aggregator
(win → yaku name list) that enforces the one-yaku win gate and the
yakuman-supersedes convention. AC: per-yakuman positive AND negative tests;
the aggregator answers `[]` for yakuless completions (the gate's refusal
signal) and suppresses standard yaku under a yakuman, convention documented
in the module.

## 2. What the dependency (T-005-01-03) left behind

`src/core/yaku.ts` (594 lines, commits dea35ca/45f8138/78cba61) is the closed
standard catalog. Its exports:

- `type YakuName` — 27-literal union, riichi family deliberately absent.
- `type WindKind` — `'1z' | '2z' | '3z' | '4z'`.
- `interface WinContext` — ONE decomposition + melds + `winningKind` +
  `source: 'wall' | 'rinshan' | 'discard' | 'chankan'` + `lastTile` +
  `seatWind` + `roundWind`. `source` subsumes tsumo/ron (wall/rinshan =
  tsumo; discard/chankan = ron); illegal combinations are unrepresentable.
- `STANDARD_YAKU_NAMES` — frozen, catalog order; iterated by tests and future
  UI instead of parallel copies.
- `standardYakuOf(ctx): YakuName[]` — names of one reading, catalog order,
  fresh array. Kokushi decompositions answer `[]` (yakuman, explicitly
  deferred to this ticket at yaku.ts:589). Arity corruption throws RangeError.

Direct hand-offs written INTO -03's artifacts for this ticket:

- yaku.ts:5–7 (header): "the aggregation across readings — together with
  yakuman and the one-yaku win gate — is T-005-01-04's aggregator, layered on
  top of this module." Layering on top, not rewriting, was the envisioned
  shape.
- Monotone predicates: sanankou is "≥3 concealed triplets" and sankantsu "≥3
  kans" precisely so suuankou/suukantsu knowledge stays out of -03
  (yaku.ts:499–511). The gate is expected to suppress standard yaku under a
  yakuman rather than the predicates capping themselves.
- Junchan's ≥1-run clause keeps the catalog silent on chinroutou shapes
  (yaku.ts:479–491); shousangen's `=== 2` leaves daisangen to -04
  (yaku.ts:514–523).
- -03's review.md §open-concerns #4: "-04 should not treat YakuName's 27 as
  arithmetic-closed" — the riichi epic widens extend-only later.

## 3. Private helpers inside yaku.ts (not exported)

The standard predicates share module-private structural reads this ticket
cannot import: `isTsumo`, `isMenzen`, `meldSetOf` (chi → run, pon/kan →
triplet), `combinedSets` (decomposition.sets ++ meld sets), `hasTripletOf`,
`allKinds` (whole-hand kind multiset; a kan contributes four copies),
`concealedTripletCount` (with the ron demotion + favorable run absorption),
`DRAGON_KINDS`. Design must choose: share these (export or same-module),
or re-derive what yakuman actually need.

## 4. The decomposition substrate (agari.ts)

`decomposeAgari(concealed, melds): AgariDecomposition[]` returns every
reading: `standard` (pair + concealed sets, sets+melds = 4), `chiitoitsu`
(seven distinct pairs, zero melds by rule), `kokushi` (13 terminal/honor
kinds + the doubled kind as `pair`, zero melds). Empty list IS "not a win" —
no throw for that; wrong arity throws RangeError. Result order is contract:
standard by pair ascending, then chiitoitsu, then kokushi. `isAgari` is the
boolean read. Kind-level throughout; melds read for arity only.

Relevant facts for yakuman detection:

- Kokushi is already a decomposition FORM — no shape predicate needed.
- The aggregator's caller-side input (concealed kinds + melds) fully
  determines the whole-hand tile multiset; several yakuman (tsuuiisou,
  chinroutou, ryuuiisou, chuuren, daisangen, the suushii pair) are multiset
  facts, not per-reading facts. In a legal win, an honor kind held ≥3 times
  can only be a triplet-class set (honors never run), so triplet questions
  about honors reduce to count questions.
- Suuankou is the one genuinely per-reading yakuman (concealed triplet count
  with the ron demotion); suukantsu is melds-only.

## 5. Tile and meld vocabulary (tiles.ts, record.ts)

`TileKind` (34 kinds, mpsz), `TILE_KINDS` order, `kindIndexOf`, `kindOf`,
`suitOf`, `rankOf` (null for honors), `isHonor`, `isTerminal`, `isSimple`.
Winds are 1z–4z, dragons 5z–7z. There is no green-tile helper (ryuuiisou's
2s/3s/4s/6s/8s/6z set exists nowhere yet). `Meld` is the record.ts union:
chi/pon/daiminkan/shouminkan (claimed + own TileIds) and ankan (own only).
Meld shapes were validated at claim time by the fold — kind-level reads off
melds are safe (the meldSetOf precedent).

## 6. Consumers waiting on this ticket

- T-005-02-01 (tsumo/ron fold, depends_on THIS ticket): folds a win action,
  records "satisfied yaku" in TableState, throws loudly on yakuless win
  actions. It will assemble the aggregator's input from live table state.
- T-005-02-02 (legal win offers): offers tsumo/ron only for yaku-bearing
  completions — "no offer at all for yakuless completions". The `[]` refusal
  signal is its gate.
- The teaching UI (P2/P5) eventually names yaku; STANDARD_YAKU_NAMES-style
  frozen name lists are its glossary source.

Neither consumer exists yet: this ticket's aggregator is exercised only by
its own tests until -02-01 lands (the same position chankan was in for -03).

## 7. Circumstance coverage — what WinContext can and cannot express

WinContext carries source (wall/rinshan/discard/chankan), lastTile, seat and
round winds. It does NOT carry: riichi state (no riichi action exists in the
vocabulary — record.ts's HandAction is draw/discard/chi/pon/kan forms), and
no "first uninterrupted turn" fact (tenhou/chiihou/renhou territory). The
engine has no match structure (single-hand records); round wind arrives
caller-supplied. Any yakuman needing state beyond WinContext's circumstances
would require widening a -03 type or the Win input this ticket defines.

## 8. Test idioms this ticket inherits (yaku.test.ts)

- `h('123m55z')` mpsz string → kinds; meld builders (chi/pon/daiminkan/
  shouminkan/ankan) with real tileIds; `ctxOf(spec, overrides)` builds
  contexts through the REAL decomposeAgari and forces ambiguous fixtures to
  `pick` one reading explicitly — typos fail as "not a win".
- The per-yaku table is `Record<YakuName, { positive, negative }>` — TOTAL by
  type, so compile-time enforcement of "every yaku has both cases"; a
  meta-test pins table keys ≡ the frozen name list. Negatives are
  near-misses, never unrelated hands.
- Contract describes: exact multi-yaku list in catalog order, purity
  (unmutated inputs, repeat-call equality, fresh arrays), guard throws.
- Expected values derived in comments from the rules, never from module
  output. No property suite — no independent oracle exists for the yaku
  rules (plan-03's tautology argument); rigor = total table + adversarial
  negatives.

purity.test.ts additionally sweeps core modules for platform imports;
index.ts is the barrel (`export * from './yaku'` etc.) — a new module needs
one appended line (the waits.ts/yaku.ts precedent, append-only, no
conflict).

## 9. Constraints and assumptions surfaced

- Names only, no han/fu anywhere — the epic-wide AC (-03 review confirmed the
  FILE, not just the API, is han-free). Double-yakuman *valuation* is
  therefore out of scope; whether double-variant NAMES (kokushi 13-wait,
  suuankou tanki, junsei chuuren) are in scope is a design decision.
- "Reachable without riichi" scopes the yakuman list: nothing in the catalog
  may require riichi or other unrepresented state. Tenhou/chiihou need
  first-draw facts that exist nowhere in WinContext or the record vocabulary.
- Determinism/order-as-contract (legalActions, decomposeAgari,
  standardYakuOf precedents): the aggregator's result order must be
  documented and pinned.
- Corruption throws RangeError; legal-but-empty answers return `[]` (the
  standardYakuOf kokushi precedent). Where "not a win at all" falls is a
  design decision: decomposeAgari treats it as a signal, standardYakuOf never
  sees it.
- Concurrency: sibling tickets are done (-01…-03 merged); S-005-02 tickets
  all depend on this one — no mid-flight file contention expected. Shared
  files touched: index.ts barrel (append-only) at most, yaku.ts only if
  design chooses same-module placement.
