# Progress: T-009-01-03 furiten-completion

## Completed

1. **`TableState` fields** (`record.ts`): added `tempFuriten`/`riichiFuriten`,
   Seat-indexed boolean tuples, doc-commented, initialized to all-false in
   `foldRecord`.

2. **`completesWithYaku`/`sealPassedWins`** (`record.ts`): a record.ts-local
   restatement of legal.ts's `winYaku`, gated on `isAgari` first for cost
   (mirrors `ronOffers`' cheapest-gates-first convention). `sealPassedWins` loops
   the three non-discarder seats and seals `tempFuriten` (always) and
   `riichiFuriten` (only when already locked) for any seat the discard
   `completesWithYaku` for.

3. **Correct call sites — found and fixed a real bug mid-implementation.** My
   first pass called `sealPassedWins` from `performDiscard` itself (at discard
   time). Running the full suite exposed it immediately: `selfplay.test.ts`'s
   `ronWins` count dropped to 0 and several bot-driven games broke outright,
   because sealing at discard time gates the SAME window's ron offer before the
   seat has had any chance to act on it — a seat's very first legalActions query
   on its own winning discard would already see itself as furiten. Moved the
   seal to the three places a window actually CLOSES without that ron: the
   `'draw'` case in `applyAction` (guarded on `state.claimable !== null`),
   `applyClaim`, and `applyDaiminkan`. A second bug surfaced here too: sealing
   from `applyClaim`/`applyDaiminkan` AFTER the claiming seat's hand was already
   spliced for the new meld corrupted the completion probe (`decomposeAgari`
   threw "requires 11 concealed tiles ... got 12") — fixed by moving the seal
   call to BEFORE the hand-mutating splice in both functions.

4. **Performance**: `completesWithYaku` gates on `isAgari` before ever calling
   `yakuOf`, avoiding the try/catch path for the common case (most discards
   complete nobody's hand). Without this, `dynamics.test.ts`/`legal.test.ts`'s
   exhaustive/property suites intermittently timed out under full-suite load.

5. **`legal.ts`**: `ronOffers` ORs `state.tempFuriten[seat]`/`riichiFuriten[seat]`
   alongside the existing `discardFuriten` self-pond check. Doc-comments updated
   (module header's "THE FURITEN DIVERGENCE", `discardFuriten`, `ronOffers`).

6. **Tests**:
   - `record.test.ts`: new `describe('furiten tracking (T-009-01-03)', ...)` —
     fold-level set/clear assertions for a non-vacuous temp-furiten pass (seed
     3951 / RON_SEED), the vacuous immediate-next-actor case (seed 4851 /
     COEXIST_SEED — the regression guard against reintroducing the discard-time
     bug), determinism (re-fold twice, same arrays), and a riichi'd seat's
     permanent seal (seed 100, extending the existing riichi fixture).
   - `legal.win.test.ts`: `ronGates`' oracle now ORs in
     `state.tempFuriten[seat]`/`riichiFuriten[seat]` (read straight off state —
     these two facts have exactly one authority, the fold, per record.ts's own
     doc-comments on why they can't be recomputed from a snapshot). New
     `describe('temporary and riichi furiten (T-009-01-03)', ...)` — ronOffers
     withheld through the sealed span (offer-level mirror of the record.test.ts
     fixture), tsumoOffer's total absence of a furiten gate (one synthetic
     state override — no natural fixture combines a permanent riichiFuriten seal
     with a later tsumo point for the seeds this suite already anchors), and the
     riichi-permanent-vs-temp-clears contrast.

## Concurrency note

This ticket's implementation overlapped, in the same working tree, with a
concurrently running T-009-01-02 (riichi-yaku-family-and-uradora) thread —
Lisa's documented concurrency model (multiple threads on one branch, file
locking as the safety net, not full isolation). `legal.ts`/`record.ts`/
`legal.win.test.ts` were touched by both tickets' work simultaneously; the
other thread's own commits ended up carrying my changes to those three files
(git history shows them landing under T-009-01-02's commit messages, e.g.
"Wire legal.ts's winYaku to real riichi/ippatsu status"). Verified after each
of their commits that the full suite (`just test`, `just check`) stayed green
with my furiten logic intact. Only `record.test.ts` (untouched by their work)
needed a commit of its own.

## Verification

- `just check` (svelte-check + tsc): 0 errors.
- `just test`: 33 files / 863 tests, all green (including the pre-existing
  `legal.win.test.ts` "two-sided win partition" property test, now exercising
  the extended three-way furiten gate over its full random sweep).

## Open items for Review

None outstanding — see review.md.
