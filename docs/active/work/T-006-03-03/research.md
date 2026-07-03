# T-006-03-03 — drive-seam-wiring — Research

## The ticket in one sentence

Route non-PLAYER seat decisions in `src/app/drive.ts` to the policy pair
(`discardPolicy`/`callPolicy`, landed by T-006-03-01/-02) instead of the
tsumogiri placeholder and the claim/win auto-pass, so seats S/W/N (1, 2, 3)
draw, discard, call, and win autonomously while East (seat 0) stays human.

## What exists

### The drive seam — `src/app/drive.ts` (222 lines)

The seam between input and the authoritative record. Doctrine (module header):
every function takes `legalActions` output and returns an ELEMENT of it or
null; nothing computes legality, reads hands, or counts the wall. Exports:

- `PLAYER: Seat = 0` — the human's seat, East.
- `claimChoices(offered, player)` — the player's claim offers (chi/pon/
  daiminkan), elements of `offered`, frozen order preserved. The shared wait
  predicate: forcedAction's guard, passClaim's guard, the prompt's list.
- `promptChoices(offered, player)` — claimChoices deduped by (form, uses
  kinds) for presentation; empty exactly when claimChoices is empty.
- `tapClaim(offered, player, choice)` — the offered element matching a
  button's `(type, uses)` payload, ordered match, or null.
- `passClaim(offered, player)` — the head draw when the player holds a claim
  or win offer to decline AND the head is a draw; null otherwise. Documented
  as complementary to forcedAction: exactly one driver applies per state.
- `winChoice(offered, player)` — the player's one win offer (tsumo/ron/houtei
  ron) or null; at most one exists per state by the enumeration's shape.
- `tapDiscard(offered, player, tile)` — the offered discard of `tile` by
  `player`, or null.
- `forcedAction(offered, player)` — THE TICKET'S SUBJECT. Current arms:
  1. empty offering → null (halt);
  2. player holds a claim OR win offer → null (wait — the prompt owns it);
  3. head is a draw → forced (this is the bot AUTO-PASS: bot-only windows
     go stale because the head draw is taken over the bot's claim/ron);
  4. head is the player's discard obligation → null (the tap's choice);
  5. otherwise reverse-scan for the last offered discard → forced (this is
     the bot TSUMOGIRI arm: the last discard is the drawn tile by legal.ts's
     hand-order-then-drawn-last contract; the reverse scan deliberately steps
     over bot tsumo and kan offers — placeholder bots never win, never kan);
  6. fallthrough (bot-only houtei: rons only, none the player's) → null (the
     bots pass their houtei rons; the hand rests at ryuukyoku).

Signature is `(offered, player)` — no TableState anywhere in the module. The
placeholder arms to replace are 3 (auto-pass, when the window is bot-only),
5 (tsumogiri), and 6 (bot houtei pass).

### The policy pair — `src/core/policy.ts` (285 lines, T-006-03-01/-02)

Both typed against `SeatView` (the fair-play projection, seatview.ts), both
pure selection: `(view, offered) → an ELEMENT of offered`, deterministic,
no RNG, throw RangeError when consulted where they do not govern.

- `discardPolicy(view, offered)` — OWN-TURN points only: takes an offered
  tsumo unconditionally; else the shanten-minimizing discard (tie-break:
  farthest from center rank, then earliest offered); else the seat's offered
  draw. Own-turn ankan/shouminkan offers pass through unchosen (a strength
  ticket's call). Handles both discard-obligation classes (post-draw 14 and
  the claim discard) — the candidate pool is hand ∪ drawn either way.
