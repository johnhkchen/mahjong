# Research — T-009-03-01 tenpai-riichi-prompt

## Ticket

Story S-009-03 (teaching-view). This is the P2-crown moment charter.md quotes verbatim:
"you're tenpai — declare riichi?" Two behaviors, one component family:

1. When `legalActions` offers the player a `riichi` action, show a prompt with the
   stakes (hand locks, 1000-point stick, riichi yaku + uradora chance). Accept folds
   the riichi action; decline folds a plain discard.
2. Pre-tenpai, a subtle "N away from tenpai" hint reads `shanten` directly.
3. AC requires "no engine logic in the view" — any decision logic beyond selecting
   from `offered` belongs in core, not in `src/app/`.

## The engine's riichi vocabulary (src/core)

- `HandAction`'s `riichi` member (record.ts:80): `{ type: 'riichi', seat, tile }` — one
  atomic declare-and-discard. `tile` means exactly what `discard.tile` means.
- `legalActions` (legal.ts:373-406), unlocked seat holding a draw: offers, in frozen
  order, are `[...13 hand discards, drawn-tile discard, ...riichiOffers, tsumoOffer?,
  ankanOffers, shouminkanOffers]`. **Key fact**: the 14 plain `discard` offers are
  unconditional and always precede `riichiOffers` — so every tile with a `riichi` offer
  also always has a matching plain `discard` offer for the identical tile, already in
  `offered`, needing no construction.
- `riichiOffers` (legal.ts:188-205): one offer per candidate tile (13 hand + drawn) whose
  removal leaves the 13-tile hand at shanten 0, gated on: not already locked, closed hand
  (`isMenzen`), `scoresIn[seat] >= RIICHI_STICK` (1000), live wall nonempty. Zero, one, or
  several tiles may qualify.
- `shanten` (shanten.ts:193): `min(standardShanten, chiitoiShanten, kokushiShanten)` over
  the concealed hand at either legal arity (13 waiting / 14 holding a draw); `-1` complete,
  `0` tenpai, positive counts exchanges. Pure, exported, already the AC's "core shanten
  module."
- `policy.ts`'s `discardPolicy` (own-turn bot decision) already declares riichi
  (T-009-02-01, committed just before this ticket): scores every discard candidate by
  resulting shanten + a center-distance tie-break, and **whenever the winning tile's
  post-discard shanten is 0, looks up the matching `riichi` offer for that exact tile**
  and returns it instead of the plain discard — *unless* that tile would leave a dead
  wait (`isDeadWait`, every completing kind already exhausted), in which case it falls
  back to the plain discard for the same tile. This proves (and the module's own header
  states) that whenever any riichi offer exists at all, the discard-scoring tie-break's
  winning tile is *always* one of the riichi-eligible tiles — shanten 0 is the floor a
  discard can reach (an agari-shaped 13-tile hand is not a thing), so if any candidate
  reaches it, the global minimum is 0 and the tie-break winner reaches it too, by the
  identical candidate ordering both functions iterate.
- `discardPolicy` is generic over `SeatView['seat']` — it is not bot-specific code, only
  bot-*consuming* code today (called for non-player seats via `forcedAction` in
  drive.ts). Nothing stops calling it with the player's own `seatView`.

## The app's seam (src/app/drive.ts)

drive.ts's whole discipline: every function here returns an ELEMENT of `legalActions`
output or null; nothing computes legality or constructs an action locally. Existing
precedent functions this ticket's additions must match:
- `winChoice(offered, player)`: finds the (at most one) tsumo/ron offer for `player` —
  the exact "find the one relevant offer" shape a riichi selector needs.
- `tapDiscard(offered, player, tile)`: today only matches `type === 'discard'` — the
  player currently has **no way to ever select a `riichi` action** even though
  `legalActions` can offer one. This ticket closes that gap.
- `promptChoices`/`claimChoices`: dedupe/group offers for presentation; not directly
  reusable here (riichi has no `uses` to dedupe by) but establish the "derive a
  presentation list from `offered`, never rebuild" convention.
- `forcedAction`: returns null (waits on the player) whenever the head offer is the
  player's own discard turn and no claim/win offer intervenes — i.e., **the whole
  window where riichi could be offered is already a wait-on-player point**; nothing
  about the auto-advance loop needs to change to accommodate it.

## The view layer (src/app)

- `App.svelte` owns the console slot: currently renders `ClaimPrompt` when
  `prompt.length > 0 || win !== null`, else nothing. It derives `offered`/`prompt`/`win`
  from `legalActions`/`promptChoices`/`winChoice` and wires taps through `drive.ts`
  functions exclusively — App.svelte itself never inspects `HandAction` internals to
  decide legality, only to route taps (e.g. `table.turn === 0 && table.drawn !== null`
  gates the drawn-tile button, a presentation fact already on `TableState`).
- `Table.svelte` is stateless/presentational: one `{ table }` prop (plus `ontap`/
  `scores`/`onnext`), computation-free apart from the documented display sort. The
  player's 13-tile hand and the drawn tile both render as tap buttons unconditionally —
  they stay live through every prompt (see the tsumo precedent below), so no gating
  changes are needed there for the riichi prompt to coexist with discard taps.
- `ClaimPrompt.svelte` is the existing "prompt/console seam" the ticket references:
  header (claimed tile), a `win` button (rendered first, no `uses`), each claim
  button, and an optional `pass`. Precedent worth copying: **the tsumo moment renders
  `canPass = false`** because "declining a tsumo IS tapping a discard on the table
  below" — there is no separate decline action for tsumo; the hand's own tap surface
  is the decline. Riichi's decline, by contrast, needs an explicit action ('a plain
  discard of a specific tile') because a riichi offer does not universally match
  "whatever tile the player next taps" — the ticket's decline lands on a *specific*
  tile (the one being asked about), a different shape than tsumo's blanket case.
- `app.ssr.test.ts` / `table.tap.svelte.test.ts` / `app.controls.svelte.test.ts` are the
  three test tiers: SSR content/aria assertions over hand-authored `foldRecord`
  fixtures, a jsdom mount for closure/identity behavior, and a full mounted `App` driven
  through fake timers for end-to-end flows. `drive.test.ts` covers the pure selector
  functions with frozen seed anchors (offered-identity assertions, `toBe` not shape).

## Open questions Design must resolve

1. **Which tile does the prompt ask about**, when `riichiOffers` yields more than one
   candidate? No existing selector picks "the" riichi offer among several — `winChoice`
   only ever sees at most one win.
2. **What "no engine logic in the view" permits**: calling `shanten`/`discardPolicy`
   directly is reading core, not reimplementing it — but which layer (drive.ts vs. the
   Svelte component) should hold the call, matching the seam discipline above.
3. **Decline's fold target**: an explicit plain-discard action (this ticket's AC
   phrasing: "declining folds the plain discard") vs. a bare dismiss with no fold (the
   houtei `dismissed`-flag precedent). The AC's wording, and the fact that `offered`
   always carries the matching plain discard already, argue for an explicit fold.
4. **Console placement and priority** against the existing claim/win prompt, and how
   the shanten hint and the riichi prompt relate (mutually exclusive by shanten value).
