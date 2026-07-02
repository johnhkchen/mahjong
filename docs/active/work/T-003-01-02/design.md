# T-003-01-02 — Design: legal-actions-surface

Decision: **a closed-form enumerator, `legalActions(state: TableState): HandAction[]`,
in a new `src/core/legal.ts` module, re-exported through the barrel** — an independent
statement of legality cross-checked against the step function by an agreement test,
never derived from it.

## The design space

### A. Closed-form enumeration from state fields (CHOSEN)

Read `phase` / `turn` / `drawn` / `hands[turn]` and enumerate directly:

- `phase !== 'playing'` → `[]`
- `drawn === null` → `[{type:'draw', seat: state.turn}]`
- `drawn !== null` → 14 discards: `hands[turn]` in hand order, then the drawn tile

Pros: pure, allocation-light, deterministic, trivially total over reachable states;
crucially it is an *independent second statement* of the turn cycle, so the AC's
agreement test genuinely cross-checks two artifacts — a legality bug and a step bug
would have to agree to slip through. Research showed the legal set is closed-form at
every reachable state (0 / 1 / 14 actions), so enumeration costs nothing and reads as
the spec of the state machine.

Cons: the turn-cycle rules now live in two places, and a future rule change (calls,
riichi) must touch both — this is exactly the risk the agreement test exists to catch,
and T-003-01-03's generator will re-check it over random sequences forever after.

### B. Oracle filtering: try each candidate against the step (REJECTED)

Enumerate a candidate space (4 draws + 4×136 discards) and keep what `applyAction`
accepts, via try/catch on a cloned state.

Rejected because it makes the AC vacuous: the agreement test would compare the step
function with itself and pass by construction, proving nothing. It also needs deep
state clones per candidate (applyAction mutates), costs ~548 trial folds per call, and
`applyAction` is module-private by design — legality-by-exception would smear the
"throws are for log corruption" convention into a control-flow mechanism.

### C. Refactor the step into validate + apply, share the validator (REJECTED)

Split `applyAction` into a pure `checkAction` used by both fold and legality.

Rejected for the same independence reason as B (one artifact, self-agreeing test) and
because a validator answers "is this action legal?" (action → bool), while this
ticket needs *enumeration* (state → actions) — the validator alone cannot produce the
set, so C ends up needing A's enumeration anyway, plus an invasive refactor of a
freshly-frozen, fully-tested step, with throw-message wording (asserted by 9 tests)
at risk. The step stays the single authority on what *folds*; `legalActions` is the
authority on what is *offered*.

### D. Signature `legalActions(record: HandRecord)` (REJECTED as the primary)

Architecture.md says "log in → legal actions out", which reads record-shaped. But
every real consumer (bots are `table state → action` by charter; T-003-01-03's
generator folds once then asks repeatedly; the app holds the folded state) already
has a `TableState`; a record-shaped surface would re-fold the whole log per query —
O(n) per action point, O(n²) per hand — purely to recompute a state the caller holds.
The composition `legalActions(foldRecord(record))` *is* the architecture sentence.
State-shaped wins; no record-shaped convenience wrapper until a consumer wants one.

## Decisions in detail

**Module placement — new `legal.ts`, not `record.ts`.** The fold (`record.ts`) answers
"what happened"; legality answers "what may happen next" — a different concern with a
different growth curve: calls legality (chi/pon/kan candidates for *other* seats),
riichi declarability, and agari checks will all land here and would bloat the contract
layer. `legal.ts` imports only `./record` (types), `./deal` (Seat via types), `./tiles`
(TileId type) — satisfying the purity gate's `./sibling` rule. Barrel gains one
`export * from './legal'` line, which is what the AC's "exported from the core barrel"
demands.

**Return shape — fresh `HandAction[]`, deterministic order.** Order: for discards,
`hands[turn]` in hand order (index 0..12) then the drawn tile last — mirrors the
physical table (drawn tile held apart) and is stable because hands are draw-ordered
and never sorted. Fresh array per call (house freshness rule); the contained actions
are new object literals, so no caller can corrupt a fold's state through the result.
`legalActions` never mutates its input — it only reads.

**Trusted input, no validation.** Per the TileId/seed precedent, states arrive from
`foldRecord`; hand-built corrupt states are out of scope. One reachable-world subtlety
is documented rather than guarded: in a legal fold, `drawn === null ∧ phase ===
'playing'` implies `live` is non-empty (the phase flips on the discard that empties
the wall), so the single draw action offered is always foldable.

**Contract wording stays widen-friendly.** The doc comment states today's vocabulary
(draw/discard) and that call/riichi/agari tickets extend the enumeration — same
extend-only framing as `HandAction` and `phase`.

## Agreement test design (the AC, made concrete)

New `legal.test.ts`, following house patterns (`seedArb`, prefix helpers — reusing
`tsumogiriRecord`-style construction locally, since test helpers live per-file today):

1. **Soundness (property)** — every offered action folds: for seed × turns × optional
   dangling draw, fold the prefix, then for each `a ∈ legalActions(state)` assert
   `foldRecord({seed, actions: [...prefix, a]})` does not throw.
2. **Completeness against the state (property)** — the set is exactly the closed form:
   pre-draw states offer exactly `[{draw, turn}]`; post-draw states offer exactly the
   14 discards whose tiles set-equal `hands[turn] ∪ {drawn}`, all tagged `turn`.
3. **Outside actions throw (property + exhaustive example)** — sampled negatives per
   the AC: wrong-seat draws/discards, a draw while a tile is drawn, a discard before
   drawing, and discards of tiles sampled from other hands / live / dead / own pond.
   Plus one *exhaustive partition* example at frozen seed 1 for a pre-draw, a
   post-draw, and the ryuukyoku state: all 548 encodable draw/discard candidates
   (4 draws + 4×136 discards) split exactly into "in the returned set ⇒ folds" and
   "outside ⇒ throws RangeError" — the strongest form of the AC's sampling clause at
   a cost paid only three times, not per property run.
4. **Ended state (property)** — `legalActions(foldRecord(maximalRecord(seed)))` is
   `[]` for arbitrary seeds.
5. **Purity (property)** — calling `legalActions` leaves the state deep-equal to a
   snapshot; repeated calls return equal-but-fresh arrays.

Determinism of the set follows from 2 (it equals a function of the state); no separate
test needed. `purity.test.ts` needs no change (glob picks up new files; its
guard-list check names only existing files).

## Risks

- **Two statements of one rule** — accepted deliberately; the agreement test is the
  contract that keeps them locked, and T-003-01-03 re-verifies over random walks.
- **Exhaustive example cost** — 3 × 548 folds of short prefixes ≈ trivial; the
  properties themselves stay cheap (≤14 folds per run).
