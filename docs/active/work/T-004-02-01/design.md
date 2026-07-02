# T-004-02-01 — drive-claim-window-selection — Design

Decisions grounded in research.md. Six decisions, each with the rejected
alternatives and why.

## D1 — forcedAction waits on the player's claims: one new guard, first

**Chosen:** insert a single check before every other classification: if
`offered` contains any claim offer (chi/pon/daiminkan) whose seat is
`player`, return null. Everything after is unchanged — draw head forces
(now meaning: bot-only windows auto-pass), player discard head nulls, bot
tsumogiri reverse-scans.

The guard must come FIRST, not inside the draw arm, because of the seed-3
geometry (research): when North discards and East may chi, the head is
East's OWN draw — "a draw is never a choice" is exactly wrong there. Any
formulation that trusts the head before scanning for player claims
auto-passes the player's chi on North's discards, which is the bug class
this ticket exists to close. Scanning the whole offering is O(n) over a
≤ ~20-element array folded per action — free.

**Rejected — classify by head, special-case the player-draw arm:** would
need the same full scan anyway for the bot-draw-head case (seed 5: East's
pon behind North's draw obligation); two scan sites instead of one guard.

**Rejected — auto-pass the player too, gate waiting behind a flag/callback:**
violates the AC verbatim ("returns null when the human East holds a claim
offer — the loop waits") and re-introduces policy into the app.

## D2 — passing is selecting the head draw: passClaim

There is no pass action in the vocabulary and none is added (core is closed
here): a pass IS the default continuation — the draw at the head, whose fold
closes the window (staleness, record.ts). So the pass helper obeys the
module's one contract, "return an ELEMENT of offered or null":

**Chosen:** `passClaim(offered, player)` returns `offered[0]` when (a) the
head is a draw and (b) the player holds at least one claim offer behind it;
null otherwise. Clause (b) makes passClaim non-null EXACTLY where
forcedAction newly nulls — the two are complementary by construction, so at
every state precisely one driver applies: forced action, tap/pass choice, or
halt. A pass button can exist only while a prompt exists.

**Rejected — passClaim returns the draw at any pre-draw state:** overlaps
forcedAction (both non-null at bot-only windows); double-driving hazards in
the app loop and a pass button that could render with nothing to decline.

**Rejected — a `pass` HandAction in core:** new vocabulary, new fold arm,
new agreement-suite surface — for semantics the draw already has. Out of
ticket scope and against the record's minimality (the log stores only what
no fold can derive).

## D3 — claim selection keys on (type, uses): tapClaim

**Chosen:** `tapClaim(offered, player, choice)` where
`choice: { type: 'chi' | 'pon' | 'daiminkan', uses: readonly TileId[] }`.
Returns the offered element with `type === choice.type`,
`seat === player`, and `uses` equal pairwise in order; null otherwise.

Rationale: mirrors tapDiscard's "minimal datum of the tap" style — the tile
is implied (single window tile per state; legalActions stamps it), the seat
is the player parameter, and `(type, uses)` is unique per seat by the
enumeration's construction (distinct copy combinations are distinct offers).
Distinct chi variants differ precisely in `uses`, so the AC's
distinguishability requirement is the key itself. Physical TileIds in `uses`
also stay correct when red fives make copies non-interchangeable — same
future-proofing legalActions chose.

Ordered comparison (not set-wise) because `uses` order is contractual
canonical output (hand order / [low, high]) and the UI echoes back data it
was handed from the same offering; the strictest match keeps lookalikes out,
matching the doctored-list philosophy.

**Rejected — pass the offered element itself and identity-check membership:**
`tapClaim(o) === o` is near-vacuous, and Svelte 5 `$state` proxying plus
legalActions' fresh-literals-per-call mean reference identity is only safe
within a single fold tick — value matching is the durable key (research).

**Rejected — select by index:** sample-by-index is legal per the frozen
order, but an index says nothing about WHICH variant a button meant; any
re-derivation between render and tap silently re-targets. No teeth.

**Rejected — one helper per call type (tapChi/tapPon/tapKan):** three
functions with identical bodies modulo a literal; the discriminant is
already in the choice.

## D4 — claimChoices: one exported read shared by seam and prompt

**Chosen:** export `claimChoices(offered, player): HandAction[]` — the
player's chi/pon/daiminkan elements of `offered`, original (frozen) order
preserved. forcedAction's D1 guard and passClaim's clause (b) both test
`claimChoices(...).length > 0`; T-004-02-02's prompt renders from exactly
this list. One predicate, three consumers — the prompt's visibility
condition and the loop's wait condition cannot drift apart.

Claim types only: ankan/shouminkan are the turn seat's own-turn choices, not
window claims — the player's post-draw states already null via the
head-seat rule (his discard choice), and bot kan offers are already
excluded by the tsumogiri reverse-scan (T-004-01-03's bracing). A player
kan UI is future work, deliberately untouched.

Note carried from -01-03's review: this list is complete, not minimal —
three identical-looking pon pairs can appear. Dedupe-for-presentation
remains -02-02's concern; the seam hands over the full offered truth.

## D5 — App.svelte auto-passes the player, temporarily, via the seam

forcedAction newly nulling at East's claim windows would soft-lock the
running app (no prompt exists until -02-02; no tap resolves a pre-draw
state). Main must keep playing a full hand (vision's definition of done).

**Chosen:** the effect's driver becomes
`forcedAction(offered, PLAYER) ?? passClaim(offered, PLAYER)` with a comment
marking the `?? passClaim` arm as the interim auto-pass that -02-02 replaces
with the prompt. Behavior is byte-identical to today's trajectories (East
passes like the bots); the app exercises the new helper in production; the
diff -02-02 must touch is exactly the line it already owns.

**Rejected — leave the app soft-locking until -02-02:** breaks main's
playability between tickets for no gain; -02-02's AC ("passing resumes the
paced bot loop") would also land on an app nobody could have run meanwhile.

**Rejected — keep forcedAction auto-passing and put waiting in App.svelte:**
inverts the seam — the app would classify offerings (compute legality-shaped
facts) which the module header forbids; AC pins the null on forcedAction.

## D6 — Test strategy: anchors, complements, and the pass-policy walk

drive.test.ts grows four blocks, keeping the house teeth (toBe identity,
doctored lists, frozen anchors with derivations):

1. **Anchors.** Re-state seed 3 `racePrefix3` (East chi [47,37] + South pon
   [43,41] on North's 42, head = East's own draw) and seed 5
   `ponChiPrefix5` (East pon [93,95] on West's 94, head = North's draw).
   Scan by scratchpad script for one more: an East window with ≥ 2 distinct
   chi variants (the multi-variant distinguishability anchor — seed 85's
   five-variant window belongs to West, unusable). Freeze all with
   derivation comments, never regenerate.
2. **forcedAction.** Bot-only window still forces the head draw (existing
   seed-1 test, re-commented as auto-pass); seed-3 and seed-5 windows return
   null — covering both head-draw owners (player's own, a bot's).
3. **Helpers.** tapClaim returns each of East's offers by (type, uses) with
   toBe identity; null for: South's pon identity passed as PLAYER (wrong
   seat), a doctored list with East's chi removed, an unoffered uses
   variant, any claim choice at no-window/post-draw/ended states. passClaim
   returns the head draw (toBe) exactly at the two wait anchors; null at
   bot-only windows, plain pre-draw, player-discard, and ended states.
   claimChoices content and order pinned at the race window (East's chi
   only — South's pon excluded) and at the multi-variant anchor.
4. **Walks.** The full-hand walk gains the explicit pass policy: when
   forcedAction nulls and the head isn't the player's discard, append
   passClaim's element — asserting it toBe offered[0] and counting the
   passes East made (pinned if seed 1's trajectory opens East windows; the
   scan tells). Trajectory must stay byte-identical: 140 actions,
   [18,18,17,17] ponds, ryuukyoku. A second, short walk drives a REAL claim
   through the seam: seed 3 → tapClaim East's chi → fold accepts →
   mustDiscard offering → forcedAction nulls (player's discard) → tapDiscard
   drives the claim discard → play continues one bot tick — proving the
   seam covers call, not just pass, end to end.

app.ssr.test.ts is insensitive (SSR renders the dealt fold; no effect runs);
`just check` covers the App.svelte edit's types.
