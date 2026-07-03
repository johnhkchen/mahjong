# T-005-02-03 — win-prompt-and-hand-end-screen — Design

Options weighed against the research; one approach chosen with rationale.

## 1. The shape of the problem

Three seams must learn about wins, each with a decided shape:

1. **drive.ts** — the wait predicate is WRONG at one state (a player-ron window is
   auto-passed after BOT_DELAY_MS) and incomplete elsewhere (no selector builds a
   win action).
2. **The prompt UI** — tsumo/ron buttons at the legal moment.
3. **The hand-end screen** — winner, winning tile, yaku names, off `table.win`.

Plus fixtures: no mined anchor has seat 0 winning.

## 2. Decision 1 — the drive seam: a parallel, SINGULAR win family

**Chosen**: a new `winChoice(offered, player): HandAction | null` (the player's
tsumo/ron offer, an element of `offered`) and `tapWin(offered, player): HandAction |
null` (the same element — the tap selector, kept separate from the predicate so the
naming stays parallel to claim/tap even though today they coincide... no — see §2a:
ONE function). `forcedAction` and `passClaim` widen their guards to claims ∪ wins.

**2a. Singular, and one function, not two.** The enumeration guarantees at most ONE
player win offer per state: post-draw offers exactly zero-or-one tsumo; a claim
window holds at most one ron per seat; ryuukyoku's houtei arm likewise. A
`winChoices(...): HandAction[]` plural would imply a choice set that cannot exist
and force `.length`/`[0]` noise on every consumer. And a separate `tapWin` alongside
`winChoice` would be two names for the identical lookup (a win action carries no
`uses` to match — the offer IS the selection). So: **one function, `winChoice`**,
serving as predicate (prompt visibility, forcedAction's wait) and selector (the tap
appends its result). This is the same economy passClaim already practices — pass
button existence and the pass action are one function.

