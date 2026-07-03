# T-005-01-01 — agari-decomposition — Research

Descriptive map of what exists. The ticket adds the pure agari predicate — decompose
concealed tiles + melds into four sets and a pair, plus chiitoitsu and kokushi forms —
in a new zero-DOM `src/core/agari.ts`. Everything below is what the ticket builds ON;
no solutions proposed here.

## 1. The tile domain (src/core/tiles.ts, import-free foundation)

- 34 kinds × 4 copies = 136 `TileId`s (integers 0–135). `TileId = kindIndex *
  COPIES_PER_KIND + copy`; decode via `kindOf(id)`, `copyOf(id)`.
- `TILE_KINDS` is the canonical kind order — 1m…9m, 1p…9p, 1s…9s, 1z…7z — and
  `kindIndexOf(kind)` its 0–33 index. The doc comment on TILE_KINDS explicitly names
  this "the ordering used for hand sorting and count-array algorithms downstream" —
  count-array agari/shanten work was anticipated here.
- Classifiers already exist: `suitOf`, `rankOf` (null for honors), `isHonor`,
  `isTerminal`, `isSimple`. Runs are only possible within one numbered suit (honors
  have no rank); kind indices of a numbered suit are contiguous, so `kindIndex + 1`
  is "next rank up" within a suit block (blocks at 0–8, 9–17, 18–26; honors 27–33).
- TileId range validation is deliberately NOT done in core runtime paths — ids from
  outside the program are validated at the future log-parser boundary (tiles.ts rule,
  repeated in deal.ts/record.ts). Core modules trust their inputs and throw loudly
  only on semantic corruption.

## 2. Hands and melds as the fold presents them (src/core/record.ts)

- `TableState.hands` — four `TileId[]` in draw order, never sorted. A seat's
  concealed tiles at a potential win are `hands[seat]` (13 − 3·melds) plus either
  `drawn` (tsumo shape) or a claimable discard (ron shape). This ticket does not
  read TableState — but its input shape must accept what these arrays hold.
- `Meld` (record.ts:103) — discriminated union: `chi`/`pon` `{ claimed, from, own:
  [TileId, TileId] }`; `daiminkan`/`shouminkan` own three; `ankan` `{ own: [4 ids] }`
  with no claimed/from. The claimed tile is displayed in the meld but counted in the
  discarder's pond for conservation; for hand-composition purposes a claiming meld's
  tiles are `claimed` + `own`, an ankan's are its four `own`.
- Kans are four tiles but count as ONE set toward the four-sets-and-a-pair shape —
  the concealed remainder after k melds is always 13 − 3k tiles (+1 winning tile),
  regardless of how many of those melds are kans.
- `HandAction` is a frozen, extend-only vocabulary; `phase: 'playing' | 'ryuukyoku'`
  is "a widenable literal union: agari tickets add winning endings". Widening both is
  T-005-02-01's job, NOT this ticket's — nothing in record.ts changes here.

## 3. Where this ticket sits in the epic (dependency spine)

T-005-01-01 is the root of E-005's DAG; everything downstream consumes its API:

- **T-005-01-02 tenpai-waits** (depends on -01): "every kind in waits(hand, melds)
  completes agari" — it will call this module once per candidate kind, 34× per hand,
  inside property loops. Its AC mentions "exhausted kinds (all four copies visible)"
  — a kind-level concern, hinting the completion test is asked at kind granularity.
- **T-005-01-03 standard-yaku-catalog** (depends on -01): yaku predicates "over a
  WinContext type". Several standard yaku are properties of a particular
  decomposition (pinfu: all runs + non-yakuhai pair; iipeikou: two identical runs;
  toitoi: all triplets; sanshoku/ittsuu: specific run sets), and a single tile
  multiset can decompose multiple ways (the classic 111222333m shape) — so -03 needs
  the decompositions themselves, not a boolean, and plausibly ALL of them (high-point
  interpretation rule). Chiitoitsu is itself a yaku over the chiitoitsu form.
- **T-005-01-04 yakuman-and-yaku-gate** (depends on -03): kokushi is a yakuman read
  off the kokushi form.
- **T-005-02-01 tsumo/ron fold** (depends on -04): the fold's win guard ("non-winning
  tile throws") folds through the same predicate.

