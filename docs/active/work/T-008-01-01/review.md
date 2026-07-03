# T-008-01-01 — fu-calculation — Review

Handoff summary: what changed, test coverage, open concerns. All six RDSPI phases
(Research, Design, Structure, Plan, Implement, Review) completed in this pass.

## 1. What changed

| File | Change | Commit |
|---|---|---|
| `src/core/fu.ts` | NEW (243 lines) — `fuOf(ctx: WinContext): number`, sole export | `c0d2888` |
| `src/core/fu.test.ts` | NEW (240 lines) — 15 tests, 8 `describe` blocks | `c0d2888` |
| `src/core/index.ts` | +1 line, `export * from './fu'` | `ba50997` |

No existing file's behavior changed. `agari.ts`, `yaku.ts`, `yakuman.ts`,
`record.ts`, `tiles.ts` are read-only dependencies — `fu.ts` type-imports
`WinContext` from `yaku.ts` and value-imports tile predicates from `tiles.ts`,
mirroring the existing `yakuman.ts` → `yaku.ts` type-reuse precedent.
`docs/active/tickets/T-008-01-01.md` shows `phase: review` in the working tree —
that transition was made by the external RDSPI automation (Lisa) reading the
completed artifacts, not by this session; no ticket frontmatter was edited here,
per the task's explicit instruction.

## 2. What `fuOf` computes

One function over one `decomposeAgari` reading (the same "single reading in, one
fact out" contract `standardYakuOf` uses) — not han, not points, not an aggregate
over all of a hand's possible readings:

- Base 20; +10 menzen (closed hand, won by ron — ankan does not break this);
  +2 tsumo (suppressed for the pinfu-tsumo exception).
- Set fu: chi always 0; concealed runs always 0; concealed triplets 4/8 simple/
  honor (closed) unless ron-completed with no run able to absorb the tile, in
  which case 2/4 (open) — the same favorable-attribution convention `yaku.ts`'s
  `concealedTripletCount` already established, reapplied per-set for a fu rate
  instead of a han-relevant count; melds map directly (pon → open triplet,
  daiminkan/shouminkan → open kan 8/16, ankan → closed kan 16/32).
- Pair fu: unconditional +2 per matching fact (dragon, seat wind, round wind —
  additive, so a double-wind pair scores +4).
- Wait fu: +2 for tanki/kanchan/penchan, +0 for ryanmen/shanpon, resolved by
  enumerating every structurally valid attribution of the winning tile (pair,
  matching triplet, every run containing it) and taking the MAX — see §4.
- Named exceptions: pinfu-shape closed → fixed 20 (tsumo) / 30 (ron); pinfu-shape
  open (kuipinfu) → raw 20 bumped to 30 on ron (tsumo needs no exception, 22
  rounds to 30 unaided).
- Chiitoitsu → fixed 25, never rounded. Kokushi → throws `RangeError` (fu is
  inapplicable to a yakuman, which prices flat by han).
- Round-up-to-10 applied once, at the very end of the standard-form path.

## 3. Test coverage

15 tests, every AC bullet covered plus one design-driven addition:

1. Pinfu tsumo 20 / ron 30 — 2 tests.
2. Chiitoitsu fixed 25 (tsumo and ron) — 2 tests.
3. Open pinfu-shaped ron 30 (kuipinfu), plus its tsumo sibling to document that
   tsumo needs no special case — 2 tests.
4. Closed ron +10 menzen fu, contrasted directly against the same hand's tsumo
   total — 2 tests.
5. Triplet vs kan fu across all four open/closed combinations, same honor kind
   (1z) — 4 tests.
6. Round-up-to-10 (42 → 50) — 1 test.
7. Wait-attribution ambiguity resolving to the max fu (not the first-found or a
   "prefer run absorption" heuristic) — 1 test, with the naive alternative's
   wrong answer stated in the comment so the fixture is legible as a real
   regression guard, not an arbitrary number.
8. Kokushi throws — 1 test.

Every expected value is hand-derived in a comment against the standard fu table
(research.md §3) before the assertion. All 15 passed on the first run — no
fixture needed adjustment after seeing the module's actual output.

Full-suite results: `npm run test` — 592/592 passed (26 files, no regressions).
`npm run check` (svelte-check + tsc) — 0 errors, 0 warnings, 180 files.

**Coverage gap, by design, deferred to T-008-01-04**: no property/table test over
the full han×fu grid exists here — that is explicitly T-008-01-04's
(scoring-property-grid) job, which depends on this ticket plus T-008-01-03. This
ticket's suite is fixture-based per its own AC wording ("fixtures pinning the
classic traps"), matching `yaku.test.ts`'s house style.

## 4. The wait-attribution design decision (worth a second look)

The riskiest judgment call in this ticket: when one `AgariDecomposition` +
`winningKind` admits more than one structurally valid "which slot did the
winning tile fill" reading (e.g. a pair whose kind also anchors the low end of a
run), real scoring tools resolve this by taking the interpretation that yields
the MOST fu, not a fixed preference order. `fuOf` implements exactly this via
`attributionDelta` + `Math.max(...)` over every candidate. The test suite's
group-7 fixture is deliberately built so a "prefer run absorption" alternative
computes a genuinely different (and wrong) rounded total — 30 instead of 40 —
so this isn't a passively-untested design choice. Flagging for human review
anyway because it's inference beyond what any single test or doc in the repo
stated outright (this is standard-rules domain knowledge brought in from
outside the codebase, same as the fu table itself in research.md §3).

## 5. Open concerns / TODO for later tickets

- **No cross-reading fu maximization yet.** `fuOf` prices ONE reading, same as
  `standardYakuOf`. A hand with multiple valid `decomposeAgari` readings (e.g. a
  chiitoitsu-shaped hand that is also standard-form) needs a caller to compute
  fu (and han) per reading and pick the best-scoring combination — no ticket in
  S-008-01 names this aggregation explicitly yet. It will matter once
  T-008-01-03 wires a real settlement path; worth confirming it's in scope
  there or needs a new ticket.
- **`isTerminalOrHonor` collapses "terminal" and "honor" to one fu rate**,
  matching the standard table (both get the higher yaochuu rate) — correct per
  research.md §3, but worth a reviewer's explicit sign-off since it's easy to
  misremember as "honors only."
- **No integration test through `record.ts`'s fold** — `fuOf` is exercised only
  directly against hand-built `WinContext`s, never through a folded `TableState`.
  This matches the ticket's stated boundary ("pure `src/core/` module... no han,
  no points") and `yaku.ts`'s own test precedent, but a full fold→fu path is
  untested until a later ticket wires `fuOf` into `record.ts` or a settlement
  function.

## 6. Critical issues

None found. `just check` and `just test` are both clean; no DOM/Svelte import
was introduced; the public surface is exactly the one function design.md
specified.
