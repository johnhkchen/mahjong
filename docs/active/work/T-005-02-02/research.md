# T-005-02-02 — legal-win-offers-and-furiten — Research

Descriptive map of what exists. The ticket: `legalActions` offers tsumo on a winning
drawn/rinshan tile and ron through the existing claim window at priority above
pon/kan above chi, gated by basic discard furiten (waits ∩ own pond) and the
one-yaku rule. Both dependencies are done: T-005-02-01 (tsumo/ron fold steps) and
T-005-01-02 (the waits derivation).

## 1. The two halves of the contract

- `src/core/legal.ts` — the OFFERED half: folded state in → exactly the actions the
  step function accepts next. Header doctrine: "Nothing here imports record.ts guard
  logic; the rules are re-stated in enumeration form on purpose." The two halves are
  locked together by the agreement suite (`legal.test.ts`), not by shared code.
- `src/core/record.ts` — the FOLDING half: `foldRecord` + `applyAction`, the single
  authority on what folds. Already accepts `tsumo`/`ron` (T-005-02-01).

`legalActions(state)` today (legal.ts:169–187) has four state classes with a frozen
enumeration order that is contract ("bots and generators may sample by index"):

1. `phase !== 'playing'` → `[]` (agari AND ryuukyoku — see §3 houtei gap).
2. `mustDiscard` → the caller's hand discards, hand order, nothing else.
3. `drawn === null` → `[draw]` first, then, when `claimable !== null`, claim offers:
   all pons, then all daiminkans, then all chis (`claimOffers`, seats scanned in
   rotation order from the discarder's right; every copy combination its own offer).
4. `drawn !== null` → the 14 discards (13 hand tiles in hand order, drawn last),
   then `ankanOffers`, then `shouminkanOffers` (both behind `kanAllowed`).

The extend-only promise (legal.ts:165–167): "riichi/agari tickets grow this
enumeration; existing offerings never change shape, and the draw-first /
14-discard-prefix positions stay stable." Only those two positions are promised
stable — claim-block indices are not, so inserting ron between the draw and the
pons is within the freeze, as the AC requires.

Purity gate (`purity.test.ts`): runtime core modules may import only `./siblings`.
`waits`, `yakuman`, `yaku` are all siblings — importable from legal.ts.

## 2. What T-005-02-01 built (the fold side, frozen)

- Vocabulary: `tsumo` records NO tile (the drawn tile is wall authority); `ron`
  records the claimed `tile` (chi/pon redundancy rule). Record.ts:64–92.
- State: `drawnFrom: 'wall' | 'rinshan' | null` in lockstep with `drawn`; `phase`
  widened with `'agari'`; `win` union (by/winner/tile/yaku, ron adds `from`).
- `applyWinTail` (record.ts:629–666): assembles a `Win` for `yakuOf`, throws on a
  non-completing tile and on a yakuless completion — "the ONE-YAKU WIN GATE's
  refusal — a yakuless win action is corruption; legality (T-005-02-02) never
  offers one." Fold constants it uses: `windKindOf(seat)` = `${seat+1}z`,
  `ROUND_WIND = '1z'` (module-local, NOT exported — the independence doctrine
  means legality re-states them).
- `applyTsumo`: guards turn / mustDiscard / drawn-present, then the win tail with
  `source = drawnFrom` verbatim ('wall' or 'rinshan') and
  `lastTile = live.length === 0`.
- `applyRon`: two arms. Playing: against the open claim window (like chi/pon).
  Ryuukyoku — THE HOUTEI ARM: folds OUT of the provisionally-ended phase against
  the reconstructed final discard (`turn` stays at the last discarder; that pond's
  last tile IS the final discard). Guards: not own discard, tile names the fresh
  discard, then the win tail.
- **The fold does NOT check furiten anywhere** (no occurrence of the word in
  record.ts). Its doctrine: "knowing who else could have won is legality's
  business (waits over every seat), never the step function's." A furiten ron
  FOLDS. Furiten gating exists only at the offering layer — this ticket.
- Multiple-ron convention: exactly one ron ends a hand; the recorder picks; a
  second ron throws 'already ended in agari'. Legality's job is to enumerate every
  simultaneously legal ron; atamahane selection is -03's driver.
- The -01 review's explicit handoff (§5): "-02 must not offer what the fold
  rejects: yakuless completions (yakuOf []) ... and must offer houtei through the
  ryuukyoku carve-out and tsumo on rinshan draws (drawnFrom is the state to read)."

## 3. The houtei gap

`legalActions` returns `[]` for every `phase !== 'playing'`, but the fold accepts a
houtei ron out of 'ryuukyoku'. -01 review §3.1: "T-005-02-02 must mirror this
carve-out when it offers houtei ron (its `phase !== 'playing'` early-return needs
the same exception)." In ryuukyoku, `live` is empty, so `lastTile` is true and the
completion always carries the 'houtei' yaku — the one-yaku gate cannot exclude a
houtei completion.

## 4. The waits module (T-005-01-02) — built for this ticket

`waits(concealed, melds): TileKind[]` (waits.ts:53–70) — "the one datum ron
offering, furiten gating, and tenpai teaching all read." Facts that matter here:

- Input arity: exactly `13 − 3·melds` concealed KINDS (the between-turns hand — no
  drawn or claimable tile); wrong arity throws RangeError (caller corruption).
- Probes each of the 34 kinds through `isAgari` — cannot drift from the decomposer.
- Exhaustion convention: a kind all four of whose copies are visible to the hand
  itself is never a wait. Harmless for probing a physically-present discard: if the
  hand accounted for all 4 copies, no opponent could discard that kind — so for a
  window tile, `waits(...).includes(kind)` ⟺ `isAgari([...kinds, kind], melds)`.
- Ponds keep the complete discard history — claimed-away tiles stay counted in the
  discarder's pond (Meld doc: "furiten and defense reads treat a claimed-away tile
  as still discarded"). So "waits ∩ own pond" reads `state.ponds[seat]` directly,
  comparing at kind level (`kindOf` per pond TileId).
- Cost: one `waits` call is up to 34 `isAgari` probes. `legalActions` runs at every
  fold step of the dynamics drivers, so per-window cost matters (§6).

## 5. The yaku aggregator (yakuOf)

`yakuOf(win: Win): WinYakuName[]` (yakuman.ts:254). `Win` fields: `concealed`
(winner's kinds INCLUDING the completing tile), `melds`, `winningKind`, `source`
('wall'|'rinshan'|'discard'|'chankan'), `lastTile`, `seatWind`, `roundWind`.
Throws on a non-completing hand; returns `[]` for a yakuless completion — the
datum the one-yaku offer gate reads. Deterministic order (contract). The catalog
includes 'haitei', 'houtei', 'rinshan', so wall-edge completions are never
yakuless. `WindKind`, `yakuOf`, `waits`, `isAgari` are all exported via `./index`.

## 6. Existing tests this ticket will disturb

`legal.test.ts` (859 lines, the agreement suite; helpers `keyOf`, `prefixArb`,
frozen ANCHORS from mined seeds):

- "pre-draw: every further offer claims the open window" — asserts every non-draw
  offer's type ∈ {pon, daiminkan, chi}. A ron offer at a random tsumogiri window
  (dealt-tenpai seat, ~1/10⁴ per seat — seeds exist: 3951) breaks it. Must widen.
- "pon and daiminkan offers all precede every chi offer" — the `slice(1, firstChi)`
  sort check assumes only pon/daiminkan before chis; a ron in that span breaks it.
- "post-draw: any tail is the turn seat's kans" — asserts tail types ∈
  {ankan, shouminkan}; a tsumo offer breaks it.
- "a ryuukyoku fold returns no legal actions (property)" + "kan-shortened
  ryuukyoku offers nothing" — houtei offers make ryuukyoku non-empty when a seat
  can win the final discard. Property needs restating.
- Exhaustive partitions (`expectPartition`, claim/kan candidate spaces at frozen
  anchors): candidate spaces contain no win actions, and the completeness check
  filters by `offeredTypes` — structurally unaffected, but the seed-1 'ended'
  anchor asserts `offered.size === 0` on a ryuukyoku fold (re-verify under houtei).
- Two-sided premise "everything outside the offered set throws" gains its FIRST
  deliberate divergence: a furiten ron is not offered but folds (§2). Any new
  win-candidate partition must state this.

`dynamics.test.ts`: `playRecord` (random-legal driver) and `playGreedy` pick from
`legalActions` — once wins are offered, games can end in 'agari'. Affected:
"every randomly driven full game ends in ryuukyoku" + `expectEndIdentities`
(draws + kans === FULL_TURNS assumes wall exhaustion); the greedy corpus test
asserts every game ends ryuukyoku AND covers all five call forms — `isCall`
(anything not draw/discard) would make greedy prefer wins, ending games early and
possibly starving call coverage. `countTypes`/`withSeat` already carry tsumo/ron.

`win.test.ts` (fold-side suite): untouched by design, but its mined fixtures are
directly reusable as offer anchors: seed 3951 (seat 3 dealt tenpai, pinfu waits
1s/4s/7s; ron window at turn 0 tile 72; tsumo point at turn 35 draw 85), seed
12754 (yakuless ron window at turn 2 tile 101), seed 103897 (houtei ron seat 2
tile 72 after 70 turns), seed 47821 (haitei tsumo), seed 29732 (rinshan tsumo
after ankan, drawn 22). Fixture-mining precedent: under tsumogiri a seat's 13-tile
hand never changes, so dealt-tenpai seats give deterministic win points; scripted
`swaps` (tedashi) reach shapes pure tsumogiri cannot.

Furiten geometry available for free: seed 3951 continued PAST turn 35 —
tsumogiri makes seat 3 discard its own wait (85, 4s), making it furiten; any
later wait-kind discard by another seat is a window where the ron must NOT be
offered though the fold would accept it. The exact later turn needs mining.

## 7. Constraints and assumptions

- Riichi-specific furiten refinements (temporary furiten after a passed ron,
  riichi permanent furiten) are OUT of scope: the ticket names basic discard
  furiten only — waits ∩ own pond, whole-seat gate (any wait in own pond kills
  every ron offer for that seat).
- No riichi state exists yet anywhere in core; nothing to read for it.
- `legalActions` must stay a pure read: fresh arrays/literals per call, same
  state → same array (existing purity/freshness properties sweep all anchors).
- Deterministic order is contract; the AC freezes ron ahead of pon/daiminkan/chi.
  Tsumo's position in the post-draw class is unfrozen — a design decision.
- Barrel export: legal.ts is already `export *` in index.ts; no index change.
- Verification loop: `just test` (vitest, 385 tests/16 files green today),
  `just check` (svelte-check + tsc), `just build` (singlefile).
