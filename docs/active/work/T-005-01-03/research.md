# T-005-01-03 — standard-yaku-catalog — Research

Descriptive map of what exists. The ticket adds the closed catalog of non-yakuman
yaku predicates — "menzen tsumo through chinitsu, chiitoitsu, haitei/houtei/rinshan"
— over a WinContext type, returning yaku NAMES only (han/fu stays with the scoring
epic). Everything below is what the ticket builds ON; no solutions proposed here.

## 1. The input the catalog reads: decomposeAgari's output (src/core/agari.ts)

T-005-01-01 landed and is the direct dependency. Its contract:

- `decomposeAgari(concealed: readonly TileKind[], melds: readonly Meld[]):
  AgariDecomposition[]` — every distinct reading of a winning hand; `[]` means not a
  win. Kind-level deliberately (copies never affect shape).
- `AgariDecomposition` is a three-form discriminated union:
  - `{ form: 'standard', pair: TileKind, sets: readonly ConcealedSet[] }` — the
    CONCEALED side only; `sets.length === 4 − melds.length`. The full four-sets
    picture is decomposition + melds, "zipped by the caller" — agari.ts's header
    names the yaku catalog explicitly as one such consumer.
  - `{ form: 'chiitoitsu', pairs: readonly TileKind[] }` — seven distinct kinds
    ascending; zero melds by rule.
  - `{ form: 'kokushi', pair: TileKind }` — a -04 (yakuman) concern, but the type
    flows through any WinContext that carries a decomposition.
- `ConcealedSet = { type: 'run', start } | { type: 'triplet', kind }`. Runs are
  identified by their start kind; triplets by their kind.
- Multiple decompositions per hand are the norm for interesting shapes (111222333m;
  ryanpeikou hands are standard AND chiitoitsu simultaneously). -01's design D3
  states the reason: "different decompositions carry different yaku (pinfu vs
  sanankou readings)" — the catalog is the ticket that cashes that in.
- Result order is deterministic and part of the contract.

## 2. What melds carry that the catalog needs (src/core/record.ts)

`Meld` is a discriminated union of `chi | pon | daiminkan | shouminkan | ankan`:

- **Openness**: chi/pon/daiminkan/shouminkan all claimed a tile (open); ankan
  claimed nothing. Riichi rules: a hand is closed (menzen) iff its only melds are
  ankan. Menzen gates menzen-tsumo, pinfu, iipeikou/ryanpeikou.
- **Set structure at kind level**: a chi's three tiles are `claimed` + `own` (two
  ids) — the run start is the minimum kind of the three (record.ts validates the
  run at claim time, so the three kinds ARE consecutive one-suit). Pon/kans are
  triplet-class sets of `kindOf(own[0])`. `kindOf(id)` from tiles.ts decodes.
- **Concealed-triplet status**: ankan counts as a concealed triplet (sanankou);
  pon/daiminkan/shouminkan are open triplets. All four kan forms count for
  sankantsu.
- There is no kind-level "meld summary" helper anywhere — -01's design D2
  deliberately rejected inventing a parallel meld vocabulary; each consumer reads
  the Meld objects it already holds.

## 3. What the fold does NOT yet know (win circumstances)

The catalog's circumstance yaku (menzen tsumo, haitei, houtei, rinshan, chankan)
depend on facts that exist in the fold today only as mechanics, not as recorded
win context — because no win exists yet:

- **Tsumo vs ron**: `HandAction` has no tsumo/ron members; T-005-02-01 widens the
  vocabulary and ends the hand. The catalog cannot read this off TableState.
- **Last tile**: `phase` flips to 'ryuukyoku' when the live wall empties after a
  discard; "won on the last live-wall draw" (haitei) / "ron on the last discard"
  (houtei) are determinable by the future fold, not by a pure predicate over tiles.
- **Rinshan**: the kan tail puts the replacement draw in `drawn`; "this win's tile
  was a rinshan draw" is fold knowledge.
