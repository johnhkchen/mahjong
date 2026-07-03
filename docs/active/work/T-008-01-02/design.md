# Design — T-008-01-02 han-values-and-dora-counting

## Decisions (summary)

1. New module `src/core/han.ts`, sibling to `fu.ts`, barrel-exported the same
   way. No changes to `yaku.ts` or `yakuman.ts` (their name-only contract is
   frozen by the AC).
2. Two exported functions only — `hanOf(name, melds)` and
   `doraHanOf(win, doraKinds)` — backed by PRIVATE lookup tables, mirroring
   `yaku.ts`'s private `STANDARD_YAKU` table behind the public
   `standardYakuOf`.
3. `hanOf` takes `melds: readonly Meld[]` (not a `menzen: boolean`, not a
   `WinContext`) and derives openness itself via a locally duplicated
   `isMenzen`, following the `isMenzen` duplication precedent already present
   in both `yaku.ts` and `fu.ts`.
4. `doraHanOf` takes a `Win` (the pre-reading whole-hand shape from
   `yakuman.ts`) plus the flipped dora-kind list (`TableState.doras`,
   dora+kan-dora already unified), and internally duplicates the
   `allKindsOf`/`countOf` scan pattern from `yakuman.ts`.
5. No ura-dora handling — riichi doesn't exist in the engine yet (confirmed
   in research). No red-five handling — `TileKind` has no aka variant.
6. Yakuman han is a flat 13 for every `YakumanName`, openness-independent.

## Options considered for `hanOf`'s signature

### A — `hanOf(name: WinYakuName, menzen: boolean): number`

Caller pre-computes openness once (e.g. `isMenzen(win.melds)`) and passes the
bool. Pros: `han.ts` has zero coupling to `Meld`/`Win` types beyond the union
name type; trivially unit-testable with no fixture machinery. Cons: pushes
the "how do I know if this hand is closed" question onto every caller,
including this ticket's own test file, which would have to reimplement
`isMenzen` a third time just to build test inputs — except the test suite
already needs `Meld` fixtures anyway (to build realistic `Win`/`WinContext`
objects for the dora side), so the dedup gain is illusory.

### B — `hanOf(name: YakuName, ctx: WinContext): number` (mirrors `fuOf`)

Directly parallels `fuOf(ctx: WinContext)`. Pros: maximal structural
consistency with the sibling module. Cons: `WinContext` carries a full
`AgariDecomposition`, which han-per-name lookup never needs (fu needs the
reading to attribute wait-fu per set; han-by-name needs only openness) —
forces every caller (including tests) to run a real hand through
`decomposeAgari` just to look up a flat number. Worse, `WinContext` cannot
represent a yakuman win at all (yakuman evaluation is pre-reading, over
`Win`, per `yakuman.ts`), so a single `hanOf` covering `WinYakuName` cannot
take `WinContext` — this option would need two functions with different
context types, one of which (`WinContext`) is heavier than the fact it
answers.

### C — `hanOf(name: WinYakuName, melds: readonly Meld[]): number` — CHOSEN

Same openness fact as A, but expressed as the same shape `isMenzen` already
takes in both existing modules (`isMenzen(melds: readonly Meld[])`), not a
boolean the caller must compute out-of-band. Any caller holding a `Win` or
`WinContext` already has `.melds` sitting right there — `hanOf(name,
win.melds)` or `hanOf(name, ctx.melds)`, no intermediate step, no new fact to
derive. Test fixtures reuse the exact same `Meld` builders (`chi`, `pon`,
`ankan`, ...) already standard across `fu.test.ts`/`yaku.test.ts`. This is
option A's simplicity with option B's "reuse what's already on hand" idiom,
without B's `WinContext`/decomposition weight. Chosen.

## Options considered for dora counting

### A — `doraHanOf(kinds: readonly TileKind[], doraKinds: readonly TileKind[]): number`

Caller pre-flattens the hand into a kind multiset (reusing `yaku.ts`'s
`allKinds` shape or `yakuman.ts`'s `allKindsOf` shape) and passes it in raw.
Pros: simplest possible signature, zero type coupling. Cons: forces every
caller to duplicate the flattening walk a third time (it already exists
twice, privately, in `yaku.ts` and `yakuman.ts`) just to call this function;
the ticket's own test file would need it a fourth time. That is exactly the
kind of redundant-at-the-boundary duplication the codebase's "each module
owns its private helpers" convention is meant to avoid RE-DERIVING — the
convention duplicates small O(1) predicates like `isMenzen`, not O(n)
multiset walks.

### B — `doraHanOf(win: Win, doraKinds: readonly TileKind[]): number` — CHOSEN

Takes the same `Win` shape `yakuOf` already takes (`concealed` INCLUDING the
winning tile, `melds`). `han.ts` owns its own private flattening (a
duplication of `allKindsOf`, consistent with the `isMenzen`-duplication
precedent — small, obviously-correct, no external dependency), so the
caller's job shrinks to "hand me the `Win` you already built for `yakuOf`,
plus the dora list from `TableState.doras`." This is the natural fit for
-03's eventual call site (`record.ts`'s `applyWinTail` already assembles a
`Win`-shaped object for `yakuOf`) and for this ticket's test file (which
already needs `winOf`-style fixtures to prove the win-gate interaction, so no
extra fixture machinery is introduced by this choice).

