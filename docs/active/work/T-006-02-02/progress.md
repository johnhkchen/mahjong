# T-006-02-02 — chiitoi-kokushi-min-combinator — Progress

## Steps completed

1. ✅ `KOKUSHI_KIND_INDEXES` + `chiitoiShanten(counts)` + `kokushiShanten(counts)`
   added to `src/core/shanten.ts`, private helpers, after `standardShanten`.
2. ✅ `shanten(concealed, melds)` combinator added — delegates arity/meld
   validation to `standardShanten`, gates the two special forms on
   `melds.length === 0`, returns the min of all applicable terms.
3. ✅ Module header comment rewritten: the "reserved for T-006-02-02" forward
   reference replaced with a description of what `shanten` now does; the
   standard-form algorithm section unchanged, one clause appended noting the
   closed-form special-form scans and the zero-meld gate.
4. ✅ `describe('shanten combinator', ...)` added to `shanten.test.ts`:
   chiitoitsu-binds (2 fixtures), kokushi-binds (2 fixtures), standard-wins (1
   fixture), meld-gate (1 fixture), contract (RangeError passthrough +
   purity) — 8 `it` blocks total (11 assertions counting the paired
   standardShanten/shanten comparisons some its make).
5. ✅ `just test`: 20 files / 483 tests green (baseline was 19/466; the delta
   beyond this ticket's +17 shanten tests is a concurrent Lisa thread landing
   T-006-01-02 mid-session — confirmed via `git log`, not this ticket's work).
   `shanten.test.ts` in isolation: 29/29 (18 pre-existing + 11 new).
6. ✅ `just check`: 172 files, 0 errors, 0 warnings.

## Deviations from plan

None of substance. Plan §1 anticipated possibly needing to fold Steps 1-2 into
one commit if `just check` flagged unused-private-symbol before the combinator
existed — in practice both were written in the same edit pass before any
intermediate check ran, so this never became an issue. Plan's Step 4 fixture
list (chiitoitsu/kokushi tenpai + complete, standard-wins, meld-gate) was
implemented exactly as specified, reusing the exact hand shapes named in
research.md (cross-referenced from `waits.test.ts`/`agari.test.ts`) and the
exact pre-existing `1122m3344p5566s7z` / `23m456p789s55z` fixtures from this
module's own `standardShanten` tests.

One addition beyond the plan's letter: each new `it` in the "binds the
minimum" and "standard wins"/"meld gate" blocks asserts BOTH the
`standardShanten` value (as a documented baseline) AND the `shanten` value in
the same test, rather than only asserting `shanten`. This makes each test
self-certifying (the "worse via standard" half of the AC is asserted, not just
narrated in a comment) at the cost of one extra assertion per test — judged
worth it given the AC's explicit "scores lower via their own form than via
standard decomposition" wording.

## Commits

Not yet committed — held for the user's explicit request per the commit
protocol (only commit when asked). Working tree currently has the two source
edits plus the RDSPI artifacts for this ticket, matching T-006-02-01's
precedent of separating the code commit from the artifacts commit.

## What remains

Review phase only (this document is followed immediately by review.md, per
the RDSPI instruction to complete all phases in one continuous pass without
stopping).
