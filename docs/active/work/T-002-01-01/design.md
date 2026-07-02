# T-002-01-01 — Design: dora indicator → dora kind mapping

Decisions with rationale, grounded in research.md. Two axes: **where the code lives**
and **how the mapping is computed**; plus the API shape and the test design.

## 1. Where the code lives

### Option A — extend `tiles.ts`

The mapping needs nothing outside tiles.ts, so it could live there without breaking the
file's import-free rule.

- (+) No new file; barrel untouched.
- (−) **Wrong layer.** tiles.ts is the *tile domain* — what tiles exist and how they're
  encoded, ruleset-agnostic. "Which tile is dora given an indicator" is *riichi rules
  knowledge*; the ticket itself calls it "the first rules-knowledge function in core".
  Architecture pins "Ruleset: Riichi … isolated behind the engine … so the ruleset
  choice stays redirectable" — folding rules into the domain file erodes exactly that
  seam, and every later rules function (yaku, fu) would have precedent to pile in too.

### Option B — new sibling module `src/core/dora.ts` ✅ chosen

A one-function module importing only `./tiles`, wired into the barrel like `wall.ts`.

- (+) Matches the established pattern: wall.ts is likewise a small single-purpose module
  over tiles.ts. The purity gate covers it automatically (`import.meta.glob('./*.ts')`).
- (+) Gives sibling ticket T-002-01-02 (dead wall + indicator flip) and later dora work
  (ura, kan-flipped indicators, dora-han counting) a natural home rather than a scatter.
- (+) Keeps tiles.ts import-free and ruleset-agnostic.
- (−) One more file for ~15 lines today. Accepted: the architecture prefers legible
  seams over file-count thrift, and the file will grow (dora counting is a known
  consumer).

### Option C — new `rules.ts` grab-bag module

Rejected: "rules" is an unbounded name that would become a dumping ground; scoring/yaku
deserve their own modules when their tickets arrive. `dora.ts` is scoped to one concept.

## 2. How the mapping is computed

### Option 1 — arithmetic on suit/rank ✅ chosen

Branch on `suitOf`: numbered suits use `rank % 9 + 1` in the same suit; honors split at
digit 4 into the wind cycle (`d % 4 + 1`) and dragon cycle (`(d - 4) % 3 + 5`).

- (+) The code *is* the rule statement — three cycles, three lines; each wraparound is
  the modulo, not a special case.
- (+) Mirrors how tiles.ts computes rather than tabulates (`buildKinds()` loops; the
  literal table lives in the *test* as the second independent spelling — tiles.test.ts
  pins `TILE_KINDS` as a 34-element literal). Same division of labor here: source
  computes, test pins literals.
- (−) Honor-digit extraction needs `Number(kind[0])` since `rankOf` returns null for
  honors — a small local decode, same trick suitOf uses (`kind[1]`).

### Option 2 — hand-written 34-entry literal `Record<TileKind, TileKind>`

- (+) Maximally explicit; totality visible at a glance (and checkable by the type system
  with a `satisfies Record<TileKind, TileKind>`).
- (−) If the source is the table and the test is also a table, both spellings are the
  same *kind* of artifact — a transcription typo pattern-matched into both places is
  plausible (e.g. mis-cycling winds identically). Computing in source and tabulating in
  test makes the two spellings genuinely independent, which is the codebase's
  established defense (see wall.test.ts's frozen vector, tiles.test.ts's literal order).
- Rejected, but the *test* will carry the full literal table (see §5), so we still get
  the at-a-glance review artifact — on the verification side.

### Option 3 — Map prebuilt by walking TILE_KINDS with successor logic

Builds a `ReadonlyMap` at module load. Rejected: the builder would contain the same
arithmetic as Option 1 *plus* map plumbing — more moving parts, no added safety (O(1)
vs O(1) at this scale), and the KIND_INDEX-map precedent in tiles.ts exists for a
hot-path index lookup, which this is not (34 calls per hand at most).

## 3. API shape

```ts
export function doraKindOf(indicator: TileKind): TileKind
```

- **Name:** follows the dominant local convention `xxxOf(kind)` (`suitOf`, `rankOf`,
  `kindOf`, `kindIndexOf`) — reads as "the dora kind of (this indicator)".
  `doraFromIndicator` and `nextDoraKind` considered; rejected as convention breaks
  (`nextDoraKind` also mis-suggests iteration/state).
- **Kind → kind, not id → kind:** the AC speaks only in TILE_KINDS; physical indicator
  tiles are decoded upstream with `kindOf(id)` (T-002-01-02's job). Taking a TileId here
  would couple rules knowledge to the id encoding for no benefit.
- **Total, no errors:** input domain is the closed `TileKind` union; every input has a
  defined output. No null, no throw. Ids from outside the program are validated at the
  log-parser boundary per tiles.ts's stated policy — same stance here.
- **No extra exports:** no wind/dragon predicates, no inverse function, no multi-
  indicator helper. None is needed by the AC or the named consumers; adding speculative
  surface to the public barrel is scope creep. Ura-dora uses the same function later.

## 4. Rejected scope extensions

- **`isWind` / `isDragon` predicates in tiles.ts** — only this function needs the split
  today, and it needs the *digit*, not a boolean. Revisit when a second consumer appears
  (yaku: yakuhai will want it — that ticket can promote it).
- **Red fives / aka dora** — no red-five concept exists in the tile domain; out of scope.
- **Indicator *position* in the dead wall** — T-002-01-02 owns it.
- **Dora *counting* in a hand** — scoring epic owns it; this ticket is the mapping only.

## 5. Test design (the AC, plus the cheap strong properties)

New `src/core/dora.test.ts`, importing from `'./index'` (public-surface convention),
vitest + exhaustive enumeration — the 34-kind domain is small enough that "property test"
here means *exhaustive* over the whole domain (tiles.test.ts precedent), no fc needed:

1. **Totality (AC):** for every kind in `TILE_KINDS`, `doraKindOf(kind)` is a member of
   `TILE_KINDS` (Set membership).
2. **Pinned wraparounds (AC):** the five named cases — 9m→1m, 9p→1p, 9s→1s, 4z→1z,
   7z→5z — as direct literal assertions.
3. **Full table as the second independent spelling:** all 34 pairs as a literal object,
   hand-derived from the rule text (E→S→W→N→E; haku→hatsu→chun→haku), mirroring how
   tiles.test.ts pins the canonical order literally. Subsumes 1–2 but the AC cases stay
   as their own named assertions for legibility.
4. **Structural properties (cheap, catch whole bug classes):**
   - *Permutation:* the image of TILE_KINDS has 34 distinct members (bijectivity —
     catches two indicators mapping to one dora).
   - *Group closure:* numbered indicators map within their own suit; winds map to winds
     (index 27–30); dragons to dragons (31–33) — catches the classic 4z→5z bug.
   - *No fixpoints:* `doraKindOf(k) !== k` for all k — every cycle has length ≥ 3.
   - *Successor rule:* for numbered ranks 1–8, dora rank = rank + 1 (the non-wrap bulk).

Verification gate: full `just test` (all 6 suites incl. purity gate) and `just check`.

## 6. Risks

Near-zero mechanical risk. The one real failure mode is *encoding the rule wrong* (wind
or dragon cycle direction); defense is the doubly-spelled table (arithmetic in source vs
hand-written literal in test) plus the AC's named wraparound pins. Rule cross-checked:
indicator→next-tile, winds ESWN cyclic, dragons haku→hatsu→chun cyclic — standard riichi
(EMA/WRC rules concur).
