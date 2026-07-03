# T-005-02-03 — win-prompt-and-hand-end-screen — Progress

## Step 0 — anchor mining ✅

Temporary probe (`src/core/mine.test.ts`, deleted after capture) scanned seeds
0..2,000,000 under all-tsumogiri, cross-checked against isAgari/waits/yakuOf only.
Seat-0 dealt tenpai runs ~1/8000 per seat (verified uniform across seats), hence
the wide range. Frozen anchors, verified against the fold and legalActions in a
second (also deleted) probe:

- **Tsumo — seed 542630**: seat 0 tenpai (pinfu, waits 6p/9p); first win event is
  seat 0's own turn-32 draw live[32] = 69 (9p). Post-draw offering = 14 discards +
  tsumo at index 14. Fold → win {tsumo, winner 0, tile 69, yaku [menzen-tsumo,
  pinfu]}, legalActions [] after.
- **Shanpon ron — seed 887141**: seat 0 tenpai (waits 5m/8m, TWO 8m copies); turn 3
  North tsumogiri live[3] = 31 (8m) → window offers draw(seat 0 — own-draw head!),
  ron seat 0, pon [30,28], 8 chi variants (2 shapes). Ron fold → win {ron, winner
  0, from 3, tile 31, yaku [pinfu, iipeikou]}.
- **Plain ron — seed 362857**: seat 0 tenpai (waits 5m, yakuhai-chun); turn 26 West
  tsumogiri live[26] = 19 (5m) → offering exactly [draw seat 3, ron seat 0]: the
  ron-ONLY window behind a bot draw — the auto-pass regression anchor.
- **Houtei — seed 1038928** (bonus, found): turn-69 South discard live[69] = 21
  (6m) completes seat 0's chiitoitsu; ryuukyoku offering exactly [ron seat 0].
  Fold → yaku [chiitoitsu, houtei].

Walk note honored in step 1: the seam walks tsumogiri the player's turns (tap the
DRAWN tile) — a tedashi would mutate the 13-tile hand and break first-event geometry.

## Step 1 — drive.ts + drive.test.ts ✅ (commit 4f25943)

`winChoice` (predicate + selector in one, at-most-one rationale + atamahane note +
FURITEN DIVERGENCE consumption documented); `forcedAction` wait guard → claims ∪
wins, docstring gains the houtei arms; `passClaim` guard widened (head-draw check
already scopes it to window rons); header: bots "never call, never win". 13 new
tests: winChoice identity/scoping/negatives/doctored, forcedAction regression
(verified RED against stashed old drive.ts, then green), passClaim win cases,
complementarity battery over 15 anchors with the widened pass predicate, three
eager-winner walks (tsumo 66 actions, shanpon ron 9, houtei 141) each asserting
identity containment, the win literal, and post-agari quiescence.
Deviation: none. One capture-comment correction: core's seed-147508 houtei winner
is seat 3 (my note said seat 2; the -02 suite's geometry comment was right).

## Step 2 — ClaimPrompt.svelte ✅ (commit 6147968)

`win`/`canPass`/`onwin` props, nullable `claimed` (header conditional), win button
first with `tsumo`/`ron <kind>` aria, pass behind canPass, `.win` emphasis style.
SSR: 3 new tests (tsumo button alone + no pass; ron-beside-pon order at the
shanpon window; houtei ron + pass). Deviation: claim-button aria now reads the
choice's own `tile` instead of the `claimed` prop (svelte-check caught the
nullable widening; the per-choice tile is the same fact, type-safely).

## Step 3 — App.svelte ✅ (commit 52bb595)

`win` derived, `takeWin`, `pass()` houtei-dismiss arm, mount condition
`(prompt.length > 0 || win !== null) && !dismissed`, `claimed` nullable pass-through,
`canPass={win?.type !== 'tsumo'}`. No new tests (boot seed deals no win; existing
no-prompt-at-boot test pins the quiet state); check + suite green.

## Step 4 — Table.svelte hand-end ✅ (commit 898c80a)

Center-panel agari block: winner wind + you-mark + form + ron discarder, labeled
winning-tile chip, labeled yaku list; `.win-summary`/`.yaku` styles. SSR: 5 new
tests (winner/you-mark, winning-tile region, every yaku name, no aria-current/no
ryuukyoku line, bot-ron reading without you-mark). Whitespace-collapsed sentence
assertions (SSR line wrapping is not the fact).

## Final sweep ✅

431/431 tests across 17 files; svelte-check + tsc 0 errors; `just build` →
self-contained dist/index.html 71.3 kB (verify-single-file OK).
