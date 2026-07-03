# T-006-02-01 — standard-form-shanten — Research

What exists, where, and how it connects. Descriptive only; the design phase decides.

## 1. The ticket

The standard four-sets-plus-a-pair shanten count over a seat's concealed 34-kind
counts, discounting called melds — the core datum "competent" is defined against.
AC: `src/core` exports a standard-form shanten function returning an integer; unit
tests pin known hands (complete = −1, tenpai = 0, 1-shanten, and a maximally
scattered 13-tile hand), with called-meld counts reducing required sets.

Scope fence from the sibling tickets (story S-006-02, "shanten-crown"):

- **T-006-02-02** (depends on this one) adds chiitoitsu and kokushi shanten plus the
  `shanten(hand, melds) = min(standard, chiitoi, kokushi)` combinator. So THIS ticket
  is standard form ONLY — no special forms, no min-of-three.
- **T-006-02-03** adds the brute-force-reference property tests and the
  `shanten === 0 ⟺ isTenpai` agreement. So this ticket's tests are PINNED FIXTURES,
  not property sweeps — the property crown lands two tickets later.
- **T-006-03-01** (discard-policy) is the first real consumer: it picks the
  shanten-minimizing discard from a 14-tile view, so it will call this function once
  per discard candidate per turn (~14 calls), plus the teaching prompts later.

## 2. Where shanten would live: the core module map