- **Chankan**: record.ts:479 explicitly defers it — "Chankan — robbing this kan —
  is an agari epic's concern; no ron exists yet." Shouminkan itself already folds.
- **Seat/round winds**: `Seat` 0–3 is E/S/W/N dealer order (deal.ts), "the same
  ordering the honor kinds 1z-4z anchor". Round wind (East vs South round) is match
  structure that exists NOWHERE in the engine — records are single hands.

Consequence: WinContext must carry these circumstances as caller-supplied fields;
the catalog can derive none of them. The ticket names WinContext as the type this
ticket introduces.

## 4. Who consumes the catalog (dependency spine)

- **T-005-01-04 yakuman-and-yaku-gate** (depends on -03): "the single aggregator
  (win → yaku name list) that enforces the one-yaku win gate and the
  yakuman-supersedes convention". So -04, not -03, owns cross-decomposition
  aggregation and yakuman suppression; -03 supplies the standard predicates and
  (being first) the WinContext type -04 will reuse.
- **T-005-02-01 tsumo/ron fold** (depends on -04): folds a win action, recording
  "winner, winning tile, and satisfied yaku" — it will assemble WinContext values
  from fold state (it knows tsumo/ron, last-tile, rinshan, seat).
- **T-005-02-02 legal-win-offers**: "gated by … the one-yaku rule" — calls through
  -04's aggregator, so the catalog is on the legality hot path (34-kind wait scans
  × ron checks); it should stay cheap per call.
- **T-005-02-03 win-prompt/hand-end-screen**: renders "the yaku made" by name —
  the teaching surface (P2) that makes name legibility matter.

## 5. Scope facts from the riichi rules (what "the closed catalog" contains)

Standard non-yakuman yaku, excluding those whose enabling mechanics don't exist:

- **Always-available**: menzen tsumo, pinfu, tanyao, iipeikou, yakuhai (dragons ×3,
  seat wind, round wind), sanshoku doujun, sanshoku doukou, ittsuu, chanta,
  junchan, toitoi, sanankou, sankantsu, chiitoitsu, honroutou, shousangen,
  ryanpeikou, honitsu, chinitsu.
- **Circumstance yaku in the ticket text**: haitei, houtei, rinshan. Chankan is the
  fourth of this family; the ticket text omits it but the engine already folds
  shouminkan, and -02's ron will make it reachable. Whether it belongs in the
  closed catalog now is a Design decision.
