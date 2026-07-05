# Structure — T-013-01-01: game-record-text-notation

## Files created

### `src/core/notation.ts` (new)

The whole module. Imports only same-directory siblings, per the purity gate:
- `type { GameRecord }` from `./game`
- `type { HandAction }` from `./record`
- `type { TileId }` from `./tiles`
- `type { Seat }` from `./deal`

Exports:

```ts
export const NOTATION_VERSION = 1

export function serializeGameRecord(record: GameRecord): string
export function parseGameRecord(text: string): GameRecord
```

Internal (not exported) organization, top to bottom:

1. Module header doc-comment — freezes the grammar (the type-letter table, tile/seed
   encoding, versioning) the way `record.ts`'s `HandAction` doc-comment freezes its own
   conventions. This IS "document it in the module header," per the ticket text.
2. `encodeTile(id: TileId): string` / a paired regex + `decodeTile(text, line, col):
   TileId` — the base-36, fixed-2-width tile codec, with the range guard (`[0, 135]`)
   living in `decodeTile` (the log-parser boundary `tiles.ts` defers to) and a defensive
   mirror guard in `encodeTile` (never emit a token that can't parse back).
3. `decodeSeat(ch, line, col): Seat` — single-digit `0-3` guard.
4. `encodeAction(action: HandAction): string` — one `switch` over `action.type`, one arm
   per the ten variants, each a template string of `TYPE + seat + tile fields`, in the
   Design's field-order convention. `default` arm is an exhaustiveness guard (`const
   _exhaustive: never = action`) mirroring `record.ts`'s `applyAction` default-arm style.
5. A `TOKEN_SPECS` lookup: `Record<string /* type letter */, { length: number; build:
   (token, line, col) => HandAction }>` — one entry per type letter, each `build` slicing
   fixed offsets out of `token` and calling `decodeSeat`/`decodeTile`. This is
   `encodeAction`'s inverse, table-shaped instead of switch-shaped because decode also
   needs a length check per type before slicing.
6. `decodeToken(token, line, col): HandAction` — looks up `TOKEN_SPECS[token[0]]`,
   guards empty token / unknown type letter / wrong length, then delegates to `build`.
7. `parseHeader(line: string): { seed: number }` — regex `^v([0-9]+) ([0-9a-z]+)$`,
   version-mismatch guard, seed range guard.
8. `serializeGameRecord(record)` — header line + one `actions.map(encodeAction).join('
   ')` per hand, all joined by `'\n'` (Structure mirrors Design Decision 2 exactly; no
   trailing newline).
9. `parseGameRecord(text)` — `text.split('\n')`, header from line 0, then one hand per
   remaining line (empty line ⇒ `[]`, else `line.split(' ')` tokens fed through
   `decodeToken` with a running column counter), collecting `{ seed, hands }`.

No new types are exported beyond `NOTATION_VERSION`/the two functions — `GameRecord`
already exists and is what round-trips; this module adds no new public data shape.

### `src/core/notation.test.ts` (new)

Same-directory test file, importing `HandAction`, `RiichiContext` (type-only) plus
runtime `foldRecord`, `foldGame`, `handSeedOf`, `legalActions`, `callPolicy`,
`discardPolicy`, `seatView`, `LIVE_WALL_SIZE`, `DEAL_SIZE`, `SEAT_COUNT`, `type Seat`
from `./index` (the barrel — consistent with `selfplay.test.ts`'s own import style), and
`serializeGameRecord`, `parseGameRecord`, `NOTATION_VERSION` from `./notation` directly
(so the "exported from the barrel" AC gets its own explicit check via a second import
from `./index`).

Sections, top to bottom:

1. Local `ACTION_BOUND` restatement (copied constant expression from
   `selfplay.test.ts`) and a local `playHand(seed, context)` — the Design Decision 8
   per-hand driver, restating `selfPlay`'s loop body but parameterized by
   `RiichiContext` instead of assuming a fresh game.
2. `playGame(gameSeed, handCount)` — chains `playHand` calls, reading each next hand's
   context off `foldGame({ seed, hands: [...hands, []] }).table.{scoresIn,pot}` (Design
   Decision 8).
3. `describe('encode/decode round trip per action type')` — one direct unit test per
   `HandAction` variant: construct a literal action, `encodeAction`... (not exported —
   instead exercised indirectly via `serializeGameRecord`/`parseGameRecord` on a
   single-hand, single-action `GameRecord`) — assert the parsed action deep-equals the
   original.
4. `describe('property: arbitrary legally-played GameRecords round-trip')` — the AC's
   core test: `fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),
   fc.integer({min:1,max:4}), (seed, handCount) => { ... }))`, building via `playGame`,
   asserting `foldGame(parseGameRecord(serializeGameRecord(record)))` deep-equals
   (`toEqual`) `foldGame(record)`. Explicit timeout (60_000ms), matching the sibling
   suite's convention for full-domain property runs.
5. `describe('charset')` — asserts `serializeGameRecord` output matches
   `/^[\x20-\x7e\n]*$/` (single suit of printable ASCII + newline) on a sampled record.
6. `describe('malformed input throws naming line and position')` — one test per failure
   mode enumerated in Design Decision 6, each asserting the thrown message contains
   both `line` and `position` substrings plus the specific bad line number.
7. `describe('versioning')` — round-trips `NOTATION_VERSION` into the header and back;
   asserts an unsupported version string throws naming it.

### `src/core/index.ts` (modified)

One line added to the barrel, alongside the other fourteen: `export * from
'./notation'`. Placed after `./game` (the module it most directly depends on
type-wise), preserving the file's existing dependency-order-ish grouping.

## Files NOT touched

- `src/core/purity.test.ts` — needs no change; it already globs every `./*.ts` file, so
  `notation.ts`/`notation.test.ts` are covered automatically the moment they exist.
- `src/core/record.ts`, `src/core/game.ts`, `src/core/tiles.ts`, `src/core/deal.ts` —
  read-only dependencies; nothing about this ticket changes the action-log contract or
  `TileId`/`Seat` domains, only adds a text view over them.
- `src/app/*` — out of scope (Design: "What's explicitly out of scope").

## Ordering

Single-file module, no sub-steps needed: `notation.ts` has no internal ordering
dependency on anything not already merged (T-012-01-02, this ticket's `depends_on`,
touches `src/app/` only and is already `phase: done` — no actual code dependency exists
between the two tickets; the `depends_on` edge is sequencing, not a code coupling this
module needs to wait on).
