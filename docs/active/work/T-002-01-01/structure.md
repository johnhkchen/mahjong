# T-002-01-01 — Structure: dora indicator → dora kind mapping

The blueprint: files, boundaries, interfaces, ordering. Implements design.md (Option B
placement, Option 1 arithmetic, exhaustive doubly-spelled tests).

## 1. File-level changes

| File | Change | Contents |
| --- | --- | --- |
| `src/core/dora.ts` | **create** | riichi dora rules module; exports `doraKindOf` |
| `src/core/dora.test.ts` | **create** | exhaustive tests: totality, pinned wraparounds, full literal table, structural properties |
| `src/core/index.ts` | **modify** | add `export * from './dora'` (one line) |

Nothing else changes. No deletions. `tiles.ts`, `rng.ts`, `wall.ts`, existing tests,
build config, justfile: untouched. `purity.test.ts` needs no edit — its
`import.meta.glob('./*.ts')` picks the new files up automatically and polices their
imports (dora.ts may import only `./tiles`; dora.test.ts only `./index` + vitest).

## 2. `src/core/dora.ts` — module shape

```
// Header comment: riichi rules knowledge — indicator → dora. States the rule
// (next tile in the indicator's own cycle) and the three cycles (suit ranks 1-9,
// winds E→S→W→N→E, dragons haku→hatsu→chun→haku), and that it's kind-level
// (physical indicator tiles are decoded upstream via kindOf; ura uses the same map).

import { suitOf, type TileKind } from './tiles'

export function doraKindOf(indicator: TileKind): TileKind
```

Single export. Internal logic (no helper functions warranted at this size):

- `const suit = suitOf(indicator)` — branch discriminator.
- `const n = Number(indicator[0])` — leading digit; rank for numbered kinds, honor
  index 1–7 for z. (Direct char decode, same idiom as `suitOf`'s `kind[1]`; `rankOf`
  is unusable here since it nulls on honors.)
- Numbered (`suit !== 'z'`): `` `${(n % 9) + 1}${suit}` `` — 9 wraps to 1.
- Winds (`n <= 4`): `` `${(n % 4) + 1}z` `` — 4z wraps to 1z.
- Dragons (else, 5–7): `` `${((n - 4) % 3) + 5}z` `` — 7z wraps to 5z.
- Return type: the template strings need one `as TileKind` cast per arm (TS can't
  narrow `Number(string)` back into the Rank union) — same accepted-cast pattern as
  tiles.ts's `buildKinds()` and `suitOf`.

Import discipline: **only `./tiles`**, and only `suitOf` + the `TileKind` type. No
TILE_KINDS scan, no Map state — the module is stateless and allocation-free per call
except the returned string.

## 3. `src/core/index.ts` — barrel

```ts
export * from './tiles'
export * from './rng'
export * from './wall'
export * from './dora'   // ← added, keeping build-order-ish grouping (domain → infra → rules)
```

Placement at the end; no re-export collisions possible (`doraKindOf` is a fresh name).

## 4. `src/core/dora.test.ts` — test shape

Imports: `{ describe, expect, it }` from `vitest`; `{ TILE_KINDS, doraKindOf, kindIndexOf, suitOf, type TileKind }`
from `'./index'` (public-surface convention). No fast-check: the domain is exhaustively
enumerable (tiles.test.ts precedent).

One `describe('dora indicator mapping')` with these `it` blocks, in order:

1. **`maps every one of the 34 kinds to a valid kind (total)`** — AC clause 1.
   Loop `TILE_KINDS`; assert output is in a `Set(TILE_KINDS)`.
2. **`pins the wraparound cases from the AC`** — AC clause 2.
   Five literal assertions: `doraKindOf('9m') === '1m'`, `'9p'→'1p'`, `'9s'→'1s'`,
   `'4z'→'1z'`, `'7z'→'5z'`.
3. **`matches the hand-written full table (second independent spelling)`** —
   a 34-entry literal `Record<TileKind, TileKind>` (with `satisfies` so the type system
   itself proves the table total on both sides), derived from the rule text, not from
   the implementation; loop and compare. Comment marks it as the independent spelling —
   never regenerate from code output.
4. **`is a permutation of the 34 kinds (bijective)`** —
   `new Set(TILE_KINDS.map(doraKindOf)).size === 34`.
5. **`stays within the indicator's cycle group and never fixes a point`** —
   per kind: same suit for m/p/s; wind indicators (kindIndexOf 27–30) land in 27–30,
   dragons (31–33) land in 31–33; `doraKindOf(k) !== k`.
6. **`advances rank by exactly one below the wrap (successor rule)`** —
   for suits m/p/s and ranks 1–8: `` doraKindOf(`${r}${suit}`) === `${r+1}${suit}` ``.

Blocks 2 and 3 are the two AC-critical spellings; 4–6 are structural nets that catch
whole bug classes (merged cycles, wrong cycle direction, off-by-one) with ~10 lines.

## 5. Boundaries and contracts

- **Public contract added:** `doraKindOf(indicator: TileKind): TileKind` via the barrel.
  Consumers: T-002-01-02/-04 (flip indicator → show mapped dora), later scoring (dora
  han), teaching UI. All call through `src/core/index.ts`.
- **Not part of the contract:** the arithmetic encoding, the `Number(kind[0])` decode.
- **Layering:** `dora.ts` sits beside `wall.ts` as a leaf over `tiles.ts`. Nothing in
  core imports `dora.ts` yet; first internal consumer arrives with T-002-01-04's fold.

## 6. Ordering of changes

Small enough for a single commit, but the working order that keeps every intermediate
state green is:

1. `dora.ts` (new file — nothing references it; suite still green).
2. `index.ts` barrel line (exports it; suite still green).
3. `dora.test.ts` (tests go from nonexistent to passing in one step).
4. Full gate: `just test` (6 suites incl. purity) + `just check` (svelte-check + tsc).

One commit at the end is consistent with sibling-ticket practice (subject:
`T-002-01-01: <what>` — matches recent history like `T-001-03-02: …`).
