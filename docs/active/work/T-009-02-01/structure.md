# Structure — T-009-02-01 bot-riichi-policy

## 1. Files touched

Two files, both already existing — no new files, no deleted files, no `src/app/` changes
(this is a `src/core/` policy extension, same split T-009-01-01 held to).

- `src/core/policy.ts` — `discardPolicy`'s body and header doc-comment.
- `src/core/policy.test.ts` — new fixtures/describe blocks, plus two small extensions to the
  existing sweep.

No changes to `legal.ts`, `record.ts`, `seatview.ts`, or `index.ts` — the riichi vocabulary,
its offering, and `SeatView`'s surface are all already exactly what this ticket needs
(Research §2.2–2.4).

## 2. `src/core/policy.ts`

### 2.1 New import

```ts
import { waits } from './waits'
```

Added alongside the existing `import { shanten } from './shanten'` line — same module
grouping, no barrel indirection (policy.ts imports its dependencies directly today, never
via `./index`).

### 2.2 New private helper, placed directly after `shantenAfterDiscard`

```ts
/**
 * True when discarding `tile` from `pool` would leave a wait that can never complete —
 * every kind the resulting 13-tile hand could win on is already fully visible to the
 * hand itself (its own concealed tiles plus its own melds), so ron and tsumo are both
 * structurally impossible. `waits`' own exhaustion convention (waits.ts) is the source of
 * truth; this is a direct call, not a re-derivation.
 */
function isDeadWait(
  pool: readonly TileId[],
  melds: SeatView['melds'][number],
  tile: TileId,
): boolean {
  const remainder = pool.filter((t) => t !== tile).map(kindOf)
  return waits(remainder, melds).length === 0
}
```

Signature deliberately mirrors `shantenAfterDiscard` (same `pool`/`melds`/`tile` shape) so
the call site reads as a parallel pair of scorers.

### 2.3 `discardPolicy` — one new step after the existing discard-scoring loop, before its
`if (best !== null) return best` line

Current shape (`src/core/policy.ts:112-143`, unchanged lines omitted):

```ts
export function discardPolicy(view: SeatView, offered: readonly HandAction[]): HandAction {
  const seat = view.seat
  for (const action of offered) {
    if (action.type === 'tsumo' && action.seat === seat) return action
  }
  let best: HandAction | null = null
  let bestShanten = 0
  let bestDistance = 0
  let pool: TileId[] | null = null
  for (const action of offered) {
    // ...unchanged scoring loop...
  }
  if (best !== null) return best   // <-- new step inserted immediately before this line
  for (const action of offered) {
    if (action.type === 'draw' && action.seat === seat) return action
  }
  throw new RangeError(/* unchanged */)
}
```

New step, replacing that one `if (best !== null) return best` line:

```ts
  if (best !== null) {
    if (bestShanten === 0) {
      const bestTile = (best as Extract<HandAction, { type: 'discard' }>).tile
      for (const action of offered) {
        if (action.type === 'riichi' && action.seat === seat && action.tile === bestTile) {
          if (!isDeadWait(pool!, view.melds[seat], bestTile)) return action
          break
        }
      }
    }
    return best
  }
```

Notes on shape:

- `pool` is already guaranteed non-null here (it is assigned on the first loop iteration
  that reaches `best !== null`'s assignment, and `best !== null` implies at least one
  iteration ran) — the existing code already relies on this invariant implicitly (`pool` is
  read inside the loop only after `pool ??=`); the `!` non-null assertion matches that
  established trust level, not a new one.
- The `for` loop scans at most the full `offered` array once more; riichi offers are few
  (bounded by 14 candidate tiles) and this only runs when `bestShanten === 0`, which is the
  rare "already at tenpai" case — no meaningful cost added to the common path.
- `break` (not a second `return`) once a matching-tile riichi offer is found but rejected by
  `isDeadWait`, since offered order guarantees at most one riichi action per tile — no need
  to keep scanning.

### 2.4 Header doc-comment

