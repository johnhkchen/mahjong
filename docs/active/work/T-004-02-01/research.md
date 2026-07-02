# T-004-02-01 — drive-claim-window-selection — Research

Descriptive map of what exists, where, and how it constrains this ticket. No
solutions here; decisions live in design.md.

## The ticket in one line

Extend the drive seam (src/app/drive.ts) to the claim window: bot seats
auto-pass every claim (placeholder bots never call), `forcedAction` returns
null when the human East holds a claim offer (the loop waits), and new human
selection helpers pick call/pass — chi variants distinguishable — from
legalActions output, or return null for anything not offered. The app still
never computes legality.

## Scope boundaries drawn by sibling tickets

- **T-004-01-03 (done, f20cdfd)** delivered the offered half: `legalActions`
  now enumerates claim offers at open windows (all pons, then daiminkans, then
  chis — frozen order) and ankan/shouminkan post-draw. Its review flags two
  facts for THIS ticket: the offered set is complete-not-minimal (three
  indistinguishable pon pairs for a triplet holder — dedupe is presentation's
  job, not the enumeration's), and "the app never takes a claim (no UI yet)"
  is the current, verified state.
- **T-004-02-02 (ready, depends on this)** owns the visible prompt: call/pass
  UI with chi-variant choice, meld display, pond marking, loop pause/resume in
  `just dev`. This ticket supplies the selection functions that prompt will
  call; it does NOT build UI.
- **T-004-01-04 (research, parallel)** owns claims in the random-legal
  generator of dynamics.test.ts (core). dynamics.test.ts does not import
  drive.ts; no interaction.
- Core is closed for this ticket: record.ts, legal.ts and their suites need no
  change and none is licensed here. The action vocabulary has NO pass action —
  passing is letting the window go stale by taking the next draw (record.ts:
  "a draw closes the window").

## drive.ts today (64 lines)

Module contract (header comment): every function takes legalActions output and
returns an ELEMENT of it or null; nothing computes legality, reads hands, or
counts the wall. The tsumogiri chooser is the deliberate bot placeholder.

- `PLAYER: Seat = 0` — the human is East, the dealer. Table.svelte presents
  the same fact.
- `tapDiscard(offered, player, tile)` — finds the offered discard by
  (type, seat, tile) or null. Shape-robust to claim offers already.
- `forcedAction(offered, player)` — classifies by `offered[0]` (the frozen
  order's anchor: the draw at pre-draw states, else the turn seat's first
  hand discard):
  1. empty → null (halt);
  2. head is a draw → the head, ALWAYS — including when claim offers sit
     behind it, and including when those offers belong to the PLAYER. The
     comment owns this openly: "Claim offers listed after it are never
     auto-taken: forcing the draw lets the discard go stale, i.e. every seat
     passes on calls until a claim UI / real bot ticket". That "until" ticket
     is this one — for the player's offers only;
  3. head is the player's discard → null (the tap's choice);
  4. otherwise bot tsumogiri: the LAST offered DISCARD by reverse scan (kan
     offers follow the discards; a bot holding four of a kind still
     tsumogiris — T-004-01-03's bracing, design D6b there).

**The gap this ticket closes:** rule 2 auto-passes the HUMAN's claims too. A
window where East may claim is currently resolved by forcing the next draw,
so East can never call. Two sub-cases matter, because the head draw's seat
varies independently of who holds offers:

- North discards, East chi-able: the head is EAST'S OWN draw (turn advanced
  to East). "A draw is never a choice" is false exactly here — taking the
  player's own draw is what passes the player's claim.
- South/West discards, East pon-able: the head is a BOT's draw; East's offer
  sits behind a bot obligation.

There is no helper at all for selecting a claim: `tapDiscard` filters
`type === 'discard'`, so no current function can return a chi/pon/daiminkan
element. Chi variants (distinct `uses` on the same window tile) have no
selection key anywhere in the app layer.

## legalActions facts the seam builds on (legal.ts, frozen contract)

- Deterministic order, part of the contract: pre-draw = the turn seat's draw
  FIRST, then (window open) all pons, all daiminkans, all chis. Claim seats
  scan in rotation from the discarder's right; chi only by window.seat + 1;
  every distinct physical-copy combination is its own offer; chi `uses` read
  [lower kind, higher kind], shapes low-rank ascending.
- Post-draw = 14 discards (13 hand order + drawn last), then ankans, then
  shouminkans. mustDiscard (post-chi/pon) = the caller's hand discards ONLY.
- Fresh array of fresh literals (fresh `uses` tuples) per call — element
  identity (`toBe`) only holds within one call's result; a selection helper
  matching across calls must match by value, not reference.
