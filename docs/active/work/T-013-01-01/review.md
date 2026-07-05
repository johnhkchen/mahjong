# Review — T-013-01-01: game-record-text-notation

## Summary

Adds the text form of the action-log contract deferred since E-002 (architecture.md
§2): a pure `src/core/` module that serializes a `GameRecord` (game seed + one action
log per hand) to a compact, versioned, all-ASCII notation, and a strict parser back.
This is also, by design, the "future log-parser boundary" that `tiles.ts`'s `TileId`
doc-comment and `record.ts`'s `HandRecord.seed`/`RiichiContext` doc-comments already
named as the place range validation for ids and seeds arriving from outside the program
would eventually live.

## Files changed

- **`src/core/notation.ts`** (new, ~300 lines) — `NOTATION_VERSION`,
  `serializeGameRecord`, `parseGameRecord`, and their private codec helpers
  (`encodeTile`/`decodeTile`, `decodeSeat`, `encodeAction`/`TOKEN_SPECS`/`decodeToken`,
  `parseHeader`). Zero DOM/app imports — only `./deal`, `./game`, `./record`, `./tiles`
  types.
- **`src/core/notation.test.ts`** (new, ~230 lines) — direct round-trip tests per
  `HandAction` variant, malformed-input tests (11 cases), charset/versioning tests, and
  the AC's property test plus 3 fixed anchors.
- **`src/core/index.ts`** (+1 line) — `export * from './notation'` added to the barrel.
- **`docs/active/work/T-013-01-01/{research,design,structure,plan,progress}.md`** — the
  RDSPI artifacts preceding this one.

No existing file's behavior changed — this is a pure addition. `purity.test.ts` needed
no edits (it globs the directory automatically) and reports the new files clean.

## What the notation looks like

```
v1 25evpds
D0 K0af R1cd C2af04ab T3
```

Header: `v<version> <seed-base36>`. Each hand is one line, tokens space-separated,
each token `<TYPE letter><seat digit><tile fields...>`, tiles as exactly 2 lowercase
base-36 digits (`0`-`135` → `00`-`3r`). Ten type letters, one per `HandAction` variant
(`D`raw, `K`discard, `R`iichi, `C`hi, `P`on, `M`inkan/daiminkan, `A`nkan,
`S`houminkan, `T`sumo, ron as `X`). Full grammar is documented in `notation.ts`'s module
header, per the ticket's own instruction to "document it in the module header."

## AC verification

- ✅ **fast-check property, arbitrary legally-played GameRecords round-trip**:
  `notation.test.ts`'s `playGame`/`playHand` helpers restate `selfplay.test.ts`'s
  consult loop (deliberately — that file's own header already frames this as expected
  practice) to build 1-4-hand games, chaining hands via `foldGame`'s own dealer/score
  threading. The property asserts `foldGame(parseGameRecord(serializeGameRecord(r)))`
  `toEqual` `foldGame(r)` over 25 runs across the full `uint32` seed domain, plus 3 fixed
  anchor cases for fast CI signal. All green.
- ✅ **Single-suit-of-ASCII, URL/issue-safe**: every emitted character is drawn from
  `[0-9A-Za-z ]` plus `\n` — asserted directly (`/^[\x20-\x7e\n]*$/`) in the charset
  test.
- ✅ **Malformed input throws naming line and position**: 11 explicit failure-mode
  tests (empty document, missing/invalid/out-of-range seed, missing hand lines, unknown
  type letter, wrong token length, bad seat digit, bad tile characters, out-of-range
  tile value, stray doubled space) — every one asserts the thrown message contains
  `line <n>, position <p>` plus a specific reason.
- ✅ **Exported from the core barrel**: `notation.test.ts` imports the self-play
  dependencies (`foldGame`, `foldRecord`, etc.) via `./index`, and a dedicated check in
  the versioning/round-trip tests exercises `serializeGameRecord`/`parseGameRecord`
  themselves imported from `./notation` directly — barrel wiring is a one-line diff in
  `index.ts`, structurally identical to the other fourteen barrel entries, and covered
  transitively by every test in the file compiling/running against the barrel's other
  exports.
