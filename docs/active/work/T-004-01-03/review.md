# T-004-01-03 — legalactions-claim-offers-agreement — Review

Self-assessment and handoff. Read with design.md (the six decisions) beside it.

## What changed

**`src/core/legal.ts`** (rewritten, 47 → ~190 lines) — the ticket's production
surface:

- `legalActions` now enumerates four state classes: ended → `[]`; mustDiscard →
  the caller's hand discards ONLY (this fixes a latent bug — the old code
  offered a draw at post-chi/pon states, which the fold rejects); pre-draw →
  the draw first, then, on an open window, all pons, all daiminkans, all chis;
  post-draw → the 14 discards exactly as before, then ankans, then
  shouminkans. Draw-first and the byte-stable 14-discard prefix keep every
  existing sample-by-index consumer working.
- Every distinct physical-copy combination is its own offer (design D1): a
  seat holding three copies gets three pon pairs; chi variants are distinct
  per run shape AND per copy. The offered set equals the foldable claim set
  up to `uses` ordering — and needs no change when red fives make copies
  distinguishable. Canonical `uses` order (D3): hand order, ankan's drawn
  tile last, chi as [lower kind, higher kind].
- Kan offers are gated by `kanAllowed` — `doraIndicators.length - 1 < 4`
  (the kansMade identity from -02) and a nonempty live wall. legal.ts imports
  only tiles/deal vocabulary and record TYPES: no shared guard code with the
  fold (D4) — the agreement suite stays a genuine lock between two
  independent statements.

**`src/core/legal.test.ts`** (233 → ~700 lines) — the agreement suite over the
extended vocabulary. `keyOf` normalizes `uses` sorted, so membership is
insensitive to copy order. Thirteen frozen anchors (mirrored from
record.test.ts plus four new scratchpad-scanned ones, derivations in comments,
never regenerate). Suites: closed-form structure (draw leads pre-draw, claims
name the window, 14-discard prefix post-draw, mustDiscard offers the hand
only), pon/daiminkan-before-chi ordering property, ended-hand (incl. a
kan-shortened ryuukyoku), offered-actions-fold (property + anchor sweep),
outside-actions-throw (sampled negatives now with claim bads; a sampled
claim-candidate property asserting offered ⇔ folds; the old 548-space
partition re-anchored; NEW exhaustive claim/kan candidate spaces at 12
anchors), directed suppression tests, six frozen full-array order literals,
purity/freshness with fresh-`uses` identity.

**`src/core/dynamics.test.ts`** (~30 lines): `drawsAndDiscards` filters the
generator's slice of the offered set, keeping random trajectories
byte-identical to before — claims in random play are T-004-01-04's charter
(D6a). `keyOf` mirrors the widened serializer; two stale comments updated.

**`src/app/drive.ts`** (~15 lines): `forcedAction` returns the last offered
DISCARD via reverse scan instead of the last element — a bot whose post-draw
offering now ends in kan offers still tsumogiris, never silently kans (D6b).
Comments no longer claim offering homogeneity. **`src/app/drive.test.ts`**:
one assertion loosened (South's pre-draw offering at seed 1 now carries a chi
offer; the head is still the forced draw).

**Untouched, by design:** `record.ts` (the folding half — no fold behavior
changed anywhere in this ticket), `tiles/wall/dora/deal/index.ts`,
`App.svelte`/`Table.svelte` (shape-robust through drive.ts).

Commits: `a30931c` (consumer bracing, green standalone), `f20cdfd`
(enumeration + suite), plus this artifacts commit.

## Acceptance criteria — verified line by line

- **Every offered claim folds via foldRecord** — the offered-actions-fold
  property (prefixArb now reaches claim windows) plus the anchor sweep over
  all 13 frozen states; the exhaustive partitions additionally verify each
  offered claim through its candidate twin.
- **Every non-offered claim candidate throws** — exhaustive candidate spaces
  (chi/pon pairs, daiminkan triples over every seat's hand positions at 7
  window anchors; ankan 4-subsets and shouminkan × 136 tiles at 5 post-draw
  anchors — ~30k candidates total) partition into offered ⇒ folds / outside ⇒
  throws RangeError, with a completeness cross-check that every offered claim
  was hit by exactly one candidate; the sampled property repeats the lock over
  random states.
- **Chi only against the left neighbor's fresh discard, each variant
  enumerated separately** — structural property (every chi offer's seat is
  window.seat + 1), wrong-seat/stale/decoy negatives, and the seed-85 (three
  shapes, five variants) and seed-3/seed-5 (duplicate-copy variants) frozen
  arrays.
- **Deterministic order: same state → same array, pon/kan before chi** —
  double-call equality at every anchor plus the repeated-calls property; the
  pon≺daiminkan≺chi ordering property over random windows; six full-array
  literals pinning the exact frozen order.

## Test coverage

175 tests (156 before, +19), ~1.7s; `just check` and `just build` clean. The
two-sided lock is the load-bearing novelty: a legality bug (offering what the
fold rejects) dies on the fold sweeps; a fold bug (accepting what enumeration
excludes) dies on the partition. Non-vacuous suppression is pinned both ways:
seed-101033's fifth-kan window has real daiminkan material (three pons
offered, the kan absent AND thrown with 'no rinshan tile remaining');
seed-1004's haitei draw holds a real concealed quad (no ankan offered AND
thrown with 'on an empty live wall').

**Coverage gaps, deliberate and owned downstream:** random-legal trajectories
still exclude claims/kans (T-004-01-04 — the generator filter is explicit and
commented); no shouminkan-from-drawn-tile anchor (the enumeration's
`?? drawn` arm is exercised only by the 136-tile candidate space throwing —
a positive anchor would need a scan for a pon whose fourth copy arrives as a
draw; noted for -04's generative coverage); the app never takes a claim
(no UI yet — verified as a FEATURE by a scratchpad drive of the real app loop
at seed 1004: 140 actions to ryuukyoku, 17 ankan offers surfaced and passed).

## Open concerns for a human reviewer

1. **The offered set is complete, not minimal** (design D1): three pon pairs
   for a triplet-holder are indistinguishable to a player until red fives
   exist. The claim UI ticket should DEDUPE by kind-shape for presentation
   rather than ask this enumeration to shrink — flagged so the UI doesn't
   render three identical pon buttons.
2. **forcedAction's reverse scan** returns null if a non-player obligation
   offering somehow contained no discard — unreachable today (post-draw and
   mustDiscard offerings always lead with discards), and null is the safe
   "wait" answer if it ever became reachable. Worth a glance.
3. **Chi enumeration re-states run arithmetic** (D4 independence): the shape
   window `low ∈ [rank-2, rank] ∩ [1, 7]` is the least obvious line; the
   seed-85 three-shape literal and the exhaustive chi candidate spaces pin it
   from both sides. An honors-chi can never be offered (rankOf null) nor fold
   (isRun rejects) — agreed by construction, asserted via candidates at the
   seed-101033 4z window.
4. **Suite runtime** grew ~0.6s from the ~30k-fold partitions. If it ever
   drags, thin the non-turn seats' ankan 4-subsets first (they only prove
   wrong-seat throws, already covered elsewhere).
5. **`??` precedence in shouminkanOffers** (`hand.find(...) ?? (drawn-kind
   check ? drawn : null)`) — reads correctly and is partition-tested, but the
   `tile !== null && tile !== undefined` guard exists because `find` yields
   undefined while the fallback yields null; a stricter reader might prefer
   normalizing both to null.

No TODOs left in code; no known bugs; nothing skipped silently.
