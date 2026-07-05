// The text form of the action-log contract (architecture.md §2, deferred since E-002):
// a compact, versioned, ASCII serialization of a GameRecord (seed + one action log per
// hand) and its strict inverse parser. This IS the "future log-parser boundary" that
// tiles.ts's TileId doc-comment and record.ts's HandRecord.seed doc-comment both defer
// range validation to — every TileId and the game seed are range-checked HERE, on the
// way in from outside the program. Never validates legality (is this chi a run, is it
// this seat's turn) — that stays foldRecord/foldGame's job; a syntactically well-formed
// but semantically illegal parsed record folds and throws exactly as a hand-built one
// would.
//
// GRAMMAR, frozen (extend-only — a future version bumps NOTATION_VERSION and this
// comment, never silently reinterprets an existing one):
//
//   document := header ('\n' handLine)+
//   header   := 'v' <version:decimal> ' ' <seed:base36>
//   handLine := (token (' ' token)*)?        -- empty line = a hand with zero actions
//   token    := <TYPE letter><seat digit 0-3><tile>*
//   tile     := exactly 2 lowercase base-36 digits, decoding to an integer in [0, 135]
//
// Each token is fully POSITIONAL: once the type letter is known, every field's width is
// fixed, so no inner delimiter is ever needed inside a token (uppercase type letters,
// lowercase tile digits, and bare seat digits are three disjoint alphabets by position,
// not by character set alone). Tokens within a line are space-separated purely for
// legibility when eyeballing a pasted bug report ("a bug report is a hand log",
// architecture.md §2) — the grammar does not depend on the space to disambiguate fields.
//
// Type letters (HandAction's own ten frozen variants, record.ts:77-107), chosen to
// avoid collisions with each other:
//
//   D draw        (no fields — the wall order is the sole authority for the tile drawn)
//   K discard     tile                                   Kiru, Japanese for "discard"
//   R riichi      tile                                   Riichi (the atomic declare+discard)
//   C chi         tile, uses[0], uses[1]
//   P pon         tile, uses[0], uses[1]
//   M daiminkan   tile, uses[0], uses[1], uses[2]         Minkan, the open kan
//   A ankan       uses[0], uses[1], uses[2], uses[3]      (no claimed tile — nothing claimed)
//   S shouminkan  tile                                    (no uses — the upgraded pon is derivable)
//   T tsumo       (no fields — the winning tile IS `drawn`, the wall-order authority)
//   X ron         tile                                    ("X marks the win" — R was already riichi)
//
// TileId (0-135, tiles.ts) encodes as exactly 2 lowercase base-36 digits
// (`id.toString(36).padStart(2, '0')`) — 135 ('3r') is the largest value and 36^2 =
// 1296 comfortably covers it, so width is always exactly 2, never variable. The game
// seed (0..2^32-1) encodes as plain base-36 in the header, variable width, since it is
// the header's own last field with nothing packed after it.
//
// Per-hand seeds are NEVER encoded — handSeedOf(gameSeed, handIndex) (game.ts) already
// re-derives them from the one game seed, and encoding a second value here would be
// exactly the second-authority-that-could-disagree problem record.ts's own header
// warns against for draw/tsumo tiles.

import type { Seat } from './deal'
import type { GameRecord } from './game'
import type { HandAction } from './record'
import type { TileId } from './tiles'

/** The one format version this module reads and writes. Bump on any grammar change. */
export const NOTATION_VERSION = 1

const MAX_TILE_ID = 135
const MAX_SEED = 0xffffffff

/** Exactly 2 lowercase base-36 digits — the fixed-width tile field shape. */
const TILE_RE = /^[0-9a-z]{2}$/

/** `id` losslessly as exactly 2 lowercase base-36 digits. Guards its own output. */
function encodeTile(id: TileId): string {
  if (!Number.isInteger(id) || id < 0 || id > MAX_TILE_ID) {
    throw new RangeError(`serializeGameRecord: tile id ${id} out of range [0, ${MAX_TILE_ID}]`)
  }
  return id.toString(36).padStart(2, '0')
}

/** `encodeTile`'s inverse, at the log-parser boundary: validates shape AND range. */
function decodeTile(text: string, line: number, position: number): TileId {
  if (!TILE_RE.test(text)) {
    throw new RangeError(
      `line ${line}, position ${position}: malformed tile ${JSON.stringify(text)} — expected 2 lowercase base-36 digits`,
    )
  }
  const id = parseInt(text, 36)
  if (id > MAX_TILE_ID) {
    throw new RangeError(`line ${line}, position ${position}: tile id ${id} out of range [0, ${MAX_TILE_ID}]`)
  }
  return id
}

