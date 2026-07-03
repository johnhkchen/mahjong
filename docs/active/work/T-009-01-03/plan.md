# Plan: T-009-01-03 furiten-completion

Each step is independently committable; tests accompany the step that makes them
meaningful rather than being batched at the end.

## Step 1 — `TableState` fields + fold mutation (`record.ts`)

- Add `tempFuriten`/`riichiFuriten` to the `TableState` interface (doc-commented).
- Add `completesWithYaku` and `sealPassedWins` helpers.
- Call `sealPassedWins` from `performDiscard`.
- Clear `tempFuriten[seat]` in `applyAction`'s `'draw'` case and in `applyKanTail`.
- Initialize both fields in `foldRecord`.
- Verify: `npx tsc --noEmit` (or `just check`) compiles; existing `record.test.ts` and
  every other suite that folds records still passes unmodified (these new fields are
  additive — no existing assertion reads or constrains them yet, so nothing should
  break; `structuredClone`-based purity checks in `legal.win.test.ts` will pick up the
  new fields automatically since they compare whole-state snapshots).
- **Verification criteria**: `just test` green with zero test file changes yet.

## Step 2 — `legal.ts` gate composition

- Extend `ronOffers`'s furiten check to OR in the two new state fields.
- Update `discardFuriten`'s and `ronOffers`'s doc-comments; amend the header's
  "THE FURITEN DIVERGENCE" closing note.
- **Verification criteria**: `just test` still green — no fixture in the current suite
  should change behavior yet, since `sealPassedWins` only just started running and no
  existing frozen fixture was mined with tempFuriten/riichiFuriten in mind. If any
  existing test's expectations DO shift (a previously-offered ron becomes withheld
  because some anchor incidentally passed a win earlier in its `scriptedTurns` prefix),
  treat that as a real finding: inspect whether the new gate is correct (likely yes)
  and update that fixture's expectation/comment to document the newly-visible fact,
  rather than treating it as a regression to code around.

## Step 3 — Mining: temp-furiten-without-self-furiten seed

Scratch script (not committed), using the now-real engine:

```
for candidate seeds (small deterministic range):
  live = dealtLive(seed)
  fold scriptedTurns incrementally, turn by turn
  at each post-discard state, for each seat:
    if seat is dealt-tenpai (has waits) AND discardFuriten(seat) is false
       AND state.tempFuriten[seat] just flipped true this step
       AND it flipped true from a discard NOT by seat itself (already implied,
           since discardFuriten stays false means seat's own pond never matched)
    record (seed, turn index, seat) as a candidate
  continue scripting a few more turns past the candidate's seat's next own draw,
  confirm tempFuriten[seat] is false there while riichiFuriten[seat] stays false too
    (no riichi declared in a pure scriptedTurns game)
```

Pick the first clean candidate (ideally one where the seat's wait is a single kind, to
keep the fixture comment simple). Record: seed, exact turn/action index of the pass,
exact turn/action index of the seat's next draw, and the tile/kind involved — in the
same comment style as `legal.win.test.ts`'s existing "Frozen anchors" block. Discard
the script once the seed is captured (scratchpad only, per repo convention: "Never
regenerate" — the values get hard-coded, the mining process is not preserved as a
runnable artifact).

**Verification criteria**: the candidate reproduces deterministically (fold it twice,
same result) before it's written into a test file.

## Step 4 — `legal.win.test.ts`: temp/riichi furiten offer-level tests

- Update `ronGates` oracle to OR in `state.tempFuriten[seat] || state.riichiFuriten[seat]`.
- Add `describe('temporary and riichi furiten', ...)` with:
  1. Non-riichi pass → `ron` withheld, `state.tempFuriten[seat]` true, fold of that
     SAME ron still succeeds (divergence preserved) — mirrors the existing "furiten
     divergence" tests' shape.
  2. Continue past that seat's next draw → `state.tempFuriten[seat]` now false; if a
     legal (non-furiten) ron exists for that seat at that later point, it's offered
     normally (proving the unseal is functional, not just a flag flip nobody reads).
  3. Riichi pass (seed 100 / `RIICHI_SEED`, extended past the existing
     `record.test.ts` prefix into a scripted continuation): `ron` withheld,
     `state.riichiFuriten[seat]` true; continue past the seat's own next draw (rinshan
     or wall) and reassert the ron is STILL withheld and `riichiFuriten[seat]` is
     STILL true (the temp/riichi distinction, directly contrasted against step 4.2's
     seat which unsealed).
  4. Tsumo offered regardless: at a tsumo point for a seat with `riichiFuriten` (or
     `tempFuriten`) true, assert `legalActions` still includes the `tsumo` offer —
     reuses an existing tsumo-point anchor, prefixed with whatever forces the furiten
     flag true first.
  5. Determinism: `foldRecord(sameRecord)` twice → `tempFuriten`/`riichiFuriten` arrays
     deep-equal across both folds, at a state where at least one is non-default.
