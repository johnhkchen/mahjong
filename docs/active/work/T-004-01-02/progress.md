# T-004-01-02 — kan-three-forms-rinshan-kandora — Progress

## Status: complete — all plan steps executed, all gates green

- Step 0 (baseline): `just test` 124 green, `just check` clean before any change.
- Step 1 (state growth): committed `6cf80cb` — Meld discriminated union,
  `doraIndicators`/`doras` plurals, foldRecord literal, test-literal updates.
- Step 2 (anchor scan): scratchpad scripts (scan.ts / scan2.ts / scan3.ts, never
  committed) located and cross-checked all anchors; results below.
- Steps 3+4 (kan step + positive suites + negative matrix): committed together
  (deviation D2 below) — three action members, `kansMade` /
  `guardRinshanAvailable` / `applyKanTail` / `firstDuplicate` helpers,
  `applyDaiminkan` / `applyAnkan` / `applyShouminkan`, three new describe
  blocks (32 new tests).
- Step 5 (acceptance sweep + artifacts): this commit. `just build` green,
  single-file verify OK.

## Anchor scan results (Step 2)

All facts derived from the frozen wall/deal contracts and cross-checked by
folding the constructed records at capture time; frozen as literals with
derivation comments in record.test.ts ("never regenerate").

- **Seed 67 (daiminkan + shouminkan):** East dealt the fourth 5s (91), North
  dealt the trio [90, 88, 89]. East tedashis 91 on turn one; North daiminkans
  (non-adjacent — seats 1 and 2 are skipped, visible in the untouched hands and
  live wall). The same geometry drives the shouminkan chain: pon with [90, 88]
  keeping 89, claim discard 87, one go-around, North draws live[4] = 14, adds
  89. dead = [135, 133, 50, 70, 81, 105, 108, 98, 43, 27, 67, 73, 64, 7].
- **Seed 161 (ankan, drawn among uses):** South dealt the 3z trio
  [118, 116, 119]; live[1] = 117 is South's own first draw.
- **Seed 280 (ankan, dealt quad):** North dealt all four 1m (0..3); draw 134
  (7z) survives the kan and is appended to the hand. Also the ryuukyoku-one-
  earlier anchor: full tsumogiri drive after the kan → 69 draws / 69 discards.
- **Seed 56 (two kans):** East's 3s trio [82, 83, 80] vs North's 81; South's 4m
  trio [14, 12, 15] vs West's 13. Two daiminkans in one hand pin the rinshan
  order (dead[0] = 0, then dead[1] = 127) and the indicator walk (43 → 94 → 31,
  original dead[4]/[6]/[8]).
- **Seed 101033 (four-kan chain):** four distinct-kind daiminkan geometries;
  the routed 30-action chain makes all four kans (all five indicators flipped),
  and a fifth kan attempt throws the rinshan-exhaustion guard at the correct
  index.

## Deviations from the plan

- **D1 — scan ran after the engine step, not before.** With the step already
  implemented, the scan scripts could validate whole kan-bearing records by
  folding, not just their pre-kan prefixes — a strictly stronger capture-time
  cross-check. Expectations in the committed tests remain wall/hand-derived per
  house rule.
- **D2 — plan commits 2 and 3 landed as one commit.** The positive suites and
  the negative matrix were authored in one pass against the finished step;
  splitting them after the fact would have been staging theater, not an
  independently verifiable step. Both plan gates (test + check) ran green
  before the commit.
- **D3 — unplanned touches: `legal.test.ts` and `dynamics.test.ts` `keyOf`
  helpers.** Structure.md declared both files untouched, but their membership
  serializers assumed every non-draw action carries `tile`, which `ankan`
  broke at the type level. Fixed by serializing on `'tile' in action` —
  draw/discard key formats are byte-identical, so no behavior changed (their
  suites still pass unmodified otherwise). Also one narrowing line in the
  existing chi pond-mark test (the Meld union has a claimless member now), and
  the seat-bump mutant in dynamics.test.ts now narrows on `'discard'` instead
  of `'draw'` — same generated vocabulary, type-safe against the wider union.

## Verification summary

- `just test`: 156 passing (124 baseline + 32 new: 6 kan-forms, 5 wall-
  accounting, 21 illegal-kan).
- `just check`: 0 errors, 0 warnings (svelte-check + tsc).
- `just build`: single self-contained dist/index.html, verify-single-file OK.
- Conservation asserted at EVERY prefix of seven kan-bearing anchors (including
  the 139-action full hand and the 30-action four-kan chain) over the widened
  six-zone partition.

Commits: `6cf80cb` (state growth), `6046cfa` (step + suites), plus this
artifacts commit.

## Handoff notes for dependent tickets

- **T-004-01-03 (legalActions offers):** kan availability facts live on the
  state: `claimable` (daiminkan candidates), `drawn !== null` at the turn seat
  (ankan/shouminkan candidates), `kansMade < 4` and `live.length > 0` (both
  module-local guards — the enumeration will need the same predicates; consider
  extracting them alongside `isRun` when you extract that). Ankan enumeration
  should offer the four copies of any kind fully held across hand+drawn;
  shouminkan any held-or-drawn tile whose kind matches an own pon.
- **T-004-01-04 (dynamics):** `allZonesWithMelds` is now module-level in
  record.test.ts — mirror or import-by-copy for the generated-play conservation
  property. The dead-wall-exhaustion mutation case has a worked example (seed
  101033 chain) to seed the generator's expectations.
- The rinshan tsumogiri discard of dead[0] in the seed-56 anchor is literally
  `tile: 0` — a reminder that tile id 0 is a real tile; avoid falsy checks on
  TileId anywhere downstream.
