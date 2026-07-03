# T-005-02-01 — tsumo-ron-actions-and-fold — Research

What exists in the codebase that this ticket builds on, and the constraints it
inherits. Descriptive only; decisions live in design.md.

## 1. The ticket in one line

Widen the extend-only HandAction vocabulary with `tsumo` and `ron`, and teach
foldRecord to end the hand deterministically — winner, winning tile, and
satisfied yaku recorded in TableState. AC: folding a log ending in tsumo/ron
yields an ended phase carrying winner/tile/yaku names; replay reproduces the
identical win; corrupt win actions (wrong seat, non-winning tile, yakuless)
throw loudly; the multiple-ron convention is documented in record.ts and
exercised by a test.

## 2. The fold as it stands (record.ts, 712 lines)

`HandAction` is a 7-member union (draw, discard, chi, pon, daiminkan, ankan,
shouminkan) under an explicit CONTRACT FREEZE (record.ts:14–43): extend-only;
"agari tickets add members". Frozen conventions directly relevant here:

- Every action carries the acting `seat` as **deliberate redundancy** — a
  wrong-seat action is corruption and throws (record.ts:19–21).
- `draw` records NO tile (wall order is the single authority); `chi`/`pon`
  record the claimed `tile` even though it is derivable from the claim window
  — a mismatch is corruption and throws (record.ts:29–34). Ron faces the same
  choice: its tile is derivable from `claimable`.
- RangeError naming the action index is the uniform corruption signal
  (applyAction doc, record.ts:566–570).

`TableState` (record.ts:140–214) is "a DERIVED VIEW, not a frozen contract:
this shape may grow fields … without invalidating any stored hand". Fields the
win step will read: `hands`, `drawn`, `claimable`, `live`, `melds`, `turn`,
`mustDiscard`, `phase`. `phase: 'playing' | 'ryuukyoku'` is documented as "a
widenable literal union: agari tickets add winning endings" (record.ts:213).

The turn cycle (applyAction, record.ts:540–678): draw fills `drawn` and closes
the claim window; discard opens the window (unless it ends the hand); claims
jump the turn; kans end in `applyKanTail` (kan-dora flip, rinshan draw into
`drawn`, live tail into the dead wall). The ended-phase guard is the FIRST
check — any action after the end throws.

Zone conservation invariant (record.ts:200–205, exercised by
dynamics.test.ts:238): every tile id lives in exactly one of hands / melds'
own / ponds / drawn / live / dead at all times. A win step must state where
the winning tile sits in the ended state.

## 3. The ending this ticket must coexist with: ryuukyoku

The discard step flips `phase` to `'ryuukyoku'` the moment the wall-emptying
discard lands (record.ts:643–650), and "an ended hand never holds a window" —
`claimable` stays null (record.ts:190–193, 561–564). **Consequence: houtei
(ron on the final discard) is unreachable through the current fold** — the
final discard never opens a window and the ended-phase guard rejects
everything after. yaku.ts already defines houtei (yaku.ts:298–301) and its
`lastTile` circumstance; the fold cannot yet produce a WinContext for it.
Tests currently pinning this behavior: record.test.ts:264 ("ends exactly when
live is empty"), record.test.ts:523 (claims after ryuukyoku throw),
dynamics.test.ts:254–262 (ryuukyoku end shape asserts `claimable` null),
legal.test.ts:365/375 (ryuukyoku offers nothing).

## 4. The aggregator built for this ticket (yakuman.ts)

`yakuOf(win: Win): WinYakuName[]` (yakuman.ts:254–281) is "THE aggregator:
… the single win → yaku-name-list read the tsumo/ron fold (T-005-02-01)
records and win legality (T-005-02-02) gates on" (yakuman.ts:1–3). Its
contract, all decided in -04 and frozen:

- `[]` means "this completion carries no yaku" — the ONE-YAKU WIN GATE's
  refusal signal consumers must honor.
- A NON-completion (decomposeAgari returns no readings) is caller corruption
  and **throws RangeError** — so `[]` stays unambiguous for the gate.
- Yakuman supersede standard yaku; every satisfied yakuman is listed; standard
  yaku are the union across readings. Deterministic name order.

Its input `Win` (yakuman.ts:79–94) is what the fold must assemble:
`concealed` (winner's concealed tiles INCLUDING the completing tile, as
kinds), `melds`, `winningKind` (kind-level), `source: 'wall' | 'rinshan' |
'discard' | 'chankan'`, `lastTile`, `seatWind`, `roundWind`. The doc note:
"the fold assembles one object" (yakuman.ts:75–78).

Gaps between what `Win` needs and what the fold knows today:

- **source**: nothing in TableState records whether `drawn` came from the
  live wall or a rinshan draw (applyKanTail fills `drawn` identically,
  record.ts:352). A tsumo step cannot distinguish 'wall' from 'rinshan'
  without new derived state.
- **chankan**: record.ts:478–479 says "Chankan — robbing this kan — is an
  agari epic's concern; no ron exists yet." But shouminkan folds atomically
  (meld replaced + kan tail in one step, record.ts:481–538) — there is no
  moment between the announcement and the rinshan draw for a robbing ron to
  fold into. Supporting chankan means restructuring shouminkan into two
  steps or an equivalent window mechanism.
- **seatWind**: derivable — `${seat + 1}z`; Seat 0 IS East the dealer
  (deal.ts:15, yaku.ts:101–106).
- **roundWind**: "match structure the engine does not hold (records are
  single hands), so both winds arrive … as plain kinds the caller supplies"
  (yaku.ts:103–105). HandRecord is seed + actions "and nothing else"
  (record.ts:72–87). The fold has no round wind source; something must supply
  or fix it.
