# Structure — T-008-01-02 han-values-and-dora-counting

## Files touched

- **`src/core/han.ts`** — NEW. The whole ticket's implementation.
- **`src/core/han.test.ts`** — NEW. The fixture suite.
- **`src/core/index.ts`** — MODIFIED. One new line, `export * from './han'`,
  appended after `export * from './fu'` (append-at-end precedent from
  T-008-01-01).

No other file changes. `yaku.ts`, `yakuman.ts`, `fu.ts`, `record.ts` are all
read-only for this ticket (the AC's "without changing yaku.ts's name-only API
contract" is satisfied by not touching it at all).

## `src/core/han.ts` — module shape

```ts
// header comment: scope statement mirroring fu.ts's style — what this module
// is (name/dora → han), what it explicitly is NOT (no fu, no points, no
// aggregation across yaku names into a total — the -03 caller's job), and
// the yakuman-flat-13 / no-ura-dora / no-red-five constraints from research.

import type { TileKind } from './tiles'
import type { Meld } from './record'
import type { YakuName } from './yaku'
import type { YakumanName, Win, WinYakuName } from './yakuman'

// --- openness -----------------------------------------------------------
// isMenzen(melds): readonly Meld[] => boolean — duplicated verbatim from
// yaku.ts/fu.ts (the established precedent for this exact predicate).

// --- the standard-yaku han table -----------------------------------------
// private: YAKU_HAN: Readonly<Record<YakuName, { closed: number; open: number }>>
// one entry per YakuName (26), values per design.md's table.

// --- the yakuman han value -------------------------------------------------
// private: YAKUMAN_HAN = 13 (single constant — every YakumanName maps to it,
// no per-name table needed since all 10 entries are identical).

// --- name → han dispatch --------------------------------------------------
export function hanOf(name: WinYakuName, melds: readonly Meld[]): number
// implementation: if name is a YakumanName (test via a Set/lookup built from
// YAKUMAN_NAMES, imported from yakuman.ts) return YAKUMAN_HAN; else look up
// YAKU_HAN[name as YakuName] and pick .closed/.open by isMenzen(melds).

// --- dora + kan-dora counting ---------------------------------------------
// private: allKindsOf(win: Win): TileKind[] — duplicated from yakuman.ts's
// allKindsOf (same body: win.concealed spread + meld tiles, ankan all four
// own tiles, other meld types claimed+own).
// private: countOf(kinds, kind) — duplicated from yakuman.ts.

export function doraHanOf(win: Win, doraKinds: readonly TileKind[]): number
// implementation: const kinds = allKindsOf(win); sum over doraKinds of
// countOf(kinds, doraKind). (Deliberately NOT deduplicating doraKinds first —
// two indicators mapping to the same kind must each count every matching
// tile in the hand; summing per-indicator, not per-distinct-kind, is what
// makes kan-dora "stack" correctly. E.g. two indicators both pointing to 5p,
// hand holds two 5p copies: contributes 2 + 2 = 4 han, not 2.)
```

### Why `YAKUMAN_HAN` is a single constant, not a per-name table

Every yakuman prices identically (13 han flat, per design.md) — a
`Record<YakumanName, number>` populated with the same value 10 times would be
mechanical repetition with no information content. A single constant plus a
membership test (`YAKUMAN_NAMES.includes(name as YakumanName)`, reusing the
existing exported frozen array — no new data structure) says the same thing
without the redundant table. If a future ticket introduces double-yakuman
variants with different values, this collapses back to a per-name table at
that point — not before.

### Dispatch implementation sketch (for the plan phase, not final code)

```ts
const YAKUMAN_SET = new Set<string>(YAKUMAN_NAMES)

export function hanOf(name: WinYakuName, melds: readonly Meld[]): number {
  if (YAKUMAN_SET.has(name)) return YAKUMAN_HAN
  const entry = YAKU_HAN[name as YakuName]
  return isMenzen(melds) ? entry.closed : entry.open
}
```

## `src/core/han.test.ts` — suite shape

Follows `fu.test.ts`/`yakuman.test.ts`'s established idiom exactly (both
confirmed in research): local `h(spec)` mpsz-shorthand parser, `Meld`
builders (`chi`, `pon`, `daiminkan`, `shouminkan`, `ankan`) using real
`tileId`, fixtures built through the real `decomposeAgari`/`yakuOf` rather
than hand-typed decomposition literals.

