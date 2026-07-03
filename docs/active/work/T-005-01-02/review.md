# T-005-01-02 — tenpai-waits — Review

Handoff summary: what changed, how it is tested, what a human should look at.

## What changed

| File | Change |
|---|---|
| `src/core/waits.ts` | NEW (~75 lines) — the waits derivation + isTenpai |
| `src/core/waits.test.ts` | NEW (~390 lines) — fixtures + meld-aware property suite |
| `src/core/index.ts` | +1 line — `export * from './waits'` |

Commits, in order: `ef3430f` (module + barrel), `1d3ae53` (fixtures), `ae4c1b0`
(property suite). agari.ts, record.ts, legal.ts untouched as planned — the ron/tsumo
offering wires waits in at T-005-02-01.

## The API (what downstream tickets consume)

`waits(concealed: readonly TileKind[], melds: readonly Meld[]): TileKind[]` — every
kind that completes the between-turns hand (13 − 3·melds kinds, no drawn/claimed
tile) to agari AND can still physically arrive; ascending TILE_KINDS order (frozen
contract); `[]` IS the noten signal. `isTenpai` is the emptiness read. Wrong arity /
> 4 melds throws RangeError naming both numbers, counted from the 13-tile side.

**The documented exhaustion convention (design D2, the AC's named edge)**: a kind
all four of whose copies are visible to the hand ITSELF — concealed + own melds'
tiles, claimed included — is never a wait. One filtered list serves all three named
readers: ron (an excluded kind cannot be discarded by anyone else), furiten (it
cannot be in the own pond), and tenpai (`waits.length > 0` IS formal tenpai under
the mainstream Tenhou-style rule — a hand whose every completion is self-exhausted
is noten). Kinds exhausted by OTHER seats' visible tiles are deliberately NOT
excluded (live-tile counting is a hint-layer concern with table visibility).

Implementation is deliberately derivational: visible counts once, then a 34-kind
probe loop through `isAgari` — waits' idea of a win can never drift from the
decomposer's (design D4; the -01 header names waits a consumer that "never
re-derives decomposition"). waits.ts is the first core module to read meld CONTENT;
the contrast with agari's arity-only posture is documented in both modules' terms.

## Acceptance criteria — verified

1. *"for random hands, every kind in waits completes agari and every kind outside
   it does not"* — ✔. The 34-kind biconditional (`k ∈ waits ⇔ visible(k) < 4 ∧
   isAgari(hand + k)`) runs over two distributions: winner-minus-one tenpai hands
   with content-honest melds at arity 0–4 (300 runs) and random 13-tile multiset
   draws (300 runs), plus a 200-run generator self-test.
2. *"noten hands return empty waits"* — ✔. Random draws are negative-dense (checked
   via the biconditional + `isTenpai ⇔ nonempty`); pinned fixtures: aimless hand,
   four-of-a-kind pseudo-chiitoitsu, and the all-waits-exhausted hand.
3. *"exhausted kinds (all four copies visible to the hand) handled per documented
   convention"* — ✔. Convention documented in the module header and waits' doc;
   three fixtures pin it: four concealed copies (1111m…, 1m excluded), own-ankan
   blocking a ryanmen side (waits [4m] only), and the noten-by-exhaustion four-meld
   tanki (own pon holds the other three 5z ⇒ [] / isTenpai false). The `visible <
   4` term in the property biconditional covers it distributionally.

`just test` 259/259 (was 236; +23), `just check` 0 errors, suite wall ~2.2s.

## Test coverage assessment

- **Fixtures (20)**: every classic wait shape (tanki, ryanmen, kanchan, penchan,
  shanpon), cross-suit ascending-order pin (9m/1p — adjacent kind indices), junsei
  chuuren nine-sided, meld-bearing ryanmen, four-meld tanki; chiitoitsu single
  wait + the not-two-pairs rule; kokushi 13-sided (the maximum wait) and single
  wait; all three exhaustion pins; both RangeError messages; purity (inputs incl.
  meld objects unmutated, repeat-call equality); isTenpai on both sides.
- **Property melds are real**: the builder draws meld sets (pon/chi/ankan) and
  concealed sets from ONE 4-copy budget and materializes Meld objects with
  budget-derived copy ids — agari.test.ts's arity-only FAKE_MELDS are unusable
  here since waits reads meld content, and the header says so. Ankan melds
  exercise 4-visible-via-meld exhaustion naturally.
- **Anti-vacuity without the oracle**: winner-minus-one containment (`removed ∈
  waits`) is construction-guaranteed — after removal the kind is under 4 visible
  and its re-add is a known win — consulting neither module nor decomposer.
- **Honest tautology note**: the biconditional restates the implementation's own
  loop against the same decomposer (the AC defines waits in terms of agari, and
  -01 verified agari against an independent brute-force reference). Independence
  in THIS suite lives in the hand-derived fixtures and the containment property.
  This is stated openly in the test-file header.

### Gaps (known, accepted)

- The property builder covers pon/chi/ankan only; daiminkan/shouminkan differ
  solely in the claimed/own split, which `visibleCounts` sums identically (plan
  risk #2, accepted narrowing). Fixture coverage of the claiming forms comes via
  pon/chi.
- Exhaustion-by-four-CONCEALED-copies appears in properties only when random draws
  produce it (the builder caps winners at wall-legal counts, so minus-one hands
  hit meld-side exhaustion more often); the concealed producer is pinned by
  fixture. Acceptable: the filter is one code path over one counts array.
- No fold-integration test — deliberate; T-005-02-01 owns wiring ron/furiten
  through real records.

## Open concerns for a human reviewer

1. **The exhaustion convention is now load-bearing** (design D2). Excluding
   self-exhausted kinds matches Tenhou-style formal tenpai and makes one list
   serve ron/furiten/tenpai — but if the teaching layer later wants to SHOW
   "structurally waiting on 1m, all four in your hand", it must query
   decomposeAgari itself (the -01 header names that capability as why the
   decomposer is kind-level). Adding a second export later is extend-only-cheap.
2. **A fixture derivation error was caught and corrected during implement**
   (progress.md deviation #1): 1111m234m567m999p waits on [4m, 7m], not [4m] —
   the module was right, my hand-math initially missed the 77m-pair reading. Worth
   one reviewer glance at that fixture's comment since it was rewritten mid-phase.
3. **Concurrent -03 (yaku catalog)**: its `./yaku` barrel line landed in
   index.ts after this ticket's commits — no conflict materialized (disjoint
   files; the barrel took both lines). Nothing for this ticket, just context.
4. **isTenpai allocates the full waits list** — same one-code-path choice -01 made
   for isAgari, same justification (µs-scale; no divergence-prone fast path).
5. Ticket frontmatter untouched (`phase: research` / `status: open`) per RDSPI
   rule 3 — lisa advances on artifact detection.

## TODOs handed to later tickets

- **T-005-02-01 (tsumo/ron fold)**: ron legality = `kindOf(discard) ∈
  waits(hand, melds)`; map TileId→kind at the boundary (the -01 handoff rule);
  furiten gating reads the same list against the own pond.
- **Riichi/teaching epics**: `isTenpai` is the declaration gate datum; live-tile
  counting (waits minus table-visible copies) is a hint-layer computation on top
  of this list, not a change to it.
- A THIRD copy of the `h()` mpsz helper now exists across test files
  (agari.test.ts, waits.test.ts — plus any -03 copy): the -01 review set the
  extraction bar at three; whoever adds the next copy should lift it into a
  shared test helper instead.
