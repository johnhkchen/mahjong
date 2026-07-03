# T-005-02-02 — progress

## Done

- **Step 1 (mining)** — temporary `src/core/mine.test.ts` (deleted) probed the
  derivation stack over seeded tsumogiri records. Findings, frozen:
  - Seed 4851 turn 4: seat 0 discards live[4]=87 (4s); seat 1 rons it (pinfu,
    tanyao, sanshoku-doujun, not furiten), seat 2 has pon [86,84], seat 1 has
    chi [79,82] — the ron+pon+chi coexistence window.
  - Seed 23798: seat 1 waits 6p/9p, tsumogiris its own 6p (tile 58) at turn 9;
    at turn 20 seat 0 discards 70 (9p): completes with pinfu but FURITEN.
  - Seed 147508: non-furiten houtei — seat 3 rons the final discard 43 (2p),
    yaku [chiitoitsu, houtei]. (Scan: 3M seeds, cheap live[69] pre-filter.)
  - Seed 103897 (win.test.ts's houtei fixture): the winner seat 2 IS furiten
    (waits 1s/4s, own pond hit) — perfect houtei-arm divergence fixture.
  - Seed 3951 turn-0 window: ron seat 3 offered, NO claim offers coexist; seat
    3's pond has no wait kind before turn 35; no wait-kind discard by others
    exists after turn 35 (so the 3951 furiten window does not exist — 23798
    replaces it). All legal.test.ts anchors are win-free; seed-1 maximal
    ryuukyoku has no houtei winner (the 'ended' anchor literal stays 0).
- **Step 2 (legal.ts)** — win offers implemented per design D1–D6: header
  divergence paragraph, re-stated ROUND_WIND/windKindOf, winYaku single
  assembly point, discardFuriten, ronOffers (shared window/houtei), tsumoOffer;
  legalActions five state classes with rons after the draw and tsumo after the
  14 discards; docstring rewritten.
- **Step 3 (suite widening)** — legal.test.ts: pre-draw property admits rons
  (window tile, non-discarder, rons-before-claims), claim-order property strips
  leading rons, post-draw property admits one leading tsumo in the tail,
  ryuukyoku tests assert houtei-rons-only (usually empty). dynamics.test.ts:
  isWin helper; playGreedy filters win offers (stays the ryuukyoku call
  corpus); termination property branches agari/ryuukyoku; expectEndIdentities
  generalized (live-adjusted draw identity; tsumo leaves one discard
  obligation unmet). 385/385 green, check clean. Commit c183879.

## Deviations from plan

- Plan step 3 anticipated a possible red intermediate state; the suites stayed
  green after step 2 (random property seeds missed win windows), so steps 2+3
  landed as one commit to keep every commit green regardless of fc seed.
- The furiten fixture moved from seed 3951 (plan's guess — no such window
  exists under pure tsumogiri) to mined seed 23798.

- **Step 4 (legal.win.test.ts)** — 16 tests: tsumo anchors (wall + rinshan,
  exact post-discard index) and the offered ⇔ derivation-stack property; the
  frozen coexistence order literal (draw, ron, pon, chi at seed 4851); the
  furiten divergence pinned both ways (23798 playing arm, 103897 houtei arm);
  the one-yaku gate as agreement (12754); the positive houtei offer (147508);
  the two-sided win partition over eight anchors; purity sweep. Commit 5be697a.
- **Step 5 (verify)** — 401/401 tests × 5 consecutive runs (fresh fc seeds each
  run), svelte-check + tsc clean, `just build` self-contained single file OK.
  Suite duration unchanged (~2.4s) — the probe-first laziness held.

## Remaining

Nothing — review.md is the final artifact.