So the module's output shape is load-bearing for four tickets. The ticket text itself
only demands the decomposition ("decompose … into four sets and a pair, plus
chiitoitsu and kokushi forms"); the AC only demands agreement with brute force plus
form fixtures.

## 4. Core module conventions (enforced and observed)

- **purity.test.ts gate**: every runtime module in core imports ONLY same-directory
  siblings (`./x`); test files may add `vitest`/`fast-check`/`node:`. The regex scans
  raw source including comments — a commented `from 'foo'` example fails the gate.
  The AC names this suite: it must stay green with agari.ts exported from the barrel.
- **Barrel**: `src/core/index.ts` re-exports every core module (`export * from
  './x'`); app code imports only from the barrel. New module ⇒ one barrel line.
- **Doc style**: every module opens with a role comment situating it in the
  architecture; exported functions carry contract-level doc comments (what is frozen,
  what throws, what is fresh). Purity claims are explicit ("fresh arrays per call",
  "input untouched").
- **Error style**: semantic corruption throws `RangeError` with a self-locating
  message (the nextInt precedent). Pure predicates like `isRun` (record.ts:217)
  simply return false for non-matching shapes.
- **Existing shape logic**: `isRun` in record.ts is private and validates a chi
  claim's three kinds; legal.ts re-states run arithmetic independently (deliberate
  double-entry, locked by an agreement suite). There is no shared "set detection"
  helper to reuse — each module states its own rules and tests lock them together.

## 5. Test conventions (src/core/*.test.ts)

- vitest + fast-check throughout; `seedArb = fc.integer({ min: 0, max: 0xffffffff })`
  is the canonical seed arbitrary (dynamics.test.ts, record.test.ts).
- dynamics.test.ts is the precedent for generator-driven property suites: generators
  are test-local by design; properties assert self-evident invariants; deterministic
  corpora pin coverage facts ("call density is a pinned fact, never an fc
  statistic"). Hard bounds convert non-termination into thrown errors.
- record.test.ts style: wall-derived expectations over deterministic records.
  drive.test.ts (app side) freezes scratchpad-scanned anchors with derivations in
  comments, marked "never regenerate".
- Suite size/speed today: ~192 tests in ~1s via `just test` (vitest over src/).
  Property suites keep default fc run counts; nothing sets global numRuns.
- The AC's brute-force reference has no precedent in the repo yet — this ticket
  introduces the first reference-implementation comparison test.

## 6. Riichi domain facts the module must encode (rules, not code)

- **Standard form**: 4 sets + 1 pair = 14 tiles. Sets are runs (three consecutive
  ranks, one numbered suit) or triplets (three of a kind); melds contribute their
  sets openly (chi→run, pon/kan→triplet — a kan is a triplet-class set with a fourth
  tile). Concealed remainder: 14 − 3·(meld count) tiles arranged as (4 − melds) sets
  + the pair.
- **Chiitoitsu**: seven distinct pairs, fully concealed — zero melds by definition
  (any call breaks it; four-of-a-kind does NOT count as two pairs under standard
  rules — the seven kinds must be distinct).
- **Kokushi musou**: one of each of the 13 terminal/honor kinds + one duplicate of
  any of them; fully concealed, zero melds (kokushi tiles can never be chi'd into
  runs anyway, and any meld leaves too few tiles).
- **Overlap facts** relevant to testing: a standard hand can also be chiitoitsu-
  shaped only via four-of-a-kind pairs (excluded above), so chiitoitsu and standard
  are disjoint EXCEPT ryanpeikou-shaped hands (two iipeikou = 4 runs + pair that is
  also 7 pairs — e.g. 223344m 556677p 88s) — both forms are simultaneously true and
  the decomposer must report both. Kokushi never overlaps either.
- **Multiplicity**: standard decompositions are not unique (111222333m-style shapes;
  pair-vs-triplet ambiguity as in 11122z…). Yaku and fu downstream legally depend on
  choosing among them, per the high-point rule.

## 7. Constraints and assumptions surfaced

- New file `src/core/agari.ts` + one barrel line + its test file; record.ts,
  legal.ts, deal.ts untouched (the fold learns about wins in T-005-02-01).
- Zero imports beyond `./tiles` (and possibly `./record` for the Meld type — a
  type-only same-directory import, purity-legal; legal.ts already imports Meld's
  sibling types this way).
- The module is a pure read: no RNG, no mutation of inputs, deterministic output
  ordering (the legalActions precedent — deterministic order is part of contracts
  here).
- Randomized property hands "with 0–4 melds" (AC) require constructing meld-bearing
  inputs without folding real records — the test needs hand-built Meld values or a
  meld-shape abstraction, since driving real folds to 4-meld states is dynamics
  territory and unnecessarily heavy for a pure predicate suite.
- Performance envelope: -02 will call the decomposer ~34× per property iteration;
  the brute-force reference in this ticket's own suite is the slow path and bounds
  suite runtime, so fc run counts need choosing deliberately.
- No shanten module exists yet (E-005 scopes win detection; shanten is a later
  teaching epic) — nothing here should pre-build shanten machinery.

## 8. Files in scope

| File | Role today | Touch expected |
|---|---|---|
| src/core/agari.ts | does not exist | NEW — decomposer + forms |
| src/core/agari.test.ts | does not exist | NEW — property suite vs brute force + fixtures |
| src/core/index.ts | barrel | +1 export line |
| src/core/tiles.ts | kind/classifier foundation | read-only import |
| src/core/record.ts | Meld type source | read-only (type import at most) |
| src/core/purity.test.ts | import gate | untouched; must stay green (AC) |
