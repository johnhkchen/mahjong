# T-003-01-02 — Plan: legal-actions-surface

Two commit-sized steps, each independently verifiable, following structure.md's
seams. Verification gates throughout: `just test` (vitest over `src/core/`),
`just check` (svelte-check + tsc). `just build` once at the end (core-only change;
the single-file gate should be unaffected).

## Step 1 — the surface: `legal.ts`, barrel export, shape-level tests

**Code**

1. Create `src/core/legal.ts`: `legalActions(state: TableState): HandAction[]` with
   the three arms (ended → `[]`; pre-draw → the one draw; post-draw → 13 hand
   discards in hand order + drawn last) and the contract comments specified in
   structure.md (independent-statement framing, purity/freshness/order guarantees,
   reachability note, widening note).
2. Append `export * from './legal'` to `src/core/index.ts`.

**Tests** (new `src/core/legal.test.ts`, importing `fast-check`/`vitest`/`./index`
only; test-local helpers `dealtLive` / `tsumogiriRecord` / `maximalRecord` /
`prefixArb` per structure.md)

3. `describe('the set is the closed form')`:
   - property (seed × turns): even prefix ⇒ result equals
     `[{type:'draw', seat: state.turn}]` exactly;
   - property (seed × turns × dangling draw): post-draw state ⇒ 14 actions, every
     seat tag `=== state.turn`, every type `'discard'`, tiles as a Set equal
     `new Set([...state.hands[state.turn], state.drawn])`, order = hand order then
     drawn last.
4. `describe('ended hand offers nothing')`: property — `maximalRecord(seed)` folds
   to ryuukyoku and `legalActions` of it is `[]`.
5. `describe('purity and freshness')`: property — `structuredClone` snapshot before,
   deep-equal after; two calls `toEqual` but arrays and per-index action objects
   `not.toBe`.

**Verify**: `just test` green (67 existing + new all passing), `just check` clean.
The barrel import in the test file is itself the AC's export check.

**Commit**: `T-003-01-02: legalActions — closed-form legality surface exported from
the core barrel`

## Step 2 — the agreement: soundness + negatives

**Tests** (same file)

6. `describe('offered actions fold')` — soundness property: for
   `{seed, turns, dangle}`, build prefix, fold, then for each
   `a ∈ legalActions(state)` expect
   `foldRecord({seed, actions: [...prefix, a]})` not to throw. (≤14 folds/run.)
7. `describe('outside actions throw')`:
   - sampled-negative property: from a folded prefix, build the specific
     off-by-one-rule actions — wrong-seat draw (`(turn+1)%4`), wrong-seat discard,
     draw while `drawn !== null`, discard while `drawn === null`, discard of a tile
     drawn from another seat's hand / `live[0]` / `dead[0]` / own pond (when
     non-empty) — assert each is absent from the returned set AND
     `foldRecord([...prefix, bad])` throws `RangeError`;
   - exhaustive partition example at seed 1: for three anchor states — pre-draw
     (`tsumogiriRecord(1, 1)` prefix), post-draw (that plus one draw), ended
     (`maximalRecord(1)`) — enumerate all 548 candidates
     (`4 draws + 4 seats × 136 tiles`), and for each: if it deep-equals a member of
     `legalActions(state)` expect the appended fold to succeed, else to throw
     `RangeError`. Membership via a serialized-key Set (`type:seat:tile`).

**Verify**: `just test` green; `just check` clean; `just build` OK. Runtime sanity:
the suite should add no more than a few seconds (3 × 548 short folds + cheap
properties); if fc shrinking makes the sampled-negative property noisy, split it
into one `it` per negative shape rather than raising `numRuns`.

**Commit**: `T-003-01-02: agreement suite — every offered action folds, all 548
candidates partition into offered/throws, ryuukyoku offers nothing`

## Acceptance-criteria traceability

| AC clause                                                        | covered by |
|------------------------------------------------------------------|-----------|
| `legalActions` exported from the core barrel                     | step 1 (barrel line; test imports from `./index`) |
| every returned action accepted by the step, many seeds/prefixes  | step 2, soundness property |
| sampled actions outside the set throw                            | step 2, negatives property + 548-candidate partition |
| ended (ryuukyoku) state returns no legal actions                 | step 1, ended-hand property (re-checked by partition's third anchor) |

## Risks / contingencies

- **fc property cost**: soundness folds ≤14 records of ≤141 actions per run — fine at
  default `numRuns`. If CI time balloons, cap `turnsArb` sampling, not assertions.
- **`toEqual` vs literal order in the closed-form test**: hands are draw-ordered and
  the enumeration is specified hand-order-then-drawn, so exact `toEqual` on the
  array is deterministic — no set-normalization needed except where the spec says
  set-equal.
- **Deviation protocol**: any drift from this plan (helper sharing, extra guards,
  message-fragment assertions) gets a note in `progress.md` before proceeding.