**2b. Rejected — fold wins into claimChoices/promptChoices/tapClaim.** A ron at a
window is genuinely a claim in parlor terms, but the claim family's machinery is
built on `uses` (dedupe keys, ordered-uses matching, ClaimChoice's payload) and win
actions have none. Widening `ClaimChoice` to `uses?: TileId[]` weakens every
existing contract for zero gain; tsumo isn't a window claim at all. The families
stay separate; the PROMPT unifies them visually (§3).

**2c. forcedAction**: insert `winChoice(offered, player) !== null → null` beside the
existing claim guard. Effects, by state class: player-ron window now waits (the bug
fix); player tsumo already waited (head = player's own discard) — unchanged; player
houtei already waited (head.seat === player coincidence) — now waits by intent, not
coincidence; bot win offers stay ignored (the guard is player-scoped; tsumogiri's
reverse discard scan already skips a bot tsumo offer, and window heads still force
the draw — placeholder bots never win, the documented doctrine).

**2d. passClaim**: the guard widens from "holds a claim offer" to "holds a claim or
win offer" — but only where the head is a draw, which the existing head-check
already enforces. Declining a window ron IS taking the head draw, exactly like
declining a pon; the docstring's "declining IS taking the next draw" needs no new
mechanism. Two win moments get NO pass action, by the nature of the record:

- **Tsumo**: declining is discarding — the hand's tap surface is already live at a
  post-draw state, so the prompt simply shows no pass button and any discard tap
  dissolves it reactively. No dismissal state.
- **Houtei ron**: the hand is already (provisionally) ended; there is no action to
  append. Declining is purely presentational: an App-local `dismissed` flag (§3c).

**2e. Atamahane lands as documentation, not code.** The -01/-02 handoff ("take the
first ron") matters when a RECORDER chooses among several rons. The player's tap
names the player's own ron — the fold accepts whichever single ron the log names,
so no tie-break executes in this ticket. `winChoice`'s doc records that a future bot
recorder breaking a multi-ron tie takes the first offered ron (rotation order =
head-bump order). Placeholder bots never ron, so nothing else is reachable.

## 3. Decision 2 — the prompt: extend ClaimPrompt, don't fork a WinPrompt

**Chosen**: ClaimPrompt gains an optional `win: HandAction | null` prop (default
null) rendered as the FIRST button — matching the frozen offered order, wins before
calls — plus a nullable `claimed` and a `canPass` boolean (default true).

**Rejected — separate WinPrompt component.** A shanpon-waiting player can hold ron
AND pon on the same discard (both offered, both his). Two mounted asides for one
decision moment is two competing prompts; the parlor reality is one choice row
("ron / pon / pass"). One component keeps the one-decision-one-surface shape and
the existing aria landmark (`call or pass`) that app.ssr.test.ts anchors on.

Prop/render details:

- `win` renders a button labeled `tsumo` or `ron` (`callName` grows the two cases —
  display vocabulary only, the payload keeps the discriminant). aria:
  `"tsumo"` / `"ron <kind>"`. Tapping emits `onwin` (no payload needed — the owner
  already holds the element; symmetric with `onpass`).
- `claimed: TileId | null` — null exactly at the two windowless win moments (tsumo:
  the win is the drawn tile, already rendered apart in the hand; houtei: the window
  is reconstructed, `state.claimable` is null). Header shows "call on <tile>?" when
  present; at tsumo/houtei the win button carries the moment by itself.
- `canPass: boolean = true` — false only at tsumo (declining = discarding, §2d).
  Defaulting true keeps existing SSR renders (which pass no handlers) green.

**App.svelte wiring**: `const win = $derived(winChoice(offered, PLAYER))`; mount
condition becomes `prompt.length > 0 || win !== null` (the claimable type-guard
conjunct moves into the derived `claimed` value); `onwin` appends `win` itself;
`pass()` widens: append `passClaim(...)` when non-null, else set the houtei
`dismissed` flag (§3c).

**3c. The houtei dismiss flag** — `let dismissed = $state(false)`, ANDed into the
mount condition, set only when pass is tapped with no pass action available. It is
presentation state in the BOT_DELAY_MS sense (never authoritative, never read by
the record); a single hand needs no reset. Rejected: encoding a "decline" in the
record (no such action exists in the vocabulary and inventing one violates the
action-log contract) and auto-hiding the houtei prompt (the player would lose a
legal, offered win with no say — the opposite of the ticket's teaching moment).

## 4. Decision 3 — the hand-end screen: inline in Table's center panel

**Chosen**: extend the center panel where the ryuukyoku line already lives, gated
`{#if table.phase === 'agari' && table.win !== null}` (one conjunct is a type
guard, the ClaimPrompt precedent): a `role="status"` block naming the winner
(`SEATS[win.winner].wind`, "you" marked for seat 0), the win form (tsumo/ron —
"ron" may also name the discarder: "ron on West"), the winning tile as a real
`<Tile id={win.tile}/>` chip, and the yaku list rendered from `win.yaku` verbatim
(romaji slugs — the codebase's display vocabulary today; the teaching glossary
that translates/explains them is its own later ticket, per STANDARD_YAKU_NAMES's
"teaching UI's yaku glossary" note).

**Rejected — a HandEnd overlay component.** The AC asks that the screen NAME three
facts; the center panel is the established end-state slot (ryuukyoku precedent),
Table stays the one stateless fold-in/markup-out view, and app.ssr.test.ts's
render-Table-directly pattern covers it without new component plumbing. A richer
post-hand review screen is explicitly future work (vision.md's review feature),
and an overlay would prejudge its shape. Same reasoning keeps yaku display as the
raw catalog names: inventing English names here would create a second naming
authority the glossary ticket would have to reconcile.

The ryuukyoku line stays as-is (phases are exclusive); the turn marker already
hides at any ended phase (`phase === 'playing'` gate) — `turn` parks at the winner
after agari and must not render as "to act", which the existing gate handles.

## 5. Decision 4 — fixtures: mine two seat-0 anchors, keep bot anchors as negatives

**Chosen**: mine (temporary probe file, -02's deleted-after-capture precedent,
cross-checked against isAgari/waits/yakuOf — never against legalActions) and freeze:

1. **A player-tsumo seed** — seat 0 dealt tenpai, all-tsumogiri, its turn-k draw
   (k ≡ 0 mod 4) completes with yaku. Drives: prompt-at-tsumo driver test, the
   agari full-hand walk, and the SSR hand-end + tsumo-prompt assertions ("you win"
   is the teaching moment the ticket names).
2. **A player-ron seed** — seat 0 dealt tenpai, a bot tsumogiri lands its wait
   (yaku-bearing, seat 0 not furiten). Drives: the window-wait bug-fix test (the
   old forcedAction would have forced the head draw here) and the ron-prompt SSR
   assertion.

Existing bot-seat anchors (3951, 4851, 23798, 12754) become negatives through the
player lens: `winChoice` null for PLAYER even while bot wins are offered — the
seat-scoping teeth. The seat-parametric alternative (driving seed 3951 with
`player = 3`) was rejected as the PRIMARY fixture: every existing drive/SSR test
and App itself binds the player to seat 0, and the AC's sentence is about THE
player; parametric reuse would test the functions but not the app's geometry.
(One parametric spot-check is still cheap and included in the plan.)

Nice-to-have if mining is cheap: a shanpon window where seat 0 holds ron+pon
together (pins the unified-prompt render); a player houtei (pins the dismiss). Both
are bonus, not AC — capped mining effort, noted in review if not found.

## 6. Test strategy (detail in plan.md)

- **drive.test.ts**: `winChoice` unit block (offered-element identity via toBe;
  doctored-list rejection; null across all windowless/bot-win/furiten anchors —
  furiten and yakuless negatives come free from core's gates, asserted through the
  seam to pin the AC's "never when furiten or yakuless"); widened
  forcedAction/passClaim assertions on the two new anchors; the complementarity
  battery extended with them; a full agari walk through the seam (deal → tsumo,
  phase 'agari', legalActions [], win fields cross-checked against the fold).
- **app.ssr.test.ts**: win-prompt renders (tsumo button at the tsumo point, no
  pass; ron button with the tile at the ron window, pass present) with props
  derived from live offers; hand-end render assertions (winner wind + you-mark,
  winning tile kind, every yaku name, no active seat, no claim prompt).
- Unchanged tests stay green by construction: no existing anchor holds a player
  win offer, so the widened guards are no-ops on them.

## 7. Invariants preserved

- App never computes legality: `winChoice` returns elements of `offered`; the win
  fold's furiten/yaku gates are consumed, never re-derived.
- One predicate family: prompt visible ⇔ loop waits on the player, now spanning
  claims ∪ wins; exactly-one-driver (forcedAction ⊕ passClaim) still holds — the
  new both-null states (tsumo point, houtei) are tap/halt states like the discard
  choice, and the battery asserts the widened shape.
- Stateless view, action-log authority, extend-only enumeration: untouched. The
  riichi epic extends `winChoice`'s family (declaration offers) without reshaping
  it; a real-bot ticket replaces forcedAction's tsumogiri arm and inherits the
  atamahane note on winChoice.
