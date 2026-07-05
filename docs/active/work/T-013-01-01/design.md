# Design — T-013-01-01: game-record-text-notation

## Decision 1: module scope — `GameRecord`, not `HandRecord`

The module serializes/parses `GameRecord` (`{ seed, hands }`), one text document per
game. Per-hand seeds are never encoded — `handSeedOf(gameSeed, handIndex)` re-derives
them, matching game.ts's existing "no second authority" rule. A `HandRecord`-only
notation was considered and rejected: the AC explicitly says "GameRecords," and a game
is the unit a saved bug report / localStorage entry actually needs (one whole game, not
one hand in isolation with no way to fold it against the running score/dealer/pot state
that later hands depend on).

## Decision 2: line-oriented document shape

```
v1 <seed-base36>
<hand 0 tokens>
<hand 1 tokens>
...
```

Header is line 1: `v` + integer format version + one space + the seed in base36. Each
subsequent line is exactly one hand's action log, in order — an empty line is a hand
with zero actions (the freshly-dealt active-hand case). No trailing newline (so
`split('\n')` round-trips the exact line count with no ambiguous empty extra element).

Rejected: JSON. Technically already round-trips (selfplay.test.ts uses
`JSON.stringify` to compare replays byte-for-byte today) but is not "compact" or
"terse" — verbose keys per action, and the ticket explicitly asks for a fresh terse
notation, modeled on Tenhou-style logs per architecture.md §2. JSON stays useful
internally (equality checks) but is not this ticket's deliverable.

Rejected: single-line whole-document (hands joined by a delimiter other than newline,
e.g. `;`). Newlines are the natural hand separator (visually: one line = one hand, a
"bug report is a hand log" reads best as one line to paste) and cost nothing — the doc
is still one string, still safe in a `localStorage` value or a URL query param after
percent-encoding.

## Decision 3: per-action token grammar — positional, not delimited fields

Each token is `<TYPE><SEAT><...tiles>`, fully positional (fixed field widths per type,
no inner delimiters) — self-delimiting once the type letter is known, so the parser
never scans for a separator inside a token. Tokens within a hand's line are
space-separated (one space between tokens) — purely for human legibility when eyeballing
a pasted bug report; the grammar does not depend on it (each token's length is
determined by its type letter).

Type letters (chosen to avoid collisions with each other; case matters — always
uppercase for the type marker):

| letter | action        | mnemonic                              | length |
|--------|---------------|-----------------------------------------|--------|
| D      | draw          | Draw                                   | 2      |
| K      | discard       | Kiru (discard)                         | 4      |
| R      | riichi        | Riichi                                 | 4      |
| C      | chi           | Chi                                    | 8      |
| P      | pon           | Pon                                    | 8      |
| M      | daiminkan     | Minkan (open kan)                      | 10     |
| A      | ankan         | Ankan                                  | 10     |
| S      | shouminkan    | Shouminkan                             | 4      |
| T      | tsumo         | Tsumo                                  | 2      |
| X      | ron           | (last letter free of collisions — ron  | 4      |
|        |               | claims a discard, "X marks the win")   |        |

`<SEAT>` is exactly one digit, `0`-`3`. Each `<tile>` field is exactly 2 lowercase
base-36 characters (Decision 4). Field order mirrors `HandAction`'s own property order
(`tile` before `uses`, `uses` in recorded order) so the encoding is a direct, boring
transliteration of the type — nothing to invert or remember beyond the table above.

Rejected: a single shared 1-char type code with a following variable-length,
comma-separated argument list (`K,0,5f`). More visually busy, and variable-length CSV
fields reopen exactly the delimiter-scanning-inside-a-token problem fixed-width fields
avoid for free.