- Add the new anchors to the existing "two-sided win partition" `anchors` array (line
  340) so the general property test also exercises them, unless doing so would require
  restructuring `scriptedTurns`-shaped prefixes (the riichi fixture is NOT a pure
  `scriptedTurns` sequence) — in that case leave the partition test's anchor list as
  pure-tsumogiri-only (its existing contract) and rely on the dedicated new tests for
  riichi-involving fixtures instead. Decide once the actual mined fixture shapes are
  in hand; document the choice inline if the partition list is left unchanged.
- **Verification criteria**: `just test` green; the new tests fail before Steps 1-2
  existed (sanity: temporarily verify by checking the assertions would have failed
  against the pre-change gate — not required as a committed step, just a mental check
  before finalizing).

## Step 5 — `record.test.ts`: fold-level tracking tests

- New `describe('furiten tracking', ...)` after the riichi block:
  1. Reuse `RIICHI_SEED`'s riichi fixture — after the pass, assert `state.tempFuriten`
     and `state.riichiFuriten` directly (not through `legalActions`) at the seat/array
     level, matching this suite's existing style (`record.test.ts` asserts fold
     internals; `legal.win.test.ts` asserts offer behavior — division of labor kept).
  2. The Step 3 non-riichi seed: assert `tempFuriten` sets then clears at the exact
     action indices mined, `riichiFuriten` stays all-false throughout (no riichi in
     this fixture).
  3. A direct unit check of the "any seat" loop: construct (or reuse) a fixture where
     TWO seats could both ron the same discard (multiple-ron shape, if such a fixture
     already exists elsewhere in the suite — check `record.test.ts`/`legal.win.test.ts`
     for an existing multi-ron anchor before mining a new one) and confirm BOTH get
     sealed, not just the one whose ron (if any) actually gets logged next.
- **Verification criteria**: `just test` green.

## Step 6 — Full suite + `just check`

- `just test` (all suites — property tests included, since `fast-check` runs
  hundreds of random `scriptedTurns` walks in `legal.win.test.ts`/`legal.test.ts`/
  `dynamics.test.ts` that now exercise the new fields incidentally).
- `just check` (svelte-check + tsc) — confirms no type drift, especially the
  `TableState` literal in `foldRecord` and any other place a `TableState` is
  hand-constructed (search for `TableState = {` / object literals typed as
  `TableState` outside `record.ts`, e.g. test helpers that build fixture states
  manually) needs the two new fields or a compile error surfaces immediately.
- **Verification criteria**: both commands exit 0.

## Testing strategy summary

- **Unit (fold-level)**: `record.test.ts` — new fields set/cleared at exact action
  indices, multiple-ron sealing.
- **Integration (offer-level, agreement suite)**: `legal.win.test.ts` — `ronGates`
  oracle extended, new fixtures for set/clear/permanent/tsumo-immunity, existing
  property test continues to hold with the extended oracle.
- **Determinism**: explicit re-fold-twice equality check (both suites' `structuredClone`
  purity tests already sweep in whatever new fields exist, plus one direct assertion).
- **No property test invents temp/riichi furiten "ground truth" independently** — per
  design.md's rejection of alternative D, the fold IS the only authority; property
  tests assert *implications* (furiten flag true ⇒ no ron offered) and *invariants*
  (riichiFuriten monotonic non-decreasing across a fold prefix sequence; tempFuriten
  false immediately after that seat's own draw), not a from-scratch recomputation of
  the flags themselves.
