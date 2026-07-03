# T-005-01-03 — standard-yaku-catalog — Structure

The blueprint: two new files plus one barrel line. record.ts, agari.ts, tiles.ts,
legal.ts are read-only; purity.test.ts must stay green untouched.

## Files

| File | Change |
|---|---|
| src/core/yaku.ts | NEW — WinContext, YakuName, the 27-predicate catalog |
| src/core/yaku.test.ts | NEW — per-yaku fixture table + interaction/purity suite |
| src/core/index.ts | append `export * from './yaku'` (merge-trivial vs -02) |

## src/core/yaku.ts — internal organization (top to bottom)

Imports: `./tiles` (value: kindIndexOf/rankOf/suitOf/isHonor/isTerminal/isSimple,
type: TileKind), `./agari` (types: AgariDecomposition, ConcealedSet), `./record`
(type: Meld). Same-directory only — purity-gate legal.

1. **Module role comment** — the catalog is the yaku-NAMES half of win
   evaluation: per-decomposition predicates over a caller-assembled WinContext;
   han/fu belong to the scoring epic; -04 layers yakuman + the aggregator on top;
   the fold (-02-01) assembles contexts. States the closed-catalog rule and the
   riichi-family exclusion (extend-only YakuName widening when riichi lands).

2. **`YakuName`** — 27-literal union in traditional table order (design D3).

3. **`STANDARD_YAKU_NAMES: readonly YakuName[]`** — same order, `Object.freeze`d
   (the TILE_KINDS precedent). Doc: catalog order is the frozen result order of
   standardYakuOf.

4. **`WindKind`** — `'1z' | '2z' | '3z' | '4z'`, doc noting Seat→wind is
   `${seat+1}z` (deal.ts anchor) and why it lives here (design D2).

