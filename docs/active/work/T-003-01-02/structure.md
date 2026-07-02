# T-003-01-02 — Structure: legal-actions-surface

The blueprint: two files created, one line added to the barrel, nothing deleted,
`record.ts` untouched.

## File-level changes

| file                     | change   | contents                                          |
|--------------------------|----------|---------------------------------------------------|
| `src/core/legal.ts`      | create   | `legalActions(state): HandAction[]` (~50 lines with contract comments) |
| `src/core/index.ts`      | modify   | append `export * from './legal'`                  |
| `src/core/legal.test.ts` | create   | agreement suite (~180 lines)                      |
| `src/core/record.ts`     | untouched | the step stays the single authority on folding   |
| `src/core/purity.test.ts`| untouched | glob picks up new siblings automatically         |

## `src/core/legal.ts` — module boundary and shape

**Imports** (all `./sibling`, satisfying the purity gate):

```ts
import type { HandAction, TableState } from './record'
```

(`Seat` and `TileId` flow through the `HandAction`/`TableState` types; no direct
import needed unless a local annotation wants one — keep imports minimal.)

**Public interface** (the module's entire surface):

```ts
export function legalActions(state: TableState): HandAction[]
```

**Internal organization** — one function, three arms in the order the state machine
narrows, mirroring research's closed-form table:

```ts
export function legalActions(state: TableState): HandAction[] {
  if (state.phase !== 'playing') return []          // ended hand: nothing is legal
  if (state.drawn === null)                          // action point 1: must draw
    return [{ type: 'draw', seat: state.turn }]
  return [                                           // action point 2: must discard
    ...state.hands[state.turn].map(...discard literals in hand order...),
    { type: 'discard', seat: state.turn, tile: state.drawn },  // drawn tile last
  ]
}
```

Contract comments carry the load, in the house style (see `record.ts` doc comments):

- **Header**: legality is the *offered* half of the public contract ("log in → legal
  actions / next state out", architecture.md); the step in `record.ts` remains the
  authority on what *folds*; the two are locked together by the agreement suite. An
  independent statement, deliberately — not derived from `applyAction`.
- **Guarantees**: pure read (never mutates the state); fresh array and fresh action
  literals per call (callers cannot corrupt a fold through the result); deterministic
  order — hand order 0..12 then the drawn tile last, stable because hands are
  draw-ordered and never sorted.
- **Reachability note**: in a legally-folded `'playing'` state with `drawn === null`,
  `live` is non-empty (the phase flips on the wall-emptying discard), so the single
  offered draw always folds — documented, not guarded, per the trusted-state
  precedent.
- **Widening note**: extend-only — call/riichi/agari tickets grow the enumeration
  (and this module), never reshape existing members.

## `src/core/index.ts` — one-line change

```ts
export * from './legal'
```

appended after `export * from './record'` (keeps the barrel's dependency-ish
ordering: legal reads record's types). This satisfies the AC's "exported from the
core barrel"; the app and tests import from `./index` / the barrel as today.

## `src/core/legal.test.ts` — suite layout

Imports: `fast-check`, `vitest`, and `./index` only (barrel import doubles as the
AC's export check — the suite fails to compile if `legalActions` is missing from the
barrel). Test-local helpers, mirroring `record.test.ts` conventions rather than
sharing them (helpers live per-file today; extracting a shared helpers module is
T-003-01-03's call if it wants one):

- `seedArb` — integers `[0, 2^32)`.
- `dealtLive(seed)` / `tsumogiriRecord(seed, turns)` / `maximalRecord(seed)` —
  copied pattern: expectations derive from wall → partition → deal, never from the
  code under test.
- `prefixArb` — `{seed, turns ∈ [0, 70], dangle: boolean}` mapped to a record prefix
  reaching both action points (even/odd action counts).

`describe` blocks, one per design-test:

1. **`offered actions fold`** — soundness property: each `a ∈ legalActions(fold(p))`
   appended to `p` folds without throwing.
2. **`the set is the closed form`** — completeness property: pre-draw ⇒ exactly
   `[{type:'draw', seat: turn}]`; post-draw ⇒ 14 discards, seat all `turn`, tiles
   set-equal `hands[turn] ∪ {drawn}`, ordered hand-order-then-drawn.
3. **`outside actions throw`** —
   - property: sampled negatives (wrong-seat draw/discard, draw-while-drawn,
     discard-before-draw, discard of a tile from another hand / live / dead / own
     pond) each throw `RangeError`;
   - exhaustive example at frozen seed 1: for a pre-draw prefix, a post-draw prefix,
     and the full ryuukyoku record, partition all 548 candidates (4 draws + 4×136
     discards) into offered ⇒ folds / not offered ⇒ throws.
4. **`ended hand offers nothing`** — property: ryuukyoku fold ⇒ `[]` (the AC's
   fourth clause).
5. **`purity and freshness`** — property: state deep-equals its pre-call snapshot;
   two calls return `toEqual` but not-`toBe` arrays (and not-`toBe` action objects).

## Ordering of changes

1. `legal.ts` + barrel line + suite blocks 2/4/5 (shape-level facts) — compiles,
   proves the surface exists and is pure.
2. Suite blocks 1 and 3 (the agreement halves: soundness, then negatives incl. the
   548-candidate partition).

Two commits along those seams; `record.ts` is never edited, so no risk to the frozen
step or its 67 tests.

## Non-changes, stated

- No `applyAction` refactor, no new exports from `record.ts`.
- No app wiring (T-003-02-01 owns rendering; bots come later).
- No record-shaped convenience wrapper (`legalActions(foldRecord(r))` composes).
- No changes to `justfile`, vitest config, or purity gate.
