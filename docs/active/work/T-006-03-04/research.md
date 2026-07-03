# T-006-03-04 — determinism-termination-harness — Research

## The ticket in one sentence

A test-only harness that bots ALL FOUR seats through the policy pair and asserts,
across a sample of seeds, the P5 invariant: same seed → byte-identical action log,
and every full-botted game ends (agari or ryuukyoku) within the bounded action count.

## Why this invariant exists (charter/architecture)

- charter.md P5 ("Rigor as the exhibit"): the pure engine behind the action-log
  contract, "AI-vs-AI determinism doubling as attract mode."
- architecture.md: attract-mode self-play is a *caller of the engine*; the b28.dev
  cover embeds the same index.html running the production engine AI-vs-AI.
- CLAUDE.md invariant: "Randomness is seeded; full hands must be deterministically
  simulatable (AI-vs-AI determinism doubles as attract mode)."

The ticket makes the invariant EXECUTABLE, test-only. The runtime attract-mode
driver is a later epic (dynamics.test.ts header doctrine: "bots (the future runtime
consumer of random play) are a later epic with their own shape").

## What already exists — the dependency chain

### The engine stack (all of src/core/, pure, no ambient reads anywhere)

- `record.ts` — `foldRecord({seed, actions}) → TableState`. A hand IS its record;
  the fold is the single authority on state. Same record → same folded state,
  forever (frozen conventions: rng stream, wall orientation, deal map, dora
  position, action encoding). Corruption throws RangeError with the action index.
- `legal.ts` — `legalActions(state) → HandAction[]` in a DETERMINISTIC, contractual
  order: agari offers nothing; ryuukyoku offers only houtei rons; mustDiscard
  offers hand discards; pre-draw offers the draw FIRST, then rons (atamahane
  rotation), then claims (pons, daiminkans, chis); post-draw offers 13 hand
  discards + drawn, then tsumo, then ankan/shouminkan. The order is part of the
  contract — "bots and generators may sample by index."
- `seatview.ts` — `seatView(state, seat) → SeatView`, the fair-play projection.
  Pure and total; bots take THIS, never TableState.
