# T-004-01-03 — legalactions-claim-offers-agreement — Progress

Final state: **all steps complete**, suite green (175 tests), `just check` and
`just build` clean, two code commits + this artifacts commit.

## Step log

- **Step 0 — scratchpad scans** ✅ (`scan.ts` / `scan2.ts` in the session
  scratchpad, never committed). Re-derived every mirrored anchor's facts —
  all matched record.test.ts's frozen comments exactly (no drift). New
  captures: seed-3's race window carries TWO chis (East holds both 3p copies
  47 and 44 — a free duplicate-copy variant); seed-85 turns=6 is a
  three-shape five-chi window; seed-5 turns=7 is a two-shape four-chi window
  with another seat's pon; seed-1004 deals South a 5p quad (hand order
  [55,52,53,54]) making its haitei draw the non-vacuous empty-wall
  suppression anchor; at seed-101033 the fourth 4z (tile 122) sits at live
  index 55, reachable by tsumogiri continuation after the four-kan chain
  while West still holds 120/121/123 — the non-vacuous fifth-kan window
  (pons offered, daiminkan suppressed). Canonical-uses check: ANKAN161's
  recorded uses [118,116,119,117] already equal hand-order-drawn-last;
  seed-280's offer is [0,3,2,1] (hand order), NOT record.test.ts's [0,1,2,3]
  — both fold; the offer literal uses the canonical form.
- **Steps 1+2 (squashed as planned)** ✅ — commits `a30931c` + `f20cdfd`.
  After the legal.ts rewrite, exactly the two anticipated stale legal.test.ts
  expectations failed and nothing else; per the plan's squash clause the tree
  was kept green by splitting instead into (a) consumer bracing (dynamics
  filter + widened keyOf mirror, drive.ts last-discard forcedAction,
  drive.test.ts's one stale singleton assertion) — verified green standalone
  against the OLD legal.ts (156 tests) before committing — then (b) legal.ts
  + the full new suite (175 tests).
- **Step 3 — frozen anchors + deterministic order** ✅ (in `f20cdfd`): six
  full-array order literals (seed-67 window incl. three pon pairs before the
  daiminkan; seed-3, seed-5, seed-85 chi variants; shouminkan-67; ankan
  161/280 with canonical uses) + same-state-same-array sweep over all 13
  anchors.
- **Step 4 — two-sided partition** ✅ (in `f20cdfd`): `claimCandidatesAt`
  (chi/pon pairs + daiminkan triples over every seat's hand positions, tile =
  window tile) exhausted at all 7 window anchors; `kanCandidatesAt` (ankan
  4-subsets over every seat's pool, shouminkan × 136 tiles × 4 seats) at all
  5 post-draw anchors; sampled claim-candidate property over random prefixes
  (offered ⇔ folds); claim-shaped bads added to the sampled-negatives
  property; directed suppression tests with fold-message cross-checks
  (fifth kan, haitei quad, stale window, claim-discard-owed).
- **Step 5 — purity/freshness + full verification** ✅: anchor sweep with
  fresh-`uses` identity assertions; `just test` 175 green (~1.7s — no
  candidate-space thinning needed), `just check` 0 errors, `just build`
  single-file OK.
- **Step 6 — artifacts** ✅ (this commit).

## Deviations from plan

- **D1 — commit split, not squash.** plan.md step 1 anticipated committing
  legal.ts + consumers together (or squashing 1+2). Instead the consumer
  edits proved green against the old legal.ts, so they became their own
  commit (`a30931c`) and legal.ts+suite the second (`f20cdfd`) — two honest
  green states instead of one big one. No content deviation.
- **D2 — drive.test.ts touched (anticipated as "only if pinned").** One
  assertion pinned `beforeSouthDraw`'s offering as a draw singleton; at seed 1
  that state now carries South's chi offer. Loosened to "offered[0] is the
  draw" with a comment — the forcedAction identity assertion is unchanged.
- **D3 — extra end-to-end check beyond plan.** A scratchpad drive of
  App.svelte's exact loop (forcedAction/tapDiscard over legalActions) at
  seed 1004: the full hand reaches ryuukyoku in 140 actions while bot South's
  post-draw offerings surface 17 ankan offers, every one passed over in favor
  of tsumogiri — the D6 drive.ts fix observed working, not just unit-tested.
- **D4 — no dedicated "structural order property" beyond pon≺daiminkan≺chi.**
  structure.md sketched order assertions inside suite 1; the dedicated
  property ("pon and daiminkan offers all precede every chi offer") plus the
  six frozen full-array literals cover the same ground with more teeth, so a
  separate weaker assertion was dropped rather than duplicated.

## What remains

Nothing for this ticket. Downstream hand-offs recorded in review.md: random
trajectories over claims/kans (T-004-01-04), claim UI + real bot choice
(later tickets), riichi/agari growth of the enumeration (later epics).
