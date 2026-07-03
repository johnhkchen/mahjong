# Plan — T-008-01-02 han-values-and-dora-counting

Each step is independently committable and independently verifiable with
`just check` / `just test`. Steps 1–3 build the module bottom-up (openness →
han table/dispatch → dora counting); steps 4–5 wire the barrel and write
tests; step 6 is the full verification pass.

## Step 1 — Scaffold `src/core/han.ts` with openness + the han table/dispatch

- Write the module header comment (scope statement, per structure.md).
- Add `isMenzen(melds)` (duplicated from `yaku.ts`/`fu.ts` verbatim).
- Add the private `YAKU_HAN: Record<YakuName, {closed: number; open: number}>`
  table, all 26 `YakuName` entries, values from design.md's table. For
  closed-only-by-predicate names (`menzen-tsumo`, `pinfu`, `iipeikou`,
  `chiitoitsu`, `ryanpeikou`), set `open` equal to `closed` (design.md's
  "same value both columns" call — not a sentinel).
- Add `YAKUMAN_HAN = 13` and a `YAKUMAN_SET` built from the imported
  `YAKUMAN_NAMES`.
- Add `export function hanOf(name: WinYakuName, melds: readonly Meld[]):
  number` per structure.md's dispatch sketch.
- Verify: `just check` (typecheck only — no tests yet). Confirms the
  `YakuName`/`YakumanName`/`WinYakuName`/`Meld` imports resolve and the table
  is exhaustive (TypeScript's `Record<YakuName, ...>` requires every key —
  a missing entry is a compile error, catching an incomplete table for free).

## Step 2 — Add dora + kan-dora counting to the same file

- Add the private `allKindsOf(win: Win): TileKind[]` (duplicated from
  `yakuman.ts`).
- Add the private `countOf(kinds, kind)` helper (duplicated from
  `yakuman.ts`).
- Add `export function doraHanOf(win: Win, doraKinds: readonly TileKind[]):
  number` per structure.md.
- Verify: `just check`.
- Commit: "Add han.ts: name→han table and dora/kan-dora counting (T-008-01-02)"
  (mirrors T-008-01-01's first-commit phrasing).

## Step 3 — Barrel-export `han.ts`

- Add `export * from './han'` at the end of `src/core/index.ts`.
- Verify: `just check` (no conflicting export names — `hanOf`/`doraHanOf` are
  new identifiers, no collision with `fuOf`/`standardYakuOf`/`yakuOf`).
- Commit: "Barrel-export han.ts from src/core/index.ts (T-008-01-02)" (mirrors
  T-008-01-01's second-commit phrasing).

## Step 4 — Write `src/core/han.test.ts`

Build bottom-up, matching structure.md's eight sections:

1. Local test scaffolding: `h(spec)` mpsz parser, `Meld` builders (`chi`,
   `pon`, `daiminkan`, `shouminkan`, `ankan`) — copy verbatim from
   `yakuman.test.ts` (it already has all five builders; `fu.test.ts`/
   `yaku.test.ts` are missing `pon`... confirm which file has the fullest set
   before copying, to avoid missing a builder mid-write).
2. `hanOf` full-table test (section 1): the independently-spelled
   `{closed, open}` expected map (transcribed from design.md's table BY HAND
   in the test file, not imported/derived from `han.ts`'s own table — the
   "second independent spelling" rule), iterate `STANDARD_YAKU_NAMES`, assert
   closed always, assert open only for the six variable names
   (sanshoku-doujun, ittsuu, chanta, junchan, honitsu, chinitsu) using a
   trivial one-meld `melds` array (openness only depends on "any non-ankan
   meld present," so a single `chi` or `pon` suffices — doesn't need to be a
   realistic hand for THIS table-driven test, since `hanOf` never reads set
   contents, only `melds.every(m => m.type === 'ankan')`).
3. `hanOf` yakuman-flat-13 test (section 2): iterate `YAKUMAN_NAMES`, assert
   13 for both `[]` and a one-meld array.
4. `doraHanOf` sections 3–7: five small `Win`-fixture cases per structure.md,
   built through a local `winOf(spec, overrides)` helper mirroring
   `yakuman.test.ts`'s (real `decomposeAgari`/`isAgari`-checked fixtures, not
   hand-typed).
5. `doraHanOf`/`yakuOf` win-gate integration test (section 8): construct the
   yakuless-open-hand fixture, assert `yakuOf(win)` is `[]`, assert
   `doraHanOf(win, chosenDoraKinds)` is `> 0` for the same `win`. Comment
   states explicitly that this proves dora cannot cross the win gate on its
   own — the ticket AC's exact wording.
- Verify: `just test` — every new test green, no existing test regressed.

## Step 5 — Run full verification

- `just check` (svelte-check + tsc, confirms core stays DOM-free per the
  architecture invariant — `han.ts` imports only from `./tiles`, `./record`,
  `./yaku`, `./yakuman`, all already DOM-free).
- `just test` (full `vitest` run over `src/core/`, not just the new file —
  confirms no barrel-export collision broke another module's import).
- Read the final diff once (`git diff`) before committing the test file, to
  catch anything the plan didn't anticipate (e.g. a `YakuName` added to the
  union since research was written, which would make `YAKU_HAN` incomplete
  and fail step 1's typecheck anyway — belt and suspenders).
- Commit: "Add han.test.ts: yaku/yakuman han table and dora counting fixtures
  (T-008-01-02)".

## Testing strategy

- **Unit, table-driven**: `hanOf` against an independently-spelled table
  (both closed and open columns) — this is the AC's "every name... has a han
  value" requirement, made a single exhaustive test rather than 36 ad hoc
  assertions.
- **Unit, small fixtures**: `doraHanOf` against hand-built `Win` objects
  covering the single-copy, multi-copy, kan-dora-stacking, meld-tile, and
  zero cases — the AC's "add han per copy held."
- **Integration**: the win-gate proof, exercising the REAL `yakuOf` (not a
  stub) against a `Win` this module also prices with `doraHanOf` — the AC's
  "a test proves a yakuless dora-laden hand still cannot win."
- No property tests here — T-008-01-04 owns the property grid across the
  whole scoring surface (han × fu × payment table); this ticket's fixtures
  are deliberately example-based, matching `fu.test.ts`'s precedent.
- No `record.ts`/`TableState` wiring or tests — out of scope (T-008-01-03
  wires han/fu/dora into the payment entrypoint; this ticket stays a
  standalone pure module, same boundary `fu.ts` held in T-008-01-01).

## Risks / open questions carried into Implement

- Confirm `yakuman.test.ts` actually has every `Meld` builder needed (`chi`
  included) before assuming "copy verbatim" — verify at write time.
- Confirm `yakuOf`'s exact behavior on a genuinely yakuless completion (does
  it return `[]` or throw?) by reading its body once more at implementation
  time rather than trusting research's recollection — the gate's throw lives
  in `record.ts`'s `applyWinTail`, not in `yakuOf` itself, per research, but
  this must be re-confirmed against the actual source before the test
  asserts a specific return shape.