- `callPolicy(view, offered)` — claim windows and houtei, ONE seat: takes an
  offered ron unconditionally; accepts the first offered claim that strictly
  cuts shanten AND keeps a yaku anchor (yakuhai or kuitan); else returns the
  offered draw — the pass ("folding it lets the window go stale — the
  drive.ts decline doctrine"). Daiminkan structurally never passes the cut
  (pinned theorem). Reads `view.claimable!.seat` for the meld's `from`.
- Header pins the cross-seat contract: "arbitrating ACROSS seats is the
  driver's — fold the earliest non-draw answer in offered order, which is
  ron-before-claims, atamahane rotation among rons, and pon-before-chi among
  claims, all frozen by legal.ts."

### The reference arbitration — `src/core/policy.test.ts` playPolicy (~631)

The seeded sweep drives whole games "arbitrating across seats exactly as
T-006-03-03 will": detect a call point (`phase === 'ryuukyoku' || (drawn ===
null && !mustDiscard && claimable !== null)`), consult callPolicy once per
seat holding a ron/claim offer, treat a returned draw as THAT SEAT DECLINED,
fold the earliest non-draw answer by offered index, else the head draw. Non-
call points go to `discardPolicy(seatView(state, state.turn), legal)`.
T-006-03-02's review.md, concern 4, states this explicitly: the driver must
treat "returned the draw" as a per-seat decline, never fold it immediately.

### The offered-order contract — `src/core/legal.ts` (~250–288)

Order is contractual ("bots and generators may sample by index"):
- ryuukyoku → houtei rons only (usually empty);
- mustDiscard → the caller's hand discards, nothing else;
- pre-draw → the turn seat's draw FIRST, then (window open) rons in rotation
  order from the discarder's right (= atamahane order), then claims: all
  pons, then all daiminkans, then all chis, seats in rotation order;
- post-draw → 14 discards (hand order, drawn last), then tsumo, then ankan,
  then shouminkan offers.
So "earliest non-draw answer by offered index" IS the rules' precedence.

### The consumer — `src/app/App.svelte`

Authoritative state is the record (`seed` + growing `actions`); every append
refolds. `$derived`: `table` (fold), `offered` (legalActions), `prompt`
(promptChoices), `win` (winChoice). A `$effect` runs the loop: `forcedAction
(offered, PLAYER)` non-null → push after `BOT_DELAY_MS = 250` (one action per
tick — "the existing pace" the AC names); null → wait for taps. Tap handlers:
`tap` (tapDiscard), `claim` (tapClaim), `pass` (passClaim, else `dismissed =
true` for the houtei presentation-only decline), `takeWin` (push `win`). The
prompt shows iff `prompt.length > 0 || win !== null`, `canPass` hides the
pass button at the tsumo point only. No difficulty selector exists anywhere.

### The test suite — `src/app/drive.test.ts` (786 lines)

Frozen scratchpad-mined anchors (comments say "never regenerate"): player
claim windows (seeds 3, 5, 15, 212), player wins (542630 tsumo, 887141
shanpon ron, 362857 ron-only, 1038928 houtei), bot events through the player
lens (3951 bot ron + bot tsumo, 23798 furiten, 12754 yakuless, 147508 bot
houtei). Teeth: identity (`toBe` — returned actions ARE offered elements) and
doctored lists (a removed offer is rejected even though the fold accepts it).
Placeholder-behavior tests that this ticket obsoletes: "forces a bot seat's
draw through a bot-only window — auto-pass", "forces bot tsumogiri", "still
forces bot tsumogiri past a bot tsumo offer — never win", the bot-houtei halt
arm, the full-hand walk "byte-identical to unclaimed play" (bots tsumogiri),
and passClaim's "returns the head draw" semantics (a decline must now give
the bots their window). `src/app/app.ssr.test.ts` imports only `PLAYER`,
`promptChoices`, `winChoice` — untouched by a forcedAction reshape.

## Boundaries and constraints

- **Fair play is structural**: bots take `SeatView`, never `TableState`
  (seatview.ts doctrine). The DRIVER holds the state and projects the view —
  so drive.ts must gain access to the folded `TableState` to call
  `seatView(state, seat)`. Today nothing in drive.ts touches state; App has
  `table` at hand ($derived, line 25). `seatView`, `discardPolicy`,
  `callPolicy`, `TableState` are all exported via the core barrel.
- **Legality stays legal.ts's**: policies and drive SELECT from `offered`,
  never construct. The doctored-list tests enforce this per function.
- **state/offered consistency is trusted** (the TileId/seed precedent, stated
  in policy.ts) — the driver supplies both from the same fold.
- **Purity/SSR**: `$effect` never runs in SSR; core stays DOM-free (drive.ts
  is app-side, so importing state types is fine).
- **Pace**: BOT_DELAY_MS pacing is presentation, one forced action per tick;
  the AC says "at the existing pace" — no pacing change.
- **No difficulty selector** — the AC pins its absence; the policy pair is
  wired unconditionally as THE bot.
- **Determinism**: policies are pure and RNG-free; T-006-03-04 (depends on
  this ticket) will harness AI-vs-AI determinism over this wiring.

## Assumptions surfaced

- A window can hold offers for the player AND bots at once (seed 3: East's
  chis + South's pon). Today the player's tap folds his claim directly and
  his pass folds the head draw — both silently deny bots their precedence
  (a bot ron outranks a player pon; a bot pon outranks a player chi). The
  policy header's arbitration rule covers all seats; how the player's answer
  joins it is a design decision.
- callPolicy's decline returns the offered DRAW even when consulted for a
  non-turn seat; at houtei there is no draw, but a bot holding a houtei ron
  never declines (ron is unconditional), so a bot consultation at houtei
  always answers the ron.
- Bot claim → mustDiscard state → the bot's claim discard is a plain own-turn
  point (discardPolicy's pool handles drawn === null).
- Frozen-anchor expectations for bot behavior (does South's chi at seed-3 pass
  the accept rule? what does South discard at afterSouthDraw?) must be mined
  at implement time by scratchpad scan — the suite's standing convention —
  and cross-checked by in-test oracles, never asserted from prose.
