# T-005-02-01 — tsumo-ron-actions-and-fold — Plan

Ordered, independently verifiable steps over structure.md's blueprint. Gate
for every step: `just test` + `just check` green before committing.

## Step 1 — state plumbing: drawnFrom, win, phase widening (commit 1)

record.ts only, no win behavior yet:

1. Add `drawnFrom` and `win` fields to TableState with their docs; widen
   `phase` with `'agari'` and extend its doc.
2. Plumb `drawnFrom`: `'wall'` in the draw case; `'rinshan'` in applyKanTail;
   null beside every `drawn = null` (discard's two arms, applyAnkan,
   applyShouminkan); `null` in foldRecord's initial state alongside
   `win: null`.
3. Update record.test.ts:89's TableState literal (`drawnFrom: null,
   win: null`).

Verify: full suite green — proves the plumbing is invisible to every
existing fold. Commit: `T-005-02-01: drawnFrom/win state plumbing, phase
widens with 'agari'`.

## Step 2 — the vocabulary and the win steps (commit 2)

record.ts:

1. Append the `tsumo` and `ron` HandAction members; extend the CONTRACT
   FREEZE doc with their bullets, THE MULTIPLE-RON CONVENTION paragraph, and
   the chankan-note update (structure §2b).
2. Imports: `yakuOf`, `type WinYakuName` from `./yakuman`; `type WindKind`
   from `./yaku`.
3. `windKindOf`, `applyWin`, `applyTsumo`, `applyRon` per structure §2d —
   guard orders are design §9's contract. applyWin details:
   - concealed = `state.hands[winner].map(kindOf)` + winning tile's kind;
   - `yakuOf({concealed, melds: state.melds[winner], winningKind,
     source, lastTile: state.live.length === 0, seatWind:
     windKindOf(winner), roundWind: '1z'})`;
   - catch/re-throw of the non-completion RangeError → message with action
     index ("does not complete a win"); `[]` → the yakuless-gate throw;
   - success: `state.win`, `state.phase = 'agari'`, `state.claimable =
     null`; ron additionally `state.turn = winner`.
4. applyAction: ended-guard carve-out (ron at ryuukyoku falls through), two
   dispatch cases, turn-cycle doc additions.

Verify: suite green (nothing exercises the new members yet); `just check`
proves the union widening type-checks everywhere (legal.ts's exhaustive
switch-free style has no default-case problem; record.test's literals fine).
Commit: `T-005-02-01: tsumo/ron vocabulary and win steps — fold ends in
agari`.

## Step 3 — mine the fixtures (no commit; scratchpad)

Script `mine-wins.ts` in the scratchpad, run via `flox activate -- npx tsx`
(or vitest bench-style one-off). Mining strategies, in order of need:

- **tsumo**: scan seeds; keep those where East's deal `isTenpai`; simulate
  all-seats tsumogiri (the `tsumogiriRecord` shape) watching East's draws
  for a wait kind; menzen-tsumo guarantees the gate. Emit seed + prefix
  length + expected winner/tile/yaku.
- **ron**: same scan, but watch OTHER seats' tsumogiri discards for East's
  wait; keep only completions where `yakuOf` (source 'discard') is
  non-empty. Completions where it IS empty become the **yakuless-ron**
  gate fixture — same loop, two outputs.
- **haitei**: tsumo scan filtered to "the completing draw is the 70th"
  (live empties) — more seeds, same loop.
- **houtei**: ron scan filtered to "the completing discard is the final
  one" — fold to ryuukyoku, then ron.
- **rinshan**: scan for a seat dealt four-of-a-kind whose post-ankan hand is
  tenpai; ankan → rinshan draw ∈ waits. Rarest; if the plain scan stalls,
  widen (any seat, allow one preparatory draw) before declaring it unmined.
- **two-seat wait** (multiple-ron fixture): during the ron scan, note
  discards completing TWO seats' hands with yaku. If none surfaces in
  budget, the convention test falls back to: valid ron folds, appending a
  second ron (any seat) throws — still exercises the documented convention.

Each emitted fixture is verified by folding before it's accepted. Budget:
this step is exploratory; strategies that stall get the documented fallback
rather than unbounded mining.

## Step 4 — win.test.ts (commit 3)

Write the suite per structure §3, fixtures as constants with geometry
comments (which seed, who is tenpai on what, where the wait arrives).
Coverage inventory against the AC:

- ended phase carrying winner/tile/yaku — tsumo + ron describe blocks;
- replay reproduces the identical win — the determinism block (fold twice,
  deep-equal, fresh arrays);
- corrupt actions throw — wrong seat (tsumo by non-turn seat; ron by the
  discarder), non-winning tile (ron tile ≠ window; ron/tsumo that complete
  nothing), yakuless (the mined gate fixture), plus sequence corruption
  (tsumo before draw / while owing claim discard; ron with no window;
  anything after agari);
- multiple-ron convention — the two-ron log throws at the second ron's
  index (plus the two-winner fixture if mined);
- houtei/haitei/rinshan — circumstance yaku present; houtei exercises the
  ryuukyoku→agari arm; skip-with-note any unmined fixture.

Also: conservation spot-check (allZonesWithMelds equivalent over an agari
state — all 136 ids, winning tile still in drawn/pond) so -04 inherits a
pinned convention. Verify: suite green. Commit: `T-005-02-01: win fold
suite — mined fixtures, corruption, multiple-ron, replay`.

## Step 5 — review pass (commit 4 if needed)

- Re-read the changed doc blocks against actual behavior (freeze block,
  phase doc, turn-cycle doc, win-zone doc).
- `just build` once — the app compiles against the widened types.
- progress.md finalized; review.md written.

## Testing strategy summary

Unit: win.test.ts (new behavior), record.test.ts (one literal, otherwise
untouched — its staying green IS the no-regression statement). Property:
existing dynamics/legal suites unchanged by design; the new suite adds the
replay-determinism fold-twice checks over win logs. Integration beyond core:
none — app consumption is -03. Explicitly NOT tested here: legality offers
(-02), furiten (-02), scoring (absent by charter), chankan (unreachable,
documented).

## Risks / contingencies

- Mining stalls on rare fixtures (rinshan, two-seat wait): documented
  fallbacks above; the AC does not require them, the design does not depend
  on them.
- yakuOf's non-completion throw lacks the action index: re-wrapped at the
  step boundary — test asserts the index is present.
- Hidden TableState literals beyond record.test.ts:89: `just check` finds
  them in step 1 (grep says there are none).
