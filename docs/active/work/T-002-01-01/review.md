# T-002-01-01 — Review: dora indicator → dora kind mapping

Handoff self-assessment. Ticket AC fully met; suite and typecheck green; one commit.

## What changed

| File | Change | Size |
| --- | --- | --- |
| `src/core/dora.ts` | created | 17 lines — module comment + one function |
| `src/core/dora.test.ts` | created | ~80 lines — 6 test blocks |
| `src/core/index.ts` | modified | +1 barrel line (`export * from './dora'`) |
| `docs/active/work/T-002-01-01/*` | created | 6 RDSPI artifacts |

Nothing deleted; no other source touched. Public surface grew by exactly one symbol:
`doraKindOf(indicator: TileKind): TileKind`.

## The change in one paragraph

`doraKindOf` encodes the riichi dora rule — the dora is the *next* tile in the
indicator's own cycle: suit ranks wrap 9→1, winds cycle E→S→W→N→E (so 4z→1z), dragons
cycle haku→hatsu→chun→haku (so 7z→5z), winds and dragons being separate cycles. It is a
pure kind→kind function living in a new rules-knowledge module `src/core/dora.ts`
(placed beside `wall.ts`, importing only `./tiles`), keeping the ruleset layer separate
from the tile domain per architecture.md. Physical indicator *tiles* are decoded to
kinds upstream (T-002-01-02's territory); ura-dora indicators use this same mapping.

## Acceptance criteria → evidence

- **Totality over all 34 TILE_KINDS (property test):** `dora.test.ts` block 1 loops
  `TILE_KINDS` asserting Set membership of every output; block 3 (full-table) and
  block 4 (bijectivity) independently subsume it. The domain is a closed 34-value
  union, so the tests enumerate it exhaustively rather than sampling (tiles.test.ts
  precedent; fast-check adds nothing over a closed enumeration).
- **Pinned wraparounds:** block 2 pins 9m→1m, 9p→1p, 9s→1s, 4z→1z, 7z→5z as literal
  assertions.
- **Exported from src/core/index.ts:** barrel line added; the test file imports
  `doraKindOf` from `'./index'`, so the export path itself is under test.
- **`just test` green:** 6 test files, 32 tests, all passing (was 5/25 before). The
  purity gate covers the two new files automatically and passes.
- Additionally `just check` (svelte-check + tsc): 0 errors, 0 warnings.

## Test coverage assessment

Coverage of the new function is exhaustive — all 34 inputs are asserted against a
hand-written expected table, in two independent spellings (arithmetic in source,
literal table in test transcribed from the rule statement, per design.md §5). On top of
the point-for-point table: bijectivity, cycle-group closure (the classic 4z→5z bug
class), no-fixpoints, and the rank-successor rule. The literal table's key/value
totality is also compile-time-checked via `satisfies Record<TileKind, TileKind>`.

**Gaps:** none within scope. Out-of-domain inputs (arbitrary strings cast to TileKind)
are untested by design — core's stated boundary policy (tiles.ts header) is that
external data is validated at the log-parser boundary, not per function.

## Open concerns / notes for the reviewer

1. **Rule correctness is the one thing worth eyeballing** (design.md §6): the encoded
   cycles are standard riichi (EMA/WRC-consistent) — indicator→next, winds ESWN
   cyclic, dragons haku→hatsu→chun cyclic. The five AC pins plus the hand-written
   table are the defense; a reviewer confirming the table matches their rule knowledge
   is the highest-value 30 seconds on this diff.
2. **`Number(indicator[0])` decode:** dora.ts reads the leading digit directly rather
   than via `rankOf` (which returns null for honors). Same idiom as `suitOf`'s
   `kind[1]`. If a third site ever needs the honor digit, promoting an accessor into
   tiles.ts would be the cleaner move — deliberately not done now (YAGNI; design.md §4).
3. **No red fives / aka dora:** the tile domain has no red-five concept; the mapping is
   kind-level and unaffected. If aka dora ever enter scope they are a *counting*
   concern, not a mapping concern.
4. **Deferred by design:** indicator position in the dead wall (T-002-01-02), dora
   *counting* toward han (scoring epic), wind/dragon predicates in tiles.ts (promote
   when yakuhai needs them).
5. **Pre-existing working-tree noise:** `docs/active/tickets/T-002-01-01.md` and
   `T-002-01-02.md` were already modified before this session; left unstaged and
   untouched (Lisa owns ticket frontmatter).

## Known limitations

None functional. The module is stateless, allocation-light, deterministic, and
dependency-free beyond `./tiles`; nothing in core consumes it yet — first integration
lands with T-002-01-04's fold (and T-002-01-02's indicator flip), each carrying its own
AC.

## TODOs

None left in code or docs.