- **lastTile**: derivable — `live.length === 0` at the win. yaku.ts:117–121
  fixes the convention: lastTile is consulted only for wall/discard sources
  (a rinshan win on an emptied wall is rinshan, never haitei).

## 5. The substrate reads the win step composes

- `decomposeAgari(concealed, melds)` (agari.ts:186–210): kind-level, concealed
  INCLUDING the completing tile, melds read for arity only; `[]` = not a win;
  wrong arity throws. `isAgari` is the boolean read.
- `kindOf(id)` (tiles.ts:57) maps the physical TileId the fold holds to the
  TileKind level yakuOf wants.
- `waits` (waits.ts) exists but is a -02 concern (furiten gating); the fold
  itself never needs it — a ron's validity is `isAgari(hand + tile)` plus the
  yaku gate, both via yakuOf's own throws/refusal.

Import direction check: record.ts adding a runtime import of yakuman.ts
creates record → yakuman → {agari, yaku, tiles}; yaku.ts and agari.ts import
only `type Meld` from record.ts (type-only, erased at runtime) — no runtime
cycle. purity.test.ts checks core stays DOM-free, not import topology.

## 6. The offered half (legal.ts) — explicitly out of scope

legal.ts re-states the turn cycle in enumeration form, deliberately sharing no
code with the fold; the two are locked together by legal.test.ts's agreement
suite. T-005-02-02 (depends on this ticket) adds tsumo/ron OFFERS and furiten
gating there. This ticket only changes what FOLDS. Note: legal.ts:169 returns
`[]` whenever `phase !== 'playing'` — if the design lets a ron fold out of an
ended-ish state (houtei), -02 inherits that seam.

## 7. Multiple-ron: what exists to hang the convention on

Nothing yet — the ticket requires choosing and documenting the convention in
record.ts. The claim window is single-slot (`claimable: {seat, tile} | null`);
the fold is strictly sequential, so "simultaneous" rons can only be adjacent
log entries against the same window. The ticket AC says the ended state
carries "winner" (singular). Downstream consumers of the singular reading:
-03's hand-end screen ("names winner, winning tile, and the yaku made") and
-04's determinism suite ("the same winner/tile/yaku").

## 8. App-side consumers of the widened surface

- Table.svelte:48 `table.phase === 'playing'`, :111 `phase === 'ryuukyoku'`
  — positive literal checks; new phase members don't break them (they render
  nothing new until -03).
- App.svelte:54 mentions "the empty offering at ryuukyoku" — reads legality,
  not phase.
- drive.ts never reads `phase` directly.

## 9. Test infrastructure and precedents

- record.test.ts (1121 lines): scripted-prefix style — known seeds, hand-mined
  tile-id constants with geometry comments (FOUR_KAN_SEED at :677, kan
  prefixes at :628–742); `tsumogiriRecord(seed, turns)` builds full-hand
  logs; `expectThrows(prefix, bad, fragment)` asserts corruption messages.
- dynamics.test.ts: index-sampled legalActions driver (`fc` property tests)
  for conservation/determinism/termination. legalActions doesn't offer wins,
  so this ticket's fold changes don't perturb the random driver — but new
  assertions there pinning "claimable null at ryuukyoku" (:262) collide with
  any houtei design that retains the final window.
- yakuman.test.ts constructs `Win` objects directly (no fold); its per-yakuman
  table is independent of this ticket.
- Reaching a REAL win through a legal log requires seed mining (no existing
  helper): dealt-tenpai scans over seeds are cheap (foldRecord of the empty
  log + `isTenpai`), and any closed dealt-tenpai hand that draws its wait has
  menzen-tsumo by construction — a guaranteed-yaku tsumo source. Ron needs a
  non-menzen-tsumo yaku (mining must check `yakuOf` non-empty); a yakuless
  closed ron is conversely the natural gate-throw fixture. haitei/houtei/
  rinshan wins carry their own circumstance yaku, so any mined completion at
  the right moment passes the gate.

## 10. Constraints inherited

- Extend-only vocabulary: existing action members never change shape; new
  members follow the seat-redundancy and derivable-tile conventions.
- Same record → same folded state, forever (foldRecord doc, record.ts:680–688)
  — the win must be a pure function of the log, evaluated eagerly at fold time
  (the yakuless-throw AC requires evaluation inside the fold).
- Determinism: yakuOf is pure and deterministic; storing its result in
  TableState keeps replay-reproduces-the-win automatic.
- Commit style: `T-005-02-01: <what>` (git log precedent), incremental.
- `just test` (vitest over src/core), `just check` (svelte-check + tsc) gate
  every step.
