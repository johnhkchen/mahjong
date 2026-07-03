# Review — T-008-01-02 han-values-and-dora-counting

## Summary

Added the han half of scoring as a new, standalone, pure `src/core/` module —
exactly the boundary T-008-01-01 established for `fu.ts`. No existing file's
behavior changed; `yaku.ts`/`yakuman.ts`'s name-only contract is untouched.

## Files changed

| File | Change | Lines |
|---|---|---|
| `src/core/han.ts` | new | +124 |
| `src/core/han.test.ts` | new | +234 |
| `src/core/index.ts` | +1 line (barrel export) | +1 |

Three commits: `21f3100` (module), `b69bc12` (barrel export), `cf6f5e1`
(tests). `yaku.ts`, `yakuman.ts`, `fu.ts`, `record.ts`, and every other
existing core module are byte-for-byte unchanged.

## What `han.ts` exports

- **`hanOf(name: WinYakuName, melds: readonly Meld[]): number`** — table
  lookup covering all 26 `YakuName`s (open/closed variants for
  sanshoku-doujun, ittsuu, chanta, junchan, honitsu, chinitsu; flat for
  everything else) and all 10 `YakumanName`s (flat 13, openness-irrelevant).
  Openness is derived from `melds` internally (the `isMenzen` duplication
  precedent already shared by `yaku.ts` and `fu.ts` — now three copies of the
  same four-line predicate; consistent with, not a new departure from, the
  codebase's existing style for this exact fact).
- **`doraHanOf(win: Win, doraKinds: readonly TileKind[]): number`** — sums,
  per flipped indicator (not per distinct kind), the count of that kind held
  across the whole hand (concealed tiles + meld tiles). Correctly stacks
  kan-dora (two indicators on the same kind price every matching tile
  twice) and correctly reads dora held inside open melds.

## Test coverage

50 new tests, all passing (`just test`: 642/642 total, up from 592):

- **`hanOf` table** — one test per `YakuName` (closed value) plus one per
  openness-varying name (open value), plus a totality check
  (`Object.keys(EXPECTED)` vs `STANDARD_YAKU_NAMES`, catching a name added to
  the union without a matching table row — though TypeScript's
  `Record<YakuName, ...>` already makes an incomplete `YAKU_HAN` a compile
  error in `han.ts` itself, so this is a second, independent check at the
  test-table level).
- **`hanOf` yakuman** — one test per `YakumanName`, both closed and open,
  asserting flat 13.
- **`doraHanOf`** — five hand-built `Win` fixtures: single copy, triplet
  (multi-copy), two-indicators-same-kind (kan-dora stacking), dora inside an
  open meld, and a zero case. All fixtures pass through the real `isAgari` —
  a miscounted fixture fails as "not a win," not silently.
- **Win-gate integration** — one test constructing a genuinely yakuless open
  ron (verified by hand against every catalog predicate — see the fixture's
  in-line comment for the per-yaku exclusion reasoning) and asserting
  `yakuOf(win)` is `[]` while `doraHanOf(win, ...)` is `> 0` for the same
  `win` — the AC's literal ask, proven against the real aggregator rather
  than a mock.

### Gaps / not covered here (by design, deferred to later tickets)

- No test exercises `hanOf`/`doraHanOf` together producing a total han for a
  real win — that aggregation (name-han sum + dora-han, fed into the payment
  formula alongside `fuOf`) is T-008-01-03's job, per both this ticket's AC
  and `fu.ts`'s established "aggregation is a later caller's" precedent.
- No property-based tests here — T-008-01-04 owns the property grid across
  the full scoring surface (han × fu × payment table, zero-sum settlement,
  fu invariants, dora-never-a-yaku as a property rather than an example).
  This ticket's suite is deliberately example-based, matching `fu.test.ts`'s
  precedent from T-008-01-01.
- No `TableState`/`record.ts` wiring — `han.ts` never reads
  `TableState.doras` directly; a caller (T-008-01-03) is expected to pass
  `state.doras` as `doraHanOf`'s second argument. This mirrors `fu.ts`,
  which also never touches `record.ts`.

## Open concerns for a human reviewer

1. **Han value table correctness is the highest-leverage thing to check by
   hand.** The 26-row `YAKU_HAN` table (and the six open-value rows that
   differ from closed) is transcribed from standard riichi rules in both
   `han.ts` and independently again in `han.test.ts` (the "second
   independent spelling" convention), but both spellings originate from the
   same author in the same session — an actual rules reference cross-check
   by a human (or a differently-sourced third spelling) would catch a
   systematic error neither spelling would catch on its own. The
   `design.md` table in this work directory documents the reasoning per row
   and is the fastest artifact to audit against a rules source.
2. **`isMenzen` is now defined identically in three files** (`yaku.ts`,
   `fu.ts`, `han.ts`). This is consistent with the codebase's established
   convention (confirmed in research — the codebase already had it twice
   before this ticket), not a new pattern introduced here, but three copies
   is a slightly stronger case for extraction than two. Left as-is,
   deliberately, per design.md's reasoning — flagging it here in case a
   future ticket decides the threshold has been crossed.
3. **`allKindsOf`/`countOf` are now defined in both `yakuman.ts` and
   `han.ts`**, same duplication story as `isMenzen`. Same call: consistent
   with precedent, flagged for awareness rather than treated as a defect.
4. No `just check`/`just test` failures remain; both are green at the time
   of this review. No TODOs or `FIXME`s were introduced.

## Ticket AC verification

- [x] Every name in the yaku catalog (incl. yakuman) has a han value with
  open/closed variants where standard rules differ, exported from core
  without changing `yaku.ts`'s name-only API contract (a new scoring-side
  table maps names → han) — `hanOf` in `src/core/han.ts`, barrel-exported,
  `yaku.ts` unmodified.
- [x] Dora/kan-dora counts add han per copy held — `doraHanOf`, tested
  against single-copy, multi-copy, and kan-dora-stacking cases.
- [x] A test proves a yakuless dora-laden hand still cannot win — the
  win-gate integration test in `han.test.ts`, exercising the real `yakuOf`.
