# T-005-02-01 — tsumo-ron-actions-and-fold — Structure

File-level blueprint for design.md's decisions. Not code — the shape of it.

## 1. Files

| File | Change |
|---|---|
| `src/core/record.ts` | MODIFIED — the whole ticket's production surface (~+180 lines) |
| `src/core/win.test.ts` | NEW — the tsumo/ron fold suite (mined fixtures + corruption + convention + replay) |
| `src/core/record.test.ts` | TOUCHED — the one full TableState literal (:89) gains `drawnFrom: null, win: null`; nothing else |
| scratchpad `mine-wins.ts` | NEW, NOT COMMITTED — seed-mining script; its outputs land in win.test.ts as commented constants |

Untouched by design: `legal.ts` (-02's), `yaku.ts` / `yakuman.ts` /
`agari.ts` / `waits.ts` (consumed, not changed), `index.ts` (record.ts is
already exported), all app files, all other test suites (the houtei-via-
reconstruction choice exists to keep them green).

## 2. record.ts — internal organization

Ordered as the file reads today; new pieces slot into the existing zones.

### 2a. Imports

Add runtime import `yakuOf` and type import `WinYakuName` from `./yakuman`.
(Runtime edge record → yakuman → {agari, tiles, yaku}; back-edges into
record are type-only — no cycle.)

### 2b. HandAction (the CONTRACT FREEZE block, record.ts:12–70)

Two new members appended after `shouminkan`:

```ts
| { readonly type: 'tsumo'; readonly seat: Seat }
| { readonly type: 'ron'; readonly seat: Seat; readonly tile: TileId }
```

Doc additions to the freeze comment, mirroring the existing bullets:

- tsumo records no tile (wall-order authority, the `draw` rule); ron records
  the claimed tile (the chi/pon redundancy rule — mismatch throws).
- THE MULTIPLE-RON CONVENTION (the AC's documented home): exactly one ron
  ends a hand; where several seats could win one discard the recorder logs
  the single winner (the app driver picks by atamahane rotation, -03); a
  second ron is an action after the end and throws. Extend-only escape hatch
  noted (double-ron would be accepting what now throws).
- Chankan note: the shouminkan bullet's existing "no ron exists yet" aside
  updates to: ron exists but folds only against discards; `source:
  'chankan'` stays unreachable until a ticket splits shouminkan into
  announce/complete.

### 2c. TableState (record.ts:140–214)

- `drawnFrom: 'wall' | 'rinshan' | null` — documented in lockstep with
  `drawn` (null exactly when drawn is null; wall draws vs kan replacements;
  consecutive kans stay 'rinshan').
- `phase` union widens: `'playing' | 'ryuukyoku' | 'agari'`; its doc gains
  the agari ending and the ryuukyoku→agari houtei transition ("provisionally
  ended: extendable by exactly one ron, nothing else").
- `win` — the discriminated union from design §2 (tsumo arm / ron arm /
  null), non-null iff phase === 'agari'. Doc states the winning tile's zone:
  tsumo → still `drawn`; ron → still the discarder's pond (the claimed-tile
  precedent), `win.tile` is the mark, conservation untouched.

### 2d. New private helpers (between applyShouminkan and applyAction)

- `windKindOf(seat: Seat): WindKind` — `` `${seat + 1}z` `` with the cast
  contained. (Import `type WindKind` from `./yaku`.)
- `applyWin(state, action, index, winner, tile, source, from)` — the shared
  tail of both win steps: assemble concealed kinds (`hands[winner]` mapped
  through `kindOf`, plus the winning tile's kind), call `yakuOf` with
  `lastTile: state.live.length === 0`, `roundWind: '1z'` (documented
  constant, design §8), re-wrap yakuOf's non-completion RangeError with the
  action index, throw the yakuless-gate RangeError on `[]`, then set
  `state.win` (tsumo/ron arm by `from === null`), `state.phase = 'agari'`,
  `state.claimable = null`. Exact split between this helper and the two
  steps may shift at implementation; the guard ORDER below is the contract.
- `applyTsumo(state, action, index)` — guards in order: seat vs turn →
  mustDiscard → drawn === null ("before seat drew") → delegate to applyWin
  with `tile = state.drawn`, `source = state.drawnFrom` ('wall'|'rinshan'),
  `from = null`. Leaves `drawn`/`turn` in place.
- `applyRon(state, action, index)` — two entry arms:
  - playing: window null → throw; seat === window.seat ("ron of its own
    discard") → throw; action.tile !== window.tile → throw; delegate with
    `source = 'discard'`, `from = window.seat`.
  - ryuukyoku (houtei): reconstruct the final discard — discarder is
    `state.turn` (stays at last discarder, existing doc), tile is that
    pond's last element; same seat/tile guards against the reconstruction;
    delegate with `source = 'discard'`, `from = state.turn` — computed
    BEFORE `turn` moves.
  - Both arms end with `state.turn = action.seat` (claim-jump precedent).

### 2e. applyAction (record.ts:572–678)

- The top ended-phase guard gets the one carve-out: `ron` while phase ===
  'ryuukyoku' falls through to the switch; everything else after any end
  still throws the existing message (now naming 'agari' when relevant, via
  the untouched `${state.phase}` interpolation).
- `draw` case: sets `drawnFrom = 'wall'` beside `drawn = live.shift()`.
- `discard` case: nulls `drawnFrom` wherever it nulls `drawn` (two arms).
- `ankan`/`shouminkan` steps: null `drawnFrom` where they null `drawn`;
  `applyKanTail` sets `drawnFrom = 'rinshan'` beside its `drawn` fill.
- Two new switch cases dispatching to applyTsumo / applyRon.
- The turn-cycle doc comment gains the win arms and the houtei exception.

### 2f. foldRecord (record.ts:690–712)

Initial state gains `drawnFrom: null, win: null`. Nothing else.

## 3. win.test.ts — internal organization

Header comment: what the suite pins (the win fold's conventions) and how
fixtures were mined (script, criteria), the FOUR_KAN_SEED precedent.

- **Fixture constants** (from the mining script, each with a geometry
  comment): a tsumo seed + scripted prefix (dealt-tenpai East, tsumogiri
  until the wait arrives — menzen-tsumo guarantees the gate passes); a ron
  seed + prefix (winner's hand carries a non-tsumo yaku); a yakuless-ron
  seed + prefix (closed dealt-tenpai hand whose only yaku would be
  menzen-tsumo — ron on it is the gate-throw fixture); if mining yields
  them: haitei, houtei, rinshan, and a two-seat-wait fixture.
- **describe('tsumo folds')** — ended shape: phase 'agari', win arm fields,
  yaku list equals yakuOf's, `drawn` still holds the tile (zone), turn
  unmoved, claimable null, legal ended-guard: any following action throws.
- **describe('ron folds')** — ended shape with `from`; tile still in
  discarder's pond; turn jumped to winner.
- **describe('corrupt win actions throw')** — the AC's three, plus form
  guards: wrong-seat tsumo/ron, tsumo before drawing, tsumo while owing a
  claim discard, ron with no window, ron of own discard, ron tile ≠ window
  tile, ron/tsumo completing nothing (non-winning tile), yakuless ron (the
  gate), tsumo/ron after ryuukyoku-with-no-win where inapplicable, anything
  after agari.
- **describe('multiple-ron convention')** — either single ron folds to that
  winner; the double-ron log throws at index of the second.
- **describe('houtei and haitei')** (if fixtures mined) — ron out of
  ryuukyoku folds to agari with houtei among the yaku; last-draw tsumo
  carries haitei; rinshan tsumo carries rinshan and `drawnFrom` plumbing.
- **describe('replay determinism')** — foldRecord twice over each win log:
  deep-equal states, fresh `win.yaku` arrays, identical winner/tile/yaku
  (the AC's replay clause).

## 4. Ordering of changes (matters)

1. record.ts vocabulary + TableState fields + foldRecord init + drawnFrom
   plumbing (compiles alone; record.test.ts literal updated in the same
   change — everything still green before any win logic exists).
2. record.ts win steps + dispatch + docs (the behavior).
3. Mining script → fixtures → win.test.ts (the proof).
4. Doc-comment sweep (freeze block, phase, turn cycle) — kept beside the
   code it describes in the same commits.

## 5. Public interface deltas (index.ts barrel, automatic)

- `HandAction` — two new members (extend-only widening).
- `TableState` — `drawnFrom`, `win`, widened `phase` (derived-view growth).
- No new exported functions; `foldRecord`'s signature is unchanged.
