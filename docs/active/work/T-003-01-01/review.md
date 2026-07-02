# T-003-01-01 — Review: draw-discard-step-function

Self-assessment and handoff. The engine's turn loop now exists: a hand folds from
deal through E→S→W→N draw/discard turns to ryuukyoku, entirely as a fold over its
record, with corruption failing loudly at the offending log index.

## What changed

Two files, four commits (`c637802`, `420509a`, `b23439f`, + throw-matrix commit);
no files created or deleted; barrel and app untouched.

### `src/core/record.ts` (modified)

- **`HandAction`**: `never` → a two-member discriminated union,
  `{type:'draw', seat}` | `{type:'discard', seat, tile}`. Doc comment freezes the
  encoding conventions as replay contract: extend-only; seat tag is deliberate
  redundancy for loud wrong-seat detection; draw records no tile (the seed's wall
  order is the single authority); tsumogiri is derived, not encoded; id-range
  validation deferred to the log-parser boundary.
- **`TableState`**: grew `ponds` (per-seat, discard order, fresh per fold), `turn`
  (Seat expected to act; stays at the last discarder after the end), `drawn`
  (`TileId | null`, held apart from the 13-tile hand — every tile id lives in exactly
  one of hands/ponds/drawn/live/dead), `phase` (`'playing' | 'ryuukyoku'`, a
  widenable union for future agari endings). Existing five fields untouched.
- **`applyAction`** (new, module-private): the per-action step. Check order: phase
  guard → type switch (default throws on unknown types from untyped JS) → seat-vs-
  turn → arm-specific. Draw: out-of-sequence and empty-live guards, then
  `drawn = live.shift()`. Discard: undrawn guard; tsumogiri (`tile === drawn`) leaves
  the hand alone, tedashi splices the hand tile out and APPENDS the former drawn tile
  (preserving "hands in draw order, never sorted"); pond push; then
  `live.length === 0 ? phase = 'ryuukyoku' : turn advances`. All throws are
  `RangeError` (the house corruption type) naming the action's log index.
- **`foldRecord`**: the non-empty-log guard is gone; the fold builds the dealt state
  (unchanged derivation) and applies each action. Empty-log fold — the app's boot
  path — behaves byte-for-byte as before, extended only by the four new fields.

### `src/core/record.test.ts` (modified)

Helpers `dealtLive` / `tsumogiriRecord` / `maximalRecord` derive all expectations
from the frozen upstream contracts (wall → partition → deal), never from the step
under test. One test deleted (the empty-vocabulary rejection, semantically inverted
by this ticket; its corrupt-cast idiom survives in the unknown-type case). 53 → 67
tests.

## Test coverage

- **AC (a)** interleaved folds: property over (seed × 0–70 turns) checks every pond,
  the turn pointer, untouched hands, and the shrinking live wall against wall-derived
  expectations; a dangling-draw property pins `drawn` to the exact next live tile
  with the hand still 13; a tedashi example on frozen seed-1 literals pins the
  splice-and-append hand mechanics.
- **AC (b)** ryuukyoku: maximal-record property (70 turns → ended, live empty, ponds
  split 18/18/17/17, South last, drawn null) plus an exactly-when boundary property
  (through the 70th draw: live empty ∧ still 'playing'; one discard later:
  'ryuukyoku').
- **AC (c)** throw matrix, 9 cases from legally-reachable prefixes: wrong-seat draw
  and discard, draw-after-draw, discard-before-draw, another seat's tile, a
  live-wall tile, an already-ponded tile, both action types after ryuukyoku, unknown
  action type — each asserting RangeError + message fragment.
- **Contract invariants re-proven over the live vocabulary**: determinism (deep-equal
  refolds), array freshness (now incl. ponds), record non-mutation
  (structuredClone snapshot over mid-hand records), and conservation — hands + ponds
  + drawn + live + dead = 136 distinct ids, checked with and without a mid-turn
  dangling draw.
- **Gates**: `just test` 67/67 green, `just check` 0 errors/0 warnings,
  `just build` single-file gate OK. The seed-1 frozen golden passes verbatim.

### Coverage gaps (accepted, owned by siblings)

- No random *tedashi* sequences — happy-path properties are tsumogiri-shaped (plus
  one tedashi example) because tsumogiri logs are predictable from the deal alone.
  The random-legal-sequence generator (arbitrary tedashi/tsumogiri mixes, mutation
  testing, termination proofs) is explicitly T-003-01-03's charter.
- Conservation is checked at fold *ends* (with an optional dangling draw), not at
  every prefix of every sequence — again T-003-01-03's "at every prefix" property.
- The empty-live draw guard is unreachable through legal folds (defense-in-depth);
  no test drives it directly since constructing the state requires a corrupt fold.

## Open concerns / notes for humans

1. **The action encoding is now frozen.** `{type, seat[, tile]}` with draw recording
   no tile joins the rng-stream/wall/deal freeze set. If anyone wants a different
   shape (e.g. Tenhou-compatible compact text), the window is NOW, before
   T-003-01-02/-03 and the view build on it. The text-serialization ticket can map
   this structure to any wire format, so I believe the shape is safe.
2. **`applyAction` is deliberately not exported.** The public contract stays "log
  in → state out"; T-003-01-02 (legal-actions-surface) can drive agreement tests via
  `foldRecord` over extended logs (n ≤ 140, trivially cheap) and owns the call on
  whether a public stepper is warranted.
3. **Turn pointer after ryuukyoku** stays at the last discarder (South, seat 1, for a
  full hand) rather than advancing — documented on the field; legalActions for an
  ended state must be empty regardless (T-003-01-02's AC already says so).
4. **`TableState` is mutated internally during the fold** (fresh arrays, invisible
  outside); if a future ticket exposes incremental folding, it must not hand callers
  the same arrays it keeps mutating.
5. **App untouched by design**: App.svelte still folds an empty log; the
  tap-to-discard view over this vocabulary is S-003-02's work and now unblocked.
6. No TODOs left in code; no known bugs. Priority-critical path is clear:
  T-003-01-02 and T-003-01-03 are both unblocked by this ticket.
