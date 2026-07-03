# T-006-03-03 — drive-seam-wiring — Structure

## Files

| File | Change |
|---|---|
| `src/app/drive.ts` | MODIFIED — the whole ticket's production surface |
| `src/app/drive.test.ts` | MODIFIED — placeholder-behavior suites reworked to policy behavior |
| `src/app/App.svelte` | MODIFIED — new signatures wired through the tap handlers and the loop |
| (nothing else) | `src/core/**` untouched; `app.ssr.test.ts` untouched (imports only PLAYER/promptChoices/winChoice); no files created or deleted |

## `src/app/drive.ts` — internal organization after the change

Module header rewritten: the seam is no longer "input + the bot placeholder"
but "input + the policy pair" — drive still never computes legality (it
selects via core's policies, which select from `offered`), but it now HOLDS
THE STATE to project per-seat views (the seatview.ts driver doctrine, quoted).
The auto-pass/tsumogiri placeholder paragraphs go; the arbitration rule
(earliest non-draw answer in offered order = the rules' precedence, frozen by
legal.ts) arrives, with the T-006-03-02 review's warning made doctrine: a
callPolicy draw answer means THAT SEAT DECLINED, never "fold the draw now".

Imports widen to: `callPolicy`, `discardPolicy`, `seatView`, `kindOf`, types
`HandAction`, `Seat`, `TableState`, `TileId` — all from `'../core'` (barrel).

Declaration order (existing order preserved; changes marked):

1. `PLAYER` — unchanged.
2. `ClaimAction` type + `isClaim` — unchanged (also reused by the new
   bot-offer scan).
3. `ClaimChoice` interface — unchanged.
4. `claimChoices` — unchanged.
5. `promptChoices` — unchanged.
6. `usesEqual` — unchanged.
7. `tapClaim` — unchanged.
8. ~~`passClaim`~~ — DELETED (subsumed by settleWindow; rationale in design
   §C). Its complementarity doc-block migrates to settleWindow.
9. `winChoice` — unchanged code; one doc sentence updated ("placeholder bots
   never win" is no longer true — the recorder note about atamahane `find`
   order now describes live behavior via settleWindow).
10. NEW private `botSeatsHoldingOffers(offered, player): Seat[]` — the seats
    ≠ player holding a ron or claim offer, deduped, in first-offer order.
    (Name may shorten at implement time; one consumer each in forcedAction
    and settleWindow.)
11. NEW export `settleWindow(state: TableState, offered: readonly
    HandAction[], player: Seat, chosen: HandAction | null): HandAction | null`
    — the window/houtei settlement described in design.md: candidates =
    non-null `chosen` plus each bot seat's non-draw callPolicy answer;
    winner = lowest offered index (indexOf — identity, consistent with the
    element-of-offered contract); fallback = head draw if the head is a
    draw; else null. Doc-block carries: the precedence-by-position argument,
    the decline semantics, the houtei-null (presentation dismissal), and the
    complementarity family (App calls it exactly where forcedAction is null
    and the prompt is up, plus forcedAction's own bot-only-window arm).
12. `forcedAction(state: TableState, offered: readonly HandAction[],
    player: Seat): HandAction | null` — WIDENED signature (state first: the
    driver's authority, then the selection universe, then the seat — matches
    settleWindow). Arms per design.md: empty → null; player claim/win →
    null; bot ron/claim offers present → `settleWindow(state, offered,
    player, null)`; head draw → head; player discard obligation → null; bot
    discard obligation → `discardPolicy(seatView(state, head.seat),
    offered)`. The reverse tsumogiri scan and the fallthrough-halt paragraph
    are deleted with their arms.

Public interface after the change (the app's import list):
`PLAYER`, `ClaimChoice`, `claimChoices`, `promptChoices`, `tapClaim`,
`winChoice`, `tapDiscard`, `settleWindow`, `forcedAction`.
Removed: `passClaim`. Signature-changed: `forcedAction`.

## `src/app/App.svelte` — wiring deltas only

- `$effect`: `forcedAction(table, offered, PLAYER)` (table already a
  `$derived` in scope). Timer/pacing untouched.
- `claim(choice)`: `tapClaim` result non-null → push
  `settleWindow(table, offered, PLAYER, action)` result (non-null by
  construction there — chosen is a candidate and windows head with a draw;
  still guard for null like every handler).
- `pass()`: `settleWindow(table, offered, PLAYER, null)` non-null → push;
  null → `dismissed = true` (the houtei presentation decline, unchanged).
- `takeWin()`: `win` non-null → push `settleWindow(table, offered, PLAYER,
  win)` result. At the tsumo point no bot holds offers → settles to the
  tsumo itself; at windows a bot's atamahane-earlier ron may settle instead.
- Comment updates where the old text says "placeholder bots", "auto-pass",
  or names passClaim. No template, style, prompt-visibility, or `dismissed`
  changes beyond the handler bodies.

## `src/app/drive.test.ts` — suite-level reshaping

Header comment: rewritten for the new teeth (policy-driven bots; identity
and doctored lists still the spine). Anchors: all existing frozen anchors
stay (states are fold-derived, unaffected by drive changes); NEW frozen
expectations for what the policy DOES at the bot anchors are mined by
scratchpad scan at implement time and cross-checked in-test against the
policy functions themselves (the sweep's oracle style, e.g. `expect(forced)
.toBe(callPolicy(seatView(state, seat), offered))` plus a frozen literal).

- `claimChoices` / `promptChoices` / `tapClaim` / `tapDiscard` describes —
  UNCHANGED (selector semantics untouched).
- `winChoice` describe — UNCHANGED except the two tests that assert the LOOP
  behavior at bot windows ("the loop rolls past it") move their loop
  assertions into the forcedAction describe with new expectations.
- `passClaim` describe — DELETED; its complementarity property test is
  reborn as a settleWindow complementarity test over the same anchor list
  (exactly one of {forcedAction non-null, prompt-up settleWindow reachable,
  tap states, halt} per state).
- NEW `settleWindow` describe: pass-at-mixed-window (seed 5: North's chis
  consulted on East's decline — frozen outcome), player-claim-vs-bot-offer
  (seed 3: East's chi vs South's pon — settle picks the earlier offered iff
  South's policy accepts; frozen outcome), houtei-only-player → null (seed
  1038928), tsumo settles to itself (seed 542630), doctored list (a removed
  bot offer is never consulted/folded), identity containment for every
  non-null result.
- `forcedAction` describe — reworked: dealt/draw/wait/halt arms keep their
  tests (signature updated); "bot-only window auto-pass" becomes "bot-only
  window settles" (seed-1 `beforeSouthDraw` — frozen outcome of South's chi
  decision); "bot tsumogiri" becomes "bot policy discard" (afterSouthDraw —
  assert `toBe(discardPolicy(seatView(...), offered))` + frozen tile +
  shanten-minimality oracle); "never win" flips to "bot takes its tsumo"
  (seed 3951 turn 35) and "bot takes its ron" (botRonWindow); bot houtei
  halt (seed 147508) flips to "bot takes its houtei ron"; furiten/yakuless
  anchors keep asserting no ron is offered (core gates, unchanged).
- Full-hand walks — the "byte-identical to unclaimed play" walk is replaced
  by a policy-driven seed-1 walk: player declines every prompt and tsumogiris
  (taps `state.drawn`); every append `toContain`-ed; frozen end facts
  (phase, action count, bots' melds/win as mined); plus an assertion that
  S/W/N produced at least one non-tsumogiri discard or call across the walk
  (the "on their own" teeth). The playToWin walks stay (player wins still
  reachable through the seam) with `passClaim` swapped for settleWindow and
  re-mined trajectories if bot behavior perturbs them — likely for
  1038928/887141 (bots now interfere: mined at implement time; if a seed's
  geometry is destroyed by bot play, re-mine a fresh seed by the documented
  scratchpad method rather than force the old one).

## Ordering of changes

1. drive.ts rewrite (compiles alone — nothing imports settleWindow yet;
   forcedAction's new signature breaks drive.test.ts and App.svelte, so:)
2. same commit: App.svelte rewiring + drive.test.ts mechanical signature
   updates; behavior-level test rework in the same or immediately following
   commit(s) with the scratchpad-mined anchors.
3. `just test` + `just check` green gate the commit(s).
