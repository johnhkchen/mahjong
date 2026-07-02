# T-002-01-04 — Review: hand-record fold entrypoint

Self-assessment and handoff. The keystone invariant — "a hand is its record" — is now
running, tested code with a public entrypoint.

## What changed

One code commit, f3681e1 (`T-002-01-04: hand record type + fold entrypoint (foldRecord)
as core's public contract`):

| File | Change | Summary |
| --- | --- | --- |
| `src/core/record.ts` | created (~95 lines) | `HandAction = never` (the empty action vocabulary — the named extension point later tickets widen); `HandRecord { seed, actions }` (the irreducible pair, per architecture.md §1); `TableState` (seat-indexed hands in draw order, post-deal live wall, dead wall, dora indicator + mapped dora kind), documented as a **derived view, not a frozen contract**; `foldRecord(record) → TableState`, composing the frozen buildWall → partitionWall → dealHands chain plus `doraKindOf(kindOf(indicator))`, with a loud `RangeError` on any non-empty action log. |
| `src/core/record.test.ts` | created (~120 lines) | Five fast-check properties, one guard test, one golden (details below). |
| `src/core/index.ts` | modified (+1 line) | `export * from './record'` — the fold and record types are public through the barrel (AC d). |

No other files touched: wall/deal/dora/tiles/rng remain frozen; no app code; ticket
frontmatter left to lisa. Artifacts (this directory) committed separately.

## Acceptance criteria — status

- **(a) Empty-log fold yields the table state** (live/dead wall, dora indicator +
  mapped dora, four hands, seats) — ✅ property test 1 deep-equals the fold against the
  explicit composition for all seeds; seats are the `Seat`-indexed hand tuple
  (T-002-01-03's decision, reused rather than duplicated).
- **(b) "same seed → identical deal"** — ✅ property test named verbatim, folding two
  independently built records per seed.
- **(c) "same record → same folded state (deep-equal across repeated folds)"** — ✅
  property test named verbatim, plus fresh-array (`not.toBe`) checks on hands/live/dead.
- **(d) Fold and record types exported from `src/core/index.ts`** — ✅ barrel line;
  every test import resolves through `./index`, and `just check` guards `export *`
  collisions.

`just test`: 8 files, 51 tests, all passing (44 before this ticket). `just check`:
0 errors, 0 warnings.

## Test coverage

- **Properties (∀ seed, fast-check)**: fold = explicit composition (the integration
  test of all four underlying modules); same-seed deal identity; same-record fold
  identity with fresh arrays; record purity (input not mutated); 136-distinct-tile
  conservation end-to-end through the public entrypoint.
- **Guard**: a non-empty action log (cast past `never`, the one deliberate cast in the
  file, commented) throws `RangeError` — an uninterpretable action can never fold
  silently into a wrong state.
- **Golden (seed 1)**: hands, remaining-live prefix, dead wall, and indicator reuse the
  already-frozen deal/wall goldens verbatim; the mapped dora `'8m'` was hand-derived
  from the frozen contracts before being cross-checked by a scratchpad fold run (all
  seven checks agreed). Perturb-restore performed: the golden demonstrably binds.
- **Static gates**: `purity.test.ts` auto-globbed both new files (siblings-only
  imports pass); tsc strict + svelte-check clean.

Coverage gaps, considered and accepted: no test that `TableState.dora` stays correct
for indicators in other cycles (wind/dragon wrap) — that is dora.test.ts's exhaustive
job (T-002-01-01); the fold test only needs to prove the mapping is *wired*, which the
composition property does for every seed. No round-trip (serialize/parse) tests — no
notation exists yet.

## Design decisions a reviewer should weigh

1. **`HandAction = never`** — the type system states the engine's current capability
   (only empty logs are representable) instead of stubbing an action encoding this
   ticket has no mandate to freeze. The tradeoff: the first draw/discard ticket must
   edit this line (widening, non-breaking) and replace the fold's guard with a real
   step function. Alternative rejected in design.md §2.
2. **`TableState` is explicitly non-frozen** — only the record + derivation
   conventions are the replay format; the state shape will grow (discards, melds,
   turn). The doc comment says so, to prevent future shape changes being mistaken for
   contract breaks.
3. **Singular dora fields** (`doraIndicator`, `dora`) — mirrors `partitionWall`
   exposing only the initial indicator; kan-flip plurality is deliberately left to the
   kan tickets, which will need to widen these fields (a knowing, documented deferral).
4. **The deal is not an action** — folding `[]` still deals, because the seed encodes
   the deal (T-002-01-03). This is load-bearing for every future consumer: the initial
   state of any replay is the dealt table, never an "deal action" in the log.

## Open concerns / TODOs (none blocking)

- The **log-parser boundary** (validating external seeds/ids/actions) is still
  hypothetical — three modules now reference it as "future". When the notation ticket
  lands, it should sweep these references and make them concrete.
- `foldRecord`'s guard message reports only the action *count*; once actions exist the
  replacement step function should identify the offending action. Noted in the doc
  comment ("action tickets replace it").
- T-002-02-01 (render-dealt-hand) can now proceed: it reads
  `foldRecord({seed, actions: []}).hands[0]` through the barrel.

## Critical issues for human attention

None. The public surface grew by exactly two types, one interface, and one function;
all four prior modules are untouched; every stored-seed-affecting convention was
composed, not created — the golden proves the composition introduces no reshuffling.
