# T-005-01-02 — tenpai-waits — Research

Descriptive map of what exists. The ticket derives the waits of a 13-tile hand — the
kinds that complete agari — as the datum ron offers, furiten gating, and future tenpai
teaching all read. Everything below is what the ticket builds ON; no solutions here.

## 1. The decomposer this ticket consumes (src/core/agari.ts, from T-005-01-01)

- `decomposeAgari(concealed: readonly TileKind[], melds: readonly Meld[]):
  AgariDecomposition[]` — every distinct reading of a winning hand across the three
  forms (standard / chiitoitsu / kokushi); `[]` ⇔ not a win. `isAgari` is the
  emptiness read. Both are exported from the core barrel.
- **Kind-level deliberately.** The module header states the design intent verbatim:
  "kind granularity lets waits (T-005-01-02) ask about completions whose four
  physical copies are already visible." A completion query for a kind the hand
  already holds four of SUCCEEDS at the decomposer level (five counted copies can
  still partition — e.g. 11111 = triplet + pair). Physical existence is explicitly
  NOT the decomposer's concern; it is this ticket's.
- **Arity contract**: concealed must be exactly 14 − 3·melds tiles, melds ≤ 4;
  violations throw RangeError naming both numbers (caller corruption, not "no win").
  A waits query therefore hands the decomposer 13 − 3·melds + 1 tiles.
- **Melds read for arity only** — the decomposer never inspects meld tile ids. Meld
  CONTENT (which physical copies a call consumed) is available on the Meld objects
  themselves and is untouched by -01.
- **Performance envelope, measured in -01's review**: ~µs per decompose query; 1000
  property queries plus the brute-force reference ran in ~35ms. The review
  explicitly pre-cleared this ticket's usage pattern: "fine for -02's
  34-queries-per-hand loops." `isAgari` has no early-exit — one code path, accepted.
- **Result order is frozen contract** (the legalActions precedent) — deterministic
  ordering is part of every core contract, so a waits list will need a documented
  order too.

## 2. Hands and melds as the engine presents them (src/core/tiles.ts, record.ts)

- `TileKind` (34 kinds, mpsz), `TILE_KINDS` canonical order (1m…9m, 1p…9p, 1s…9s,
  1z…7z), `kindIndexOf` its 0–33 index, `KIND_COUNT`/`COPIES_PER_KIND` constants.
  The count-array idiom over this order is established in agari.ts (`countsOf` is
  module-private there).
- `Meld` (record.ts:103) — discriminated union. For counting the physical copies a
  meld consumes: `chi`/`pon` hold `claimed` + 2 `own`; `daiminkan`/`shouminkan` hold
  `claimed` + 3 `own`; `ankan` holds 4 `own` and no claimed/from. All tile ids;
  `kindOf(id)` maps to kinds. A kan meld consumes FOUR copies of one kind — the only
  way a hand can have four copies of a kind visible without holding them concealed.
- A tenpai hand's concealed size is 13 − 3·(meld count): 13, 10, 7, 4, or 1 (the
  four-meld tanki). The fold keeps `hands[seat]` at exactly this size between draws;
  the drawn/claimable tile is held apart. Fold-side callers map `kindOf` over
  TileId hands at the boundary (-01 review, "TODOs handed to later tickets").
- record.ts / legal.ts stay closed for this ticket: the ron/tsumo offering and fold
  integration are T-005-02-01's job (its AC folds wins through real records).

## 3. Riichi domain facts the module must encode (rules, not code)

- **Waits (machi)**: a 13-tile hand is tenpai iff at least one kind completes it to
  a 14-tile agari. Structural wait shapes — tanki (pair wait, 1 kind), shanpon
  (dual-triplet, 2 kinds), ryanmen (2), kanchan (1), penchan (1) — compose into
  multi-kind waits (junsei chuuren waits on all 9 ranks of its suit; the 13-sided
  kokushi waits on all 13 terminal/honor kinds — the widest possible wait).
