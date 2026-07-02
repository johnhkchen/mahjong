# T-004-01-02 — kan-three-forms-rinshan-kandora — Plan

Steps in execution order; each lands green and commits atomically. Gates:
`just test` + `just check` per step, `just build` at the end. References:
design.md D1–D6, structure.md for the module shape.

## Step 0 — Baseline

Run `just test` and `just check` on the current tree; both must be green
before anything moves (T-004-01-01 left 124 tests green). Confirms no drift
from concurrent tickets on the shared branch.

Verify: both commands exit 0.

## Step 1 — State growth (commit 1)

`record.ts`:
- Widen `Meld` to the D2 discriminated union (chi/pon member textually
  unchanged; daiminkan/shouminkan/ankan members added).
- Add `doraIndicators: TileId[]` and `doras: TileKind[]` to `TableState` with
  the D4 doc comments; extend the `dead` and `phase` doc comments per
  structure §record.ts(4).
- `foldRecord`: initial literal gains `doraIndicators: [doraIndicator]`,
  `doras: [<mapped kind>]` (reuse the already-computed `dora` value).

`record.test.ts`:
- Empty-log property literal (:70) gains the two fields (derived from the
  partition, not the fold: `[partition.doraIndicator]` / mapped kind).
- Seed-1 golden gains `expect(state.doraIndicators).toEqual([24])` and
  `expect(state.doras).toEqual(['8m'])`.

Verify: all existing tests green with zero behavioral change — this commit is
purely additive state. Commit: `T-004-01-02: kan-ready state — Meld union,
doraIndicators/doras plurals`.

## Step 2 — Anchor scan (scratchpad, no commit)

A scratchpad script (flox vitest node or `npx tsx`) scanning seeds × short
legal prefixes, using only frozen upstream contracts (buildWall →
partitionWall → dealHands), to locate and FREEZE as literals:

1. **Daiminkan anchor**: a seat holding three copies of a kind whose fourth
   copy is discardable early by another seat (in that seat's dealt hand —
   tedashi — or an early tsumogiri draw). Prefer a non-adjacent caller so the
   turn jump is visible. Record: seed, prefix actions, the three `uses`, the
   claimed tile.
2. **Ankan anchors ×2**: a seat whose dealt hand holds three copies and whose
   own draw at a known live index is the fourth (drawn ∈ uses); and a seat
   dealt all four copies, kanning after any draw (drawn ∉ uses — pins the
   append rule). The second shape is rare in one seed but the scan is cheap
   (~10⁴ seeds × arithmetic on the frozen deal map); if truly absent, route
   the fourth copy in via a pon-free tedashi chain instead — any legal prefix
   is admissible.
3. **Shouminkan anchor**: a seat holding three copies pons the fourth's...
   inverse — holds three, another seat discards the fourth, the holder PONS
   with two copies keeping the third, then on a later own turn (after a
   draw) adds the kept copy. Entirely constructible from the daiminkan-shaped
   scan output (same tile geometry, different actions) — one scan feeds both.
4. **Two-kan sequence**: extend whichever anchor allows a second kan (e.g.
   ankan then shouminkan by the same seat, or two seats' kans in one hand) to
   pin the rinshan order dead[0]→dead[1] and indicator walk dead[6]→dead[8].
   If no single seed offers two natural kans cheaply, chain via tedashi
   routing; legality is the only requirement.

Each frozen anchor gets a derivation comment (kind arithmetic per house
style, "never regenerate"). Scan script stays in the scratchpad — never
committed; its OUTPUT (literals + comments) is what enters the test file.

Verify: each anchor's prefix folds legally against the CURRENT engine (chi/
pon/draw/discard only reach the kan point); the kan action itself waits for
Step 3.

## Step 3 — The kan step + positive suites (commit 2)

