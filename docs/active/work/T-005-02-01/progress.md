# T-005-02-01 — tsumo-ron-actions-and-fold — Progress

## Completed

- **Step 1 — state plumbing** (commit 457a21b): `drawnFrom` and `win` fields
  on TableState with docs, `phase` widened with `'agari'`, drawnFrom set in
  the draw step ('wall') and applyKanTail ('rinshan'), nulled beside every
  `drawn = null` (both discard arms, ankan, shouminkan), initialized in
  foldRecord. record.test.ts's one full TableState literal updated. Suite +
  check green before any win behavior existed.
- **Step 2 — vocabulary and win steps** (commit 6c6272a): `tsumo`/`ron`
  HandAction members; CONTRACT FREEZE doc extended (win-form bullets, THE
  MULTIPLE-RON CONVENTION paragraph, chankan-unreachable note; the
  applyShouminkan chankan aside updated to match); `windKindOf`, `ROUND_WIND`
  ('1z', documented constant), `applyWinTail` (yakuOf call, non-completion
  re-wrap, one-yaku-gate throw, win/phase/window/turn writes), `applyTsumo`
  (guards: turn → mustDiscard → drawn), `applyRon` (playing arm against the
  window; houtei arm out of ryuukyoku against the turn-seat pond tail);
  applyAction ended-guard carve-out for ron-at-ryuukyoku, two dispatch cases,
  turn-cycle doc updated.
- **Step 3 — mining** (scratchpad + temporary repo scripts, deleted after
  use): stage 1 exploited that all-tsumogiri play never changes a seat's
  13-tile hand — waits computed once from the deal, opportunities read off
  the wall order without folding. Found and fold-verified: tsumo + ron
  (seed 3951, seat 3 pinfu tenpai from the deal), yakuless ron (seed 12754),
  houtei (seed 103897, final-discard pinfu+houtei). Stage 2 added ONE
  scripted tedashi to reach rarer shapes: haitei (seed 47821) and rinshan
  (seed 29732, dealt 9m triplet + fourth copy on own turn + ankan). Every
  fixture verified by folding before freezing.
- **Step 4 — win.test.ts** (commit 541edfc): 24 tests over the fixtures —
  ended-shape (tsumo/ron), conservation spot-checks, ten corruption throws
  (wrong seat, out-of-sequence, no window, stale window, own discard, tile
  mismatch, non-completing tsumo and ron, yakuless gate), multiple-ron
  convention, houtei ryuukyoku→agari arm + its guards + only-ron-crosses,
  haitei, rinshan (including drawnFrom plumbing assertions), replay
  determinism (fold twice, deep-equal, fresh win arrays) over all five win
  logs. `legalActions(agari state) === []` pinned.
- **Verification**: `just test` 385/385 across 16 files; `just check` 0
  errors; `just build` produces the self-contained dist/index.html.

## Deviations from plan

1. **dynamics.test.ts touched in step 2** (anticipated as a risk, surfaced
   as a certainty): its `countTypes` literal is typed
   `Record<HandAction['type'], number>` and its `withSeat` switch is
   return-exhaustive, so the union widening broke `just check`. Added
   tsumo/ron entries to both — behavior-neutral (random-legal logs never
   contain win actions until -02 offers them).
2. **Double-ron fixture: fallback taken.** Dealt tenpai runs ~1/10,000 per
   seat, so two seats sharing a live wait is out of organic mining range
   (probe: 20 dealt-tenpai seat-1 hands in 200k seeds). Per plan, the
   convention test uses the valid-ron-then-second-ron form: either ron guard
   fires or the ended guard does — the single-winner convention is exercised
   without a two-genuine-winners fixture.
3. **Mining scripts ran from the repo root** (`.mine-wins.ts` etc., via
   `npx tsx`) rather than the scratchpad, because the engine imports resolve
   relatively; they were never staged and are deleted.

## Remaining

Nothing — review.md is the last artifact.
