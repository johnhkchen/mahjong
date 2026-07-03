# T-005-01-04 — yakuman-and-yaku-gate — Review

Self-assessment and handoff: what changed, how it is covered, and what a
human (or the S-005-02 agents) should know before building on it.

## What changed

Two implementation commits on main, per plan.md:

| Commit | Content |
|---|---|
| `aeaeafe` | yakuman.ts — YakumanName catalog, Win, the ten predicates, yakuOf aggregator; barrel line |
| `535b626` | yakuman.test.ts — total per-yakuman table, gate/supersession/stacking, union, contract |

Files: `src/core/yakuman.ts` NEW (~280 lines, mostly contract comments),
`src/core/yakuman.test.ts` NEW (~270 lines), `src/core/index.ts` +1 barrel
line. Nothing else touched: yaku.ts, agari.ts, tiles.ts, record.ts consumed
read-only, exactly the "layered on top" shape yaku.ts's header promised.

## Acceptance criteria

- **"Each in-scope yakuman has positive and negative tests"** — met
  structurally: `CASES` is typed `Record<YakumanName, { positive, negative }>`
  (a missing entry is a compile error) and a meta-test pins table keys ≡
  frozen YAKUMAN_NAMES ≡ 10 distinct names disjoint from the standard
  catalog. Negatives are near-misses that STILL WIN (yakuOf throws on
  non-wins): the ron-demoted fourth triplet, shousangen against daisangen,
  the shousuushii/daisuushii boundary hand both ways, the lone 5s in the
  greens, the broken nine-gates count, the pon'd fourth kan.
- **"The aggregator returns an empty list for yakuless completions (the
  gate's refusal signal)"** — met; pinned by an exact-`[]` test on an open
  yakuless completion. Not-a-win is NOT `[]` — it throws RangeError, keeping
  the refusal signal unambiguous (see conventions).
- **"Suppresses standard yaku under a yakuman per a convention documented in
  the module"** — met; the convention (plus stacking and the union) is the
  module header's charter and yakuOf's doc, pinned by exact-list tests
  (`['suuankou']` alone on the suuankou tsumo; `['toitoi','sanankou']` after
  the ron demotion strips the yakuman).

## Shape of the API (for -02-01/-02, the next consumers)

`yakuOf(win: Win): WinYakuName[]` — `Win` is WinContext minus the
decomposition plus raw concealed kinds (including the completing tile); the
aggregator runs decomposeAgari itself and unions standardYakuOf across
readings. Also exported: `YakumanName`, frozen `YAKUMAN_NAMES`,
`WinYakuName = YakuName | YakumanName` (the type the fold should record).
Yakuman predicates stay private (the -03 rationale). RangeErrors: non-win
input, winningKind absent from concealed, decomposeAgari arity pass-through.

## Conventions fixed (each pinned by a test)

- One-yaku gate: `[]` ⇔ completes but carries no yaku; consumers must refuse
  the win. Non-completion throws — `isAgari` is the "is it a win" read.
- Yakuman supersede ALL standard yaku; multiple yakuman stack (all listed,
  YAKUMAN_NAMES order). Standard union is STANDARD_YAKU_NAMES order.
- Suuankou: all-ankan melds + all-triplet reading + (tsumo or tanki); a ron
  completing a triplet demotes it (no run-absorption case can exist).
- Shousuushii requires the fourth wind as the PAIR (count exactly 2);
  daisuushii is all four ≥3 — disjoint by construction.
- Tsuuiisou fires over the all-honor chiitoitsu form (daichiisei not
  distinguished — a valuation question).
- Ryuuiisou does NOT require hatsu (the common modern convention).
- Chuuren requires zero melds — an ankan breaks the form.
- Tenhou/chiihou and double-variant names (kokushi 13-wait, suuankou tanki,
  junsei chuuren) are OUT, documented in the header as extend-only widenings
  (the riichi-family precedent).

## Test coverage

361 tests green overall (`just test`), `just check` clean; this ticket adds
31 tests: 10×2 table cases + the catalog meta-test + gate `[]` + two
supersession exact-lists + the stacking exact-list + kokushi exact-list +
the cross-form union exact-list + purity + three RangeError cases. Expected
lists are derived in comments from the rules, never from module output.

**Gaps, deliberate:**
- No property suite — same no-oracle rationale as -03 (any "reference"
  restates the predicates); rigor comes from the total table + adversarial
  still-winning negatives + exact-list contracts.
- Fold-assembled Wins are untested here — no fold win path exists yet;
  T-005-02-01 is exactly that integration surface.
- No per-yakuman exact-list positives beyond the four convention tests —
  contains/not-contains is the table's job; exact lists would re-pin the
  standard catalog this suite doesn't own.

## Open concerns for human attention

1. **Union semantics are name-level, not score-level** (the one judgment
   call with scoring-epic consequences, mirroring -03's concern #1): a
   ryanpeikou-shaped hand lists both ryanpeikou AND chiitoitsu — correct as
   "every yaku some reading supports" and for the gate, but a scorer naively
   summing the list would overcount. The scoring epic must pick its best
   single reading via standardYakuOf per decomposition; documented on
   yakuOf. Worth confirming at E-005 scoring scoping.
2. **The winningKind-membership guard is kind-level only** — it catches
   caller desync but cannot verify the tile actually completed the hand
   (that's the fold's job when it assembles the Win from the action log).
3. **Yakuman valuation multiplicity is deferred**: kazoe/multiple-yakuman
   payout, double yakuman, and daisuushii-as-double are scoring-epic
   questions; the name list deliberately preserves the stacking facts they
   will need.
4. **Test-helper duplication**: h(), the meld builders (and chi's rank
   arithmetic) are copied from yaku.test.ts per structure.md — a shared
   test-util module is a refactor no ticket owns yet; worth one if a third
   suite needs them (T-005-02-01 likely will).

## Known limitations / TODO (none blocking)

- allKindsOf gives a kan four copies in the multiset scans — harmless
  (membership/≥3 questions only), same caveat as yaku.ts's allKinds.
- The YAKUMAN table's order is load-bearing for the yakuman result order
  (unlike yaku.ts there is no re-sort — the table IS catalog order); the
  stacking exact-list test pins it.
- `chi()` in yakuman.test.ts derives successor kinds by string arithmetic
  (valid for the 1m-start used); yaku.test.ts's `up()` was skipped as
  unneeded generality.
