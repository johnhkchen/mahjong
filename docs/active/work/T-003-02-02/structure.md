# T-003-02-02 — tap-to-discard-and-tsumogiri-loop — Structure

The shape of the code: files, boundaries, interfaces, ordering. No core files change.

## File inventory

| File | Change | Role after this ticket |
| --- | --- | --- |
| `src/app/drive.ts` | **create** (~45 lines) | The app's action-building seam over `legalActions` — the only new decision logic |
| `src/app/drive.test.ts` | **create** (~130 lines) | The AC's app test: list-obedience units + full-hand integration walk |
| `src/app/App.svelte` | modify | Owns the growing record; wires tap + paced auto-advance |
| `src/app/Table.svelte` | modify | Gains `ontap` prop; hand + drawn tiles become buttons |
| `src/app/app.ssr.test.ts` | modify (additions) | Asserts the tappable surface renders |
| `src/core/**` | **untouched** | Both contract halves already frozen and consumed as-is |

## src/app/drive.ts — the new module

Header comment states the boundary: this is app-side wiring over core's offered set —
every function takes `legalActions` output and returns either an element of it or
`null`; no function computes legality, reads hands, or counts the wall. The tsumogiri
chooser is the deliberate bot placeholder, shaped like the future core bot's call site.

```ts
import type { HandAction, Seat, TileId } from '../core'

/** The human's seat — East, the dealer. Table.svelte presents the same fact. */
export const PLAYER: Seat = 0

/**
 * The action a tap on `tile` builds: the discard of that tile by `player` — taken
 * from `offered` itself, never constructed — or null when no such discard is offered
 * (not the player's discard turn, or the tile isn't legally discardable).
 */
export function tapDiscard(
  offered: readonly HandAction[],
  player: Seat,
  tile: TileId,
): HandAction | null

/**
 * The action that happens without player input, or null when the game waits (the
 * player's discard choice) or has ended (empty offering):
 * - any draw is forced — a draw is never a choice (singleton offering);
 * - a non-player discard offering forces tsumogiri: the LAST offered discard, by
 *   legalActions' frozen hand-order-then-drawn-last contract (index sampling is the
 *   blessed use). Swapping in a real bot later replaces exactly this arm.
 */
export function forcedAction(
  offered: readonly HandAction[],
  player: Seat,
): HandAction | null
```

Implementation notes (the whole module is these two bodies):

- `tapDiscard`: `offered.find((a) => a.type === 'discard' && a.seat === player &&
  a.tile === tile) ?? null`. Seat check kept explicit even though offered sets are
  homogeneous — the function's promise ("the discard of that tile by player") should
  not depend on the caller knowing the homogeneity contract.
- `forcedAction`: classify by `offered[0]` (homogeneity is legalActions' documented
  shape): missing → `null`; `type === 'draw'` → `offered[0]`; `seat === player` →
  `null`; else → `offered[offered.length - 1]`.
- Both return offered elements by reference — deliberate and documented: the appended
  action IS `legalActions` output (fresh literals per call, per core's contract, so no
  aliasing hazard exists).

## src/app/App.svelte — record ownership and wiring

Script section becomes:

```ts
import { foldRecord, legalActions, type HandAction, type TileId } from '../core'
import { forcedAction, tapDiscard, PLAYER } from './drive'
import Table from './Table.svelte'

let seed = $state(1)                                  // unchanged
let actions = $state<HandAction[]>([])                // the growing half of the record
const table = $derived(foldRecord({ seed, actions })) // re-derived after every append
const offered = $derived(legalActions(table))

const BOT_DELAY_MS = 250                              // pacing is presentation

function tap(tile: TileId) {
  const action = tapDiscard(offered, PLAYER, tile)
  if (action) actions.push(action)
}

$effect(() => {
  const action = forcedAction(offered, PLAYER)
  if (action === null) return
  const timer = setTimeout(() => actions.push(action), BOT_DELAY_MS)
  return () => clearTimeout(timer)
})
```

Markup: `<Table {table} ontap={tap} />`. The stale comment ("necessarily empty until
action tickets widen HandAction") is replaced by the new truth: the record is the
authoritative state, appends only, everything on the table a fold of it; the effect is
the reactive fixed point that halts when `forcedAction` yields null.

Reactivity shape: `actions` is a deep `$state` proxy; `push` invalidates `table`, which
invalidates `offered`, which re-runs the effect — one forced action per tick until the
player's choice or the empty offering at ryuukyoku. Effect cleanup clears the pending
timer on unmount (and on any re-run). `$effect` does not run in SSR, so server renders
remain the dealt-table fold.

## src/app/Table.svelte — the tappable surface

- Props widen: `let { table, ontap }: { table: TableState; ontap?: (tile: TileId) =>
  void } = $props()`. Optional — SSR tests and future embedders may render Table
  without a handler; buttons then no-op (`ontap?.(id)`).
- East's hand `<li>`s wrap their `Tile` in
  `<button type="button" aria-label="discard {kindOf(id)}" onclick={() => ontap?.(id)}>`;
  same wrapper for the drawn tile inside its existing labeled span. `kindOf` is already
  imported. No legality knowledge: buttons render whenever the tiles do.
- New scoped style neutralizes button chrome (no background/border/padding, inherit
  font, `cursor: pointer`) so the tile chip stays the visual unit.
- The header comment's "never derives game facts" rule is unbroken: `ontap` is input
  wiring out, not a fact in.

## src/app/app.ssr.test.ts — additions only

- Dealt-App suite: assert 13 occurrences of `aria-label="discard ` scoped to the
  your-hand region (the tappable surface exists at boot). Existing token/wind/count
  assertions untouched — buttons don't add tile tokens or wind words.
- Mid-hand Table suite: assert the drawn tile also carries a discard button label.
- No new fixtures; the existing `midHand` record already has `drawn !== null`.

## src/app/drive.test.ts — layout

Per-file helpers, repo convention (expectations from frozen contracts, seed 1 anchor):

1. `describe('tapDiscard')` — returns the offered element itself (`toBe`); doctored
   list omitting a held tile → null (legality comes from the list, nowhere else);
   null on draw offerings, other-seat discards (doctored), empty offerings.
2. `describe('forcedAction')` — draw forced for every seat (East included); bot
   offering → last element, and (via the fold) that element is the drawn tile —
   tsumogiri asserted against `state.drawn`, the independent statement; player
   offering → null; empty → null.
3. `describe('full hand driven through the seam')` — the integration walk:
   synchronous loop over `{seed: 1, actions}` using only `forcedAction` +
   `tapDiscard(…, first hand tile)`; asserts every appended action is an element of a
   fresh `legalActions(foldRecord(…))` (identity, not shape), the fold never throws,
   the hand ends in ryuukyoku at exactly 140 actions with `legalActions` empty, and
   the three bot ponds are pure tsumogiri (each pond tile equals the tile its fold
   said was drawn — checked during the walk).

## Ordering of changes

1. `drive.ts` + `drive.test.ts` — the seam proves itself before any view changes
   (commit 1).
2. `Table.svelte` buttons + `App.svelte` wiring + `app.ssr.test.ts` additions — the
   view consumes the proven seam (commit 2).

Each commit leaves `just test` and `just check` green; commit 2 leaves `just build`'s
single-file gate green (app-only changes ride the existing pipeline).
