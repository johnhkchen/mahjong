# T-006-03-02 — call-policy — Progress

All three plan steps complete. `just check` clean; full suite green (22 files,
533 tests).

## Step 1 — the call branch in policy.ts ✅

Commit `fd40e83` — "T-006-03-02: the call policy — ron-first, strict-cut +
yaku-anchor claims, draw as the pass".

- New export `callPolicy(view, offered)` with the three arms (ron unconditional;
  claims by strict-cut + yaku-anchor, first accepted wins, decline = the offered
  draw; RangeError otherwise), plus private helpers `ROUND_WIND`,
  `valueKindsOf`, `ClaimOffer`/`isClaimOffer`, `claimMeldOf`, `isValueTriplet`,
  `meldTiles`, `yakuAnchor`.
- Module header rewritten to document both branches, the accept rule, the anchor
  heuristic's status, the cut-exactly-one tie-break argument, and the daiminkan
  theorem; discardPolicy's throw-message tail now names callPolicy.
- discardPolicy and its helpers untouched.

**Deviation (pre-implementation, artifacts updated):** the tie-break's planned
"minimal post-shanten" primary key was dropped — an accepted chi/pon always cuts
shanten by exactly one (design.md §4 carries the argument), so the key could
never discriminate; earliest-offered is the whole tie-break.

**Deviation (minor):** structure.md's `postClaimShanten` helper was inlined into
callPolicy's claim loop — the remainder kinds and widened meld list are shared
with the anchor call, so a helper would recompute them. structure.md updated.

## Step 2 — fixture-layer tests ✅

Commit `2aa072c` — "T-006-03-02: call-policy fixtures — arms, anchors, theorem,
tie-breaks".

- `viewOf` extended with optional `claimable`/`phase` (defaults preserve every
  existing fixture); new test-side oracle `afterClaim`.
- 16 new tests across six describes: ron arm (window ron over a claim, houtei
  ron, foreign ron never taken), accepts (yakuhai pon, kuitan chi, second call
  anchored by an existing yakuhai pon), declines (the AC's strand case returns
  the draw by reference; cut-failure despite a haku anchor; the daiminkan
  theorem), tie-break (pon over equally-cutting chi; copy variants reversed →
  earliest offered), contract violations (post-draw set, empty set, houtei set
  without an own ron), purity/determinism (reference identity, no mutation,
  structural stability).
- Every fixture's shanten arithmetic is re-derived in-test through `shanten`
  itself (pre and post values asserted exactly).

**Deviation (trivial):** the plan's throw-message regex `/call decision/` did
not match the implemented message ("no ron or claim decision"); the test pins
`/claim windows and houtei/` instead.

## Step 3 — the seeded sweep with calls ✅

Commit `d96a436` — "T-006-03-02: policy sweep drives calls — arbitrated
windows, oracle-checked accepts, byte-identical replay".

- `playPolicy` now classifies call points (open claim window at pre-draw;
  ryuukyoku houtei) and consults callPolicy once per offer-holding seat in
  offered order, folding the earliest non-draw answer else the draw — the
  T-006-03-03 arbitration rehearsal. Per-answer oracles: element-of-offered,
  ron-always-taken; per-folded-claim oracle `assertClaimSound` re-derives the
  strict cut and the anchor predicate independently.
- Own-turn path and its oracles (tsumo-taken, discard minimality, non-raise)
  unchanged; ACTION_BOUND unchanged and never tripped.
- Corpus test additionally asserts the branch was exercised (≥ 1 claim folded
  across the 12 corpus seeds — it was), guarding against a driver that silently
  never consults callPolicy.

**Deviation:** explicit `{ timeout: 60_000 }` on the three sweep tests. During
step 2 the UNCHANGED corpus test transiently ran 21s (vs its usual ~2s) and hit
vitest's 5s default — CPU contention from sibling lisa threads running their own
suites, not a code change (isolated reruns: full policy suite 2.97s). The
timeouts are headroom against that contention, documented in-test.

## Acceptance criteria check

- Accepts a shanten-lowering call while a yaku remains reachable ✅ (three
  accept fixtures + sweep-folded claims oracle-checked for cut and anchor).
- Declines — selects the pass/next-draw — a call leaving an open yakuless hand
  ✅ (strand fixture returns the offered draw by reference; decline suite).
- Always returns an offered ron ✅ (window + houtei fixtures; sweep oracle at
  every consulted seat).
- Every returned action is an element of the offered set ✅ (selection by
  construction; purity fixtures assert reference identity; sweep membership
  oracle at every step).
