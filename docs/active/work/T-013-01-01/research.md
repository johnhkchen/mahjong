# Research — T-013-01-01: game-record-text-notation

## Ticket restated

Add a `src/core/` module that serializes a `GameRecord` (seed + one action log per hand)
to a compact, versioned, human-readable ASCII text form, and a strict parser back. This
is the text-form of the action-log contract deferred since E-002 (architecture.md §2).
Zero DOM, pure `core/`. Must be exported from the core barrel (`src/core/index.ts`).

## The two record shapes

- `HandRecord` (`src/core/record.ts:114`): `{ seed: number, actions: readonly HandAction[] }`
  — one hand.
- `GameRecord` (`src/core/game.ts:47`): `{ seed: number, hands: readonly (readonly HandAction[])[] }`
  — a whole game. Each hand's seed is NOT stored; it's re-derived via
  `handSeedOf(gameSeed, handIndex)` (`game.ts:105`), a frozen, provably-bijective formula.
  The ticket's "GameRecord round-trips" AC (not HandRecord) means this module works at
  the game level: header carries the ONE game seed; per-hand seeds are never encoded,
  matching the existing "no second authority" discipline record.ts/game.ts already apply.
- The last hand in `GameRecord.hands` may be a `'playing'`-phase prefix, even empty
  (`game.ts:43`) — the active, in-progress hand. The notation must round-trip that too:
  an empty hand's line is legitimately empty.

## `HandAction` — the vocabulary to encode (`record.ts:77-107`)

A frozen, extend-only discriminated union (10 variants today). Every variant carries
`seat: Seat` (0-3). Fields beyond that:

| type         | extra fields                                      |
|--------------|----------------------------------------------------|
| draw         | (none)                                             |
| discard      | `tile: TileId`                                     |
| riichi       | `tile: TileId`                                     |
| chi          | `tile: TileId`, `uses: [TileId, TileId]`           |
| pon          | `tile: TileId`, `uses: [TileId, TileId]`           |
| daiminkan    | `tile: TileId`, `uses: [TileId, TileId, TileId]`   |
| ankan        | `uses: [TileId, TileId, TileId, TileId]` (no tile) |
| shouminkan   | `tile: TileId` (no uses — the pon it upgrades is derivable) |
| tsumo        | (none — the winning tile IS `drawn`, wall-order authority) |
| ron          | `tile: TileId`                                     |

`draw` records no tile deliberately (wall order is the sole authority — record.ts:26-32);
`tsumo` records no tile for the identical reason. Any notation must NOT invent tile
fields for these two, or it creates a second authority that can disagree with the wall.

## `TileId` — the physical-tile domain (`tiles.ts`)

`TileId` is a plain integer `0..135` (`kindIndexOf(kind) * 4 + copy`). "No runtime range
checks here — ids entering from outside the program (action logs) are validated by the
log parser at that boundary" (`tiles.ts:19-20`). **This ticket's parser IS that boundary**
— it must be the place that validates `0 <= id <= 135`.

Likewise `record.ts:117-119`: "Seeds arriving from outside the program are validated at
the future log-parser boundary, per the TileId precedent" — this ticket is also that
boundary for the seed (`[0, 2^32)`, matching `createRng`'s unsigned-shift normalization
in `rng.ts`).

Because the fold keeps exact physical copies distinguishable (a hand/pond/meld array is
`TileId[]`, not `TileKind[]`), the notation must preserve copy identity, not just kind —
losing it could still fold to a state that's kind-correct but not `TileId`-identical
(different copy of the same kind occupying a hand slot), failing a strict deep-equal
round-trip. So each `TileId` must be encoded losslessly, not derived from `kindOf`.

## Existing precedent for terse encodings

- No existing text notation exists yet in the repo (grep for "notation", "serialize" in
  `src/core/` turns up nothing beyond doc-comment prose in `record.ts`/`architecture.md`
  referencing a "Tenhou-style" log as the eventual target, never implemented).