- `policy.ts` (T-006-03-01/-02) — the policy pair, both pure selectors returning an
  ELEMENT of `offered`, reference-identical on repeated calls, no RNG:
  - `discardPolicy(view, offered)` — own-turn points: offered tsumo unconditionally;
    else shanten-minimizing discard (tie-break: center distance, then earliest
    offered); else the offered draw. Throws RangeError elsewhere.
  - `callPolicy(view, offered)` — claim windows and houtei, ONE seat: own ron
    unconditionally; else first offered claim passing strict-shanten-cut AND
    yaku-anchor; else the offered draw (= "this seat declined", never "fold the
    draw now"). Throws RangeError elsewhere.

### The cross-seat arbitration — stated twice already

The rule (frozen by legal.ts's offered order): consult callPolicy once per seat
holding a ron/claim offer, in offered (rotation) order; fold the EARLIEST non-draw
answer by offered index (ron-before-claims, atamahane among rons, pon-before-chi);
when every consulted seat declines, fold the head draw (the window goes stale).

1. **Reference statement (test-local)**: `playPolicy(seed)` in
   `src/core/policy.test.ts` (~100 lines incl. oracles) — the T-006-03-02 sweep.
   Drives whole games policy-vs-policy, refolding the longer record each step, with
   heavy per-step oracles (membership, ron-always-taken, discard minimality,
   non-raise, claim cut + anchor re-derivation). Already asserts: termination on 12
   corpus seeds + 6 fc-sampled seeds, ≥1 claim folded, and byte-identical replay
   (`toEqual`) on 3 seeds — explicitly labeled "the T-006-03-04 rehearsal."
2. **Shipped statement (app)**: `src/app/drive.ts` (T-006-03-03) —
   `forcedAction(state, offered, player)` + `settleWindow(state, offered, player,
   chosen)`. Same arbitration, but parameterized by a human PLAYER seat (0):
   forcedAction returns null (waits) whenever the player holds a claim/win offer or
   a discard obligation. -03's review pins that the wiring "matches the sweep's
   reference arbitration exactly," so the harness "should replay byte-identically
   over this driver."

### The termination bound — vocabulary arithmetic, already frozen

`dynamics.test.ts` (re-stated in policy.test.ts): `FULL_TURNS = LIVE_WALL_SIZE −
DEAL_SIZE` (= 70), `ACTION_BOUND = 2·FULL_TURNS + 2·4·SEAT_COUNT + 2` (= 174).
Every action is a draw, kan, chi/pon, or discard; draws + kans ≤ FULL_TURNS; each
obliges one discard; chi/pons ≤ 16 − kans. Tripping the bound is unambiguously a
non-terminating loop, not a long legal game. Both existing drivers throw past it.

### The driver mold

`dynamics.test.ts playRecord` / `policy.test.ts playPolicy`: a for(;;) loop that
REFOLDS the whole record every step (`foldRecord({seed, actions})`), takes
`legalActions`, stops when `phase === 'agari'` or the offered set is empty
(ryuukyoku with no houtei ron), else chooses and appends. "State advances only by
refolding the longer record — foldRecord stays the single authority, no step logic
is reimplemented here." O(n²) per game and accepted as such; sweep checks are
plain throws (one expect per game — the T-006-01-02 perf lesson).

## Test-suite conventions relevant here

- **Purity gate** (`purity.test.ts`): every core RUNTIME module imports only
  same-directory siblings (`./x`); TEST files may additionally import
  `vitest`/`fast-check`/`node:`. So a core test file can never import
  `src/app/drive.ts`, and an app test can import core but not a core *test* file.
- **Naming**: suites are per-concern files in the module's directory —
  `dynamics.test.ts`, `purity.test.ts`, `seatview.fairplay.test.ts`,
  `shanten.property.test.ts` (a dotted second axis is established precedent).
- **Seeds**: canonical domain integers [0, 2^32); fc arb
  `fc.integer({min: 0, max: 0xffffffff})`; corpus seeds are small literals.
- **Timeouts**: sweeps carry explicit generous timeouts (60s) after a CPU-contention
  flake (T-006-03-02 review §5); isolated runtime is single-digit seconds.
- **Non-vacuity doctrine**: exercised-branch assertions are pinned facts, never fc
  statistics (dynamics' call-coverage; policy sweep's `claims > 0`). A corpus
  change that zeroes one means "widen the corpus, not the check."
- **Double-keying doctrine** (T-006-03-03 tests): frozen mined literals pair with
  an independent oracle so a wrong mine cannot freeze a wrong behavior.

## Measured baseline

`npx vitest run src/core/policy.test.ts`: 34 tests, 2.4s total (~2.2s in tests).
The oracle-laden playPolicy costs roughly ~90ms/seed (12 corpus + 3×2 replay + 6
fc runs ≈ 24 games in ~2.2s). The oracle re-scores every offered discard (≈14
shanten calls per discard step) — a lean driver without oracles should run several
times faster, which is the budget headroom for a wider seed sample.

## What the AC needs that does NOT yet exist

- A **dedicated harness** whose subject is the invariant itself, not the policy
  arms: the rehearsal lives inside policy.test.ts as three narrow tests (3 replay
  seeds, 12 termination seeds) with the driver entangled with per-step oracles.
- **Byte-identical** comparison end to end: the rehearsal uses `toEqual`
  (structural). "Byte-identical" is stronger phrasing — a serialized comparison of
  the full log (and the AC's "end to end" suggests the whole record, seed
  included).
- **A wider seed sample** with BOTH properties (replay identity + bounded
  termination) asserted per seed, plus non-vacuity across the sample (both end
  phases actually reached; calls actually folded) so the harness cannot pass
  vacuously on a corpus of trivial games.
- **All-four-botted through one driver**: the rehearsal already bots all four
  seats; the harness makes that the headline, with the driver stated cleanly.

## Constraints and assumptions surfaced

- The policies throw RangeError when consulted at a wrong decision point — the
  harness driver must classify states exactly (call point ⇔ ryuukyoku-with-offers
  or pre-draw-with-open-window; own-turn otherwise), the playPolicy classification.
- `legalActions` on a fresh state returns fresh action literals — two independent
  playthroughs can never share references, so identity comparison across runs is
  meaningless; byte/structural comparison is the right instrument.
- Determinism provable in-process only: two independent playthroughs in one test
  run. Cross-process/cross-platform determinism rests on the frozen conventions
  (integer rng, no Date/Math.random, no ambient reads) — already pinned by
  rng/fold/legality determinism suites; the harness composes them.
- In a legally-folded 'playing' pre-draw state the head offer is always the draw
  (legal.ts contract) — the decline fold is `legal[0]` with a type guard, per the
  rehearsal.
- A `ryuukyoku` state with NO houtei rons yields an empty offered set → clean end;
  with rons, callPolicy(holder) takes the ron unconditionally, folding to agari
  (the fold's only ended→ended transition).
- Where the harness lives decides what it can prove: core test → proves the
  engine+policy invariant (cannot touch drive.ts); app test → proves the shipped
  driver but must bot the PLAYER seat around forcedAction's waits. -03 already
  walks the shipped driver end to end with a live player; the ticket's language
  ("via the policy") and dependency shape point at the core level. Design's call.

## Files that will matter

- `src/core/policy.test.ts` — the rehearsal driver to lift/lean (and possibly
  leave untouched; design decides whether to dedupe).
- `src/core/dynamics.test.ts` — ACTION_BOUND arithmetic and driver-mold doctrine.
- NEW test file in `src/core/` — the harness (name is structure's call).
- `docs/active/tickets/T-006-03-04.md` — AC source; frontmatter untouched by me.

## Open questions carried to Design

1. Core-level harness vs app-level (through drive.ts) vs both — what does "drives
   all four seats via the policy" bind to?
2. Reuse playPolicy (extract a shared helper) vs an independent lean re-statement
   (the codebase's two-independent-statements-locked-by-agreement doctrine)?
3. Corpus size vs runtime budget; how to keep non-vacuity (agari AND ryuukyoku
   both reached) assertable rather than statistical.
4. What exactly is compared "byte-identically" — the action array, or the whole
   serialized record?
