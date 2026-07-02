# T-001-02-01 tile-types-and-identities — Design

Four decisions, each with alternatives considered. The binding constraint throughout: tile
kind names leak into the action-log notation (the system's public contract), so the *naming*
choice here is the one with long-term gravity; everything else is engine-internal and cheap
to revisit.

## D1 — Kind representation: mpsz string-literal union

**Chosen:** `TileKind` is a string-literal union of the 34 mpsz names — `'1m'…'9m'`,
`'1p'…'9p'`, `'1s'…'9s'`, `'1z'…'7z'` (honors in the fixed order E, S, W, N, haku, hatsu,
chun) — built with template-literal types so the compiler knows all 34 members exactly:

```ts
type Rank = 1|2|3|4|5|6|7|8|9
type NumberedSuit = 'm'|'p'|'s'
type TileKind = `${Rank}${NumberedSuit}` | `${1|2|3|4|5|6|7}z`
```

**Why:** (a) mpsz is the de-facto Riichi log notation (Tenhou-style), and architecture.md
explicitly models the action log on Tenhou logs — using it as the *type* means log
serialization of kinds is the identity function, no mapping table to drift. (b) Human-readable
in test failures, debugger, and hand logs — a bug report that says `expected '5p'` needs no
decoder ring. (c) Exhaustively checkable: `switch` over suits narrows; a wrong literal like
`'0m'` or `'8z'` is a compile error.

**Rejected — numeric enum / bare `0–33` index as the kind type:** the standard
shanten-algorithm shape (count arrays of length 34) wants indices, but making the index *the
public kind type* trades away log readability and type safety (any `number` passes). Instead
the canonical index stays available as a derived view (D3). **Rejected — per-kind object
`{suit, rank}`:** structural objects don't work as map keys or switch cases, are noisy in
logs, and invite identity-vs-equality bugs. **Rejected — unicode mahjong codepoints (🀇…):**
cute, unreadable in diffs, and the codepoint order doesn't match mpsz order.

## D2 — Tile identity: integer `0–135`, `id = kindIndex * 4 + copy`

**Chosen:** `TileId` is a plain `number` alias; the 136 identities are the integers 0–135,
laid out as 4 consecutive copies per kind in canonical kind order. Constructors/accessors
(`tileId(kind, copy)`, `kindOf(id)`, `copyOf(id)`) are the *only* sanctioned way to cross
between id and kind — the arithmetic is an internal detail, though the encoding is fixed and
documented (it will be visible in wall serializations).

**Why:** (a) A wall is a permutation of 136 tiles; integers make it an array of numbers —
trivially serializable into the seed header of the action log, trivially shuffled by
T-001-02-02's seeded PRNG, and compact in `localStorage`. (b) O(1) arithmetic both ways, no
lookup tables. (c) Per-copy identity is preserved (a hand is its record; two copies of `5p`
are different physical tiles in the wall order), and `copy === 0` is a natural future hook
for akadora ("copy 0 of each 5 is red") without any schema change.

**Rejected — branded `number` (`number & {__brand}`):** protects against mixing `TileId` with
kind indices, but every array index / arithmetic op needs casts; for a 34/136-value domain
with total test enumeration, the friction outweighs the bug class. Revisit if a real
confusion bug ever appears. **Rejected — string ids (`'5p#2'`):** readable but heavier in
walls/logs (the log wants kind names for actions, raw ids only inside the seed header) and
requires parsing. **Rejected — object `{kind, copy}`:** same equality/serialization problems
as in D1.

## D3 — Canonical order and the kind↔index bridge

**Chosen:** `TILE_KINDS` is a frozen 34-element array in canonical order (man 0–8, pin 9–17,
sou 18–26, honors 27–33 as E,S,W,N,haku,hatsu,chun). Its positions *are* the canonical kind
index; `kindIndexOf(kind)` / `TILE_KINDS[i]` bridge both ways (O(1) via an internal reverse
map, not `indexOf`). This matches mpsz numbering (`1z`=E … `7z`=chun) and the conventional
hand-sort order, so future shanten count-arrays, sorting, and dora-successor logic all agree
on one indexing with no translation layers.

**Rejected — alphabetical or insertion-order incidental ordering:** ordering is load-bearing
downstream (sorting, count arrays, dora wrap-around within suit); it must be *specified*, not
emergent.

## D4 — API surface: identity + classification, nothing that moves

**In scope** (the tile domain proper): the types and constants above; `allTileIds()`;
suit/rank accessors (`suitOf`, `rankOf` — rank `null`-ish for honors, exact shape settled in
Structure); classification predicates `isHonor`, `isTerminal`, `isSimple` (kind-level).
Predicates are included because they are *definitions about tiles themselves* (yaku are
merely consumers of them), they're ~1 line each, and writing them now under test is cheaper
than retrofitting.

**Out of scope, explicitly:** wall building and shuffling (T-001-02-02), hand sorting, melds/
sets, dora computation, red-five rules, anything touching randomness. Also **no display
names/art hooks** — English/Japanese names and SVG art are view-layer concerns (P4 tickets);
core exports machine names only.

**Rejected — "just the two constants" minimalism (kinds list + id count only):** forces
T-001-02-02 and every later ticket to reinvent accessors ad hoc, scattering the id encoding
across files. The encoding must have exactly one home.

## Supporting decisions

- **File layout:** new `src/core/tiles.ts` holds the whole domain; `src/core/index.ts`
  becomes a pure barrel (`export * from './tiles'`). Core grows as modules re-exported
  through one entry, matching the "composable modules, one compile target" story.
- **The placeholder dies:** `ENGINE_NAME` and its smoke test are deleted — T-001-01-02's
  review said the smoke test exists to prove wiring "until the first real test", which this
  ticket ships. New `tiles.test.ts` imports from `'./index'` (not `'./tiles'`), so the barrel
  re-export stays under test and the wiring proof is preserved, strictly strengthened.
- **Tests are example-based enumeration, not property tests:** the AC asks for exact counts
  (34 kinds, 136 distinct ids); with a 136-value total domain, exhaustive `for` loops *are*
  the strongest possible test — no generator library needed. fast-check enters with
  T-001-02-02 per its own AC ("the project's first property test").
- **Purity verification:** documented grep (`grep -rnE "from ['\"]|import\(" src/core/`
  reviewed by eye + targeted `grep -rn 'svelte\|document\|window' src/core/`), run during
  Implement and recorded in review.md. No justfile automation this ticket — `just check`'s
  contract shouldn't grow as a side effect; if the grep gate proves annoying to repeat, a
  later ticket can wire it into CI deliberately.
- **No new dependencies, no config changes:** the existing vitest glob picks up
  `tiles.test.ts`; tsconfig and vite config are untouched.

## Risk register

- *mpsz honor-order mistakes* (e.g., swapping haku/hatsu) would silently corrupt future
  dora/log logic → mitigated by tests asserting the exact 34-element canonical sequence, not
  just its length.
- *Encoding leakage*: later code doing `id / 4` arithmetic inline instead of via accessors →
  mitigated by exporting the accessors from day one and keeping the constant
  `COPIES_PER_KIND` next to the encoding.
