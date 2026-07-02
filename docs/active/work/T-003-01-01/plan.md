# T-003-01-01 — Plan: draw-discard-step-function

Ordered, independently verifiable steps. Each step ends with the named verification;
each is small enough to commit atomically. Structure.md is the blueprint; this is the
build sequence.

## Step 0 — Baseline

Run `just test` and `just check` on a clean tree to confirm the starting point is
green (recent commits say it is; trust but verify). No commit.

**Verify:** both green.

## Step 1 — Widen the contract types in `src/core/record.ts`

1. Add `Seat`, `SEAT_COUNT` to the `./deal` import.
2. Replace `type HandAction = never` with the two-member discriminated union
   (structure §2) and its contract-freeze doc comment.
3. Refresh `HandRecord.actions`' doc sentence (log is now a real sequence).
4. Append the four `TableState` fields (`ponds`, `turn`, `drawn`, `phase`) with the
   load-bearing doc comments (structure §4).
5. In `foldRecord`, extend the returned literal with post-deal values
   (`ponds: [[], [], [], []]`, `turn: 0`, `drawn: null`, `phase: 'playing'`).
   Leave the non-empty-log guard in place for this step — with a real vocabulary the
   guard is now WRONG for legal logs, but nothing constructs one yet, and keeping it
   makes this step compile-green in isolation.

**Verify:** `just check` green. `just test`: the explicit-composition property (test
1) fails on the four missing expected fields — fix it in the same step by adding
them to the `expected` literal (mechanical, no new test logic). All else green.

**Commit:** `T-003-01-01: widen HandAction to draw/discard, grow TableState with ponds/turn/drawn/phase`

## Step 2 — The step function: replace the guard with `applyAction`

1. Write module-private `applyAction(state, action, index)` per structure §5 —
   phase guard, `switch` with default throw, seat guard, draw arm (out-of-sequence +
   empty-live guards, `live.shift()`), discard arm (undrawn guard, tsumogiri vs
   tedashi with end-append, pond push, ryuukyoku-or-advance).
2. Replace `foldRecord`'s guard with the `forEach` application loop; rewrite the
   fold's doc comment (structure §6).
3. Delete record.test.ts test 6 ("rejects a record whose action log is non-empty") —
   its replacement lands in Step 4; the corrupt-cast idiom is preserved there.

**Verify:** `just test` green (existing suite exercises only empty logs after the
test-6 deletion), `just check` green — the `switch`'s default arm must satisfy
TS's `never` narrowing without casts.

**Commit:** `T-003-01-01: replace the non-empty-log guard with the per-action draw/discard step`

## Step 3 — Test helpers + happy-path suite (AC (a), (b))

In `record.test.ts`:

1. Helpers: `tsumogiriRecord(seed, turns)` (actions derived from the empty-log
   fold's `live` — expected values come from frozen upstream contracts, not the step
   under test) and `maximalRecord(seed)`.
2. New describe "draw/discard step" (structure blueprint):
   - interleaved tsumogiri property: ponds/turn/drawn expectations per prefix
   - tedashi example: discard a known hand tile → pond gets it, former drawn tile at
     hand END, hand stays 13
   - dangling-draw property: after `4k+1` actions, `drawn === live₀[k]`, hand 13
   - maximal-record property: ryuukyoku, live empty, ponds sum 70, `turn === 1`,
     `drawn === null`
   - "exactly when" boundary: prefix through the 70th draw (139 actions) →
     `live.length === 0` ∧ `phase === 'playing'`; full 140 → `'ryuukyoku'`
   - non-empty-record determinism + freshness (deep-equal refolds, distinct arrays)
3. Extend existing tests per structure: freshness (+ponds), non-mutation (+non-empty
   record), conservation (hands + ponds + drawn + live + dead = 136 over prefixes).

**Verify:** `just test` green. Property runs stay fast (fold is O(n), n ≤ 140;
cap the turns arbitrary sensibly, e.g. `fc.integer({min: 0, max: 70})`).

**Commit:** `T-003-01-01: cover the turn loop — interleaved folds, ryuukyoku boundary, conservation over prefixes`

## Step 4 — Illegal-action throw matrix (AC (c))

New describe "illegal actions throw": each case builds a legally-reachable state
(via `tsumogiriRecord` prefixes) and appends one bad action, asserting
`toThrow(RangeError)` and a message fragment:

- wrong-seat draw (e.g. South acts first) / wrong-seat discard
- draw when a tile is already drawn (out of sequence)
- draw after the hand ended (maximal record + one more draw)
- discard before any draw
- discard of a tile not in the acting hand (a tile from another seat's hand, and a
  tile that sits in `live`)
- discard after the hand ended
- unknown action type (the old test-6 corrupt cast, retargeted to the new guard)

**Verify:** `just test` green — this is the ticket's AC gate: all three AC bullets
now have named tests. `just check` green.

**Commit:** `T-003-01-01: throw matrix — wrong seat, tile not in hand, out-of-sequence actions fail loudly`

## Step 5 — Whole-repo confirmation

`just test` (full vitest run — core + app SSR test), `just check`
(svelte-check + tsc), `just build` (single-file gate — TableState growth must not
disturb the app compile). Fix anything that surfaces; expected: nothing, the growth
is additive and App/Table read only existing fields.

**Verify:** all three green. No commit unless fixes were needed.

## Testing strategy summary

- **Unit/example tests**: tedashi mechanics, the ryuukyoku boundary prefix, every
  throw case — places where one exact scenario is the spec.
- **Property tests** (fast-check over `seedArb`, the house idiom): interleaved-fold
  expectations, dangling draws, maximal records, determinism/freshness/non-mutation/
  conservation over random seeds and prefix lengths — the contract facts that must
  hold for every seed.
- **Expected-value discipline**: helpers derive expectations from the *empty-log
  fold's* wall (frozen by T-002 goldens), never from the step function under test.
- **Explicitly deferred to T-003-01-03**: the random-legal-sequence generator
  (arbitrary tedashi/tsumogiri mixes), conservation at *every* prefix of *random*
  sequences, guaranteed-termination properties, mutation testing of legal sequences.
  This ticket proves the step; the sibling proves the dynamics at scale.

## Risks / watch-fors

- **TS narrowing in the switch default**: `action` narrows to `never` once both arms
  are handled; the default throw needs to read a property without tripping
  `noUncheckedIndexedAccess`-style rules — use a safe stringify of the runtime value.
- **`turn` arithmetic typing**: `(turn + 1) % SEAT_COUNT` widens to `number`; the
  cast back to `Seat` is confined to one line inside the step.
- **Test 1's `toEqual` exactness** is the canary for accidental field drift — if a
  fifth field sneaks in later, that property fails first. Keep it exact.
- **Do not touch** the seed-1 golden, rng/wall/deal modules, or the barrel.
