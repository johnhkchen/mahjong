# T-002-01-01 — Research: dora indicator → dora kind mapping

Descriptive map of what exists today that this ticket touches. No solutions here.

## 1. The ticket in one line

A pure, total function from a flipped dora *indicator* tile kind to the tile kind it
makes *dora* — the first piece of riichi rules knowledge in `src/core/`, needed by the
learner-facing UI ("this indicator means 3p is dora") and by han counting later.

## 2. The rule being encoded (domain fact, for reference)

In riichi mahjong the dora is the tile *after* the indicator, within the indicator's own
group, with wraparound:

- **Numbered suits (m/p/s):** rank n → rank n+1 in the same suit; 9 wraps to 1
  (9m→1m, 9p→1p, 9s→1s).
- **Winds (1z–4z = East, South, West, North):** E→S→W→N→E, so 4z wraps to 1z.
- **Dragons (5z–7z = haku, hatsu, chun):** haku→hatsu→chun→haku, so 7z wraps to 5z.

Winds and dragons are *separate cycles* — 4z never maps to 5z. The mapping is a
permutation of the 34 kinds: total, and a bijection (every kind is the dora of exactly
one indicator). It operates on *kinds*, not physical tiles — red fives / aka dora do not
exist in this codebase (no red-five concept anywhere in `tiles.ts`) and are out of scope.

## 3. What exists in `src/core/` today

Four runtime modules plus tests; the barrel `index.ts` re-exports everything
(`export * from './tiles' | './rng' | './wall'`) and is the only import surface app code
may use.

### `tiles.ts` — the tile domain (src/core/tiles.ts)

Deliberately **import-free** ("This file must stay import-free — it is the foundation of
the pure engine", line 2). Provides everything this ticket consumes:

- Types: `NumberedSuit ('m'|'p'|'s')`, `Suit`, `Rank (1–9)`, `NumberedKind`
  (`` `${Rank}${NumberedSuit}` ``), `HonorKind` (`` `${1..7}z` ``), `TileKind` — all
  template-literal string types, e.g. `'9m'`, `'4z'`.
- `TILE_KINDS: readonly TileKind[]` — the frozen canonical 34-kind array in mpsz order
  (1m…9m, 1p…9p, 1s…9s, 1z…7z); position in it is the canonical kind index.
- `kindIndexOf(kind)`, `suitOf(kind)`, `rankOf(kind)` (`Rank | null` — null for honors),
  `isHonor` / `isTerminal` / `isSimple` classifiers.
- Constants `KIND_COUNT = 34`, `COPIES_PER_KIND = 4`, `TILE_COUNT = 136`.

Honor semantics are documented in the type comment: "1z-4z = East, South, West, North
winds; 5z-7z = haku, hatsu, chun dragons" — exactly the two cycle groups this ticket
needs. There is however **no exported predicate distinguishing winds from dragons** and
no exported honor-rank accessor (`rankOf` returns `null` for the whole z suit; the honor
digit is only reachable via `kind[0]` or `kindIndexOf(kind) - 27`).

### `rng.ts` / `wall.ts` — not touched

`wall.ts` builds the seeded 136-tile permutation and explicitly defers dora positions:
"deal order, dead wall, and dora indicators are positions WITHIN this sequence, owned by
later tickets" (wall.ts:2–3). *Which physical tile is the indicator* is sibling ticket
T-002-01-02 (wall-partition-and-dead-wall); this ticket only owns the kind→kind mapping.

### `index.ts` — the barrel

Three `export *` lines. Adding a module means adding one line here; tests import from
`./index`, not the leaf module (see every existing `*.test.ts`).

### `purity.test.ts` — the import gate

An executable invariant: every runtime module in core may import **only same-directory
siblings** (`./x`); test files may additionally import `vitest`, `fast-check`, `node:*`.
It also asserts the scan sees the real directory by listing known files (index, tiles,
rng, wall) — a *new* core file is scanned automatically via `import.meta.glob('./*.ts')`
but is not itself named in the guard list. Note the fail-loud quirk: the specifier regex
scans raw source including comments, so a comment containing `from 'svelte'`-shaped text
would fail the gate.

## 4. Test conventions in force

- **Runner:** vitest 4.1.9 via `just test` → `flox activate -- npm run test`; includes
  `src/**/*.test.ts`, node environment (vite.config.ts). fast-check 4.8.0 is the
  property-testing library, already used in `wall.test.ts` and `rng.test.ts`.
- **Style observed in `tiles.test.ts`:** exhaustive loops over `TILE_KINDS` / all 136
  ids (the domain is small enough to enumerate — "property test" here often means
  *exhaustive* assertion over the whole domain rather than sampled fc.assert), plus a
  second independent spelling of ground truth (the canonical order is pinned as a
  34-element literal array). `wall.test.ts` uses fc.assert over random seeds and pins a
  frozen regression vector.
- Tests import from `'./index'` to exercise the public surface, and one tiles test
  verifies frozen-ness/freshness of exported values.

## 5. Ticket's acceptance criteria, decomposed against reality

AC: "A vitest property test asserts the mapping is total over all 34 TILE_KINDS and pins
the wraparound cases (9m→1m, 9p→1p, 9s→1s, 4z→1z winds, 7z→5z dragons); exported from
src/core/index.ts; `just test` green."

- *Total over all 34 kinds* — `TILE_KINDS` is the enumeration to loop over; "total"
  means every kind produces a valid `TileKind` (membership in `TILE_KINDS` is checkable
  via `kindIndexOf` or a Set).
- *Pinned wraparounds* — five concrete cases named in the AC.
- *Exported from src/core/index.ts* — implies a new (or extended) core module wired into
  the barrel; the purity gate will automatically police its imports.
- *`just test` green* — the whole suite including the purity gate and existing 5 test
  files must still pass.

## 6. Consumers on the horizon (why the shape matters)

- **T-002-01-02** flips the initial indicator from the dead wall — it produces a
  `TileKind` (via `kindOf(id)`) that feeds this mapping.
- **T-002-01-04** folds a record into table state including "dora indicator + mapped
  dora" — it will call this function by name from the barrel.
- Later scoring (han counting: count copies of the dora kind in a winning hand) and the
  teaching UI (legible "indicator X ⇒ dora Y") are pure callers.
- Kan flips additional indicators later; each new indicator goes through the *same*
  kind→kind mapping, so a single-kind signature suffices — no list/state involved.

## 7. Constraints and assumptions surfaced

1. **Purity:** the new code may import only `./tiles` (same-directory sibling); zero
   platform/deps. Enforced mechanically by purity.test.ts.
2. **`tiles.ts` must stay import-free** — its header pins that; whether dora logic may
   live *inside* tiles.ts (no new imports needed) vs. a new sibling module is a Design
   question, but the architecture note "ruleset: Riichi … isolated behind the engine …
   so the ruleset choice stays redirectable" suggests rules knowledge is a distinguishable
   layer from the tile domain.
3. **Kind-level, not tile-level:** the AC speaks only of TILE_KINDS; physical indicator
   tiles (TileId) are decoded to kinds by `kindOf` upstream.
4. **Determinism/no state:** it's a pure lookup; nothing to seed.
5. **No red fives / no ura-dora special-casing needed:** ura-dora indicators use the
   identical mapping; aka dora don't exist in this tile domain.
6. **Naming precedent:** existing accessors are `xxxOf(kind)` (`suitOf`, `rankOf`,
   `kindOf`, `kindIndexOf`) — a strong local naming convention.