- Claim offers carry: `{type: 'chi'|'pon', seat, tile, uses: [t,t]}` and
  `{type: 'daiminkan', seat, tile, uses: [t,t,t]}`. `tile` is always the
  window tile (single-valued per window); `seat` + `uses` distinguish every
  offer; within one seat, `type` + `uses` are unique by construction
  (distinct pairs/combos per the enumeration).
- The player never holds an offer on his own discard: claimOffers scans seats
  k = 1..3 from the discarder.

## The fold's claim consequences (record.ts, for integration tests)

Appending an offered chi/pon: turn jumps to the caller, window closes,
`mustDiscard = true` — the very next offering is the caller's hand discards
(13 tiles, no drawn), head.seat === caller, so `forcedAction` already yields
null for a player claim discard and `tapDiscard` drives it. Appending a
daiminkan: rinshan draw fills `drawn`, normal 14-discard offering follows.
Appending the draw instead: window nulls (stale) — the pass mechanism.

## App.svelte — the seam's only production consumer

- `offered = $derived(legalActions(table))`; `tap()` → tapDiscard → push;
  `$effect` → forcedAction → push after BOT_DELAY_MS, one action per tick.
- The effect's fixed point halts when forcedAction yields null. Today null
  means: player's discard choice, or ended hand. If this ticket adds "player
  holds a claim offer" as a third null, the RUNNING APP soft-locks at East's
  first claim window — no tap resolves a pre-draw state (tapDiscard nulls),
  and the prompt UI is T-004-02-02's. Whether main stays playable between the
  two tickets is a design decision to make explicitly.
- app.ssr.test.ts renders the DEALT fold only ($effect never runs in SSR) —
  insensitive to any of this. Table.svelte renders hands/ponds/wall count;
  shape-robust.

## drive.test.ts today (155 lines) — the AC's file

- Frozen anchor style: SEED = 1 shared with wall golden vector and App boot;
  `tsumogiriTurns(live, n)` builds all-tsumogiri scripts reading draws off
  the empty fold's `live`. Anchored states: dealt, afterEastDraw,
  beforeSouthDraw (South pre-draw — carries a real chi offer for South since
  -01-03, the loosened assertion), afterSouthDraw, exhausted (ryuukyoku).
- Teeth conventions this ticket must keep: identity (`toBe`, never shape) on
  every returned element; the doctored-list rejection (legality provably from
  the list, not the fold); the full-hand walk driving deal → ryuukyoku
  through exactly the exported functions, every append `toContain`-ed in a
  fresh fold's offering, ending 140 actions / [18,18,17,17] ponds.
- The walk's player arm currently throws if the unforced offering isn't a
  discard choice ("an unforced offering is a discard choice") — the moment
  forcedAction starts waiting on East's claim offers, any East-claimable
  window at seed 1 breaks the walk unless the walk grows a pass/call policy.
  Whether seed 1's all-tsumogiri trajectory actually opens East windows needs
  a scratchpad scan during implementation.

## Frozen East-claim anchors already scanned (legal.test.ts, reusable)

House convention: re-state frozen literals per file with derivation comments,
never regenerate. Directly reusable here:

- **Seed 3, `racePrefix3`** (4 tsumogiri turns, discards 28/128/25/42): North
  discards 42 (2p); EAST chi-able with uses [47, 37] AND South pon-able with
  [43, 41] — one window holding a player offer and a bot offer, and the head
  draw is EAST'S OWN (seat 0). Pinned full-array literal at legal.test.ts:750.
- **Seed 5, `ponChiPrefix5`** (7 tsumogiri turns): West discards 94 (6s);
  EAST pon-able with its 93/95 pair; North chi-able (four variants). Head
  draw is North's (seat 3) — a bot draw with a player offer behind it.
- **Seed 85** (South discards to WEST's five chi variants) shows the
  multi-variant shape but for a bot seat — an EAST multi-chi-variant window
  (≥2 distinct `uses`) has no frozen anchor yet and needs a scratchpad scan.
- **Seed 1, `beforeSouthDraw`** — the bot-only window (South chi offer, no
  East offer) already anchored in drive.test.ts itself.

## Constraints and assumptions carried forward

- The seam's promise is unchanged: return an ELEMENT of `offered` or null;
  no legality computed app-side. Selection must therefore key on data the UI
  can hold (tile ids in `uses`), not on recomputed hand facts.
- `PLAYER` is a parameter everywhere despite the constant — the seat check
  stays explicit per function ("the promise holds for any caller").
- Svelte 5 runes wrap pushed actions in `$state` proxies; offered elements
  themselves are plain (constructed inside legalActions) — reference identity
  is safe within a tick but value matching is the durable key across folds.
- `just test` (175 tests), `just check`, `just build` all green at HEAD
  (f20cdfd + uncommitted ticket-frontmatter edits only).
