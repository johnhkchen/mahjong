# T-001-02-01 tile-types-and-identities — Review

## What changed

One code commit, `61a30f2` — 4 files, +205/−11 — plus this docs-only artifacts commit.

| File | Change | What it is |
| --- | --- | --- |
| `src/core/tiles.ts` | created (~100 lines) | The whole tile domain: mpsz string-literal `TileKind` (34 members via template-literal types), integer `TileId` 0–135 (`kindIndex × 4 + copy`), frozen canonical `TILE_KINDS`, encoding accessors (`tileId`/`kindOf`/`copyOf`/`kindIndexOf`/`allTileIds`), suit/rank accessors, honor/terminal/simple predicates. **Zero import statements.** |
| `src/core/tiles.test.ts` | created (~105 lines) | 8 tests, exhaustive over the total domain (all 34 kinds × 4 copies × both encoding directions). Imports through `'./index'` so the barrel stays under test. |
| `src/core/index.ts` | rewritten | Placeholder `ENGINE_NAME` → pure barrel (`export * from './tiles'`) with the purity-invariant header comment. |
| `src/core/index.test.ts` | deleted | Scaffold smoke test, explicitly superseded per T-001-01-02's own review ("until the first real test exists"). Its wiring-proof role moved into `tiles.test.ts`'s barrel import. |

No config, dependency, justfile, or `src/app/` changes. Nothing app-side imports core yet —
that boundary belongs to T-001-03-01 by design.

## Decisions a reviewer should look at (rationale in design.md)

1. **mpsz strings as the kind type** (`'1m'…'9m'`, `'1p'…'9p'`, `'1s'…'9s'`, `'1z'…'7z'`
   with honors E,S,W,N,haku,hatsu,chun). This has *contract gravity*: these names will appear
   in the action-log notation, the system's public contract. Chosen because architecture.md
   models the log on Tenhou-style logs and mpsz is that ecosystem's notation — kind
   serialization becomes the identity function. **This is the decision to veto now or never**;
   everything else in the ticket is engine-internal and cheap to change.
2. **`TileId` = plain integer 0–135**, 4 consecutive ids per kind in canonical order. Walls
   serialize as number arrays; `copy 0` is a natural future akadora hook. A branded type was
   considered and rejected (cast friction > bug-class value at this domain size) — revisit if
   an id/index confusion bug ever actually appears.
3. **No runtime validation in `kindOf`/`copyOf`** — types guard construction; the future
   action-log *parser* owns boundary validation of untrusted ids. Documented in the source.
4. **Predicates included** (honor/terminal/simple): they're definitions about tiles, one line
   each, and yaku tickets consume them; display names and art hooks deliberately excluded
   (view-layer, P4).

## Test coverage

8/8 passing; `just check` 0 errors / 0 warnings; `just build` still emits the single file
(23.44 kB, core correctly tree-shaken since app doesn't import it yet).

- **Exhaustive, not sampled:** id↔kind↔copy round-trips over all 136 ids and all 34×4
  pairs; exactly-4-copies-per-kind; kind↔index bridge for all 34; rank-null-iff-honor sweep.
  With a 136-value total domain, exhaustive enumeration strictly dominates property testing —
  fast-check arrives with T-001-02-02 per that ticket's AC, and these invariants become free
  fodder for its wall properties.
- **Order pinned literally:** the canonical 34-element sequence is spelled out in the test as
  a second, independent encoding of mpsz order — a haku/hatsu transposition (the classic
  silent-corruption bug for future dora logic) cannot pass.
- **Partition asserted:** honor(7) ∪ terminal(6) ∪ simple(21) covers all 34 kinds pairwise
  disjointly, with exact member lists for the small classes.
- **Immutability:** `TILE_KINDS` frozen; `allTileIds()` fresh per call (T-001-02-02 will
  shuffle it in place).

### Coverage gaps (known, accepted)

- **Type-level facts aren't runtime-tested** — that `TileKind` has exactly 34 *type* members
  is enforced by the compiler when the literal test array typechecks, not by a runtime
  assertion; fine, but it lives in `just check`, not `just test`.
- **The purity grep is manual** (recorded in progress.md, repeatable one-liner) — not wired
  into CI/justfile. Deliberate: `just check`'s contract shouldn't grow as a ticket side
  effect. If it should be automated, that's a small deliberate follow-up when CI lands
  (T-001-03-02 territory).
- **No negative-input tests** for out-of-range ids — consistent with decision 3 above.

## Acceptance criteria — all met

- [x] Vitest test enumerates exactly 34 kinds and 136 distinct tile ids (and more: exact
  order, 4-per-kind, round-trips).
- [x] `just check` clean (133 files, 0 errors, 0 warnings).
- [x] No DOM/Svelte imports in `src/core/`, grep-verified — the complete import inventory of
  the directory is `./tiles`, `vitest`, `./index`.

## Open concerns for a human

1. **The mpsz naming decision (above) is the one irreversible-ish choice** — it will
   propagate into the action-log notation next tickets. If the owner prefers a different log
   vocabulary (e.g., `E/S/W/N/P/F/C` honor letters), now is the moment; the change is one
   file + one test today, but a rename across the log contract later.
2. **`grep -i "dom"` caveat:** the sharpened purity grep matches import *statements* then
   filters for `svelte|dom`; a hypothetical future package with "dom" in its name (e.g.
   `random`) would false-positive, and DOM *globals* used without imports (`document.…`)
   are caught by the broader content grep, which false-positives on the invariant comment.
   Neither matters today (core has zero imports and no globals); whoever automates the gate
   should combine both greps with the comment line excluded.
3. **Deviations from plan were cosmetic** (private `ReadonlyMap` vs `Record`; grep command
   sharpened after a prose false-positive) — both documented in progress.md.
4. No TODOs, no known defects. **T-001-02-02 is unblocked**: it needs `allTileIds()` (fresh
   shuffleable 136-array), `TILE_KINDS`/`kindOf` (4-of-each-kind property), and the frozen
   canonical order — all shipped and tested here.
