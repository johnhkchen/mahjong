# T-005-01-03 — standard-yaku-catalog — Review

Self-assessment of the completed work. The handoff: what changed, how it is
covered, and what a human (or -04's agent) should know before building on it.

## What changed

Three implementation commits on main, per plan.md:

| Commit | Content |
|---|---|
| `dea35ca` | yaku.ts — WinContext, YakuName, frozen name list, guards, 15 scan-family predicates; barrel line; test helpers + their CASES rows |
| `45f8138` | yaku.ts — the 12 set-structure predicates; table complete at 27; their CASES rows |
| `78cba61` | yaku.test.ts — CASES tightened to the total Record, interaction and contract describes |

Files: `src/core/yaku.ts` NEW (593 lines, mostly contract comments),
`src/core/yaku.test.ts` NEW (459 lines), `src/core/index.ts` +1 barrel line.
Nothing else touched; agari.ts/record.ts/tiles.ts consumed read-only.

## Acceptance criteria

- **"Every catalog yaku has at least one positive and one negative test case"**
  — met STRUCTURALLY: the suite's `CASES` table is typed
  `Record<YakuName, { positive, negative }>`, so a missing case is a compile
  error, and a meta-test pins table keys ≡ STANDARD_YAKU_NAMES ≡ 27 distinct
  names. Negatives are near-misses (kanchan for pinfu, the ron-completed third
  triplet for sanankou, the honor set for junchan…), not unrelated hands.
- **"The module exports names only — no han/fu values anywhere in its API"** —
  met; no han/fu symbol exists anywhere in the FILE, not just the API. Exports:
  YakuName, WindKind, WinContext, STANDARD_YAKU_NAMES, standardYakuOf.

## Shape of the API (for -04, the next consumer)

`standardYakuOf(ctx: WinContext): YakuName[]` evaluates ONE decomposition;
aggregation across decomposeAgari's readings, the one-yaku gate, and
yakuman-supersedes are deliberately left to -04 (its ticket text owns them).
`source: 'wall' | 'rinshan' | 'discard' | 'chankan'` subsumes tsumo/ron and
makes rinshan-ron/chankan-tsumo unrepresentable. Kokushi contexts answer `[]`
(yakuman, not standard); corrupt arity throws RangeError.

## Conventions fixed (each pinned by a test)

- Kuitan allowed (open tanyao). Ankan keeps menzen; any meld kills pinfu.
- Ryanpeikou/iipeikou, chanta/junchan/honroutou, honitsu/chinitsu are DISJOINT
  predicate families — no aggregator cleanup needed for them.
- Sanankou/sankantsu are "at least three" (monotone; four is -04's yakuman and
  its gate suppresses standard yaku under yakuman anyway).
- Sanankou's ron adjustment uses favorable attribution: the winning tile joins
  an absorbing run when one exists, otherwise demotes the completed triplet.
- Haitei excludes the rinshan source (a rinshan win on an emptied wall is
  rinshan only). lastTile is only consulted for wall/discard sources.
- Wind yakuhai are two names; double-east fires both.
- Result order = STANDARD_YAKU_NAMES order, deterministic.

## Test coverage

330 tests green overall (`just test`), `just check` clean. This ticket adds ~79
assertions: 27×2 table cases + catalog meta-test + meld-builder sanity +
interaction tests (pinfu wait trio + both ryanmen ends + otakaze/seat-wind
pair, sanankou absorption both directions, family exclusivity, double-wind,
honroutou×chiitoitsu/toitoi, yakuless-open → `[]`, kokushi → `[]`) + contract
(exact five-yaku catalog-order list, purity, two guard throws). Fixtures are
built through the real decomposeAgari (typos fail as "not a win") with
ambiguous hands forced to `pick` their reading explicitly.

**Gaps, deliberate**: no property suite — there is no independent oracle for
"the yaku rules" short of restating the predicates (plan.md's tautology
argument); rigor comes from the total table + adversarial negatives instead.
Melds in fixtures are hand-built (not folded through real records) — fold-
assembled WinContexts are exactly T-005-02-01's integration surface.

## Open concerns for human attention

1. **Favorable-placement semantics** (flagging the one judgment call with
   scoring-epic consequences): pinfu fires if ANY run of the decomposition
   completes two-sidedly, even when the winning tile could also be read as the
   pair (tanki). For NAMES this is the correct union semantics; for FU the
   scoring epic must enumerate (decomposition × placement) itself rather than
   reuse these booleans. Documented at the predicate; worth confirming at -05
   scoping time.
2. **Chankan is in the catalog before any caller can produce it** — a design
   decision (closed catalog; record.ts promised chankan to this epic; the
   `source` value costs one line). Until T-005-02-01/-02 wire ron, the flag is
   exercised only by tests.
3. **Round wind is caller-supplied** (`roundWind: WindKind`) — the engine has
   no match structure; whoever assembles WinContext (the -02-01 fold, later a
   hanchan loop) owns supplying it. East-round default belongs THERE, not here.
4. **Riichi family absent by design** — YakuName widens extend-only when the
   riichi epic lands (riichi, ippatsu, double riichi, plus ura-dora as
   non-yaku). -04 should not treat YakuName's 27 as arithmetic-closed.
5. **Sibling concurrency note**: T-005-01-02 (waits) landed mid-flight; the
   only shared file was the barrel (append-only, no conflict). waits.ts and
   yaku.ts do not import each other.

## Known limitations / TODO (none blocking)

- `allKinds` gives a kan four copies in whole-hand scans — harmless today
  (membership questions only); if a future consumer counts copies, revisit.
- The private catalog table's order is load-bearing only through NAME_ORDER's
  sort (results are re-sorted to the frozen name order), so a table reorder
  cannot corrupt the contract; the exact-list contract test pins it.
