# T-008-01-03 — payment-tables-and-noten-bappu — Progress

## Deviation from plan.md's step split

plan.md sequenced six steps (scaffold → pricing/splits → noten-bappu →
dispatcher+tests → barrel export → verification pass) across three target
commits. In practice the whole module (types, constants, helpers, pricing,
splits, noten-bappu, and the public dispatcher) was authored as one coherent
pass — same rationale T-008-01-01's progress.md already recorded: the pieces
are mutually referential enough (the dispatcher needs every helper to exist to
be meaningfully verified at all) that an intermediate "helpers only, no
dispatcher" commit would have nothing to check beyond `tsc`. Collapsed plan.md's
Steps 1–4 into one commit (module + tests together, since the fixtures are what
actually verify the helpers), keeping Step 5 (barrel export) as its own commit,
per the sibling tickets' own established split. Step 6 (final verification)
folded into the barrel-export commit's verification — nothing surfaced to fix.

## Deviation from structure.md's function shape

structure.md sketched two separate functions for the base-points formula —
`yakumanBaseOf(han)` and `standardBaseOf(han, fu)` — to avoid an unused `fu`
parameter on the yakuman path. Implemented instead as one merged `baseOf(han,
fu)` covering every tier (han ≥13 flat-per-13, 11-12/8-10/6-7/5 fixed, else the
capped formula), called from both the yakuman branch (with `fu` argument `0`,
ignored at that tier) and the per-reading pricing loop. Two reasons: (1) it also
correctly handles "kazoe yakuman" — 13+ han reached through ordinary yaku plus
dora, with no actual yakuman predicate firing — which a `standardBaseOf`
hard-capped at the sanbaiman tier would have mispriced; a hand-picked test for
that exact edge case was not added (out of the AC's literal scope), but the
formula is correct for it by construction. (2) One function with one obvious
tier ladder was easier to keep correct than two functions whose boundary (who
owns han ≥13) would otherwise need to be enforced by caller discipline alone.

No other deviations from design.md or structure.md.

## What was done

- `src/core/settlement.ts` — new module, `settlementOf(state: TableState):
  SeatDeltas`, the sole exported function (plus the `SeatDeltas` tuple type).
  Re-derives `decomposeAgari` and prices every reading that carries its own
  yaku (dora-only readings filtered out), taking the maximum base-points
  reading — NOT `state.win.yaku`'s cross-reading union, which design.md's
  Rejected Option A showed can overcount. Yakuman wins skip reading selection
  entirely (yakuOf's supersession guarantees a homogeneous yaku list, priced
  flat by han alone). Ryuukyoku settlement computes per-seat tenpai via
  `shanten(...) === 0` and applies the fixed 3000-point noten-bappu split.
  `phase === 'playing'` throws `RangeError`.
- `src/core/settlement.test.ts` — new suite, 17 tests across 8 `describe`
  blocks: the AC's literal 30fu/4han fixture (7700 non-dealer ron / 11600
  dealer ron, with the kiriage-boundary contrast documented in the comment),
  tsumo splits (via the same hand's menzen-tsumo-boosted mangan variant), the
  mangan CAP as a fixture distinct from the mangan TIER (a genuine 4han40fu
  hand, raw 2560 capped to 2000), yakuman payment for both ron (tsuuiisou) and
  tsumo (ryuuiisou, a different hand chosen specifically to avoid an
  incidental suuankou stack), the reading-selection regression fixture (a
  honitsu+ryanpeikou/chiitoitsu-ambiguous hand proving the code returns 3000,
  not the union bug's 4000 or the chiitoitsu-only bug's 400), noten-bappu
  across all five tenpai counts (0/1/2/3/4), and the unended-phase guard.
  Every expected number is hand-derived in a comment against research.md §3's
  table before the assertion.
- `src/core/index.ts` — added `export * from './settlement'`, one line, at the
  file's tail (after `han`).

## Verification run

- `npx vitest run src/core/settlement.test.ts` — 17/17 passed on the second
  attempt: the first attempt had one failing fixture (the reading-selection
  test) due to a fixture-construction bug, not a module bug — see below.
- `npm run test` (full suite) — 659/659 passed, 28 files, no regressions.
- `npm run check` (svelte-check + tsc) — 0 errors, 0 warnings, 184 files (after
  fixing a `readonly TileKind[]` → `TileKind[]` assignability error in the test
  file's `doras` field, described below).
- Grepped `settlement.ts` for `svelte`/DOM imports and its export surface: zero
  DOM imports, exactly `SeatDeltas` and `settlementOf` exported.

## Fixture bug found and fixed during verification (not a module bug)

The reading-selection fixture's hand string (`'112233m445566m5z'`) was designed
so the pair-completing tile is the SECOND copy of `5z` (a tanki wait on the
pair) — but the test as first written set `winningKind: '6m'` instead of `'5z'`,
leaving the concealed hand with only one `5z` (no valid pair) and three copies
of `6m`. `settlementOf` correctly threw `yakuOf: the concealed tiles and melds
do not complete a win` for this malformed 14-tile multiset — the module behaved
correctly; the fixture was wrong. Fixed by setting `winningKind: '5z'`, matching
the intended tanki-wait design (fu recomputed in the comment: the wait-fu
contribution shifts from the run/ryanmen candidate to the pair/tanki candidate,
but both round to the same 40 fu, so the fixture's other numbers were already
correct). This is the one place a fixture number needed correction after
seeing a failure — not a case of reverse-engineering an expected value from
the module's output, since the FAILURE was a thrown "not a win" error, not a
wrong number, and the fix corrected the fixture's construction, not the
expected assertion.

The type error (`doras: opts.doras ?? []` assigning a `readonly TileKind[]` to
`TableState.doras: TileKind[]`) was fixed by spreading into a fresh mutable
array (`[...(opts.doras ?? [])]`) in both `ronState` and `tsumoState`.

## Remaining for later tickets (not this ticket's scope)

- **Kazoe yakuman is priced but not fixture-tested.** `baseOf`'s han ≥13
  branch prices a hypothetical 13+-han hand reached through ordinary yaku plus
  dora at the same flat tier as a declared yakuman, but no test drives that
  path (it would need a very dora-heavy fixture with no yakuman predicate
  firing) — worth a follow-up fixture if this ruleset ever needs to state
  its kazoe-yakuman stance explicitly rather than leave it as an implicit
  formula consequence.
- **No honba, no riichi sticks.** Neither exists in `TableState` yet (no
  match/round-rotation state, no riichi declaration in the action vocabulary),
  so this settlement prices exactly one hand's base payment. A future match/
  round epic will need to layer honba (300/seat on ron, 100/seat on tsumo,
  per honba counter) and riichi-stick carryover on top of `settlementOf`'s
  result, not inside it.
- **No integration test through a real `foldRecord`-produced `HandRecord`.**
  Every fixture is a hand-built `TableState`-shaped object, matching
  `settlementOf`'s real input type but skipping the wall/deal/action-log path
  entirely (constructing a seed that deals a specific han/fu hand is
  impractical). A future property or integration ticket could fold a real
  record ending in a chosen win and confirm `settlementOf` prices it, closing
  this gap end-to-end.