`record.ts` (structure §record.ts 1, 7, 8):
- Three `HandAction` members + CONTRACT FREEZE doc additions.
- Helpers: `kansMade`, `guardRinshanAvailable`, `applyKanTail(state, k)`;
  extract `applyDaiminkan`/`applyAnkan`/`applyShouminkan` beside `applyClaim`
  (the switch stays a dispatch table, matching -01's factoring).
- Guard orders and messages exactly per D5/structure; every throw
  `RangeError` naming `action ${index}`.

`record.test.ts` — `describe('kan forms fold')` + `describe('kan wall
accounting')` per structure §test(2–3):
- Per-form positives: meld literal, hand shrinkage (13→10 daiminkan;
  14→10+rinshan for ankan), turn jump (daiminkan) / turn retention
  (ankan/shouminkan), `drawn` === frozen dead[0], dead.length === 14 with the
  live tail tile at the end, `doraIndicators`/`doras` (hand-derived kinds via
  doraKindOf's frozen cycle), live length arithmetic, claimed-tile pond mark
  (daiminkan), in-place pon upgrade (index preserved) for shouminkan, the
  rinshan discard reopening the claim window.
- Two-kan sequence: rinshan dead[0] then dead[1]; indicators original dead[6]
  then dead[8] (asserted as frozen tile literals, not index arithmetic).
- Ryuukyoku one-earlier: build a full-hand record around one kan — after the
  kan, tsumogiri turns continue until the live wall empties; assert the total
  normal-draw count is 69, `phase === 'ryuukyoku'`, `live` empty, and the
  same record minus its final discard is still `playing` (the unchanged flip
  condition).
- Conservation at every prefix of every kan anchor via `allZonesWithMelds`
  (136 ids, all distinct — dead included, so the shift/push accounting is
  exercised at each step).
- Double-fold determinism + immutability over a kan-bearing record
  (structuredClone snapshot; fresh-array checks on melds/dead).

Verify: `just test` green (existing 124 + new positives), `just check` green.
Commit: `T-004-01-02: kan step — daiminkan/ankan/shouminkan, rinshan,
kan-dora, wall shortening`.

## Step 4 — The negative matrix (commit 3)

`record.test.ts` — `describe('illegal kans throw instead of folding
silently')`, one test per D5 guard through the `expectClaimThrows` pattern:

- daiminkan: no window (at deal), stale after next draw, own discard, wrong
  tile, duplicate uses, unheld use (claimed tile doubling as a use included),
  three-of-a-kind mismatch (kinds unequal).
- ankan: wrong seat, before drawing, while a claim discard is owed
  (mustDiscard — the explicit guard message), duplicate uses, use neither
  held nor drawn, kinds unequal.
- shouminkan: before drawing, tile neither held nor drawn, no owned pon of
  the kind (wrong form), a CHI of adjacent kinds does not qualify as the pon.
- wall guards: ankan on the haitei draw (live empty while playing — the
  empty-wall AC case), fifth kan after four (dead-wall exhaustion; reuse the
  two-kan anchor extended, or a constructed four-kan chain if one is cheap —
  otherwise assert via kansMade by chaining ankans of dealt triplets across
  an engineered seed; the scan of Step 2 flags candidates).
- any kan after ryuukyoku (ended-hand guard).

Guard-order exhibits: at least one case per form carrying otherwise-valid
later parts, proving which guard speaks first.

Verify: `just test` green; every case asserts RangeError + fragment +
`action ${prefix.length}`. Commit: `T-004-01-02: illegal-kan matrix — every
kan guard throws by index`.

## Step 5 — Acceptance sweep + artifacts (commit 4)

- Re-read the AC line by line against the suite (rinshan from dead[0..3] ✓,
  kan-dora rightward from dead[4] ✓, exhaustive draw one earlier per kan ✓,
  conservation after every fold ✓, illegal kans throwing ✓ — each mapped to
  named tests in review.md).
- `just test`, `just check`, `just build` all green.
- Write progress.md (during steps, finalized here) and review.md; commit
  artifacts. No ticket frontmatter changes (lisa owns transitions).

## Testing strategy summary

Unit-level: example anchors with wall-derived frozen expectations (the house
rule — nothing read back from the fold under test); targeted properties only
where the input space is cheap (prefix sweeps for conservation). Integration:
none beyond the fold itself — legalActions/dynamics deliberately deferred to
T-004-01-03/04. No `/verify` app drive: kans are unreachable from the app
until legalActions offers them; unchanged app behavior is covered by the
untouched drive/SSR suites and `just check`/`just build`.

## Risks & watchpoints

- **The dead-index arithmetic** (flip BEFORE mutate, `dead[6 + k]`) is the
  one place a silent off-by-one could survive review — the two-kan sequence
  test with frozen tile literals is the tripwire; do not weaken it to index
  assertions.
- **Anchor scarcity**: dealt triplets are common (~ most seeds have one
  somewhere) but specific geometries (dealt quads) may need tedashi routing;
  budget scan time in Step 2 and prefer constructed prefixes over exotic
  seeds — legality, not naturalness, is the requirement.
- **`live.pop()` on a 1-tile wall during a kan** is legal (the pop empties
  live; ryuukyoku then fires on the very next discard) — cover it in the
  ryuukyoku-one-earlier construction rather than guarding it away.
- **Type widening fallout**: the Meld union may surface `own` tuple-length
  assumptions in app code; `just check` at Step 1 catches this before any
  step logic exists.
