# T-004-01-04 — call-dynamics-property-suite — Research

Descriptive map of what exists. The ticket extends `src/core/dynamics.test.ts` — the
random-legal-trajectory property suite — to sample claims and kans, and grows its four
invariant families (conservation, termination, determinism, mutation) to the widened
state space. No production code is named by the AC; this is a test-only ticket over a
frozen engine surface.

## The ticket's file: src/core/dynamics.test.ts (280 lines)

Built by T-004-01-01/-02 and *braced* by -03. Its charter comment (lines 1–10) states
the division of labor: record.test.ts proves step semantics against wall-derived
expectations; legal.test.ts locks the offered set to the step; dynamics drives the two
together via a generator that picks every move from `legalActions`, asserting only
self-evident invariants (conservation, determinism, structural termination,
throw-on-mutation) — never derived values.

Current structure:

- **`drawsAndDiscards` filter (line 40)** — the explicit brace from -03: legalActions
  now offers claims/kans, but the generator filters to draws/discards "until that
  ticket [this one] grows this generator". Its comment names this ticket's charter and
  the properties whose exact shapes depend on the filter: 140-action games, one pond
  tile per draw, draw/discard-only mutants. Removing the filter invalidates those
  exact counts.
- **`playRecord(seed, choices)` (line 54)** — the driver. Choices are consumed ONLY at
  multi-action offering points; single-action points (the pre-draw forced draw, in the
  filtered world) auto-play and stop the walk when choices run out. State advances
  only by refolding the growing record — foldRecord stays the single authority. A hard
  bound (`2 * FULL_TURNS + 2` = 142) converts non-termination into a thrown error.
- **`allZones` (line 78)** — the conservation flatten: hands, ponds, drawn, live,
  dead. **No melds zone** — with claims sampled this undercounts, since meld `own`
  tiles leave hands.
- **`gameArb`** — seed + up to 70 choices (`fc.nat(13)`, matching the 14-discard
  offering) + a `dangle` flag appending a trailing draw so post-draw states are
  first-class.
- **`fullGameArb`** — exactly FULL_TURNS choices so playRecord only stops on an empty
  offered set; that the map returns at all (vs. tripping the bound) is the termination
  proof.
- **Property suites**: conservation at every prefix (numRuns 50, O(n²) noted);
  termination (exactly 140 actions, ryuukyoku, empty live, null drawn, empty offered
  set, 70 pond tiles); double-fold determinism (deep-equal, fresh arrays); five
  mutation operators via `assertMutantThrows` (seat bump, type flip, tile retarget,
  duplicate, append-after-ryuukyoku) — each mutant is checked BOTH absent from the
  offered set and thrown by the fold.
- **`keyOf`** (line 176) — mirrored from legal.test.ts; serializes `uses` sorted so
  membership is copy-order-insensitive. Already handles claims/kans.

## The engine surface it drives (frozen; -03 review confirms record.ts untouched)

**`foldRecord` / `applyAction` (record.ts)** — the seven-armed step. Facts the new
properties lean on:

- Action vocabulary: draw, discard, chi, pon, daiminkan, ankan, shouminkan. Kans log
  no rinshan draw (implicit, wall-order authority) and no indicator.
- Claimed tiles stay **counted in the discarder's pond**; a meld contributes only its
  `own` tiles to conservation. So the AC's "hands + melds + ponds + drawn + live +
  dead == 136" reads melds as `own` flats. TableState.drawn's doc already states the
  six-zone partition invariant verbatim.
- Chi/pon: turn jumps to caller, window closes, `mustDiscard` set (no draw); the claim
  discard comes from the hand. Daiminkan: like pon but the kan tail fills `drawn`
  (rinshan), so the ordinary discard arm follows — no `mustDiscard`.
- Kan tail (`applyKanTail`): flips the next indicator (dead[6+k] against the mutated
  array), shifts dead[0] into `drawn`, pops the live TAIL into dead. Live shrinks by
  one per kan → ryuukyoku arrives one discard earlier per kan through the unchanged
  phase condition. Dead stays exactly 14.
- `guardRinshanAvailable`: fifth kan → "no rinshan tile remaining"; kan on empty live
  → "on an empty live wall". These are the AC's "dead-wall exhaustion" throws.
