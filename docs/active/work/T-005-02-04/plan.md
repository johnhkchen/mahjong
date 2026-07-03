# T-005-02-04 — win-conservation-determinism-suite — Plan

All work is in `src/core/dynamics.test.ts` plus scratchpad mining. Two commits.
Verification is `just test` (vitest) and `just check` (svelte-check + tsc) — the
new tests must be green AND the pre-existing suite must stay untouched-green.

## Step 0 — Carrier confirmation (scratchpad, no commit)

The research scan mined carriers [100, 277, 360, 626, 731, 834, 876, 950] from
seeds 0..999 under the win-eager policy (`pool = wins.length ? wins : legal`,
`nextInt` over the pool). Before freezing:

1. Write the FINAL `playWinEager` body in the scratchpad scan harness — exactly
   the code destined for the test file (same rng consumption, same filter).
2. Re-run over 0..999; record per-carrier end form (`win.by`), winner, tile, and
   yaku list (these feed the freeze comment and sanity-check test 3's claims).
3. Acceptance: both forms present among carriers. If the list differs from the
   research scan (it should not — same policy), the confirmation run wins and the
   discrepancy is noted in progress.md.

## Step 1 — Driver + corpus + anti-vacuity test (commit 1)

1. Header touch-up (lines 1–14): two trajectory sources become three.
   (Moved into commit 1 rather than 2 — the header should never contradict the
   file's contents at any commit.)
2. Insert `playWinEager` after `playGreedy`, doc comment per structure.md §2
   (mirror-image framing, termination argument, division of labor vs playGreedy).
3. Insert `WIN_CARRIER_SEEDS` + `winCorpus` after `greedyCorpus`, freeze comment
   per structure.md §3 (mining range 0..999, tsumo carriers named, never
   regenerate, loud-failure-then-re-mine remedy).
4. Add `describe('wins over random play')` after the mutations describe, with
   test 1: every carrier ends in agari with `win !== null`,
   `expectEndIdentities` per game, and both `'tsumo'` and `'ron'` appear among
   `win.by` values with a naming failure message per form.
5. Run: `just test` — expect green; confirm the new test actually executed
   (vitest reports the new describe). Commit:
   `T-005-02-04: win-eager carrier corpus — driven agari is now a pinned fact`.

Verification criteria: suite green; deliberately flipping one carrier seed to a
known-ryuukyoku seed (e.g. 0) makes test 1 fail with the agari assertion — do
this locally as a smoke check, revert before committing.

## Step 2 — Conservation, replay, quiescence tests (commit 2)

1. Test 2 (conservation): `expectConserved(record)` for each corpus game — 136
   distinct ids at every prefix through the ended state.
2. Test 3 (replay determinism): fold each record twice; assert `first.win` non-null,
   `second.win` toEqual `first.win`, and `second` toEqual `first` (whole state).
3. Test 4 (quiescence, two-sided): per game assert
   `legalActions(foldRecord(record))` `.toEqual([])`; then for each seat 0..3
   build the 9-form menu (draw, discard, chi, pon, daiminkan, ankan, shouminkan —
   the existing append-menu shapes — plus tsumo and `ron` on the game's own
   `win.tile`) and run `assertMutantThrows(seed, record.actions, form, [])`.
   Menu tiles/uses: fixed representative ids (the existing append test's approach,
   made deterministic: e.g. tile = the game's win tile, uses drawn from low ids),
   since with an empty offered set every form is out-of-set by construction and
   the fold's ended-phase guard must throw before any tile validation.
4. Run: `just test` and `just check`. Commit:
   `T-005-02-04: win conservation, replay, and quiescence over the carrier corpus`.

Verification criteria: suite green; runtime delta of dynamics.test.ts under ~1 s
(corpus load ~30 ms + O(n²) conservation walks over 8 games).

## Step 3 — Full verification pass (no commit unless fixes needed)

1. `just test` — full run, all files, timing noted.
2. `just check` — type-level cleanliness (the menu's tuple casts must satisfy
   `HandAction` without loosening: reuse the existing menu's literal style).
3. Re-read the AC against the shipped tests, clause by clause:
   - "nonzero share end in tsumo or ron" → test 1 (pinned carriers, both forms);
   - "conservation holds through the ended state" → test 2;
   - "replaying any log reproduces the same winner/tile/yaku" → test 3;
   - "legalActions is empty after every win" → test 4 (plus the fold side).

## Testing strategy summary

- No new unit-vs-integration split: this ticket IS tests. The property suite
  additions are deterministic corpus loops (pinned facts); no new fc properties
  are needed — the existing fc arbitraries already cover the randomized side, and
  their agari branches stop being potentially-vacuous once the corpus pins wins.
- Negative-space checks: the two smoke checks (flip a carrier seed; the menu's
  not-offered precondition inside assertMutantThrows) guard against a test that
  can never fail.

## Risks / contingencies

- Carrier list disagrees with confirmation run → freeze the confirmation run's
  list, note in progress.md (research scan becomes advisory).
- A carrier's game trips ACTION_BOUND or ends ryuukyoku → mining bug; re-scan
  with the final driver, do not hand-patch seeds.
- Menu form accidentally offered/foldable after agari (would fail
  assertMutantThrows's first expect) → that is a REAL engine finding; stop and
  surface it rather than adjusting the test.