`src/core/` is the pure engine — framework-agnostic TS, zero DOM imports, one module
per concern, all re-exported through the barrel `src/core/index.ts` (tiles, rng,
wall, dora, deal, record, legal, agari, waits, yaku, yakuman). There is NO shanten
code anywhere in the repo today (`grep -ri shanten src/` matches only test-file
comments' absence — zero hits). A new concern of this size gets its own module file
plus a sibling `.test.ts`, following every existing pair (`agari.ts`/`agari.test.ts`,
`waits.ts`/`waits.test.ts`).

## 3. The tile domain (`src/core/tiles.ts`)

Everything shanten needs already exists:

- `TileKind` — the 34 kinds in mpsz notation (`'1m'`…`'7z'`), a compile-time union.
- `TILE_KINDS` — canonical kind order (1m…9m, 1p…9p, 1s…9s, 1z…7z); position in this
  array is the canonical kind index, "the ordering used for hand sorting and
  count-array algorithms downstream" (its own doc comment anticipates this ticket).
- `kindIndexOf(kind)` — kind → 0..33. `KIND_COUNT` = 34.
- Suit-block arithmetic convention: numbered kinds occupy indices 0..26 in three
  9-blocks; honors 27..33. `agari.ts` guards runs with `k < 27 && k % 9 <= 6` so a
  run never crosses a suit boundary through the contiguous indices.

## 4. The nearest relative: `agari.ts` (the standard-form decomposer)

`decomposeAgari(concealed, melds)` already contains a standard-form backtracker over
a 34-slot counts array (`searchSets`, agari.ts:70-106): resolve the lowest nonzero
kind completely (triplet and/or run-starts), mutate-recurse-restore, emit complete
partitions. Key precedents this ticket inherits:

- **Kind-level, not tile-level**: physical copies never affect shape; inputs are
  `readonly TileKind[]` + `readonly Meld[]`.
- **Melds read for ARITY ONLY** (agari.ts header comment): a call is a completed
  set whatever its content; the concealed side must decompose into `4 − melds.length`
  sets plus the pair. Shanten's "called melds reduce required sets" is the same rule.
- **Arity contract**: wrong-arity input throws `RangeError` naming both numbers
  (`decomposeAgari requires N concealed tiles with M melds, got K`); melds > 4
  throws. Kind VALUES are trusted (compile-time union; log-parser validates at the
  program boundary).
- **Purity contract**: inputs never mutated (borrow-and-restore on the counts
  array), fresh outputs, same input ⇒ same output.
- `countsOf(concealed)` (agari.ts:51-55) — the 34-slot count-array builder — is a
  private function there; `waits.ts` rebuilt its own variant (`visibleCounts`)
  rather than exporting it.

The decomposer is exhaustive over COMPLETE partitions only — it has no notion of
partial sets (pairs-in-waiting, proto-runs), so it cannot answer "how far from
complete". Shanten needs a different search, but over the same counts representation
with the same suit-block guards.

## 5. The nearest consumer-precedent: `waits.ts`

`waits(concealed, melds)` probes all 34 kinds through `isAgari` on a 13−3k-tile
hand; `isTenpai = waits(...).length > 0`. Two facts matter for shanten:

- **Exhaustion is waits' concern, not shape's**: waits reads meld CONTENT because a
  kind whose four copies are all visible to the hand can never arrive. Shanten, like
  agari, is a SHAPE distance — the sibling AC (T-006-02-03) pins
  `shanten === 0 ⟺ isTenpai` only through the waits module's own exhaustion
  convention, which that ticket will reconcile. Nothing in this ticket's AC asks
  shanten to see copies.
- **Arity precedent for the 13-tile side**: waits guards `13 − 3·melds` and throws
  from the 13 count, not the inner 14 probe.

A shanten function is useful at BOTH arities: between turns (13 − 3k tiles: "how far
is this hand") and after a draw (14 − 3k: the discard policy compares candidate
discards; a complete 14-tile hand is the −1 the AC names). `decomposeAgari` is
14-side, `waits` is 13-side; no existing module accepts both.

## 6. The Meld type (`src/core/record.ts:125-153`)

Discriminated union: `chi | pon` (claimed + from + own[2]), `daiminkan`,
`shouminkan` (claimed + from + own[3]), `ankan` (own[4], nothing claimed). For
arity-only reading, only `melds.length` matters — a kan is ONE set (the agari.ts
comment: "the concealed remainder is 14 − 3·melds tiles regardless of kan count").

## 7. Test conventions (`agari.test.ts`, `waits.test.ts`)

- `h('123m55z')` mpsz shorthand — a test-local helper, re-declared per suite (not
  shared; each suite copy is ~13 lines).
- Fixtures carry HAND-DERIVED expected values with rule-derived comments — expected
  values reasoned in the comment, never generated from module output.
- `vitest` + `fast-check` (fast-check used in waits/agari property suites; this
  ticket's AC asks for pinned unit tests only — properties are T-006-02-03).
- Contract describe-blocks pin: RangeError messages verbatim, purity
  (inputs unmutated, repeat calls identical), result-order contracts.
- Meld fixtures: waits.test.ts builds REAL melds (content-honest); agari.test.ts
  uses arity-only stubs (`FAKE_MELDS`) since agari reads arity only. A shanten that
  reads arity only can use the stub style.
- `just test` runs vitest over src/core; `just check` runs svelte-check + tsc.
  `purity.test.ts` enforces zero-platform-import purity over core modules (a new
  core module is automatically in its sweep — it globs `src/core/*.ts`).

## 8. Shanten domain facts (rules knowledge the design must encode)

- Standard-form shanten over a 13-tile hand: minimum tile exchanges to reach tenpai;
  tenpai = 0; a complete 14-tile hand = −1 by convention.
- The classical block-count formulation: over a decomposition into `m` complete sets,
  `t` partial sets (a pair used as proto-triplet, or two suit tiles at distance 1 or
  2 — a proto-run), and an optional reserved head pair,
  `shanten = 8 − 2·(melds + m) − t − (head ? 1 : 0)`, MAXIMIZED over all disjoint
  decompositions, with the block cap `m + t ≤ 4 − melds`. The cap and the explicit
  head flag are what keep the formula exact; greedy or uncapped variants have known
  counterexamples.
- Bounds: 13-tile standard shanten ranges −1 (impossible at 13; min 0) … 8 (thirteen
  mutually unreachable tiles, e.g. `147m147p147s` + four distinct honors). With k
  melds the range tightens (fewer concealed tiles, fewer required sets).
- Partial-set legality mirrors run legality: proto-runs only within a numbered-suit
  9-block (adjacent: rank ≤ 8 same suit; gapped: rank ≤ 7 same suit); honors form
  pairs/triplets only.
- "13-tiles-apart" in the AC reads as the maximally scattered 13-tile hand — the
  worst-case fixture pinning the top of the range.

## 9. Constraints and assumptions surfaced

- **Purity + determinism**: pure read, no RNG, no mutation — policy (T-006-03-01)
  requires repeated calls on the same view to return the same action.
- **Performance envelope**: the discard policy calls shanten ~14× per AI turn, and
  T-006-02-03 will sweep it under fast-check against a brute-force reference; the
  search must be exhaustive-but-pruned, not exponential-blind. `searchSets` shows
  the house style for a bounded backtracker (lowest-kind-first, consume-completely).
- **Export surface**: new module + barrel re-export in `src/core/index.ts` (the
  app imports only from the barrel). Name must leave room for T-006-02-02's
  combinator to claim the plain `shanten` name.
- **No app-side work**: the AC touches src/core and its tests only; no Svelte, no
  drive.ts wiring.
- **Working tree note**: ticket frontmatter files show as modified in git status
  (lisa's bookkeeping); work lands on `main` alongside other ticket threads —
  commits should stay scoped to this ticket's files.

## 10. Open questions carried to Design

1. Accept one arity (13−3k) or both (13−3k and 14−3k)? The AC's "complete = −1"
   needs the 14 side; the policy consumer wants both.
2. Search shape: adapt `searchSets`' consume-completely style to partial sets, or a
   per-kind branch backtracker with memo/prune? Both live over the same counts array.
3. Signature: `(concealed, melds)` like agari/waits, or counts-array-in? All
   existing module faces take `readonly TileKind[]` + `readonly Meld[]`.
4. Where the counts-array builder lives — third private copy, or promote a shared
   helper (agari.ts and waits.ts each have a private one already).
