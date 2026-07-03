# T-006-02-02 — chiitoi-kokushi-min-combinator — Review

Self-assessment and handoff. What changed, how it is covered, what a human
reviewer should look at.

## 1. What changed

| File                        | Change   | Size                                          |
| ---------------------------- | -------- | ----------------------------------------------- |
| `src/core/shanten.ts`       | modified | +56 net lines (2 helpers, 1 combinator, header edit) |
| `src/core/shanten.test.ts`  | modified | +90 lines, 8 new `it`s in 5 new `describe` blocks |

No other files touched — no barrel edit needed (`src/core/index.ts` already
exports `./shanten` wholesale from T-006-02-01), no app-side changes, no
`agari.ts`/`waits.ts`/`record.ts`/`tiles.ts` edits. Not yet committed to git
(held per the commit protocol — only commit when the user asks).

**The new export**: `shanten(concealed: readonly TileKind[], melds: readonly
Meld[]): number` — `min(standardShanten, chiitoiShanten, kokushiShanten)`.
Delegates all arity/meld-count validation to `standardShanten` (same
`RangeError` messages, no duplicated checks). Chiitoitsu/kokushi are evaluated
only when `melds.length === 0` (both are zero-meld forms by rule); a melded
hand reads exactly `standardShanten`. Pure, deterministic.

**Two new private helpers**: `chiitoiShanten(counts)` —
`6 − pairs + max(0, 7 − kinds)`; `kokushiShanten(counts)` —
`13 − kinds − hasPair`. Both O(34)/O(13) linear scans over the counts array
the combinator builds once — no search, unlike `bestValue`. `standardShanten`
itself is unchanged (same signature, same body, same tests — all 18
pre-existing tests in `shanten.test.ts` still pass unmodified).

## 2. Acceptance-criteria check

