# T-006-03-03 — drive-seam-wiring — Design

## The decision in one paragraph

Widen `forcedAction` to `(state, offered, player)` and give it the policy
pair: bot own-turn points route to `discardPolicy(seatView(state, seat),
offered)` (replacing the tsumogiri arm — this also makes bots take tsumo),
and windows/houtei route to a new exported `settleWindow(state, offered,
player, chosen)` that implements the policy header's cross-seat arbitration
(consult `callPolicy` once per offer-holding bot seat, fold the earliest
non-draw answer in offered order, else the head draw, else null). The
player's window answer joins the same arbitration: `tapClaim`'s element and
`winChoice`'s element are passed to `settleWindow` as `chosen`, and the pass
is `settleWindow(..., null)` — replacing `passClaim`, which is deleted. The
wait condition (forcedAction null while the player holds a claim or win
offer) is unchanged, so the prompt's visibility predicate and the app's tap
surface survive as-is.

## Options considered

### A. Where the bot decision lives

1. **Extend forcedAction in place, signature `(state, offered, player)`**
   — CHOSEN. The seam already owns "the action that happens without player
   input"; the policies are exactly that. One loop in App.svelte keeps one
   driver call. The state parameter is sanctioned by doctrine: "the driver
   holds the state, the seat holds the view" (seatview.ts) — drive.ts IS the
   driver; it still never computes legality (it selects via core policies,
   which themselves only select).
2. A separate `botAction(state, offered)` beside a slimmed forcedAction —
   REJECTED: two functions whose null-conditions must stay complementary is
   the passClaim/forcedAction coupling this codebase already documents as a
   predicate family; splitting the bot arms out doubles the family for no
   consumer (App has exactly one loop).
3. Arbitration in core (a `tablePolicy(state) → action`) — REJECTED:
   policy.ts explicitly assigns cross-seat arbitration to the driver, and
   core taking TableState for bots would blur the fair-play boundary the
   SeatView type makes structural. The sweep keeps its own test-side copy by
   the same reasoning.

### B. How the player's answer meets the bots' (the mixed window)

1. **One arbitration, player's answer as one candidate** — CHOSEN. The
   player taps a claim/win (or passes); the driver folds the earliest-offered
   non-draw among {player's element, bot callPolicy answers}. Offered order
   IS precedence (legal.ts: rons in atamahane rotation, pons before chis), so
   a bot ron correctly overrides a player pon, a bot pon overrides a player
   chi, and the player declining his atamahane-earlier ron lets a later bot
   ron fire — all rules-faithful, all one rule. The prompt still always shows
   (the wait condition is unchanged); the player's tap simply may lose the
   window, exactly as at a real table.
2. Player-first (tap folds directly, pass consults bots) — REJECTED: lets a
   player chi steal a bot's pon/ron — a visible precedence violation the fold
   would accept but the rules don't; and it makes the player's pass the only
   path into bot claims, leaving two different windows semantics.
3. Pre-empt the prompt when a bot ron makes the player's answer moot —
   REJECTED: an optimization with new UX states for a rare case; option 1
   subsumes it correctly (the bot ron folds whatever the player answers).

### C. The pass — passClaim's fate

1. **Delete passClaim; the decline is `settleWindow(state, offered, player,
   null)`** — CHOSEN. passClaim's "return the head draw" is now WRONG
   whenever a bot holds a live claim (the decline must give bots the window
   before letting it go stale). Keeping it exported invites exactly that
   misuse; its complementarity doctrine transfers to settleWindow (non-null
   exactly where the old pass existed, plus the bot-window cases). The houtei
   dismissal (nothing to fold → null → `dismissed = true`) carries over: a
   player-only houtei settles to null; a mixed houtei settles to the bot ron.
2. Keep passClaim delegating to settleWindow — REJECTED: same behavior, one
   extra name whose old contract ("returns the head draw") is broken anyway;
   tests pinning that contract must be rewritten regardless.

### D. Bot draws

Keep the "head draw is forced" arm for windowless pre-draw states rather
than routing draws through discardPolicy — a draw is never a choice, for any
seat (the existing doctrine), and it saves a projection per tick. Equivalent
in outcome: discardPolicy's arm 3 returns the same element.

## The chosen shape

```
forcedAction(state, offered, player):
  1. empty offered            → null                          (halt)
  2. player holds claim/win   → null                          (the prompt owns it)
  3. any bot ron/claim offer  → settleWindow(state, offered, player, null)
                                (bot-only window or bot houtei: earliest
                                 accepted bot answer, else the head draw —
                                 the stale-window pass — else null)
  4. head is a draw           → head                          (any seat's)
  5. head is player's discard → null                          (the tap's)
  6. bot discard obligation   → discardPolicy(seatView(state, head.seat), offered)
                                (tsumo taken; else best discard — replaces
                                 tsumogiri; kan offers pass through unchosen)

settleWindow(state, offered, player, chosen):
  candidates = [chosen if non-null]
    + [callPolicy(seatView(state, seat), offered)
       for each seat ≠ player holding a ron/claim offer, consulted once]
      filtered to non-draw answers ("returned the draw" = that seat declined)
  → the candidate with the lowest offered index    (precedence by position)
  → else the head draw if the head is a draw       (everyone passed)
  → else null                                      (houtei, all declined —
                                                    the presentation dismissal)
```

Arm order matters: 3 precedes 4 because the old code FORCED the head draw
through bot-only windows (the auto-pass this ticket removes). Arm 2 precedes
3 so mixed windows wait for the player — his answer enters the same
settleWindow via the tap handlers. Wins for bots fall out with no new arms:
a bot ron/houtei ron is callPolicy's unconditional first arm (via 3); a bot
tsumo is discardPolicy's first arm (via 6).

App.svelte wiring: `claim()` folds `settleWindow(table, offered, PLAYER,
tapClaim(...))`; `takeWin()` folds `settleWindow(table, offered, PLAYER,
win)` (at the tsumo point no bot holds an offer, so the tsumo settles to
itself); `pass()` folds `settleWindow(table, offered, PLAYER, null)`, else
sets `dismissed`. The `$effect` calls `forcedAction(table, offered, PLAYER)`.
Pacing, prompt visibility, canPass — untouched. No difficulty anything.

## Invariants preserved

- Every returned action is an ELEMENT of `offered` (policies select; chosen
  is a tapClaim/winChoice result; the head is offered[0]) — the doctored-list
  teeth keep their bite, now including "a doctored-away bot offer is never
  folded".
- Determinism: same (state, offered) → same element; no RNG anywhere in the
  chain. The record stays the only authority; the fold never sees an
  unoffered action.
- The wait/prompt predicate family is untouched: forcedAction is null exactly
  where it was null before EXCEPT the bot-only-window and bot-houtei states,
  where it now returns the settled action instead of the auto-pass draw /
  halt — which is the ticket.
- Fair play: policies see only SeatView; drive projects per-seat views but
  passes state to nothing else.

## Rejected wholesale

- Any timer/pacing change (the AC pins the existing pace).
- Difficulty parameterization (the AC pins its absence).
- Routing the player's own decisions through the policies (East stays human —
  the ticket's title is the seam wiring, not an autoplay mode).
- Multi-ron vocabulary changes: at most one win folds; atamahane by offered
  order is already the recorder convention winChoice documents.
