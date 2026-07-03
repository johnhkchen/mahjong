# T-005-02-03 — win-prompt-and-hand-end-screen — Research

What exists, where, and how it connects. Descriptive only; the design phase decides.

## 1. The ticket

East (the player, seat 0) gets a tsumo/ron prompt through the existing drive.ts prompt
seam, and a hand-end screen names winner, winning tile, and the yaku made. AC: on a
seeded hand known to reach a win, the prompt appears at the legal moment (never when
furiten or yakuless — those gates live in core and are already tested there), covered
by drive.test.ts driver tests and an app.ssr.test.ts render assertion.

## 2. What core already provides (T-005-02-01 fold, T-005-02-02 offers)

**The offered side** (`src/core/legal.ts`): `legalActions(state)` enumerates win offers
in a frozen order.

- Post-draw (`drawn !== null`): 14 discards (13 hand-order + drawn last), then the
  turn seat's `{type:'tsumo', seat}` if the drawn tile completes a yaku-bearing hand
  (source = `drawnFrom` verbatim: wall/rinshan), then ankan, then shouminkan offers.
  Zero or one tsumo offer, never more. No furiten gate on tsumo.
- Claim window (`drawn === null`, `claimable !== null`): the head draw FIRST (the
  default continuation — taking it stales the window), then RONS (rotation order from
  the discarder — which IS atamahane order), then pons, daiminkans, chis.
- Ryuukyoku phase: ONLY the houtei rons against the reconstructed final discard
  (`turn` parks at the last discarder; that pond's last tile is the discard). Usually
  empty. There is NO draw at the head here — the offering is rons or nothing.
- Agari phase: `[]` — the app loop's halt condition.

Win-offer gates (all in core, all tested in `legal.win.test.ts`, 16 tests): isAgari
completion → basic discard furiten (waits ∩ own pond, ron only, whole-seat) →
one-yaku rule. The prompt inherits these for free by rendering only offered elements.

**The fold side** (`src/core/record.ts`): `tsumo` records only the seat (winning tile
IS `drawn`); `ron` records seat + the fresh-discard tile. On fold, `applyWinTail`
sets `phase: 'agari'`, `turn = winner`, and fills `TableState.win`:

```
win: { by: 'tsumo', winner: Seat, tile: TileId, yaku: readonly WinYakuName[] }
   | { by: 'ron',   winner: Seat, from: Seat, tile: TileId, yaku: readonly WinYakuName[] }
   | null   // exactly while phase !== 'agari'
```

`yaku` is yakuOf's list verbatim, deterministic order — everything the hand-end
screen needs is already on the fold. The winning tile never changes zone (tsumo:
stays in `drawn`; ron: stays counted in the discarder's pond, `win.tile` marks it).

**The multiple-ron convention**: exactly one ron folds; the RECORDER (this ticket's
driver) picks. Both -01 and -02 reviews hand -03 atamahane explicitly: when
legalActions returns several rons, take the first — the seat scan is rotation order
from the discarder, which is head-bump order. THE FURITEN DIVERGENCE means the fold
would ACCEPT a furiten ron, but it is never offered — a drive layer that only ever
appends offered elements cannot fold one.

**Names**: `WinYakuName = YakuName | YakumanName` (`src/core/yaku.ts:35`,
`src/core/yakuman.ts:39`) — romaji slugs ('pinfu', 'menzen-tsumo', 'chuuren-poutou').
`STANDARD_YAKU_NAMES` / `YAKUMAN_NAMES` are exported frozen catalogs, documented as
what "the teaching UI's yaku glossary" iterates. No English display-name map exists
anywhere yet; ClaimPrompt's precedent is parlor vocabulary computed locally
(`callName`: 'daiminkan' → "kan").

## 3. The drive seam (`src/app/drive.ts`) — current shape and the exact gaps

Every function takes `(offered, player, ...)` and returns an ELEMENT of `offered` or
null; nothing computes legality. `PLAYER = 0` is exported; all functions are
seat-parametric. Current family:

- `claimChoices` — chi/pon/daiminkan offers for the player (`isClaim` excludes wins).
- `promptChoices` — claimChoices deduped by (type, uses-kinds) for presentation.
- `tapClaim(offered, player, {type, uses})` — ordered-uses matching, element identity.
- `passClaim` — the head draw iff the player holds a claim offer; complementary to
  forcedAction by construction ("exactly one driver applies at every state").
- `tapDiscard` — the player's offered discard for a tapped tile.
- `forcedAction` — null (wait) when the player holds a claim offer; else head draw;
  else null when head is the player's discard; else bot tsumogiri (last offered
  DISCARD, reverse scan past kan offers).

Gap analysis against the win offers now present in `offered`:

1. **Player tsumo (post-draw)**: forcedAction already waits — the head is the
   player's own discard (`head.seat === player → null`). The loop pauses correctly,
   but NO selector can build the tsumo action and no prompt renders. The player can
   only discard past his win.
2. **Player ron (claim window)**: forcedAction FORCES the head draw — `claimChoices`
   excludes rons, so a ron-only window looks bot-only and the loop auto-passes the
   player's ron after BOT_DELAY_MS. This is the one place the current wait predicate
   is wrong, not merely incomplete.
3. **Player houtei ron (ryuukyoku phase)**: offered is rons only, no draw at head.
   forcedAction: head is the player's ron → `head.seat === player` → null (waits, by
   coincidence of the seat check). passClaim: head is not a draw → null. So the loop
   halts with no selector and no decline: "declining" a houtei ron has NO action to
   append — the hand is already provisionally ended; the decline is purely
   presentational (dismiss).