/** A single digit 0-3, at the log-parser boundary. */
function decodeSeat(ch: string, line: number, position: number): Seat {
  if (ch.length !== 1 || !/^[0-3]$/.test(ch)) {
    throw new RangeError(`line ${line}, position ${position}: malformed seat ${JSON.stringify(ch)} — expected one digit 0-3`)
  }
  return Number(ch) as Seat
}

/** `HandAction` → its token. The Grammar comment's table, made code. */
function encodeAction(action: HandAction): string {
  const seat = String(action.seat)
  switch (action.type) {
    case 'draw':
      return `D${seat}`
    case 'discard':
      return `K${seat}${encodeTile(action.tile)}`
    case 'riichi':
      return `R${seat}${encodeTile(action.tile)}`
    case 'chi':
      return `C${seat}${encodeTile(action.tile)}${encodeTile(action.uses[0])}${encodeTile(action.uses[1])}`
    case 'pon':
      return `P${seat}${encodeTile(action.tile)}${encodeTile(action.uses[0])}${encodeTile(action.uses[1])}`
    case 'daiminkan':
      return `M${seat}${encodeTile(action.tile)}${encodeTile(action.uses[0])}${encodeTile(action.uses[1])}${encodeTile(action.uses[2])}`
    case 'ankan':
      return `A${seat}${encodeTile(action.uses[0])}${encodeTile(action.uses[1])}${encodeTile(action.uses[2])}${encodeTile(action.uses[3])}`
    case 'shouminkan':
      return `S${seat}${encodeTile(action.tile)}`
    case 'tsumo':
      return `T${seat}`
    case 'ron':
      return `X${seat}${encodeTile(action.tile)}`
    default: {
      // `action` is `never` here for well-typed input; guards a future HandAction
      // variant this module has not been extended to encode yet, per the grammar
      // comment's "extend-only" rule — never silently drop a field.
      const exhaustive: never = action
      throw new RangeError(`serializeGameRecord: unknown action type ${JSON.stringify((exhaustive as { type?: unknown }).type)}`)
    }
  }
}

/** One token spec: its exact character length, and how to build the action from it. */
interface TokenSpec {
  readonly length: number
  readonly build: (token: string, line: number, col: number) => HandAction
}

const TOKEN_SPECS: Readonly<Record<string, TokenSpec>> = {
  D: {
    length: 2,
    build: (t, l, c) => ({ type: 'draw', seat: decodeSeat(t[1], l, c + 1) }),
  },
  K: {
    length: 4,
    build: (t, l, c) => ({
      type: 'discard',
      seat: decodeSeat(t[1], l, c + 1),
      tile: decodeTile(t.slice(2, 4), l, c + 2),
    }),
  },
  R: {
    length: 4,
    build: (t, l, c) => ({
      type: 'riichi',
      seat: decodeSeat(t[1], l, c + 1),
      tile: decodeTile(t.slice(2, 4), l, c + 2),
    }),
  },
  C: {
    length: 8,
    build: (t, l, c) => ({
      type: 'chi',
      seat: decodeSeat(t[1], l, c + 1),
      tile: decodeTile(t.slice(2, 4), l, c + 2),
      uses: [decodeTile(t.slice(4, 6), l, c + 4), decodeTile(t.slice(6, 8), l, c + 6)],
    }),
  },
  P: {
    length: 8,
    build: (t, l, c) => ({
      type: 'pon',
      seat: decodeSeat(t[1], l, c + 1),
      tile: decodeTile(t.slice(2, 4), l, c + 2),
      uses: [decodeTile(t.slice(4, 6), l, c + 4), decodeTile(t.slice(6, 8), l, c + 6)],
    }),
  },
  M: {
    length: 10,
    build: (t, l, c) => ({
      type: 'daiminkan',
      seat: decodeSeat(t[1], l, c + 1),
      tile: decodeTile(t.slice(2, 4), l, c + 2),
      uses: [
        decodeTile(t.slice(4, 6), l, c + 4),
        decodeTile(t.slice(6, 8), l, c + 6),
        decodeTile(t.slice(8, 10), l, c + 8),
      ],
    }),
  },
  A: {
    length: 10,
    build: (t, l, c) => ({
      type: 'ankan',
      seat: decodeSeat(t[1], l, c + 1),
      uses: [
        decodeTile(t.slice(2, 4), l, c + 2),
        decodeTile(t.slice(4, 6), l, c + 4),
        decodeTile(t.slice(6, 8), l, c + 6),
        decodeTile(t.slice(8, 10), l, c + 8),
      ],
    }),
  },
  S: {
    length: 4,
    build: (t, l, c) => ({
      type: 'shouminkan',
      seat: decodeSeat(t[1], l, c + 1),
      tile: decodeTile(t.slice(2, 4), l, c + 2),
    }),
  },
  T: {
    length: 2,
    build: (t, l, c) => ({ type: 'tsumo', seat: decodeSeat(t[1], l, c + 1) }),
  },
  X: {
    length: 4,
    build: (t, l, c) => ({
      type: 'ron',
      seat: decodeSeat(t[1], l, c + 1),
      tile: decodeTile(t.slice(2, 4), l, c + 2),
    }),
  },
}