- **Excluded with reason**: riichi/double riichi/ippatsu (no riichi declaration
  exists anywhere in the engine — a later epic's action vocabulary); dora/ura-dora
  (not yaku — han counting, scoring epic); nagashi mangan (not a yaku; a draw
  outcome); yakuman forms (kokushi, suuankou, daisangen, etc. — T-005-01-04).
- **Interaction facts** the predicates must encode (rules, not code): ryanpeikou
  supersedes iipeikou (never both); junchan vs chanta vs honroutou partition the
  terminal/honor family; chinitsu vs honitsu partition the flush family; chiitoitsu
  is a per-form yaku (its decomposition form IS the predicate); pinfu requires
  menzen + all runs + non-yakuhai pair + a two-sided (ryanmen) wait on the winning
  tile; sanankou counts a ron-completed triplet as NOT concealed (the classic
  subtlety — the winning tile's placement within the decomposition matters);
  kuitan (open tanyao) is allowed under the common default, a convention to state.
- Several predicates need the WINNING TILE and TSUMO/RON, not just the
  decomposition: pinfu (wait shape) and sanankou (ron-completed triplet). -01's
  "Rejected along the way" recorded exactly this: "-03's WinContext carries the
  winning tile and re-derives its position per decomposition."

## 6. Sibling-ticket overlap check (concurrency)

T-005-01-02 (tenpai-waits) is open at the same phase and also depends only on -01
— likely in flight concurrently. Its AC touches `waits(hand, melds)`, a NEW module
or function distinct from this ticket's. Files it plausibly touches: a new
waits.ts/tenpai.ts + barrel + its test. This ticket must therefore avoid claiming
generic filenames it doesn't need and keep its own additions to a fresh
yaku-specific module + one barrel line (append — merge-trivial). record.ts,
legal.ts, agari.ts are read-only for both tickets.

## 7. Core module conventions (enforced and observed)

- **purity.test.ts gate**: runtime core modules import only same-directory
  siblings; the regex scans raw source INCLUDING comments. Type-only imports from
  './record', './tiles' are the legal.ts/agari.ts precedent.
- **Barrel**: new module ⇒ one `export * from './x'` line in src/core/index.ts.
- **Doc style**: module-opening role comment situating it in the architecture;
  contract-level doc comments on exports (what is frozen, what throws, purity).
  Conventions are stated as rules with reasons (see chiitoitsu's "four of a kind is
  NOT two pairs" comment).
- **Error style**: semantic corruption throws RangeError with a self-locating
  message (decomposeAgari's arity guard); pure shape predicates just return false.
  Kind VALUES are trusted (compile-time union; boundary validation is the log
  parser's).
- **Determinism**: deterministic result order is contract (legalActions,
  decomposeAgari precedents).
- **Naming**: romanized Japanese terms are the codebase's working vocabulary
  (agari, chiitoitsu, kokushi, ankan, ryuukyoku, tsumogiri) — full romaji words,
  not translations.

## 8. Test conventions (src/core/*.test.ts)

- vitest + fast-check; `just test` runs vitest over src/ (~192 tests, ~1s).
- agari.test.ts sets the local style this suite will sit next to: an `h('123m55z')`
  mpsz shorthand for TileKind lists; hand-built `FAKE_MELDS` literals where only
  part of the Meld is read (documented); fixture expectations derived in comments
  from the rules, never from module output; property agreement against a
  structurally different reference.
- The AC here demands per-yaku positive AND negative cases — "the epic's per-yaku
  rigor exhibit" — i.e. a fixture-heavy suite (≈23 yaku × ≥2 cases) rather than a
  reference-comparison property suite; no brute-force yaku oracle is demanded.
- For yaku tests, melds' KINDS matter (unlike agari.test.ts's arity-only fakes) —
  meld fixtures must be built with real tileId() values of chosen kinds.

## 9. Files in scope

| File | Role today | Touch expected |
|---|---|---|
| src/core/yaku.ts | does not exist | NEW — WinContext + the standard catalog |
| src/core/yaku.test.ts | does not exist | NEW — per-yaku positive/negative suite |
| src/core/index.ts | barrel | +1 export line (append) |
| src/core/agari.ts | decomposer | read-only (types + facts) |
| src/core/record.ts | Meld source | read-only (type import) |
| src/core/tiles.ts | kind classifiers | read-only import |
| src/core/purity.test.ts | import gate | untouched; must stay green |

## 10. Constraints and assumptions surfaced

- The API must expose NO han/fu values anywhere (AC) — names only; han ordering/
  counting is the scoring epic's.
- WinContext's shape is load-bearing for -04 and -02-01; it must be assemblable
  from fold state (Seat, melds, winning tile, tsumo/ron, wall flags) without match
  structure the engine lacks (round wind must be a plain field, caller's problem).
- Per-decomposition vs whole-hand evaluation is the central design question:
  decomposition-dependent yaku (pinfu, iipeikou, toitoi, sanshoku, ittsuu, chanta,
  junchan, sanankou, shousangen, chiitoitsu…) vs decomposition-independent ones
  (tanyao, honitsu, chinitsu, honroutou, circumstances, yakuhai-by-triplet…).
  -04's aggregator iterates decompositions either way.
- Performance: called inside -02-02's legality scans; predicates are O(sets) scans
  over ≤5-element arrays — nothing needs precomputation, but the API shouldn't
  force re-decomposition (decomposeAgari already returns all readings once).
