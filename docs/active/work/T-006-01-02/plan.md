# T-006-01-02 fair-play-property-tests — Plan

## Preconditions

- `just test` green at start (baseline recorded in progress.md).
- No runtime code changes anywhere in the ticket; the only file touched is
  `src/core/seatview.fairplay.test.ts`.

## Step 1 — Scaffold: sources, surgery, and the guard suite

**Write** the file header, Layer 1 (imports/arbs), Layer 2 (state sources), Layer 3
(surgery + collectors), and the first describe block (`the surgery is a valid sibling
constructor`).

Contents per structure.md:
- Replicas with origin comments: `dealtLive`, `tsumogiriRecord`, `foldedState`
  (seatview.test.ts); `isWin`, `isCall`, `ACTION_BOUND`, `playGreedy`, `playWinEager`,
  `allZones` (dynamics.test.ts).
- Corpora at module load: `greedyCorpus` over seeds [0, 1, 2, 63, 67, 69];
  `winCorpus` over the eight pinned carriers.
- Surgery: `copyState`, `collectHidden`, `writeHidden` (ONE slot-order definition),
  `rotatedSibling`, `shuffledSibling`.
- Collectors: `exposedTileIds` (replica), `publicIds` (independent, from state).

Guard tests (sample: each corpus record at prefix lengths {0, ⌊n/2⌋, n} × all four
seats × both mutants):
1. mutant conserves TILE_COUNT distinct ids across the six zones;
2. mutant public part unchanged field-by-field (own hand, own drawn iff turn,
   ponds, melds, doraIndicators, doras, turn, phase, claimable, mustDiscard, win,
   live.length);
3. rotation non-vacuity: hidden pool size ≥ 2 at every sampled state, and rotation
   changes every hidden slot (all ids distinct ⇒ structural, assert it anyway);
4. a fixed-seed shuffle mutant differs from the original in at least one hidden slot
   for the corpus finals (belt-and-suspenders; rotation is the real vacuity kill).

**Verify:** `just test` — new guard suite green, all existing suites untouched-green.
**Commit:** `T-006-01-02: fair-play scaffold — hidden-pool surgery + sibling guards`

## Step 2 — The equivalence property (AC clause 1)

**Add** describe `hidden-permutation equivalence`:

1. fc property: `fc.assert(fc.property(seedArb, turnsArb, fc.boolean(), seatArb,
   permSeedArb, ...))` — fold tsumogiri state; assert
   `seatView(rotatedSibling(state, seat), seat)` `.toEqual`
   `seatView(state, seat)`; same for `shuffledSibling(state, seat, permSeed)`.
2. Corpus sweep: for each record in greedyCorpus ∪ winCorpus, for every prefix
   length 0..n, for every seat: rotation mutant `.toEqual` original view; shuffle
   mutant with two fixed perm seeds at the SAME prefix (fixed seeds 1 and 2 —
   arbitrary, frozen in a comment) — kan-dora states (63/67/69) and agari states
   (win carriers) pass through the same assertion.

**Verify:** `just test`; deliberately sanity-check the property has teeth by locally
(NOT committed) breaking the slot order in `writeHidden` once and watching the guard
suite fail while equivalence stays green — confirming guards, not equivalence, own
surgery correctness. Then restore.
**Commit:** `T-006-01-02: the AC property — hidden permutations leave every SeatView identical`

## Step 3 — The inclusion property (AC clause 2) + runtime budget

**Add** describe `no tile id outside the public zones`:

1. fc property over the tsumogiri domain: `exposedTileIds(seatView(state, seat))` ⊆
   `publicIds(state, seat)` (every id, `Set.has`).
2. Corpus sweep: every prefix × every seat over both corpora; at agari finals
   additionally assert `view.win` is non-null for the win carriers (the corpus
   citation makes the assertion non-vacuous) and its tile passes the same inclusion.

**Measure:** wall-clock of the new suite (vitest reports per-file time). If the file
exceeds ~2s, stride the corpus prefixes in THIS suite only (every 3rd prefix, comment
the lever); the equivalence suite keeps every prefix — it is the AC.

**Verify:** `just test` (full), `just check` (tsc + svelte-check — the new file must
typecheck under the project config).
**Commit:** `T-006-01-02: no id outside the public zones — inclusion over call-dense and agari states`

## Testing strategy summary

| Concern | Vehicle | Where |
|---|---|---|
| Surgery soundness (bijection, public-part identity, non-vacuity) | example-based guards over corpus samples | Step 1 |
| AC: hidden-diff states ⇒ identical views | fc property (breadth) + full-prefix corpus sweep (depth: melds, kans, kan-dora, agari) | Step 2 |
| AC: no id outside public zones | fc property + full-prefix corpus sweep, independent `publicIds` set | Step 3 |
| Future SeatView widening re-audit | whole-object `toEqual` in Step 2 (structural tripwire) | Step 2 |
| Purity gate on the new file | existing purity.test.ts glob — no action | automatic |

No unit tests of runtime code are added or changed; no integration surface exists
(core-only). Verification criteria per step: `just test` green; Step 3 adds
`just check`.

## Failure playbooks

- **Equivalence fails**: first suspect the surgery (guards should fail too — check
  them); if guards are green and equivalence fails, seatView reads a hidden zone —
  STOP, that is an engine bug: file it against seatview.ts, do not "fix" the test.
- **Corpus seed stranded** (playGreedy/playWinEager diverges from dynamics' pinned
  facts, e.g. a carrier no longer reaches agari): the engine changed under us
  mid-flight — rebase, and if real, the fix belongs in dynamics.test.ts first
  (owning suite), then mirror the seed lists here.
- **Runtime blowout**: the strided-prefix lever (Step 3) and, second, dropping greedy
  seeds 0/1/2 (keeping the pinned ankan carriers 63/67/69) — never drop prefixes from
  the equivalence sweep.

## Done means

- Both AC clauses are executable properties running over seeded hands including
  call-dense and agari states; guards prove the sibling construction sound.
- `just test` and `just check` green; three commits as above; progress.md and
  review.md written.