/** One space-delimited token → its `HandAction`, at the log-parser boundary. */
function decodeToken(token: string, line: number, col: number): HandAction {
  if (token.length === 0) {
    throw new RangeError(`line ${line}, position ${col}: empty action token — a stray or doubled space`)
  }
  const spec = TOKEN_SPECS[token[0]]
  if (spec === undefined) {
    throw new RangeError(`line ${line}, position ${col}: unknown action type letter ${JSON.stringify(token[0])}`)
  }
  if (token.length !== spec.length) {
    throw new RangeError(
      `line ${line}, position ${col}: ${token[0]} action must be exactly ${spec.length} characters, got ${JSON.stringify(token)}`,
    )
  }
  return spec.build(token, line, col)
}

const HEADER_RE = /^v([0-9]+) ([0-9a-z]+)$/

/** The header line → its decoded game seed, at the log-parser boundary. */
function parseHeader(line: string): number {
  const match = HEADER_RE.exec(line)
  if (match === null) {
    throw new RangeError(
      `line 1, position 1: malformed header ${JSON.stringify(line)} — expected "v<version> <seed>"`,
    )
  }
  const [, versionText, seedText] = match
  const version = Number(versionText)
  if (version !== NOTATION_VERSION) {
    throw new RangeError(
      `line 1, position 1: unsupported format version ${version} — this parser reads version ${NOTATION_VERSION}`,
    )
  }
  const seedPosition = line.length - seedText.length + 1
  const seed = parseInt(seedText, 36)
  if (seed > MAX_SEED) {
    throw new RangeError(`line 1, position ${seedPosition}: seed ${seed} out of range [0, ${MAX_SEED}]`)
  }
  return seed
}

/**
 * `GameRecord` → its text notation (the Grammar comment above). Pure string
 * construction — no validation beyond the tile-range guard `encodeTile` already
 * carries (every value a caller can construct through `HandAction`'s own types is
 * already in range; the guard exists for hand-built or corrupt-in-memory records, the
 * same defensive posture `record.ts`'s own throw-loudly convention takes everywhere
 * else). One line per hand, no trailing newline — `parseGameRecord`'s `split('\n')`
 * depends on this exact shape to recover the same hand count with no ambiguous extra
 * empty element.
 */
export function serializeGameRecord(record: GameRecord): string {
  const header = `v${NOTATION_VERSION} ${(record.seed >>> 0).toString(36)}`
  const handLines = record.hands.map((actions) => actions.map(encodeAction).join(' '))
  return [header, ...handLines].join('\n')
}

/**
 * `serializeGameRecord`'s strict inverse — this module's own log-parser boundary
 * (tiles.ts's and record.ts's doc-comments both defer to it). Every malformed input
 * throws `RangeError` naming the 1-based `line` and 1-based character `position` of
 * the offending text, never coercing or silently dropping a field. Validates syntax
 * and numeric range only (tile ids in [0,135], seats in [0,3], seed in [0, 2^32)) —
 * never legality; a syntactically well-formed but illegal-to-play record parses fine
 * and throws only later, from `foldRecord`/`foldGame`, exactly as it would if
 * hand-built in-process.
 */
export function parseGameRecord(text: string): GameRecord {
  const lines = text.split('\n')
  if (lines.length === 0 || lines[0].length === 0) {
    throw new RangeError('line 1, position 1: empty document — expected a header line')
  }
  const seed = parseHeader(lines[0])
  if (lines.length < 2) {
    throw new RangeError('line 2, position 1: a game record needs at least one hand line')
  }
  const hands: HandAction[][] = []
  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1
    const line = lines[i]
    if (line.length === 0) {
      hands.push([])
      continue
    }
    const tokens = line.split(' ')
    const actions: HandAction[] = []
    let col = 1
    for (const token of tokens) {
      actions.push(decodeToken(token, lineNo, col))
      col += token.length + 1
    }
    hands.push(actions)
  }
  return { seed, hands }
}