5. **`WinContext`** — interface per design D2, with contract-level docs per field:
   one decomposition per context (aggregation is -04's), `source` subsumes
   tsumo/ron, `lastTile` read only for wall/discard sources, winds caller-supplied.

6. **Internal helpers** (not exported):
   - `meldSetOf(meld): ConcealedSet` — chi → `{ type: 'run', start: min kind }`
     (min by kindIndexOf over claimed+own); pon/kans → triplet of own[0]'s kind.
     Doc: shapes were validated at claim time by record.ts.
   - `isMenzen(melds)` — every meld ankan.
   - `combinedSets(ctx): ConcealedSet[]` — decomposition.sets + melds mapped
     (standard form only; callers guard).
   - `allKinds(ctx): TileKind[]` — every tile kind with multiplicity: standard
     (pair×2 + set expansion + meld tiles), chiitoitsu (pairs×2), kokushi (the 13
     + pair). Run expansion via kindIndexOf/TILE_KINDS arithmetic (suit-block
     safety already guaranteed by run construction).
   - `concealedTripletCount(ctx)` — decomposition triplets + ankans, with the
     sanankou ron adjustment (design D5) inline or as a private step.
   - Small scans: `runsOf(sets)`, `tripletsOf(sets)`, `isYakuhaiKind(ctx, kind)`
     — only where they pay for themselves; predicates otherwise inline their
     loops (each ≤5 elements — no abstraction tax for one caller).
   - `isTsumo(ctx)` — source wall|rinshan.

7. **27 private predicate functions**, one per name, each with a doc comment
   stating its rule AND its convention decisions where they exist (kuitan
   allowed; iipeikou/ryanpeikou disjoint; chanta/junchan/honroutou disjointness
   clauses; sanankou's ron adjustment and ≥3; sankantsu ≥3; haitei excludes
   rinshan by source). Order matches YakuName order.

8. **`STANDARD_YAKU` private table** — `readonly { name: YakuName, test: (ctx) =>
   boolean }[]` zipping names to predicates in catalog order. Private per D4.

9. **`standardYakuOf(ctx: WinContext): YakuName[]`** — the exported face:
   - Guards (RangeError, self-locating messages): standard form with
     `sets.length + melds.length !== 4`; chiitoitsu/kokushi with `melds.length
     !== 0`.
   - Kokushi decomposition → `[]` (yakuman, -04's) — after the guard, before the
     scan.
   - Filter the table; fresh array out; names in catalog order. Doc states:
     purity (no mutation, same ctx ⇒ same list), `[]` = "no standard yaku", the
     per-decomposition contract, and that the one-yaku GATE is -04's aggregator,
     not this function.

## src/core/yaku.test.ts — organization

Imports from `./index` (the agari.test.ts precedent), plus vitest. fast-check
only if a property earns it (the suite is fixture-driven by design D6).

1. **Header comment** — per-yaku rigor exhibit: every catalog yaku one positive +
   one adversarial near-miss negative, driven by a total table; expectations
   derived from the rules in comments, never from module output.

2. **Helpers** (test-local):
   - `h(spec)` — mpsz shorthand, same as agari.test.ts.
   - Meld builders with REAL kinds: `chi(startKind)`, `pon(kind)`,
     `daiminkan(kind)`, `shouminkan(kind)`, `ankan(kind)` — tileId()-built,
     copies 0–3, claimed/from arbitrary but well-typed.
   - `ctxOf(spec, overrides?)` — concealed tiles through the REAL decomposeAgari;
     throws if not a win (fixture typo safety); default context `{ source:
     'wall', lastTile: false, seatWind: '1z', roundWind: '1z', winningKind:
     first tile of spec }` with overrides; picks decomposition by `decompose`
     override (predicate or index) when a hand is ambiguous, else expects exactly
     one reading and asserts so.
   - Fixture hands deliberately avoid 1z when winds shouldn't fire (defaults make
     1z yakuhai — cases that hold winds set seatWind/roundWind explicitly).

3. **`CASES` table** — `Record<YakuName, { positive: WinContext | () =>
   WinContext, negative: same }>` — totality checked by the type, iterated with
   `describe.each`/loops over STANDARD_YAKU_NAMES: positive asserts name ∈
   standardYakuOf(ctx), negative asserts ∉. Each entry's comment derives WHY
   (e.g. sanankou negative: "third triplet completed by the ron tile, no
   absorbing run — 2 concealed").

4. **Interaction/edge describes** (design D6 list): ryanpeikou-not-iipeikou;
   chanta/junchan/honroutou pairwise boundaries; double-east double wind fire;
   pinfu wait-shape trio (kanchan/penchan/tanki) + otakaze-pair positive;
   sanankou ron adjustment both directions; honroutou-over-chiitoitsu (+ toitoi
   co-fire on the standard shape); menzen-tsumo with ankan; rinshan-not-haitei
   on lastTile; kokushi → `[]`; yakuless open hand → `[]`; result order equals
   catalog order (a multi-yaku hand); STANDARD_YAKU_NAMES frozen/complete.
5. **Contract describes**: guard throws (arity corruption, melded chiitoitsu
   ctx); purity (deep-equal repeat calls, inputs unmutated).

## src/core/index.ts

Append one line after `export * from './agari'`:
`export * from './yaku'` — keeps barrel order = dependency order; appending (not
inserting) keeps the diff conflict-free against -02's own barrel line.

## Ordering of changes

1. yaku.ts types (YakuName, STANDARD_YAKU_NAMES, WindKind, WinContext) + barrel
   line — compiles standalone.
2. Helpers + circumstance/simple predicates + standardYakuOf over a partial
   table? NO — the table is total from the start; predicates land in 2–3 groups
   with the function and guards first (throwing catalog stubs never ship: the
   table is only wired once all 27 exist, so intermediate commits keep the suite
   green by scoping tests to what exists — see plan.md steps).
3. Test helpers + CASES rows alongside their predicate groups; interaction and
   contract tests last.

## Boundaries respected

- Zero DOM/platform imports; same-directory imports only (purity gate).
- No han/fu symbols anywhere — not even private constants (the AC says "no
  han/fu values anywhere in its API"; keeping them out of the file entirely
  removes the temptation and the review question).
- No exports beyond the five in D4 — -04 gets WinContext/YakuName/
  STANDARD_YAKU_NAMES/standardYakuOf; if it needs isMenzen/meldSetOf it promotes
  them THEN (its diff, its call).
- record.ts/agari.ts untouched; TableState never mentioned in yaku.ts.