Rejected: encoding `uses`/`tile` as `TileKind` (e.g. `5p`) instead of raw `TileId`.
Rejected because the fold keeps physical-copy identity significant (Research: hands,
ponds, and melds are `TileId[]`, and a copy-losing round-trip can produce a
kind-equivalent but `TileId`-different fold, which is not what "parse(serialize(r))
folds deep-equal to foldGame(r)" demands under `toEqual`). Physical `TileId` is also
already the log's own literal domain — no translation layer needed at the fold boundary,
keeping this module a pure text codec over exactly what `HandAction` already carries.

## Decision 4: numeric encoding — base-36, fixed width, lowercase

- `TileId` (`0..135`): exactly 2 lowercase base-36 digits, `id.toString(36).padStart(2,
  '0')`. `135` (`3r`) is the largest value and fits in 2 digits (`36^2 = 1296`), so width
  is always exactly 2 — no variable-length ambiguity, no separator needed between
  adjacent tile fields in a token.
- Game seed (`0..2^32-1`): base-36, variable width (up to 7 digits for the max
  `uint32`), space-terminated in the header line (its own field, not tile-packed) — no
  fixed width needed since it is the header's last and only variable segment.
- Uppercase reserved for type letters, lowercase for tile digits, digits `0-3` for
  seats: three disjoint alphabets by *position*, which is what makes an all-positional
  grammar unambiguous without a scan-based tokenizer inside a token.

Rejected: raw decimal (`id` as `"5"`.."135"`) — variable width forces a delimiter
between every tile field, which then also needs escaping/collision handling against the
digit-only seat field. Base-36 fixed-width sidesteps this entirely.

Rejected: single-character encoding (base-136 alphabet) — would need punctuation/mixed
case to reach 136 distinct printable ASCII symbols, hurting the "single suit of ASCII"
requirement (paraphrased from the AC: safe in URLs/issues) and legibility; 2
alphanumeric characters per tile is already terse and stays in `[0-9a-z]`.

## Decision 5: versioning

Header carries `v<int>` explicitly, per the ticket's own text ("the version field exists
so the format can evolve without orphaning old reports"). `parseGameRecord` rejects any
version it does not implement by name (`unsupported format version N`), rather than
attempting best-effort forward compatibility — a widen-when-actually-needed policy,
matching every other "extend-only, throw until it's extended" convention in this
codebase (`HandAction`'s own CONTRACT FREEZE doc-comment, `applyAction`'s default arm).
`NOTATION_VERSION = 1` is exported so a future bump has one place to change and one
place other modules can read it from.

## Decision 6: strict parsing, line+position errors

Every parse failure throws `RangeError` naming `line <n>, position <p>` (1-based line
counting the header as line 1; 1-based character column within that line) plus a
human-readable reason — mirroring `record.ts`'s "throw loudly instead of folding
silently" convention (there: `action <index>`; here: `line`/`position`, since text has
no action-index until it's already been parsed into one).

Failure modes enumerated and handled: empty document; unsupported version; header shape
mismatch; unknown type letter; wrong token length for a known type; malformed seat digit
(not `0-3`); malformed tile chars (not exactly 2 lowercase base-36 digits) or decoded
value out of `[0, 135]`; malformed/out-of-range seed. Every one names line+position — no
generic catch-all "malformed input" message.

## Decision 7: no semantic/legality validation here

The parser validates **syntax and numeric range only** (`TileId` in `[0,135]`, seat in
`[0,3]`, seed in `[0, 2^32)`) — never legality (e.g., "does this chi form a run,"
"is this seat's turn"). That is `foldRecord`/`foldGame`'s job, unchanged, and is exactly
the boundary `tiles.ts`/`record.ts`'s own doc-comments already describe ("ids entering
from outside the program are validated by the log parser at that boundary" — nothing
about legality). A syntactically well-formed but semantically illegal parsed record
folds and throws exactly as it would if hand-constructed in-process; this module adds no
new legality surface.

## Decision 8: test generator — chain `selfPlay`-shaped hands via `foldGame`

To build arbitrary legally-played multi-hand `GameRecord`s for the property test,
restate `selfplay.test.ts`'s single-hand consult loop locally (a `playHand(seed,
context)` helper, parameterized by `RiichiContext` instead of assuming a fresh game) and
chain hands by calling `foldGame({ seed, hands: [...hands, []] })` after each completed
hand to read off the next hand's `scoresIn`/`pot`/dealer from `GameState.table` — reusing
`foldGame`'s own rotation/settlement threading rather than reimplementing it. Rejected:
reimplementing dealer rotation/score deltas by hand in the test file — `foldGame` already
is that logic, tested elsewhere (`game.test.ts`), and reuse here is both less code and a
second live check that `foldGame` tolerates a trailing empty active hand as documented.

## What's explicitly out of scope

- No support for parsing a lone `HandRecord` (only whole `GameRecord`s).
- No compression beyond the terse grammar (no gzip/base64 — the AC wants "single-suit-of-
  ASCII text," implying plain text, not a binary-ish blob).
- No app-layer wiring (localStorage persistence, UI "copy hand log" button) — that is a
  future `src/app/` ticket; this ticket is `src/core/` only, per its own text ("Pure
  `src/core/` module, zero DOM").