- Tenhou-style mjlog conventions (per architecture.md §2, "modeled on Tenhou-style logs")
  use small integer codes per tile and per action — this ticket is free to invent the
  concrete grammar; nothing in-repo constrains the exact characters, only: versioned,
  ASCII, compact, strict, and it must document the encoding "in the module header" (the
  ticket's own words) the way `record.ts`'s `HandAction` doc-comment freezes its own
  conventions.

## Generators to reuse for the property test

`src/core/selfplay.test.ts` already drives arbitrary **legal** single-hand play:
- `selfPlay(seed)` (`selfplay.test.ts:81-139`): loops `foldRecord`/`legalActions`, uses
  `discardPolicy` at own-turn points and `callPolicy` at claim windows/houtei, arbitrating
  ties by offered order (a restated rule, deliberately — the file's own header calls this
  "the THIRD statement of that rule").
- `fc.integer({ min: 0, max: 0xffffffff })` is the seed arbitrary already used
  (`selfplay.test.ts:256`) to sample the full seed domain.
- There is no existing *multi-hand game* driver — `selfPlay` only plays one hand from a
  bare seed with no `RiichiContext`. To generate arbitrary **GameRecords** (plural hands),
  this ticket's test needs its own driver that chains hands, threading `RiichiContext`
  (`scoresIn`, `potIn`) and the dealer between them. `game.ts`'s `foldGame` already knows
  how to do this threading (dealer rotation on non-dealer win/any ryuukyoku, score deltas
  via `settlementOf`) — calling `foldGame` on the hands accumulated so far, with one
  trailing empty placeholder hand appended, reads off the correct next hand's
  `scoresIn`/`pot`/dealer for free (`GameState.table.scoresIn`, `.table.pot`) without
  reimplementing the rotation math — `foldGame` is designed to tolerate a trailing
  `'playing'`-phase (even empty) hand as the active one (`game.ts:181-189`).

## Barrel export shape (`src/core/index.ts`)

Flat `export * from './x'` per module, no namespacing. A new module needs one line added
there, consistent with all fourteen existing entries.

## Purity gate (`src/core/purity.test.ts`)

Scans every `./*.ts` file in `src/core/` and asserts runtime modules only import
same-directory siblings (`^\./`) — no `../app`, no bare packages. A new module must only
import from `./game`, `./record`, `./tiles`, `./deal` (whichever types/functions it needs)
and nothing external. Test files may additionally import `vitest`/`fast-check`/`node:*`.
This gate needs no changes — it already scans every file in the directory automatically.

## Testing conventions observed

- Files pair `x.ts` + `x.test.ts` in the same directory (no `__tests__/`).
- Doc comments are long-form and explain WHY, referencing the ticket/AC and prior
  decisions; this is a strong, consistent house style across every core file read.
- Error messages are `RangeError`s that name the offending action's index (or, per this
  ticket's own AC, "line and position") — never silent coercion.
- Property tests use `fast-check` (`fc.assert(fc.property(...), { numRuns })`), already a
  devDependency (`fast-check@4.8.0`).
- `just test` runs vitest over `src/core/`; `just check` runs `svelte-check` + `tsc`.

## Open questions carried into Design

1. What are the exact grammar/characters for the per-action tokens (letter-per-type,
   tile encoding radix, field widths, delimiter or fully positional/self-delimiting)?
2. How to encode `TileId` (0-135) compactly and losslessly in ASCII.
3. How to encode the game seed (up to `2^32-1`) compactly.
4. Exact error-message shape for "throws naming line and position."
5. Whether to hand-roll a multi-hand self-play driver in the new test file, or find a
   lighter reuse path — resolved above: drive per-hand play locally (restating
   `selfPlay`'s loop, per the codebase's own restatement convention) but obtain each
   hand's starting context via `foldGame`, not a hand-rolled rotation calculation.