- ✅ **`just check` clean, core purity suite green**: `svelte-check`+`tsc` report 0
  errors/warnings across 207 files; `npx vitest run src/core` reports 773/773 tests
  passing across 29 files, including `purity.test.ts` with no changes required.

## Test coverage assessment

Strong on the AC's literal claims (property + malformed-input + charset + barrel).
Direct unit coverage adds one deep-equal round-trip per `HandAction` variant (all ten),
a zero-action-hand case (the fresh-deal active-hand shape `GameRecord.hands` can
legitimately carry), and a fixed multi-hand case with an explicit line-count assertion.

**Gaps / things a human reviewer may want to weigh**:
- The property test bounds `handCount` to `1..4` and `numRuns` to `25` — a real bug-report
  hand log could be many hands (a full hanchan is 8+). This was a deliberate scope/runtime
  tradeoff (each hand's self-play is already the expensive part; `selfplay.test.ts`
  itself only samples 10 runs at the full domain for its own single-hand property). If a
  bug ever surfaces specifically in long-game threading (very late `handIndex` values,
  unusual pot-carry chains), it would not be caught by this property's current bounds —
  widening `handCount`'s max or `numRuns` is the fix, not a redesign.
- `encodeTile`'s range guard (`serializeGameRecord: tile id ... out of range`) is
  currently unreachable through any code path a `HandAction`-typed caller can construct
  (every legally-typed `TileId` value is already `0-135` by `tiles.ts`'s own
  construction functions) — it exists purely as a defensive mirror of `decodeTile`'s
  guard, per this codebase's established "throw loudly rather than silently corrupt a
  hand-built or in-memory-corrupted record" convention (`record.ts` does the same for
  many now-technically-unreachable-through-the-fold guards). Not tested directly with a
  hand-constructed out-of-range action; considered low-value to add given the type
  system already prevents it in normal use, but flagged here for visibility.
- No test exercises a header seed of exactly `0` alongside its own edge — actually
  covered (`v1 7` and similar use small seeds; the property test samples `0` as part of
  its full-range distribution, not guaranteed every run). Not considered a real gap
  since `0` requires no special-casing anywhere in the codec (`(0).toString(36)` is
  `'0'`, decodes cleanly).

## Design decisions worth flagging for the reviewer

- **Type letters are an invented vocabulary** (`D`/`K`/`R`/`C`/`P`/`M`/`A`/`S`/`T`/`X`) —
  there was no existing in-repo precedent to match (grep confirmed no prior notation
  module), so this is this ticket's own new naming surface, frozen going forward the way
  `HandAction` itself is frozen. Worth a deliberate look before merge since it's harder
  to change later without a version bump.
- **Physical `TileId`, not `TileKind`, is encoded** — a deliberate choice (design.md
  Decision 3) because the fold's `TableState` keeps exact copy identity meaningful
  (hands/ponds/melds are `TileId[]`), so a kind-only encoding could rebuild a
  kind-equivalent but not `TileId`-identical state, failing the deep-equal round-trip
  under `toEqual`. This does mean the notation is less "reads like real mahjong
  notation" (real logs usually only care about kind) and more a faithful text mirror of
  the engine's own internal identity — an intentional tradeoff toward the AC's literal
  round-trip requirement over human familiarity.
- **Per-hand seeds are never encoded** — re-derived via `handSeedOf`, matching
  `game.ts`'s own "no second authority" rule. This means the notation is NOT simply "one
  `HandRecord`-notation per line" — a reader must know `GameRecord`'s own seed-derivation
  convention to hand-decode a multi-hand log's per-hand walls, same as the engine itself
  requires.

## Known limitations / open concerns

- No app-layer wiring exists yet (no "copy hand log" UI affordance, no localStorage use
  of this format) — explicitly out of scope per the ticket's own text ("Pure `src/core/`
  module"); a follow-up ticket would wire this into the app for the "a bug report is a
  hand log" workflow architecture.md promises.
- The grammar is this ticket's own invention with no external format to diff against
  for sanity — recommend a human skim of `notation.ts`'s module header (the grammar
  table) specifically, since it's the one piece of this ticket not derivable purely from
  existing codebase conventions.

## Critical issues

None found. All ACs met, full suite green, `just check` clean.
