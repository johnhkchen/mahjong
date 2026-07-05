# Progress — T-013-01-01: game-record-text-notation

## Completed

- **Step 1-2**: `src/core/notation.ts` written in one pass (codecs + header + full
  serialize/parse), rather than the two-step split plan.md proposed — the codec pieces
  are small enough that splitting them into separate commits/verification points added
  no real safety margin once the test file existed to check them together.
- **Step 3**: Direct unit coverage in `src/core/notation.test.ts` — one round-trip test
  per `HandAction` variant (10 cases, tile ids `0`/`135`/mid-range spread across them),
  plus zero-action-hand, multi-hand fixed-record, charset, and versioning tests.
- **Step 4**: Malformed-input coverage — 11 cases (empty document, missing seed,
  unsupported version, invalid seed character, seed decoding out of `uint32` range, no
  hand lines, unknown type letter, wrong token length, malformed seat, malformed tile
  characters, out-of-range tile value, stray doubled space).
- **Step 5**: The AC's core property test — `fc.assert` over
  `fc.integer({min:0,max:0xffffffff})` × `fc.integer({min:1,max:4})` hands, `numRuns:
  25`, `timeout: 60_000`, asserting `foldGame(parseGameRecord(serializeGameRecord(r)))`
  `toEqual` `foldGame(r)`. Backed by a local `playHand`/`playGame` driver restating
  `selfplay.test.ts`'s consult loop, generalized with a `RiichiContext` parameter and
  chained via `foldGame`'s own dealer/score threading (append a trailing empty hand,
  read `table.scoresIn`/`table.pot` back). Plus 3 fixed anchor cases (seeds 25, 9 as
  single-hand games; seed 7 as a 3-hand game) for fast deterministic CI signal.
- **Step 6**: `export * from './notation'` added to `src/core/index.ts`.
- **Step 7**: Full verification — `npx vitest run src/core` (773 tests, 29 files, all
  green, including `purity.test.ts` with no changes needed) and `just check`
  (svelte-check + tsc, 207 files, 0 errors/warnings).

## Deviations from the plan

- Combined plan.md Steps 1 and 2 into a single implementation pass for `notation.ts` —
  no functional difference, just fewer intermediate checkpoints since the module is one
  cohesive ~300-line file with no natural stopping point that wasn't itself "finish the
  parser."
- Caught and fixed two base-36 arithmetic errors while writing the malformed-input
  tests: the module header comment and design.md both originally said `135` encodes as
  `'3f'` — it's actually `'3r'` (`3*36 + 27`, and base-36 digit 27 is `'r'`, not `'f'`).
  Fixed in both `notation.ts`'s header comment and `design.md`. This also required
  fixing the "one past max" malformed-tile test to use `'3s'` (136) instead of the
  originally-planned `'3g'` (which decodes to 124, in-range, and would not have
  exercised the guard at all).
- The doubled-space malformed-input test's expected column position was worked out by
  hand against the actual `col` bookkeeping (position 4, the second stray space
  character) rather than the plan's placeholder guess (position 3) — the plan named the
  failure mode but not its exact expected position; position 4 matches the
  implementation's column-counting convention (advance by `token.length + 1` per token,
  landing the empty token's reported position on the second delimiter).

## Not done / explicitly out of scope (per design.md)

- No `HandRecord`-only (single-hand) notation — only whole `GameRecord`s, per the AC's
  own wording and design.md Decision 1.
- No `src/app/` wiring (no "copy hand log" UI, no localStorage persistence of the text
  form) — this ticket is `src/core/` only, per its own text.
- No compression/binary encoding — plain ASCII text only, per the AC.

## State at handoff

All planned steps complete. `just test` and `just check` both green. Ready for Review.
