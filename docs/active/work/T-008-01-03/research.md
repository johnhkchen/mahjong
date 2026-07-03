# T-008-01-03 — payment-tables-and-noten-bappu — Research

What exists, where, and how it connects. Descriptive only; the design phase decides.

## 1. The ticket

han/fu → points through the full payment table: dealer vs non-dealer, ron vs tsumo
splits, base-points formula with mangan/haneman/baiman/sanbaiman/yakuman limits and
standard 100-point rounding. Ryuukyoku settles noten-bappu: 3000 exchanged between
tenpai and noten seats (0/1/2/3-tenpai splits). One scoring entrypoint prices any
ended `TableState` into per-seat point deltas. `depends_on: [T-008-01-01,
T-008-01-02]` — both `done`, both consumed directly.

## 2. What already exists to build on

**`src/core/fu.ts`** — `fuOf(ctx: WinContext): number`, one `decomposeAgari` reading
in, a fu total out (20-110 for standard forms via `raw` then rounded up to 10; fixed
25 for chiitoitsu; throws for kokushi — "yakuman are priced flat by han alone, fu
does not apply"). Operates on exactly ONE reading — never picks "the best" among
`decomposeAgari`'s list. Its own review.md flagged this explicitly: *"No cross-
reading fu maximization yet... no ticket in S-008-01 names this aggregation
explicitly yet. It will matter once T-008-01-03 wires a real settlement path."*
This ticket is that path.

**`src/core/han.ts`** — two exports:
- `hanOf(name: WinYakuName, melds: readonly Meld[]): number` — table lookup, closed/
  open columns for standard yaku, flat 13 for every `YakumanName` regardless of
  openness. Pure per-name lookup; caller sums over however many names it has.
- `doraHanOf(win: Win, doraKinds: readonly TileKind[]): number` — whole-hand
  (concealed + meld tiles, full multiplicity) dora count against `TableState.doras`
  (dora + kan-dora already unified into one list), one han per matching tile per
  indicator (stacking). Reading-independent: dora counts the same regardless of
  which `AgariDecomposition` reading is chosen, since it is a flat multiset scan,
  not a decomposition-dependent yaku.

Neither module aggregates a hand's yaku list into one han total, and neither picks
a reading — both explicitly defer that to this ticket (han.ts's header: "assembling
name-han + dora-han into one number is the payment entrypoint's job (T-008-01-03)").

**`src/core/yakuman.ts`** — `yakuOf(win: Win): WinYakuName[]`, the aggregator every
`TableState.win.yaku` already stores (via `record.ts`'s `applyWinTail`). THE
SUPERSESSION RULE: if any yakuman predicate fires, the result is ONLY yakuman names
— never mixed with standard yaku. Otherwise the result is the UNION of
`standardYakuOf` across every `decomposeAgari` reading — "every yaku some reading
supports," explicitly NOT per-reading. This union is unsuitable for scoring
directly: two different readings can support mutually exclusive yaku (e.g. a
reading with pinfu vs. a different reading of the same tiles without it), so
summing `hanOf` over the union's names could price a han combination no single
valid decomposition actually produces. This ticket must re-run `decomposeAgari`
itself and evaluate `standardYakuOf` PER READING to price correctly — `state.win.
yaku` (the union) is informational/display-only, not a scoring input.

`YAKUMAN_NAMES: readonly YakumanName[]` is exported (frozen array, 10 names).
`YAKUMAN_HAN = 13` is private to han.ts, not re-exported — han.ts's `hanOf` already
returns 13 for every yakuman name via its own private `YAKUMAN_SET` membership
check, so this ticket calls `hanOf`, never re-derives the flat value.

**`src/core/agari.ts`** — `decomposeAgari(concealed, melds): AgariDecomposition[]`,
already the module this ticket must call again (not read through `state.win`,
which stores only the final yaku names, not the readings that produced them). A
hand may satisfy multiple forms (`standard`, `chiitoitsu`) simultaneously
(ryanpeikou shapes); `kokushi` is a separate form, always yakuman-gated by
`yakuman.ts`'s `kokushi` predicate, never scored via fu/han.

**`src/core/record.ts`** — `TableState` carries everything needed to rebuild a `Win`
object for a finished hand, but not the `Win` object itself:
- `hands: readonly [TileId[], TileId[], TileId[], TileId[]]` — at the moment a hand
  ends (tsumo or ron), the WINNER's hand is still the pre-completion 13−3·melds
  concealed tiles; the winning tile lives elsewhere (`drawn` for tsumo, the
  discarder's pond for ron) — exactly mirroring `applyWinTail`'s own assembly:
  `concealed: [...state.hands[winner].map(kindOf), kindOf(tile)]`.
- `melds: readonly [Meld[], Meld[], Meld[], Meld[]]` — winner's `melds[winner]` is
  the `Win.melds` field directly, no conversion.
- `doras: TileKind[]` — the flipped-indicator dora-kind list, directly `doraHanOf`'s
  second argument.
- `win`: `{by:'tsumo'|'ron', winner, tile, yaku} | {by:'ron', winner, from, tile,
  yaku} | null`. Carries `winner`, the winning `tile` (a `TileId`), and for ron the
  discarder (`from`) — but NOT `source`/`lastTile`/`seatWind`/`roundWind`, which
  `Win` requires. These must be reconstructed:
  - `source`: `by === 'tsumo'` → `state.drawnFrom` (verified below still holds the
    correct value after the fold ends); `by === 'ron'` → always `'discard'` (the
    fold's own header states chankan "stays fold-unreachable" — no `Win.source ===
    'chankan'` case can ever arise from a real `TableState`).
  - `lastTile`: `state.live.length === 0` — `applyWinTail` computes this from the
    exact same field at the exact same moment the fold ends, and nothing after
    winning mutates `live`, so reading it post-fold reproduces the original value.
  - `seatWind`: `` `${winner + 1}z` `` — `record.ts`'s private `windKindOf`,
    duplicated (the codebase's established per-module small-helper convention).
  - `roundWind`: `'1z'` — `record.ts`'s frozen `ROUND_WIND` constant (East only;
    the fold's own comment: "correct for every East-round hand," which is this
    engine's only round so far).

**Verifying `state.drawnFrom` survives to settlement time**: `applyTsumo` calls
`applyWinTail(state, index, 'tsumo', seat, state.drawn, state.drawnFrom!, null)` —
it reads `state.drawn`/`state.drawnFrom` as the `tile`/`source` ARGUMENTS but never
resets either field afterward. `applyWinTail` itself only ever writes `state.win`,
`state.phase`, `state.claimable`, `state.turn`. So after folding a tsumo-ending
record, `state.drawn` still holds the winning `TileId` and `state.drawnFrom` still
holds `'wall'` or `'rinshan'` — both readable long after the fold returns. Ron
never touches `drawn`/`drawnFrom` at all (the winner didn't just draw), so those
fields reflect whatever was true before the ron folded — irrelevant, since a ron's
`source` is always `'discard'` by construction, never read from `drawnFrom`.

**`src/core/shanten.ts`** — `shanten(concealed, melds): number`, 0 means tenpai.
Needed for ryuukyoku's noten-bappu: at the instant `phase` becomes `'ryuukyoku'`
(inside `applyAction`'s `discard` case, the same discard that empties `live`), every
seat's `mustDiscard`/`drawn` state is quiescent — no seat holds an undischarged
drawn tile (the discard that triggers ryuukyoku is itself the discard action
completing), so `state.hands[seat]` is each seat's ordinary 13−3·melds concealed
hand at that moment, feedable straight into `shanten(hands[seat].map(kindOf),
melds[seat]) === 0` for a tenpai check. (The one exception — a houtei ron folding
`ryuukyoku` into `'agari'` — bypasses noten-bappu entirely; see §4.)

**`src/core/deal.ts`** — `Seat = 0|1|2|3`, `SEAT_COUNT = 4`, seat 0 = East. No match/
round-rotation state exists anywhere in the engine (record.ts's own comment:
"Records are single hands — round rotation is match structure the engine does not
hold"), so "the dealer" is unconditionally seat 0 for as long as that remains true.

## 3. The published payment table (external domain knowledge)

Not derived from any file in the repo — standard Japanese riichi scoring, restated
here for Design to cite and `settlement.test.ts` to independently re-derive from
(never reverse-engineered from a first run, the `fu.test.ts`/`han.test.ts`
precedent).

**Base points**, from han + fu:
| Han | Base points |
|---|---|
| 1–4 | `fu × 2^(2+han)`, capped at 2000 |
| 5 | 2000 (mangan) |
| 6–7 | 3000 (haneman) |
| 8–10 | 4000 (baiman) |
| 11–12 | 6000 (sanbaiman) |
| ≥13 | 8000 × ⌊han / 13⌋ (yakuman; stacks by multiples of 13 for multiple
  simultaneous yakuman — han.ts's flat-13-per-name convention makes this the
  natural generalization, e.g. two yakuman held at once is han=26 → 16000) |

**THE KIRIAGE BOUNDARY** (ticket's explicit wording): the han 1–4 cap at 2000
already handles hands whose raw formula EXCEEDS 2000 (e.g. 4han40fu = 2560 → capped
to 2000, "mangan"). It does NOT round hands that land just BELOW 2000 up to a flat
mangan — 4han30fu = 1920 stays 1920 uncapped, and 3han60fu = 1920 likewise. Some
rule variants ("kiriage mangan") round both of those specific cases up to a flat
2000/8000 payout; standard (non-kiriage) rules do not. The ticket's own AC fixture
— "30fu/4han 7700 vs dealer 11600" — is the STANDARD (non-kiriage) result: 1920×4 =
7680 → round up to 7700; a kiriage-mangan table would instead give flat mangan
payouts (8000 non-dealer / 12000 dealer ron). This settles which convention Design
must choose (standard, not kiriage) directly from the AC text, not from outside
judgment.

**Payment split**, from base points + winner/loser seats (`roundUp100(x) =
⌈x/100⌉×100`):
| Win type | Dealer wins | Non-dealer wins |
|---|---|---|
| Ron | discarder pays `roundUp100(base×6)` | discarder pays `roundUp100(base×4)` |
| Tsumo | each of 3 non-dealers pays `roundUp100(base×2)` | dealer pays
  `roundUp100(base×2)`; each of 2 other non-dealers pays `roundUp100(base×1)` |

Every non-paying seat's delta is 0; the winner's delta is the sum of what is paid
in. Deltas always sum to zero (points move, none are created or destroyed).

**Noten-bappu** (ryuukyoku, exhaustive draw), total pot always 3000:
| Tenpai count | Each tenpai seat | Each noten seat |
|---|---|---|
| 0 or 4 | 0 | 0 |
| 1 | +3000 | −1000 |
| 2 | +1500 | −1500 |
| 3 | +1000 | −3000 |

## 4. Ended-`TableState` shapes settlement must handle

`TableState.phase` is `'playing' | 'ryuukyoku' | 'agari'`. Only the latter two are
"ended" (record.ts's own vocabulary). `'ryuukyoku'` is described as "PROVISIONALLY
ended" — a houtei ron can still fold it into `'agari'`. By the time a caller holds a
folded `TableState`, `phase` already reflects whichever ending actually happened
(there is no way to observe the transient pre-houtei-ron `'ryuukyoku'` state after
folding a record that contains a trailing ron action) — so settlement only ever
needs to branch on the FINAL `phase`: `'agari'` → win pricing; `'ryuukyoku'` →
noten-bappu; `'playing'` → not ended, caller corruption (matches the codebase's
"loud throw on domain-inapplicable input" convention, e.g. `fuOf`'s kokushi throw).

## 5. Testing conventions

`fu.test.ts`/`han.test.ts` both: (a) build hands through the REAL `decomposeAgari`/
`isAgari` (never hand-typed decomposition literals), (b) hand-derive every expected
number in a comment from an independently-stated table BEFORE the assertion, never
from the module's own first-run output, (c) reuse the `h()` mpsz-string sugar and
`chi`/`pon`/`daiminkan`/`shouminkan`/`ankan` meld builders, copied per file (no
shared test-utils module exists). A settlement test suite needs one more layer:
building a full `TableState` (or the minimal slice settlement reads) is heavier
than a bare `WinContext`/`Win` — Design must decide whether to hand-construct
`TableState`-shaped fixtures directly (matching the function's real input) or keep
testing at the `Win`-plus-tenpai-flags level and construct `TableState` objects
only where the discriminating detail (phase, winner seat) matters.

## 6. Module boundary and exports

New file `src/core/settlement.ts`, barrelled from `src/core/index.ts` (append one
line, matching the existing per-module pattern). No changes needed to `fu.ts`,
`han.ts`, `yaku.ts`, `yakuman.ts`, `agari.ts`, `shanten.ts`, or `record.ts` — this
ticket is a pure additional consumer, same tier as `fu.ts`/`han.ts` themselves (it
sits one layer above both, the way `yakuman.ts`'s aggregator sits one layer above
`yaku.ts`). `just check` and `just test` (`npm run check` / `npm run test` through
flox) are the verification commands; no DOM/Svelte import permitted in `src/core/`.