The module header (lines 1–53) gets one new paragraph appended after THE DISCARD ARM's
existing three paragraphs (before "THE CALL BRANCH, callPolicy..."), documenting the new
step in the same voice: what it does, the one-sentence dead-wait rule, and an explicit
pointer to why furiten alone is not the gate (Design §3). No existing header prose is
edited — this is a pure addition, consistent with "extend-only."

## 3. `src/core/policy.test.ts`

All additions; no existing test is modified (Design §2's placement guarantees every current
fixture's `offered` array, having no `riichi` action, is untouched by the new branch).

### 3.1 New fixtures, alongside the existing `discardsOf`/`afterDiscard` helpers

- A small helper mirroring `discardsOf` but for riichi: given a view and a tile, build the
  one `{ type: 'riichi', seat, tile }` literal — used to hand-construct curated `offered`
  arrays without duplicating the shape inline everywhere. (`riichiOf(view, tile)` or
  inlined per-test, whichever reads cleaner once written — a judgment call for Plan/
  Implement, not load-bearing to the design.)

### 3.2 New `describe('discard arm — riichi')` block, placed after the existing "discard arm
— tie-break" block and before "mustDiscard branch"

Three tests, corresponding to Research §4's two fixtures plus one purity check:

1. **Declares** — `123m456p789s1122z` + drawn `5z`, full realistic `offered` (all 14
   discards + the one matching riichi offer, mirroring `legalActions`' own ordering:
   discards then riichi offers). Asserts the chosen action is the `riichi` literal (not the
   plain discard for the same tile), and separately re-derives (in-test) that `waits` on the
   resulting hand is non-empty — the "declare" half of the AC.
2. **Declines on a dead wait** — `1111m234p567p789s` + drawn `9m`, a *curated* two-element
   `offered` (the `9m` discard and its matching riichi action only — isolating this exact
   candidate the way the existing "breaks a same-kind copies tie by offered order" test
   isolates its own). Asserts the chosen action is the plain `discard`, not the `riichi`
   action, and re-derives in-test that `waits` on the resulting hand is empty — the
   "non-declare" half of the AC.
3. **Ignores another seat's riichi offer** — same shape as the existing "ignores another
   seat's tsumo"/"ignores other seats' claim offers" tests elsewhere in the file: a riichi
   offer for a different seat sitting in `offered` must not affect `view.seat`'s own choice.

### 3.3 Purity/determinism extension

Add one riichi-containing fixture to each of the two existing `describe('purity and
determinism')` tests (repeated-call identity; structurally-equal-input equality) — same
shape as their current bodies, new `offered` array built from fixture 1 above (the "declare"
case, since it is the one that actually returns a `riichi`-typed action, exercising the new
code path under both purity checks).

### 3.4 Sweep extension (`playPolicy` and its enclosing `describe` block)

- Inside `playPolicy`'s own-turn branch (`else` block, after the existing discard-minimality
  checks): widen the `if (chosen.type === 'discard')` block's *sibling* handling so a
  `chosen.type === 'riichi'` result is also oracle-checked — re-derive that removing
  `chosen.tile` from the pool leaves `shanten === 0`, the same check already run for plain
  discards, applied to the riichi branch too. Track a `riichiFolded` counter alongside the
  existing `claimsFolded`/`ronsFolded`, returned from `playPolicy` the same way.
- In the `describe('property: the policy pair over seeded whole games')` block's first test,
  accumulate `riichiFolded` across the corpus (mirroring the existing `claims` accumulator)
  and assert it is `> 0` — non-vacuous, same posture and same comment style as the existing
  claims check ("If a corpus change ever zeroes this, widen the corpus rather than weakening
  the check").

## 4. Ordering

Single-file-pair change with no sequencing hazard between the two files individually, but
`policy.ts`'s edit must land (or at least be written) before `policy.test.ts`'s new
assertions can pass — Plan sequences accordingly (policy.ts first, tests second, sweep
extension last since it depends on the whole thing being in place and is the slowest to
iterate on).