- Claim guards, fixed order: no window ("no claimable discard — … stale …"), wrong
  seat (chi non-left / pon-own-discard / daiminkan-own-discard), tile ≠ window.tile,
  duplicate uses, unheld uses, wrong shape (not a run / triplet / quad). Ankan/
  shouminkan guard turn, mustDiscard, drawn-present, rinshan, then material.
- Every throw is RangeError naming the action index; ended hand rejects everything.

**`legalActions` (legal.ts)** — four state classes, frozen order: ended → []; 
mustDiscard → hand discards only; pre-draw → draw FIRST then pons, daiminkans, chis;
post-draw → 13 hand discards + drawn last, then ankans, then shouminkans. Kan offers
gated by `kanAllowed` (indicators−1 < 4 && live nonempty). Every distinct physical
copy combination is its own offer. Offered claims fold — the -03 agreement suite locks
this two-sidedly, so this suite may trust "offered ⇒ folds" and sample by index.

**Constants** (index.ts barrel): TILE_COUNT 136, DEAD_WALL_SIZE 14, LIVE_WALL_SIZE
122, DEAL_SIZE 52, SEAT_COUNT 4, STARTING_HAND_SIZE 13; FULL_TURNS = 70 is test-local.

## Sibling suites — patterns available to mirror

- **legal.test.ts (~830 lines)**: `prefixArb` (tsumogiri prefixes reach claim windows
  for free), `keyOf`, and — directly relevant — **`fourKanChain()` (line 203)** and
  **`fifthKanWindowRecord()` (line 235)**: hand-derived action chains reaching the
  four-kan ceiling, plus `kanMaximalRecord280` driving a kan game to ryuukyoku. The
  dead-wall-exhaustion mutant needs states like these; random play alone reaches four
  kans essentially never.
- **record.test.ts**: wall-anchored expectations; not this suite's style (dynamics
  asserts only self-evident invariants).
- -03 review flags an owned-downstream gap: **no positive shouminkan-from-drawn-tile
  anchor** — "noted for -04's generative coverage".

## Reachability facts that shape the generator

- Uniform index-sampling over offered sets makes claims plausible (pre-draw offerings
  are small: 1 draw + a few claims) but **kans rare** (daiminkan needs three held
  copies of the discarded kind; ankan needs a concealed quad; shouminkan needs a prior
  pon plus the fourth copy). Four-kan games are unreachable by chance.
- Chi/pon churn hands below 13 (13→11 after claim+discard) and skip seats' draws, so
  action counts, pond sizes, and per-seat hand sizes all become trajectory-dependent —
  every exact count in the current termination test breaks.
- Action-count bound with calls: draws+kans ≤ live consumption (70 minus nothing —
  each draw and each kan consumes one live tile), each chi/pon adds 2 actions without
  touching live but is capped by meld material (≤ 4 melds/seat, 16 total). A generous
  static bound exists; the exact worst case is a design question.
- `playRecord`'s "choices consumed only at multi-action points" convention changes
  meaning once claims appear pre-draw: the pre-draw point becomes multi-action, so
  choice-length no longer equals complete turns. `fullGameArb`'s "choices never run
  out" trick must be re-derived.

## Constraints and assumptions

- Test-only ticket: `record.ts`, `legal.ts` and the rest of core are frozen contract
  (extend-only vocabulary; -03 shipped them green). Any engine bug this suite finds is
  its own commit conversation, not silent patching.
- Suite runtime is a watched budget (-03 review: 175 tests ~1.7s; conservation
  property is O(n²) with a numRuns dial at 50). Refolding per step in playRecord is
  O(n²) per game already.
- `fc` (fast-check) + vitest, `just test` runs vitest over src/core/. `just check`
  must stay clean (svelte-check + tsc).
- Determinism: fc seeds its own runs; playRecord is deterministic given (seed,
  choices) — no Date/Math.random anywhere in core or tests.
- The AC's four mutant families (wrong tiles, wrong seat, stale discard, dead-wall
  exhaustion) map one-to-one onto existing fold guards; each needs a reachable state
  where the mutant is non-vacuously constructible (a claim window with claim material;
  a four-kan state for exhaustion).
