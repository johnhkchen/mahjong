# T-006-03-01 — discard-policy — Structure

The blueprint: file-level changes, interfaces, internal organization, ordering.

## 1. Files

| File | Change | Content |
|---|---|---|
| `src/core/policy.ts` | **create** | The policy module: `discardPolicy` + private helpers (~120 lines with doc comments) |
| `src/core/policy.test.ts` | **create** | Example fixtures + seeded property sweep (~350 lines) |
| `src/core/index.ts` | **modify** | Add `export * from './policy'` (one line, after `./legal` — barrel order mirrors the dependency direction) |

Nothing else. Explicitly untouched: `shanten.ts`/`shanten.test.ts` (another
thread's uncommitted work sits there), `legal.ts`, `seatview.ts`,
`src/app/drive.ts` (T-006-03-03's seam — the placeholder stays until then).

## 2. `src/core/policy.ts` — internal organization

Module header comment: the policy doctrine — SeatView-typed by construction
(fair play structural, the seatview.ts doctrine's first bot-side consumer),
deterministic and RNG-free (the T-006-03-04 replay invariant), selects from the
offered set rather than constructing actions, own-turn arms only with the call
branch named as T-006-03-02's extension, and the tie-break documented in prose
where consumers will read it.

Imports (all `./` siblings — purity gate):

```ts
import type { HandAction } from './record'
import type { SeatView } from './seatview'
import { kindOf, rankOf, type TileId } from './tiles'
import { shanten } from './shanten'
```

Private helpers, in file order:

- `const CENTER_RANK = 5`
- `function centerDistance(tile: TileId): number` — `|rank − 5|` for numbered
  kinds; `5` for honors (rankOf returns null). The whole tie-break key; swapping
  the heuristic later (ukeire) touches only this and the comparator.
- `function shantenAfterDiscard(tiles: readonly TileId[], meldCount-bearing
  melds, tile: TileId): number` — copy `tiles`, remove the one id (ids are
  unique), map `kindOf`, delegate to `shanten`. No arity checks of its own —
  shanten owns that contract.

Public face:

```ts
export function discardPolicy(
  view: SeatView,
  offered: readonly HandAction[],
): HandAction
```

Body, three arms in fixed order over `offered` filtered to `view.seat`:

1. `find` a `tsumo` → return it (by reference).
2. `filter` the `discard`s → if any: build the candidate multiset
   `view.drawn === null ? [...view.hand] : [...view.hand, view.drawn]` once;
   single left-to-right pass with strict-improvement comparison —
   `(s < bestS) || (s === bestS && dist > bestDist)` — so earliest-offered wins
   all remaining ties; return the winner.
3. `find` a `draw` → return it.
4. `throw new RangeError(...)` naming the contract: the discard policy decides
   own-turn points (draw / discard / tsumo) only; claim windows are the call
   branch (T-006-03-02).

Kan offers and an own pre-draw ron pass through unchosen by construction (arms
1–3 never match them); the header documents both deferrals.

## 3. Public interface (the barrel after this ticket)

- `discardPolicy(view, offered)` — the only new export. No type exports: the
  signature is written entirely in existing public types (`SeatView`,
  `HandAction`). `centerDistance` and `shantenAfterDiscard` stay private —
  the standardShanten/bestValue single-face discipline.

## 4. `src/core/policy.test.ts` — organization

Imports from `./index` (the dynamics.test.ts convention) plus `vitest`,
`fast-check`.

Describe blocks, in order:

1. **`tsumo arm`** — a post-draw offered set containing tsumo + 14 discards +
   an ankan: returns the tsumo; reference-identity asserted.
2. **`discard arm — minimality`** — hand-built SeatView fixtures:
   - unique tenpai-reaching discard chosen (every alternative computed worse);
   - chosen discard's shanten equals the min over all offered discards;
   - post-draw: result shanten ≤ shanten of the pre-draw 13 (non-raise).
3. **`discard arm — tie-break`** —
   - honor shed over a middle tile at equal shanten;
   - terminal over a 4/5/6 at equal shanten;
   - symmetric distance tie (e.g. 1m vs 9p both minimal) → earliest offered;
   - same-kind copies tie → earliest offered.
4. **`mustDiscard branch`** — a view with one meld, 11-tile hand, no drawn,
   offered = 11 hand discards: element-of-set + minimality.
5. **`draw arm`** — pre-draw offered `[draw]`: returned.
6. **`contract violations`** — a claim-window offered set for a non-turn seat
   (pons/chis only, no own draw/discard/tsumo) throws RangeError; empty offered
   throws.
7. **`purity and determinism`** — same (view, offered) twice → `toBe`-identical
   result; inputs deep-snapshot-equal after the call.
8. **`property: policy over seeded games`** — test-local driver in the
   dynamics.test.ts mold: fold a growing record from a seed, and at every state
   where `legalActions` is non-empty, if the turn seat is at an own-turn point,
   evaluate `discardPolicy(seatView(state, turn), legal)`; assert element-of-
   set (identity via `includes`), tsumo-always-taken, discard minimality, and
   post-draw non-raise. Drive the game *by* the policy's choices at own-turn
   points (claims auto-passed by taking the draw — exactly what arm 3 does),
   bounded by the ACTION_BOUND idiom; assert the game ends. A modest fixed
   seed range (e.g. 0–29) keeps the suite fast and reproducible; fc's seedArb
   adds a sampled layer if cheap.

Fixture-building helper, test-local: `viewOf({hand, drawn, melds, seat, ...})`
filling SeatView's remaining fields with inert defaults (empty ponds, wallCount,
phase 'playing', ...), since SeatView is a plain interface. Hands written as
mpsz strings via a tiny `tilesOf('123m45p…')` helper (the notation the other
suites use in comments) or explicit `tileId` calls — whichever reads cleaner;
copies disambiguated by explicit copy indices.

## 5. Ordering of changes

1. `policy.ts` + barrel line (compiles standalone; purity gate covers it).
2. Example-fixture describe blocks (1–7) — commit once green.
3. Property sweep (block 8) — commit once green.
4. `just test` + `just check` full pass before each commit; artifacts commit
   last. Stage only this ticket's files — the working tree carries other
   threads' diffs (shanten.ts, ticket frontmatter).
