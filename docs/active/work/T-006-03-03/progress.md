# T-006-03-03 — drive-seam-wiring — Progress

## Step 1 — Baseline ✅

`just test` 22 files / 533 tests green; `just check` 0 errors.

## Step 2 — Anchor mining ✅

Probe: `src/app/probe.mine.test.ts` (temporary, deleted before commit).
Mined outcomes under the new driver (settle + policy semantics):

- **seed 1 `beforeSouthDraw`**: offered `[draw s1, chi s1 uses [98,106]]`;
  South's callPolicy DECLINES (returns the draw) → forcedAction = head draw.
- **seed 1 `afterSouthDraw`**: drawn 60; discardPolicy picks tile **120**
  (a tedashi — shanten 3 ties at {120, 91, 106, 79, 60}, 120 wins the
  center-distance tie-break).
- **seed 3 `raceWindow3`**: South's pon `[43,41]` ACCEPTED. settle(decline)
  = South's pon; settle(player chi A) = **South's pon** (pon offered before
  chi — precedence by position; the player's chi loses the window).
- **seed 5 `ponWindow5`**: North declines all four chi variants →
  settle(decline) = head draw (seat 3's).
- **seed 15 / seed 212 windows**: NO bot offers — pure player windows;
  settle(chosen) = chosen.
- **win anchors 887141 / 362857 / 1038928 windows**: no bot offers.
- **seed 3951 turn 1**: forcedAction = `{ron, seat 3, tile 72}` (bot ron).
- **seed 3951 turn 35 post-draw**: forcedAction = `{tsumo, seat 3}`.
- **seed 147508 houtei**: forcedAction = `{ron, seat 3, tile 43}`.
- **seed-1 full walk** (player declines every prompt, tsumogiris): ends
  **ryuukyoku after 144 actions**, 3 player declines, South melds two chis
  (claimed 20 from seat 0; claimed 18 from seat 0), win null, ponds
  [18,18,18,18].
- **playToWin re-mine** (player eager-win, tsumogiri, decline claims):
  - 542630 → player RON tile 71 `[pinfu]` from seat 3, 41 actions (was the
    tsumo geometry; bots now surface the wait earlier as a discard);
  - 887141 → player ron tile 31 `[pinfu, iipeikou]`, 31 actions (survives);
  - 362857 → player TSUMO tile 19 `[menzen-tsumo, yakuhai-chun]`, 56
    actions (was the ron-only geometry);
  - 1038928 → **seat 2 rons the player** (ittsuu, tile 17, 73 actions) —
    the houtei walk geometry is destroyed; repurposed as the bot-beats-
    player walk anchor; houtei coverage moves to state level over the
    still-valid `houteiEnd` fixed-prefix fold.

## Design deltas discovered while mining

- `settleWindow` fallback guard: the head draw is returned only when
  something was actually declinable (bot seats consulted, or the player
  holds a claim/win offer) — this preserves passClaim's old null-at-
  windowless-states defensiveness exactly, so App.pass() keeps identical
  behavior at every unreachable-defensive state.
- ankan/shouminkan are NOT claim types, so the bot-window scan
  (`ron | chi | pon | daiminkan`) correctly ignores own-turn kan offers;
  a bot post-draw tsumo reaches discardPolicy via the discard-obligation
  arm, not the window arm.

## Step 3 — drive.ts rewrite ✅ (see commit)
## Step 4 — App.svelte rewiring ✅ (see commit)
## Step 5 — drive.test.ts rework ✅ (see commit)

All three landed as one atomic commit `76191ab` (the signature change makes
them inseparable), after `just test` (22 files / 542 tests green — 533
baseline + 9 net new) and `just check` (0 errors).

Deviations from plan: none beyond the two design deltas above and the
1038928 repurposing (recorded in the mining list). No new seeds needed —
the surviving + repurposed geometries cover tsumo, ron, bot-ron, and
state-level houtei.

## Step 6 — Commit ✅

Single commit; only the three planned files staged (probe deleted; the
tree's pre-existing shanten/ticket modifications left untouched).

## Step 7 — Build sanity ✅

`just build` produces the single-file dist/index.html without errors.