### C — Fold dora into `hanOf` itself, e.g. a `'dora'` pseudo-name

Rejected outright: dora is explicitly NOT a yaku (ticket text: "Dora never
satisfies the one-yaku win gate by itself"), and `WinYakuName` is a closed
union of real yaku/yakuman names that `yakuOf` can return — a caller must
never be able to construct a `WinYakuName[]` that includes a dora pseudo-name
and feed it back through the win-gate check, or the gate silently breaks.
Keeping dora counting on a structurally separate function makes that
confusion a type error, not a runtime bug to test for.

## Yakuman han value

Every yakuman is priced as a flat single yakuman: **13 han**, independent of
openness (openness is not a yakuman-relevant fact — `chuuren-poutou` already
requires zero melds by its own predicate; the others don't reference
`melds`). Double-yakuman variants (13-wait kokushi, suuankou tanki, junsei
chuuren-poutou) are out of scope — `yakuman.ts`'s header comment defers their
naming to a future ticket, and until such names exist there is nothing extra
to price. `hanOf` for any `YakumanName` ignores its `melds` argument and
returns 13.

## The han table (values, closed / open where they differ)

Derived from the standard riichi rule table, independent of implementation,
per the codebase's "never reverse-engineered from a first run" testing
convention (to be pinned in `han.test.ts` from these same numbers, restated
independently there):

| name | closed | open | note |
|---|---|---|---|
| menzen-tsumo | 1 | — | closed-only by predicate; open value unused but table total |
| pinfu | 1 | — | closed-only by predicate |
| tanyao | 1 | 1 | kuitan allowed, no reduction |
| iipeikou | 1 | — | closed-only by predicate |
| yakuhai-haku/hatsu/chun | 1 | 1 | openness-independent |
| yakuhai-seat-wind | 1 | 1 | openness-independent |
| yakuhai-round-wind | 1 | 1 | openness-independent |
| sanshoku-doujun | 2 | 1 | drops open |
| sanshoku-doukou | 2 | 2 | openness-independent (triplet-based) |
| ittsuu | 2 | 1 | drops open |
| chanta | 2 | 1 | drops open |
| junchan | 3 | 2 | drops open |
| toitoi | 2 | 2 | openness-independent |
| sanankou | 2 | 2 | openness-independent (concealed by definition) |
| sankantsu | 2 | 2 | openness-independent |
| chiitoitsu | 2 | — | closed-only by predicate |
| honroutou | 2 | 2 | openness-independent |
| shousangen | 2 | 2 | openness-independent |
| honitsu | 3 | 2 | drops open |
| chinitsu | 6 | 5 | drops open |
| ryanpeikou | 3 | — | closed-only by predicate |
| haitei / houtei / rinshan / chankan | 1 | 1 | circumstance, openness-independent |
| every YakumanName (10) | 13 | 13 | flat single yakuman |

For rows marked closed-only-by-predicate, the "open" column is never
reachable through `standardYakuOf` (the predicate itself requires `melds`
empty), so the table stores the same value in both columns rather than an
unreachable sentinel — `hanOf` never needs to distinguish "impossible" from
"open value," and a defensive throw would test a codepath the yaku catalog
already makes unreachable (no new guard, no new failure mode to maintain).

## Rejected: exporting the raw table as data

Considered exporting `YAKU_HAN`/`YAKUMAN_HAN` directly (e.g. for a future
teaching-UI glossary showing "2 han closed / 1 open"), matching
`STANDARD_YAKU_NAMES` being public data. Rejected for now: the ticket asks
for a table that maps names → han, not a public data export, and
`yaku.ts`'s own precedent keeps its equivalent table (`STANDARD_YAKU`)
private behind a function. Nothing in this epic's remaining tickets
(T-008-01-03 payment tables, T-008-01-04 property grid) needs direct table
introspection — both consume `hanOf` per name. Adding a public data export
now would be speculative surface with no current caller; can be added
additively later if a UI ticket needs it.
