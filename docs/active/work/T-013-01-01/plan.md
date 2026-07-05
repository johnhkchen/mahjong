# Plan — T-013-01-01: game-record-text-notation

## Step 1 — `src/core/notation.ts`: codecs + header

Write `NOTATION_VERSION`, `encodeTile`/`decodeTile`, `decodeSeat`, `parseHeader`, and a
`serializeGameRecord` that only handles the header line for now (stub hand lines as
empty). Verification: a scratch call (or a throwaway test, folded into Step 3's file
once it exists) that `parseHeader` inverts a hand-written header string for a few sample
seeds (`0`, `1`, `0xffffffff`).

## Step 2 — `src/core/notation.ts`: action codec + full serialize/parse

Add `encodeAction`, `TOKEN_SPECS`, `decodeToken`, then complete `serializeGameRecord`
and `parseGameRecord` per structure.md. Verification: deferred to Step 3's per-variant
unit tests (writing throwaway code twice is waste — the real test file is the
verification here).

## Step 3 — `src/core/notation.test.ts`: direct unit coverage

- One round-trip test per `HandAction` variant (10 cases) via a single-hand
  `GameRecord`: build a literal action, `serializeGameRecord({seed, hands:
  [[action]]})`, `parseGameRecord(...)`, assert the decoded action deep-equals the
  original. Pick tile ids that exercise the encoding edges: `0`, `135`, and one
  mid-range value (e.g. `61`) across the cases, not always `0`.
- Charset test: assert output matches `/^[\x20-\x7e\n]*$/`.
- Versioning test: `NOTATION_VERSION` round-trips; a hand-built `v2 ...` header throws
  naming the unsupported version.
- Empty-hand round-trip: a `GameRecord` whose only hand has zero actions (the fresh-deal
  active-hand case) serializes to a header plus one empty line and parses back to
  `hands: [[]]`.
- Multi-hand round-trip: a hand-built 2-hand record (small, fixed, not generated)
  serializes/parses with the right line count and hand boundaries.

Run: `just test` (or `flox activate -- npx vitest run src/core/notation.test.ts`) after
this step — must be green before continuing.

## Step 4 — `src/core/notation.test.ts`: malformed-input coverage

One `it` per failure mode from design.md Decision 6, each constructing a bad string by
hand and asserting the thrown `RangeError`'s message contains `"line"` and
`"position"`, and the correct line number:

1. Empty document (`''`).
2. Header with no seed (`'v1'`).
3. Header with unsupported version (`'v2 5'`).
4. Header with non-base36 seed char (`'v1 5g!'` or similar containing an invalid
   character — actually base-36 includes `g`; use a genuinely invalid char like `'v1
   5_'`).
5. Header seed decoding out of `uint32` range (base-36 string large enough that
   `parseInt` exceeds `0xffffffff`).
6. Unknown type letter in a hand line (e.g. `'Z0'`).
7. Wrong-length token for a known type (e.g. `'K0'` — discard missing its tile field).
8. Malformed seat digit (`'D4'`, `'D_'`... something outside `0-3`).
9. Malformed tile chars (non-`[0-9a-z]`, e.g. `'K0G!'`).
10. Tile value decoding in-range-chars but out-of-domain (base-36 `'3g'` = 136, one past
    the max `135`).
11. A hand line with a doubled space (stray empty token).

Run tests again — green before continuing.

## Step 5 — `src/core/notation.test.ts`: the property test (the AC's core claim)

- Add local `playHand(seed, context)` restating `selfplay.test.ts`'s consult loop,
  parameterized by `RiichiContext`.
- Add `playGame(gameSeed, handCount)` chaining `playHand` via `foldGame`-derived context
  (structure.md §"notation.test.ts" step 2).
- Add the `fc.assert` property: `fc.integer({min:0,max:0xffffffff})` seed ×
  `fc.integer({min:1,max:4})` handCount, `numRuns: 25`, explicit `timeout: 60_000`.
  Assert `foldGame(parseGameRecord(serializeGameRecord(record)))` `toEqual`
  `foldGame(record)`.
- Add 2-3 fixed-seed anchor tests (not property-random) for fast, deterministic CI
  failure messages if this ever regresses — reusing the `selfplay.test.ts` mined seeds
  (25, 9) wrapped as single-hand games, plus one genuinely multi-hand fixed case (e.g.
  gameSeed `7`, handCount `3`).

Run `just test` — must be green. This is the AC's central claim; do not proceed to Step
6 until this passes reliably (run twice to catch any property flakiness from timing/
performance, not correctness — the underlying self-play loop is already proven
deterministic by `selfplay.test.ts`, so flakiness here would indicate a bug in the new
`playHand`/`playGame` harness, not the notation module).

## Step 6 — barrel export

Add `export * from './notation'` to `src/core/index.ts`. Add a barrel-import smoke
check to the test file if not already covered by Step 3-5's imports (they already import
`serializeGameRecord`/`parseGameRecord` — confirm at least one of those imports comes
via `./index`, not `./notation` directly, to actually exercise the barrel path).

## Step 7 — full verification pass

- `just test` (or `flox activate -- npx vitest run`) — full core suite green, including
  `purity.test.ts` (no import violations from the new files).
- `just check` (`svelte-check` + `tsc`) — clean.
- Re-read `notation.ts` once start-to-finish for the module-header doc-comment quality
  bar this codebase holds every core file to (research.md's "testing conventions
  observed").

## Step 8 — commit

One commit: `notation.ts` + `notation.test.ts` + the one-line `index.ts` barrel edit.
Commit message states the AC in one line (fast-check round-trip + malformed-input
guarantee + barrel export), no need to split further — this is one cohesive module with
no intermediate state worth freezing separately.

## Testing strategy summary

- **Unit**: per-`HandAction`-variant round trip (Step 3), malformed-input line/position
  naming (Step 4), header/version behavior (Step 3/4), charset (Step 3).
- **Property**: `fast-check` over the full `uint32` seed domain × 1-4 hands, verifying
  `parse(serialize(r))` folds (`foldGame`) deep-equal to `foldGame(r)` — the AC's literal
  words (Step 5).
- **Regression anchor**: fixed-seed deterministic cases for fast CI signal (Step 5).
- **Static**: `purity.test.ts` (automatic), `just check` (tsc/svelte-check).
- No integration/app-level test — this ticket is `src/core/` only; app wiring is a
  separate future ticket (per design.md's explicit out-of-scope section).