Sections:

1. **`hanOf` — the full name table, table-driven.** One test iterating
   `STANDARD_YAKU_NAMES` (imported) with an independently-spelled expected
   `{closed, open}` map (a second transcription of design.md's table, per the
   "never re-derive the expected value from the implementation" convention —
   the `dora.test.ts` "second independent spelling" precedent) — asserts
   `hanOf(name, [])` (closed) and `hanOf(name, [openingMeld])` (open) against
   it for every name that has an open variant; for closed-only names, asserts
   only the closed call (calling with an open meld set would test an
   unreachable-in-practice input, not a real scenario — matches design.md's
   "no defensive throw needed" call).
2. **`hanOf` — yakuman flat 13.** Iterates `YAKUMAN_NAMES`, asserts
   `hanOf(name, [])` and `hanOf(name, [somePonMeld])` both equal 13 (openness
   truly irrelevant).
3. **`doraHanOf` — one copy, one indicator.** A hand holding exactly one
   `5p`, dora list `['5p']` ⇒ 1.
4. **`doraHanOf` — multiple copies of one dora kind.** A hand holding three
   `5p` (e.g. a triplet), dora list `['5p']` ⇒ 3.
5. **`doraHanOf` — kan-dora stacking.** Two indicators both mapping to the
   same kind (dora list `['5p', '5p']`), hand holding two `5p` ⇒ 4 (the
   design.md worked example, pinned exactly).
6. **`doraHanOf` — dora tiles inside an open meld count too.** A `pon('5p')`
   meld (3 copies) plus dora `['5p']` ⇒ 3, proving the scan reads meld tiles,
   not just concealed ones.
7. **`doraHanOf` — zero when no dora present.** Sanity zero case.
8. **The win-gate integration test (the AC's explicit ask): "a yakuless
   dora-laden hand still cannot win."** Construct a `Win` whose `yakuOf(win)`
   is `[]` — e.g. an all-simples hand with a valuable-pair-free ryanmen
   ron... no, that would be pinfu (a yaku). Need a genuinely yakuless
   completion: an OPEN hand (one `pon` meld, so pinfu/menzen-tsumo/iipeikou
   are unreachable), not tanyao (include a terminal), not yakuhai (no
   dragon/wind triplet), not any of the shape yaku (no sanshoku/ittsuu/toitoi/
   etc. — an ordinary mixed 234p-567s-9m9m9m(pon)-nothing-special hand ronned
   on a middle tile is the standard "yakuless open hand" shape used
   throughout riichi teaching material). Assert `yakuOf(win)` throws or
   returns `[]` per the existing gate (confirm exact current behavior by
   reading `yakuOf`'s contract before writing the assertion — research notes
   `yakuOf` throws `RangeError` when `standardYakuOf`'s union is empty AND
   there's no yakuman... actually re-check: `yakuOf` itself does NOT throw on
   zero yaku — only `applyWinTail` in record.ts turns `[]` into a thrown
   RangeError as the gate. `yakuOf` alone legitimately returns `[]`.) Assert
   `yakuOf(win)` returns `[]`. Separately assert `doraHanOf(win, doraKinds)`
   is > 0 for a dora list chosen to hit tiles in that same hand. The two
   assertions together are the proof: dora priced positively, yaku list
   empty — dora alone never crosses the gate, because dora isn't a member of
   `WinYakuName` and `doraHanOf`'s return type is a plain `number`, not
   something `yakuOf`/the gate ever consults.

## Barrel export change

```diff
 export * from './fu'
+export * from './han'
```

Single line, end of `src/core/index.ts`.
