# T-006-02-02 — chiitoi-kokushi-min-combinator — Plan

Ordered, independently verifiable implementation steps.

## Step 1 — `KOKUSHI_KIND_INDEXES` + `chiitoiShanten` + `kokushiShanten`

Add to `src/core/shanten.ts`, after `standardShanten`:

- Private `const KOKUSHI_KIND_INDEXES: readonly number[]` — the 13 literal
  indices, one-line comment (structure §2.2).
- Private `function chiitoiShanten(counts: readonly number[]): number` —
  single pass, `6 - pairs + Math.max(0, 7 - kinds)` (design §4.3).
- Private `function kokushiShanten(counts: readonly number[]): number` —
  single pass over the 13 indices, `13 - kinds - (hasPair ? 1 : 0)` (design
  §4.4).

**Verify**: `just check` passes (unused-private-function lint/tsc may warn —
acceptable transiently since Step 2 adds the caller in the same commit; if
`just check` fails on unused-symbol before `shanten` exists, do Steps 1-2 as
one commit instead of two). No test run yet meaningfully exercises these
directly (private, no export) — correctness checked by Step 3's fixtures.

## Step 2 — `shanten(concealed, melds)` combinator

Add the public function per design §4.5 / structure §2.5: call
`standardShanten` first (validates + computes standard term), short-circuit on
`melds.length > 0`, else build `counts` via the module's existing `countsOf`
and return `Math.min(standard, chiitoiShanten(counts), kokushiShanten(counts))`.
Doc comment per structure §2.5.

**Verify**: `just check` clean (no unused symbols now). No behavior yet
verified beyond compiling — Step 4 is where correctness gets pinned.

## Step 3 — Update the module header comment

Replace the "reserved for T-006-02-02" forward-reference (lines ~5-6 of the
current header) with a comment describing what `shanten` now does — the
min-of-three combinator, zero-meld gate on the special forms, delegation to
`standardShanten` for validation (structure §2.1). Keep everything else in the
header (KIND-level framing, block-count formula description) unchanged — it
still describes `standardShanten` accurately.

**Verify**: re-read the full header top-to-bottom; confirm no other sentence
in it still describes `shanten` as future work.

## Step 4 — Test fixtures: chiitoitsu and kokushi binding

Add `describe('shanten combinator', ...)` to `shanten.test.ts` (structure §4).
Write in this order, each `it` runnable/verifiable independently:

1. **Chiitoitsu binds**: `1122m3344p5566s7z` (13 tiles) — standard reads 3
   (already pinned in the existing standardShanten test, comment cross-refs
   it), chiitoi reads `6 - 6 + max(0, 7-7) = 0` → `shanten` must read 0. Also
   the 14-tile complete chiitoitsu hand from `agari.test.ts`'s fixture
   (`1122m3344p5566s7z` pattern won't complete at 14 without an 8th distinct
   kind — use a genuine 7-distinct-pairs 14-tile hand, e.g.
   `1122334455667m7p` reshaped to 7 pairs across suits) → standard reads far
   worse (no 4-sets+pair decomposition exists for scattered pairs), chiitoi
   reads −1 (7 pairs exactly) → `shanten` must read −1.
2. **Kokushi binds**: 13-kokushi-kinds-once (the `waits.test.ts`/
   `agari.test.ts` kokushi fixture pattern, all 13 terminal/honor kinds, no
   duplicate) — kokushi reads `13 - 13 - 0 = 0`, standard reads much worse (no
   sets, no pair anywhere since every kind count is 1) → `shanten` must read
   0. Plus the 14-tile complete kokushi hand (13 kinds + one doubled) — kokushi
   reads −1 → `shanten` must read −1.
3. **Standard wins**: reuse an existing `standardShanten`-0 or −1 fixture
   (e.g. the ryanmen tenpai `23m456p789s111z55z`) and assert
   `shanten(...) === standardShanten(...)` — proves the min doesn't always
   come from the special forms (AC's implicit requirement that `shanten` is a
   genuine min, not chiitoi/kokushi-always-wins).
4. **Meld gate**: any ≥1-meld fixture from the existing meld-discount block
   (e.g. `23m456p789s55z` with 1 meld) — assert `shanten(...) ===
   standardShanten(...)` exactly, confirming special forms are skipped.

**Verify**: `just test` — all four new assertions pass; run in isolation first
(`vitest run shanten -t "combinator"` or equivalent) to confirm they fail
before Step 1-2's code exists (red-green sanity, informal — code already
written by this point, so this is really about running the suite clean).

## Step 5 — Contract fixtures: error passthrough and purity

Add the `describe('contract', ...)` sub-block per structure §4:

1. Arity error: `shanten(h('123m'), [])` throws the SAME `RangeError` message
   `standardShanten` throws for the identical bad input (copy the exact
   expected message from the existing `standardShanten` contract test, prove
   passthrough not reimplementation).
2. Meld-count error: `shanten([], [...FAKE_MELDS, FAKE_MELDS[0]])` throws the
   5-meld RangeError, same message pattern.
3. Purity: same unmutated-inputs/repeat-call-identical pattern as
   `standardShanten`'s purity test, run through `shanten` instead.

**Verify**: `just test` green.

## Step 6 — Full suite + typecheck

Run `just test` (expect 20 tests → some N+ new tests, all files green, no
regressions to the existing 466) and `just check` (0 errors/warnings). This is
the ticket's completion gate — matches T-006-02-01's own closing step.

**Verify**: both commands exit clean; note final test count in progress.md.

## Testing strategy summary

- **Unit tests only** — no property/fast-check sweep (T-006-02-03's explicit
  job, same deferral T-006-02-01 made).
- Every new expected value is **rule-derived in a comment** (the house style):
  chiitoi/kokushi formula arithmetic spelled out inline, same discipline as
  `standardShanten`'s block-decomposition comments.
- Cross-checks against **independently pinned fixtures** in `waits.test.ts`
  and `agari.test.ts` wherever a hand shape overlaps (chiitoitsu/kokushi tenpai
  and complete-hand shapes already exist there) — not re-derived from this
  module's own output, per the established anti-circularity discipline.
- **No fixture asserts on `chiitoiShanten`/`kokushiShanten` directly** — they
  are private (design §4 rejected D); all coverage flows through `shanten`,
  chosen so at least one fixture per describe block makes the special form
  strictly the minimum (not just present).

## Commit plan

One commit, matching T-006-02-02's small scope (T-006-02-01's precedent
explicitly allowed folding multiple plan steps into one commit "when Steps 3-5
completed in a single sitting" — this ticket is smaller than that one end to
end). If `just check`/`just test` surface an issue requiring rework, that
becomes a second commit rather than amending.

## Risk notes

- The chiitoi/kokushi formulas are standard and low-risk relative to
  `bestValue`'s block-count derivation (which needed the property crown for
  full confidence, per T-006-02-01 review.md's open concern #1) — no
  comparable exactness risk is expected here, but Step 4's cross-checks against
  independently-pinned fixtures are the safety net until T-006-02-03 lands.
- Building a 7-distinct-pair 14-tile fixture and a 13-kokushi-plus-double
  14-tile fixture requires care with the `h()` mpsz-shorthand parser (structure
  §4 notes it's reused as-is) — verify tile counts by hand before trusting
  `just test` to catch a miscounted fixture (a wrong-arity fixture would throw
  RangeError, not silently mis-assert, so this is a low-risk mistake class).
