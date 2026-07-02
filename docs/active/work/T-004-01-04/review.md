# T-004-01-04 — call-dynamics-property-suite — Review

Self-assessment and handoff. Read with design.md (the six decisions) and
progress.md (deviation 2 — the identity the suite corrected) beside it.

## What changed

**`src/core/dynamics.test.ts`** (rewritten in place, 280 → 642 lines; commit
`cf8f142`) — the only file touched. Engine (`record.ts`, `legal.ts`, everything
else in core and app) untouched, per design D6.

- **Generator**: `drawsAndDiscards` is gone — `playRecord` now samples the FULL
  `legalActions` set, auto-playing forced single-offer points and consuming one
  choice per multi-offer decision point. The choice domain widened from
  `fc.nat(13)` to `fc.nat(19)`: nat(13) could never index past 13, which would
  have silently suppressed every post-draw kan offer (index 14+). The hard bound
  is now derived arithmetic (`ACTION_BOUND` = 174; a legal game holds ≤ 172
  actions, argued in the comment), so a bound trip is unambiguously
  non-termination.
- **Greedy corpus** (design D2): `playGreedy` — kans first, then any call, rng
  from core's own `createRng` — over frozen seeds 0..99, built once at module
  level. Coverage is asserted, not hoped for: the corpus must contain chi, pon,
  daiminkan, ankan, AND shouminkan (closing -03's flagged generative-shouminkan
  gap). N=100 was frozen empirically: ankan appears only at seeds 63/67/69 below
  100 (greedy pons eat copies before concealed quads form).
- **Conservation** (AC clause 1): `allZones` is the six-zone flatten — hands,
  melds' `own`, ponds, drawn, live, dead — asserted 136-distinct at EVERY log
  prefix, over both the fc games and every corpus game.
- **Termination** (AC clause 2): full random games end in ryuukyoku with the
  closed end shape (empty live, null drawn, no obligations, no window, 14-tile
  dead wall, empty offered set) plus exact identities: **draws + kans ===
  FULL_TURNS** (kans eat the wall, exactly), discards === draws + daiminkans +
  chi/pons, ponds === discards, melds === chi+pon+daiminkan+ankan.
- **Determinism** (AC clause 3): double-fold deep-equality with fresh arrays
  (melds included) over claim-bearing random games and the call-dense corpus.
- **Mutation matrix** (AC clause 4): seven property operators + two directed
  anchors, all two-sided (mutant absent from the offered set AND thrown by the
  fold): seat bump over all seven action forms; type flip; discard tile
  retarget; claim-tile retarget; uses retarget; stale-window shift (a claim
  delayed past the next draw); duplicate; append-after-end over all seven forms;
  and the dead-wall exhaustion anchors — the seed-101033 fifth-kan window
  (mirrored FOUR_KAN_GEOMS; daiminkan mutant throws 'no rinshan tile remaining'
  while the same tiles' pon IS offered — non-vacuous) and the seed-1004 haitei
  quad (ankan mutant throws 'on an empty live wall'). Both anchors pin the
  message, not just RangeError, so the RIGHT guard is proven to fire.

## Acceptance criteria — verified line by line

- **"seeded random-legal-sequence generation that now samples claims"** — playRecord
  indexes the unfiltered offered set; probes proved claims present (dropping the
  melds zone fails conservation; suppressing shouminkan fails coverage).
- **"tile conservation … at every log prefix"** — the six-zone partition property
  (fc, numRuns 50) + the same sweep over all 100 corpus games.
- **"every sequence terminates (kans included)"** — fullGameArb's map returning at
  all is the proof (bound trips otherwise); corpus games (16 daiminkans, ankans,
  50 shouminkans across the probe range) terminate with the identities holding.
- **"re-folding any generated record reproduces an identical TableState"** —
  double-fold deep-equality over both sources.
- **"every mutant in the illegal-claim matrix … throws"** — wrong tiles (three
  retarget operators), wrong seat (generalized bump), stale discard (stale-window
  shift), dead-wall exhaustion (two message-pinned anchors).

## Test coverage

199 tests (175 before, +24 net; dynamics 8 → 15), tests-time ~1.86s (+0.12s over
baseline — inside budget, no dials turned). `just check` and `just build` clean.

**The catch of the ticket** (progress.md deviation 2): the plan's termination
identity "discards === draws + kans + chi/pons" was WRONG — closed kans (ankan/
shouminkan) absorb the pending drawn tile, adding no discard obligation; only
daiminkan does. The widened generator failed the first run on exactly that
off-by-one in both trajectory sources. The engine was right; the test spec was
corrected and the absorption rule is now documented at `expectEndIdentities`.

**Coverage gaps, deliberate:**

- Four-kan states and haitei quads are anchored, not randomly reached — random
  and even greedy play cannot get there (probe: 0 four-kan games in 200 seeds).
- The uses-retarget operator relies on the offered-set fc.pre to dodge
  accidental legality; wrong-SHAPE claims (e.g. honors chi) are hit
  probabilistically by it, and exhaustively by legal.test.ts's candidate
  partitions — not duplicated here.
- Corpus determinism folds each record twice via the shared property; corpus
  games are not run through the mutation operators' fc.pre paths beyond what
  anyGameArb samples.

## Open concerns for a human reviewer

1. **The greedy corpus is load-bearing for ankan coverage on exactly three seeds**
   (63/67/69). Any change to wall building, dealing, rng, or `legalActions`'
   offer ORDER can shift greedy trajectories and lose the form — the coverage
   test will fail loudly (that is its job), but whoever hits it should re-probe
   the seed range (progress.md step-1 probe) rather than delete the assertion.
2. **`playGreedy` prefers kans over claims over draws/discards.** It is a
   test-local policy, not a bot; if a future bots epic wants it, it should be
   re-derived there (suite charter), not imported from a test file.
3. **The uses-retarget cast** (`uses as unknown as typeof action.uses`) widens a
   tuple after an arity-preserving in-place write — sound at runtime, but a
   stricter reader may prefer a per-type rebuild like `withSeat`'s.
4. **anyGameArb weights corpus and random games 50/50** (fc.oneof default). Claim
   density in mutation operators leans on the corpus arm; if gameArb someday
   generates deeper games, the weighting could be revisited.
5. **Runtime headroom**: the corpus build (100 greedy games, each refolding per
   action) runs at import (~0.4s inside the 1.86s tests-time). The trim dials,
   in order: corpus N, conservation numRuns, the two numRuns-60 properties.

No TODOs left in code; no known bugs; nothing skipped silently. Engine untouched.
