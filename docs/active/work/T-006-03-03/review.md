# T-006-03-03 — drive-seam-wiring — Review

## What changed

One commit (`76191ab`), three files modified, nothing created or deleted;
`src/core/**` untouched.

- **`src/app/drive.ts`** — the ticket. `forcedAction` widened to
  `(state, offered, player)` and given the policy pair: bot discard
  obligations route to `discardPolicy(seatView(state, seat), offered)`
  (replacing the tsumogiri arm — bots now tedashi and take their tsumo),
  and any state holding ron/claim offers for bot seats settles through the
  new export `settleWindow(state, offered, player, chosen)` (replacing the
  auto-pass — bots now claim, ron, and take houtei rons). `passClaim` is
  DELETED, subsumed by `settleWindow(..., null)`; new private helper
  `botSeatsHoldingOffers`. The module header and doc-blocks were rewritten
  for the new doctrine: the driver holds the state solely to project
  per-seat views; legality still comes from nowhere but the offered list.
- **`src/app/App.svelte`** — `$effect` passes `table` to forcedAction;
  `claim`/`pass`/`takeWin` all fold through `settleWindow` (the player's
  answer is one candidate in the arbitration); the houtei dismissal
  (`dismissed = true` when nothing settles) is unchanged. No pacing,
  template, or prompt-visibility changes; no difficulty anything.
- **`src/app/drive.test.ts`** — selector suites (claimChoices,
  promptChoices, tapClaim, tapDiscard, winChoice) essentially untouched;
  the passClaim suite reborn as a settleWindow suite; the forcedAction
  suite's placeholder tests flipped to policy behavior; both walks
  rebuilt (details below).

## The behavior, in three sentences

Seats S/W/N now play autonomously through the same seam the player taps:
their own turns go to discardPolicy (tsumo taken, else the
shanten-minimizing discard) and their windows to callPolicy, with
cross-seat arbitration by offered position — which legal.ts froze as the
rules' precedence (rons in atamahane rotation, then pons, daiminkans,
chis). The player's window answer joins that same arbitration, so a tapped
chi loses to a bot's accepted pon and any claim loses to a bot's ron,
exactly as at a real table; his decline consults the bots before letting
the window go stale. Everything folded is still an element of legalActions
output, selected — never constructed — so the record remains the only
authority and the wiring is deterministic end to end.

## Test coverage

- 542 tests / 22 files green (`just test`), `just check` clean 0 errors,
  `just build` produces the self-contained single file. 533 → 542 tests.
- **Every AC clause is pinned**: routing (forcedAction identity with
  `discardPolicy`/`callPolicy` answers over fresh seatView projections);
  tsumogiri arm gone (seed-1 South discards hand tile 120, not drawn 60,
  with a shanten-minimality oracle); auto-pass gone (bot-only window
  settles via a consulted decline; seed-3 South's pon accepted); S/W/N
  **drawing/discarding/calling** (seed-1 full walk: ryuukyoku at 144
  actions, South folding two chis with no player input, ≥1 bot tedashi)
  and **winning** (bot window ron seed 3951, bot tsumo seed 3951 t35, bot
  houtei ron seed 147508 folded into agari, and a whole-walk bot ron off
  the player, seed 1038928).
- **Double-keying**: every bot expectation pairs a frozen mined literal
  with an independent oracle (the policy's own answer by reference, or
  shanten re-derivation) — a wrong mine cannot freeze a wrong behavior.
- **Identity/doctored teeth extended**: a doctored-away bot offer is never
  consulted (the accept comes from nowhere but the list), and a
  shape-equal lookalike `chosen` is ignored — only offered elements settle.
- **Complementarity survives**: the prompt-up ⇒ loop-waits property and
  the tap/halt classification are re-pinned over the full anchor list.

### Coverage gaps (known, deliberate)

- **No walk exercises the player WINNING a mixed window against a bot's
  competing offer** (his atamahane-earlier ron vs a bot's later one) — no
  mined anchor holds that geometry; the arbitration rule is pinned at unit
  level (chi-loses-to-pon both as decline and as tap) and the atamahane
  index rule is positional, but a two-ron window fixture would sharpen it.
- **The seed-1 walk's player is a tsumogiri player** (keeps his 13 tiles
  frozen for mining); tedashi player choices are exercised by the seed-15
  claim test and the old tapDiscard suite, not by a full walk.
- **App.svelte's handlers are not directly tested** (no component test
  harness exists in this repo; the SSR test covers render only). The
  handlers are one-liners over the tested seam, per the established
  pattern.

## Open concerns for a human reviewer

1. **UX shift, intended**: the player's tapped claim can now visibly lose
   the window to a bot's ron/pon (rules-faithful precedence; design.md §B).
   The prompt still always shows; the fold that lands may not be his. If
   playtesting finds this confusing, the fix is presentation (an
   "overridden by ron" flash), not seam logic.
2. **Three of four playToWin trajectories re-mined**: policy bots
   destroyed the old all-tsumogiri geometries (542630 tsumo→ron, 362857
   ron→tsumo, 1038928 houtei→bot-ron-repurposed; houtei is now pinned at
   state level over the still-valid fixed-prefix fold). The window/win
   STATE anchors themselves are unchanged — folds are driver-independent.
3. **forcedAction consults callPolicy up to twice per bot window tick**
   (once inside forcedAction's settle, and App may settle again on the
   player's tap) — pure functions on small inputs, trivial cost beside the
   per-append refold; noted in case profiling ever looks here.
4. **The 250 ms tick now carries policy work** (≤ 4 projections + ≤ 14
   shanten calls) — measured well under a millisecond in tests; "existing
   pace" holds.
5. **T-006-03-04 dependency satisfied as rehearsed**: the wiring matches
   the sweep's reference arbitration exactly (per-seat consult, non-draw
   answers by offered index, draw-as-decline), so the determinism harness
   should replay byte-identically over this driver.

## Follow-ups already ticketed / future

- T-006-03-04: AI-vs-AI determinism/termination across all four seats.
- Strength/difficulty tickets: own-turn kan selection, richer yaku
  anchors, ukeire tie-breaks — all extend-only behind the same seam; a
  difficulty selector, when it exists, chooses policies, not drive logic.
- Multi-ron presentation (double-ron is out of vocabulary; atamahane by
  offered order is the standing convention).