4. **Bot-only houtei rons**: head is a bot's ron; the reverse discard scan finds no
   discard → forcedAction null → loop halts at the ryuukyoku display. Placeholder
   bots thereby pass houtei, consistent with "placeholder bots never call".
5. **Bot tsumo/ron while playing**: never taken — tsumogiri picks the last DISCARD;
   window heads force the draw. Placeholder bots never win; a real bot replaces
   those arms later (documented in drive.ts).
6. **Agari state**: `legalActions = []` → forcedAction null → loop halts. The
   existing `full hand driven through the seam` walk ends at ryuukyoku and asserts
   `phase === 'ryuukyoku'`; no walk ends at agari yet.

`promptChoices`' doc ties prompt visibility and loop wait into "one predicate
family" — claim-only today; wins widen the family, whatever shape design picks.

## 4. The view layer (`src/app/`)

- **App.svelte**: record = seed 1 + `$state` actions; `table`/`offered`/`prompt` are
  `$derived`; the `$effect` loop appends `forcedAction` once per 250ms tick until it
  yields null. Tap handlers (`tap`/`claim`/`pass`) append selector results. The
  ClaimPrompt mounts iff `prompt.length > 0 && table.claimable !== null` (the
  claimable conjunct is a type guard, not policy). `$effect` never runs in SSR.
- **ClaimPrompt.svelte**: computation-free input wiring. Header "call on <tile>?",
  one button per deduped choice echoing `(type, uses)` back through `onclaim`, and a
  pass button → `onpass`. Buttons render `uses` tiles; the type-narrowing `{#if}`
  guard renders nothing for non-claim actions (a win action reaching today's
  ClaimPrompt would silently render no button).
- **Table.svelte**: stateless (`table` in, markup out, `ontap` out). The center panel
  holds dora indicator, wall count, and the ryuukyoku end line — `{#if table.phase
  === 'ryuukyoku'}<p class="ended" role="status">ryuukyoku — exhaustive draw</p>` —
  the only end-state rendering precedent, and the natural slot a hand-end screen
  extends or replaces. The turn marker is gated on `phase === 'playing'`. Seat winds
  render via the `SEATS` table (East/South/West/North, aria ponds lowercase).
- **Tile.svelte**: kind-text chip; tile-art ticket replaces internals only.

## 5. The test patterns the AC names

- **drive.test.ts** (476 lines): frozen scratchpad-mined anchors ("never
  regenerate"), each a seed + `tsumogiriTurns(dealtLive(seed), n)` prefix with the
  geometry derived in comments. Teeth: element identity (`toBe`, not shape) and
  doctored-list rejection (an offer filtered out is rejected even though the fold
  would accept it). Two integration walks: seed-1 pass-everything → ryuukyoku
  (byte-identical to unclaimed play, 140 actions), and the seed-3 chi walk.
  `forcedAction`/`passClaim` complementarity is asserted over an anchor battery.
- **app.ssr.test.ts** (262 lines): `render` from 'svelte/server'; asserts content
  and aria labels, never classes/structure. `regionTokens(body, label, closeTag)`
  extracts tile tokens per labeled region. Mid-hand/ended states render `Table`
  directly with hand-authored folded records; ClaimPrompt is rendered with
  `promptChoices` output as props — derived, never typed in.

## 6. Seeds and fixtures — the one missing ingredient

All eight mined win anchors in `legal.win.test.ts` are BOT-seat winners: 3951 (seat 3
ron at turn 0 / tsumo at turn 35), 4851 (seat 1 ron+pon+chi coexist), 23798 (seat 1
furiten), 12754 (seat 2 yakuless), 147508 (seat 2 houtei), 103897 (furiten houtei),
29732 (seat 1 rinshan). **No anchor has seat 0 winning.** The AC's "seeded hand known
to reach a win" with the PLAYER prompted needs either (a) a newly mined seed where
seat 0 is dealt tenpai and its wait arrives (its own draw at turn k≡0 mod 4 for
tsumo; another seat's tsumogiri for ron), or (b) driving existing anchors with the
seat-parametric drive functions (`player = 3` at seed 3951, etc.). The mining
technique is established and documented: under all-tsumogiri play a dealt-tenpai
seat's 13 tiles never change, so win windows are deterministic; -02 used a temporary
`mine.test.ts` (deleted after capture) cross-checking candidates against the
derivation stack (isAgari/waits/yakuOf), never against legalActions itself.

## 7. Constraints and assumptions carried into design

- The app never computes legality; selectors return elements of `offered` (identity,
  not lookalikes). Wins must arrive the same way — `{type:'tsumo', seat}` /
  `{type:'ron', seat, tile}` are complete actions needing no construction.
- Extend-only enumeration order is frozen contract: tsumo at index 14 post-draw;
  rons between draw-head and pons at windows; rons-only at ryuukyoku.
- One predicate family: prompt visibility ⇔ loop wait must survive the widening
  (drive.test.ts pins the complementarity; those anchors stay green unchanged since
  none of them holds a player win offer).
- The riichi epic later adds riichi declaration offers and more furiten; the seam
  shape chosen here is what it extends.
- Scoring (han/fu, points) is NOT in this ticket — the hand-end screen names winner,
  tile, and yaku only. T-005-02-04 (conservation/determinism suite) is a sibling, not
  a dependency, and touches core dynamics tests only.
- `just test` (vitest over src/), `just check` (svelte-check + tsc), `just build`
  (single-file) are the verification commands; 401 tests green at baseline.
