# T-003-01-03 — Structure: turn-loop-property-suite

The file-level blueprint for design.md's decisions. One file is created; nothing is
modified or deleted.

## Files

```
CREATED   src/core/dynamics.test.ts     # the whole ticket
UNCHANGED src/core/record.ts            # foldRecord — consumed, not touched
UNCHANGED src/core/legal.ts             # legalActions — consumed, not touched
UNCHANGED src/core/index.ts             # barrel already exports everything needed
```

Work artifacts land in `docs/active/work/T-003-01-03/` per RDSPI.

## Why a new file (not extending record.test.ts / legal.test.ts)

- `record.test.ts` owns *step semantics* (wall-derived value expectations over
  tsumogiri records); `legal.test.ts` owns *agreement* (offered ⇔ folds). This suite
  owns *dynamics over random-legal trajectories* — a third concern, per the ticket's
  own framing ("convert property rigor from static wall facts to dynamics").
- The module-name convention (`<concern>.test.ts` beside the concern) bends here:
  there is no `dynamics.ts` runtime module, and deliberately so (design §1 — no
  runtime generator). The file-top comment must say this: the suite tests the
  *composition* of record.ts and legal.ts, so it sits beside both.
- `purity.test.ts` picks the file up automatically via `import.meta.glob('./*.ts')`
  — no registration anywhere; vitest discovers it by the `.test.ts` suffix.

## Internal organization of `src/core/dynamics.test.ts`

Order within the file mirrors the house layout (imports → constants → helpers →
arbitraries → describes):

### Imports

From `./index` only (barrel-consumption precedent from legal.test.ts), plus
`fast-check` and `vitest`:
`DEAL_SIZE, LIVE_WALL_SIZE, SEAT_COUNT, STARTING_HAND_SIZE, TILE_COUNT, foldRecord,
legalActions, type HandAction, type HandRecord, type Seat, type TableState` —
trimmed at implementation time to what is actually used (tsc/svelte-check flags
unused imports).

### Constants

- `FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE` (70) — mirrored per-file, house style.
- `seedArb = fc.integer({min: 0, max: 0xffffffff})` — the canonical seed domain.

### Helpers (test-local, no exports)

```ts
/** Drive a game from `seed`, consuming one choice per post-draw point. */
function playRecord(seed: number, choices: readonly number[]): HandRecord
```
Loop: fold current record → `legal = legalActions(state)` → if empty or choices
exhausted, stop → pick `legal.length === 1 ? legal[0] : legal[choices[c++] % legal.length]`
→ append. Choices bound the game length: `choices.length === n` yields at most `n`
complete turns (each turn consumes exactly one choice, at its post-draw point).
Hard iteration bound `2 * FULL_TURNS + 2` appended actions; exceeding it throws —
this helper is also the termination proof's engine, so it must fail loudly, never
spin. Returns `{seed, actions}`.

```ts
/** The five-zone flatten of a state, in a stable order. */
function allZones(state: TableState): number[]
```
`[...hands.flat(), ...ponds.flat(), ...(drawn ?? absent), ...live, ...dead]` —
shared by the conservation property and kept tiny so it is obviously correct.

```ts
/** Membership key for offered-set checks (mirrored from legal.test.ts). */
function keyOf(action: HandAction): string
```

### Arbitraries

```ts
/** A random-legal game: seed + up to FULL_TURNS choices + optional dangling draw. */
const gameArb = fc.record({
  seed: seedArb,
  choices: fc.array(fc.nat(13), {maxLength: FULL_TURNS}),   // 14 discards max → nat(13)
  dangle: fc.boolean(),
}).map(...)  // → {seed, actions} via playRecord (+ one legal draw if dangle & playing)
```
`fc.nat(13)` matches the largest offered set, so modulo is usually identity —
shrunk values map stably onto low hand indexes. The map runs `playRecord`, so
generation cost is itself O(n²); acceptable at these sizes (design §5).

```ts
const fullGameArb = ...  // choices: fc.array(fc.nat(13), {minLength: FULL_TURNS, maxLength: FULL_TURNS})
```
Exactly 70 choices → `playRecord` runs until the offered set empties.

### Describe blocks (one per AC clause)

1. **`conservation over random play`** — `fc.assert` over `gameArb`: for every
   prefix length 0..actions.length, refold and assert `allZones` has length 136 and
   Set-size 136; at prefixes where `drawn === null` additionally assert the AC's
   literal four-zone form. Explicit `numRuns` (timing-gated, start 50).
2. **`fold determinism over random play`** — over `gameArb`: fold twice, `toEqual`
   deep equality, top-level freshness spot-checks (`not.toBe` on hands/ponds/live).
3. **`termination`** — over `fullGameArb`: assert exactly `2 * FULL_TURNS` actions,
   `phase === 'ryuukyoku'`, `live` empty, `drawn` null, `legalActions(state)` empty,
   ponds sum to 70. (The hard bound inside `playRecord` is what makes an
   infinite-loop regression a test failure rather than a hang.)
4. **`mutated sequences throw`** — over `gameArb` + `fc.nat()` mutation-point +
   operator choice: build the mutant per design §7's five operators (seat bump,
   type flip, duplicate, tile retarget, append-after-end on full games), filter
   still-legal retargets with `fc.pre`, assert absent from offered set and
   `toThrow(RangeError)`.

Operator table (mutant construction is a test-local `mutate(record, i, op, ...)`
switch returning `{actions, at}` or a signal to `fc.pre`-discard):

| op            | applies at             | guard it must hit                    |
|---------------|------------------------|--------------------------------------|
| seat-bump     | any action i           | wrong-seat draw / wrong-seat discard |
| type-flip     | any action i           | out-of-sequence draw / discard       |
| tile-retarget | discard actions        | neither holds nor just drew          |
| duplicate     | any action i           | out-of-sequence (second draw/discard)|
| append-at-end | full games only        | hand already ended in ryuukyoku      |

### Ordering of changes

Single file, but written in the plan's step order so each commit is green:
helpers + arbitraries land with the first property that uses them; no dead code at
any commit boundary.

## Public interface changes

None. No runtime module is created or modified; the core barrel is untouched; the
test file exports nothing. The engine's public contract is exercised strictly
through `foldRecord` and `legalActions` as exported from `./index`.

## Constraints checked against the blueprint

- **Purity gate**: imports are `./index`, `fast-check`, `vitest` — all allowed for
  test files. File-top comment must avoid `from '<bare>'`-shaped quoted text.
- **Determinism**: all randomness is fc-supplied; no `Math.random`, no `Date`.
- **Budget**: two O(n²)-per-run properties carry explicit `numRuns`; the plan's
  final step measures `just test` and dials them so total suite time stays ≲2.5s.
- **No second step-authority**: the only state advancement anywhere in the file is
  `foldRecord` over a longer record (design §3).