- ✅ "`shanten(hand, melds)` returns `min(standard, chiitoi, kokushi)`" — the
  combinator's body is literally `Math.min(standard, chiitoiShanten(counts),
  kokushiShanten(counts))` when melds is empty.
- ✅ "tests show a seven-pairs hand ... scores lower via their own form than
  via standard decomposition" — `1122m3344p5566s77z`: `standardShanten` = 3,
  `shanten` = −1.
- ✅ "and a thirteen-orphans hand each score lower via their own form than via
  standard decomposition" — `119m19p19s1234567z`: `standardShanten` = 7,
  `shanten` = −1. (Also covered at the tenpai boundary: the 13-tile precursors
  of both hands, standard 3/8 vs. combinator 0/0.)

`just test`: 20 files / 483 tests green (`shanten.test.ts` alone: 29/29 — 18
pre-existing + 11 new assertions across 8 new `it`s). `just check`: 172 files,
0 errors, 0 warnings.

## 3. Test coverage assessment

Covered: both AC-named binding cases at both the tenpai (13-tile) and complete
(14-tile) boundary for each special form; a case where standard genuinely wins
the min (proving the combinator isn't chiitoi/kokushi-always-wins); the
zero-meld gate (a melded hand reads identically to `standardShanten`, proving
the special forms are skipped rather than degenerately computed and losing);
`RangeError` passthrough verified against the exact message text
`standardShanten`'s own contract test pins (proves delegation, not
reimplementation); purity/determinism. Every expected value is rule-derived in
a comment (the house style) — pairs/kinds counts spelled out arithmetically
for chiitoi, kokushi-kind-count/hasPair spelled out for kokushi — and four of
the eight new fixtures reuse hand shapes independently pinned elsewhere
(`waits.test.ts`'s chiitoitsu-tenpai and kokushi-13-sided fixtures,
`agari.test.ts`'s seven-pairs and kokushi-duplicate fixtures), continuing this
module's established anti-circularity discipline of not deriving expectations
from its own output.

**Gaps, known and scoped**:

- **No property sweep** — by ticket design, same deferral `standardShanten`
  itself made. T-006-02-03 (depends on this ticket) brings the brute-force
  reference and the `shanten === 0 ⟺ isTenpai` biconditional; until it lands,
  `shanten`'s exactness rests on the closed-form formulas (well-established,
  low derivation risk — see §4 below) plus this fixture set.
- **`chiitoiShanten`/`kokushiShanten` have no direct unit tests** — they are
  private (design's explicit decision, mirroring `bestValue`'s privacy under
  `standardShanten`); all coverage flows through `shanten`. Every fixture was
  chosen so the special form is either the strict minimum or, in the
  "standard wins" case, provably not — so both formulas' arithmetic is
  exercised, just not addressed by name.
- **Only one "standard wins" fixture** — a single ryanmen-tenpai hand
  confirming `shanten === standardShanten` when no special form is close.
  Sufficient to prove the min genuinely compares three terms rather than
  hard-coding a special-form preference, but a wider sweep of ordinary hands
  is what the property crown (T-006-02-03) will exercise anyway.
- **No fixture pins a hand where chiitoitsu and kokushi are BOTH closer than
  standard but disagree with each other** — structurally near-impossible
  (chiitoitsu wants duplicate-heavy hands, kokushi wants all-distinct-orphan
  hands; the two forms' winning shapes are close to disjoint), so this gap is
  judged not worth engineering an artificial fixture for.

## 4. Open concerns for a human reviewer

1. **The two closed-form formulas are asserted, not re-derived from first
   principles in this ticket's artifacts** (design §2.A calls them "the
   standard closed-form results," research §8 states them as external domain
   knowledge). They are the well-known formulas used by essentially every
   reference shanten calculator, and are lower-risk than `standardShanten`'s
   own block-count derivation (which needed T-006-02-01's design §2.A
   exactness argument precisely because it WAS novel to this codebase). If you
   review one thing, sanity-check the two formulas against the fixture
   comments' arithmetic — the eight new tests are the concrete evidence, not
   just the formula statement in the header/doc comments.
2. **The "standard wins" fixture count is thin (one)**. Judged acceptable
   because T-006-02-03's brute-force property sweep is the actual backstop for
   "shanten is exact across arbitrary hands," and duplicating that breadth
   here with hand-picked fixtures would be low-value busywork ahead of the
   oracle landing.
3. **Second `countsOf` pass inside `shanten`** (design §4.5): `shanten` calls
   `standardShanten` (which internally builds and mutates its own counts
   array inside `bestValue`'s recursion, not exposed) and then builds a SECOND
   counts array itself for the two special forms. This is a deliberate,
   documented tradeoff (an extra O(13)-tile linear pass, negligible) chosen
   over widening `standardShanten`'s signature to share an internal counts
   array — flagged here in case a future profiling pass disagrees.
4. **Third+ private `KOKUSHI_KIND_INDEXES` copy** (mirrors the `countsOf`
   triplication already on record from T-006-02-01's review): `agari.ts` has
   its own copy of the same 13-index array; this ticket adds a second,
   independently-declared copy in `shanten.ts` rather than exporting and
   reusing `agari.ts`'s (design §2.C — deliberate, same judgment call as the
   `countsOf` precedent). Both arrays are provably identical by construction
   (documented in each module's comment); a future ticket touching a third
   module that needs the same array is the natural point to reconsider
   promoting it into `tiles.ts`.

## 5. Deviations from plan

None of substance — see progress.md. One minor addition beyond the plan's
letter: several new tests assert both `standardShanten` and `shanten` values
in the same `it` (rather than only `shanten`), making each test
self-certifying against the AC's "scores lower … than via standard
decomposition" wording instead of relying on a comment to carry that half of
the claim.

## 6. Downstream handoff

- **T-006-02-03** (`brute-force-reference-property-tests`): build the
  exchange-distance reference test-side, independent of this module's
  algorithms (same independence requirement T-006-02-01's review.md stated for
  `standardShanten`, now extended to the combinator); verify
  `shanten === 0 ⟺ waits().length > 0` using this ticket's `shanten` export.
- **T-006-03-01** (`discard-policy`): consumes `shanten` (not
  `standardShanten`) to score candidate discards — the combinator is what
  "shanten-minimizing" should mean per this ticket's whole point.
- If a future ticket needs the chiitoitsu- or kokushi-specific shanten value
  directly (e.g. a teaching prompt "N away from chiitoitsu"), promoting
  `chiitoiShanten`/`kokushiShanten` from private to exported is a one-line,
  zero-risk change — no design cost was paid to keep that door closed.

TL;DR: two small closed-form helpers plus a delegating min-of-three
combinator, house-style module and fixture suite, all green (`just test`
20/483, `just check` 0/0), AC met with both named cases pinned at tenpai and
complete boundaries; exactness rests on well-established formulas plus
cross-checked fixtures, with the formal property backstop scheduled next
ticket exactly as this module's own precedent already established.