- **Chiitoitsu tenpai**: six pairs + a single — always exactly one waited kind (the
  single's), because chiitoitsu pairs must be distinct. **Kokushi tenpai**: either
  13 distinct kokushi kinds (13-sided) or 12 kinds with one doubled (single wait).
- **Exhausted waits (the AC's named edge)**: a kind all four of whose copies are
  visible to the waiting hand itself — concealed tiles plus its own melds' tiles —
  can never physically arrive: no opponent can discard one (ron impossible) and none
  remains in the wall (tsumo impossible). Two distinct producers: four concealed
  copies flanked by run material (e.g. 1111m234m…, where a fifth 1m would decompose),
  and a kan/pon of the kind the shape otherwise waits on (ankan 1m + 23m ryanmen).
  Under the widely used Tenhou-style formal-tenpai rule, a hand whose EVERY winning
  kind is self-exhausted counts as NOTEN; kinds exhausted only by opponents' ponds
  or discards do NOT affect tenpai (that is live-tile counting, a hint/teaching
  concern with table-wide visibility this pure function does not have).
- **Furiten** (future consumer, not this ticket): a seat is furiten when ANY of its
  waited kinds appears in its own pond — gating reads the full waits list, so waits
  must be complete, not just nonempty.

## 4. Where this ticket sits in the epic (dependency spine)

- **T-005-01-02 (this)** depends on -01 only. Its consumers: **T-005-02-01
  tsumo-ron-fold** offers/validates ron via waits and needs furiten's datum;
  **T-005-02-x** (riichi/furiten story) gates on the same list; the teaching epic's
  shanten/tenpai prompts read it later. None of them exist yet — this ticket ships
  a pure module + tests, nothing wired.
- **T-005-01-03 (yaku catalog)** also depends only on -01 and may be in flight
  CONCURRENTLY on this branch (lisa spawns all satisfied-dependency tickets). Both
  tickets add one line to the core barrel `index.ts`; commit serialization is
  file-locked per the workflow doc. Keep this ticket's footprint to its own new
  files plus the single barrel line.
- The ticket text names no file; -01 established the one-module-per-concern pattern
  and its header names waits as a *consumer* of agari.ts, not a resident.

## 5. Core module conventions (enforced and observed)

- **purity.test.ts gate**: runtime core modules import only same-directory siblings
  (`./x`); test files may add vitest/fast-check/node:. The glob-driven gate picks up
  new modules automatically. Type-only `./record` imports are established practice
  (agari.ts imports `type Meld` this way).
- **Barrel**: new module ⇒ one `export * from './x'` line in `src/core/index.ts`.
- **Doc style**: module-opening role comment situating it in the architecture;
  contract-level doc comments on exports (what is frozen, what throws, what is
  fresh, purity claims explicit).
- **Error style**: wrong-arity queries are caller corruption ⇒ RangeError naming the
  numbers (decomposeAgari precedent: "requires N concealed tiles with M melds, got
  K"). Kind VALUES are trusted (compile-time union + log-parser-boundary rule).
- **Double-entry over sharing**: legal.ts re-states record.ts rules rather than
  importing them, locked by agreement suites. agari.ts keeps `countsOf` private;
  a consumer wanting counts builds its own.

## 6. Test conventions (src/core/*.test.ts, esp. agari.test.ts)

- vitest + fast-check; property suites choose numRuns deliberately (agari.test.ts
  uses 200–300); whole suite currently 236 tests ≈ 1s via `just test`.
- agari.test.ts precedents this suite inherits directly:
  - `h('123m55z')` mpsz shorthand — test-local; -01's review put a third copy at
    the extraction bar, so a SECOND copy here stays local.
  - `FAKE_MELDS` — arity-only meld stubs with arbitrary tile ids. **Caution for
    this ticket**: waits reads meld tile KINDS (exhaustion counting), so
    arbitrary-id meld stubs are no longer content-neutral; property melds must
    carry kinds consistent with the hand's 4-copy budget.
  - `buildWinner(meldCount, setChoices, pairChoice)` — deterministic constructed
    winners under the 4-copy cap, no rejection loop; consumes nothing for melds
    (arity only). A winner minus any one tile is a guaranteed-tenpai 13-tile hand
    whose waits contain the removed kind (unless self-exhausted) — the natural
    positive-dense generator for this ticket, needing a meld-content-aware upgrade.
  - Fixture style: expected values hand-derived in comments from the rules, never
    from module output; anti-vacuity assertions built into properties.
- The AC's oracle IS -01's agari ("every kind in waits completes agari"), itself
  verified against an independent brute-force reference — so waits' property suite
  may lean on decomposeAgari as the completion oracle without re-importing the
  reference, provided fixtures carry independent hand-derived expectations.

## 7. Constraints and assumptions surfaced

- Pure read, seeded-determinism invariant: no RNG, no input mutation, fresh output
  arrays, same input ⇒ same output, deterministic documented order.
- Kind-level API in and out (TileKind lists), consistent with -01; fold-side TileId
  mapping stays at the caller boundary.
- 34 decompose queries per waits call ≈ tens of µs — property budgets are set by
  fc run counts, not the module.
- The exhaustion convention must be DOCUMENTED and TESTED per the AC — the rule
  choice (structural-but-impossible kinds excluded? included? flagged?) is a Design
  decision; research only records that both self-exhaustion producers exist and
  that the three named consumers (ron, furiten, tenpai) read the same list.
- No shanten machinery — E-005 scopes win detection; waits answers "which kinds
  complete", not "how far from tenpai".

## 8. Files in scope

| File | Role today | Touch expected |
|---|---|---|
| src/core/waits.ts (name TBD in Design) | does not exist | NEW — the waits derivation |
| src/core/waits.test.ts | does not exist | NEW — fixtures + property suite |
| src/core/index.ts | barrel | +1 export line |
| src/core/agari.ts | decomposer (the oracle) | read-only import |
| src/core/tiles.ts | kinds/counts foundation | read-only import |
| src/core/record.ts | Meld type + meld tile content | read-only (type + kindOf reads) |
| src/core/purity.test.ts | import gate | untouched; auto-covers the new module |
