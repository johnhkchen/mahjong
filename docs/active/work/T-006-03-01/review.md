# T-006-03-01 — discard-policy — Review

The handoff: what changed, how it is covered, what a human should look at.

## 1. What changed

| File | Change | Commit |
|---|---|---|
| `src/core/policy.ts` | **created** (116 lines) — `discardPolicy(view, offered)` | `04d1c8c` |
| `src/core/index.ts` | +1 line — `export * from './policy'` | `04d1c8c` |
| `src/core/policy.test.ts` | **created** (356 lines, 18 tests) | steps 2+3 commit |
| `docs/active/work/T-006-03-01/*` | six RDSPI artifacts | artifacts commit |

Nothing else touched. In particular `shanten.ts`, `legal.ts`, `seatview.ts`, and
`src/app/drive.ts` are unmodified; only this ticket's files were ever staged
(the working tree carries other threads' uncommitted diffs).

## 2. The shape of the work

One pure function, `discardPolicy(view: SeatView, offered: readonly
HandAction[]): HandAction`, three arms over the seat's own actions:

1. an offered **tsumo** is returned unconditionally;
2. offered **discards** are scored by resulting shanten (`shanten` over
   hand ∪ drawn minus the candidate, melds arity-passed) and the winner picked
   by strict-improvement comparison — minimal shanten, then **max distance from
   the center rank** (|rank − 5|, honors 5), then **earliest offered**;
3. the offered **draw** is returned.

Anything else throws `RangeError` (the shanten/waits posture). "Element of the
offered set" holds by construction — the function only ever returns elements of
`offered`, reference-identically. "Does not raise shanten" falls out of
minimality: the drawn tile is always among the offers, so the minimum is ≤ the
pre-draw shanten. No RNG, no ambient reads anywhere.

AC check: element-of-offered ✓; never raises shanten ✓; offered tsumo always
returned ✓; no RNG, same SeatView → same action (reference-identical, stronger
than required) ✓.

## 3. Test coverage

- **Every arm and both throw paths** have direct fixtures; both discard-offering
  state classes (post-draw 14, mustDiscard 11-with-meld) are exercised; each
  tie-break key has a dedicated fixture including both symmetric-tie cases
  (kinds 1p/9p, same-kind copies) falling to offered order.
- **Integration sweep**: whole seeded games driven by the policy's own choices,
  with an in-test oracle re-scoring every offered discard at every decision
  point — membership, tsumo-always, minimality, non-raise, termination within
  the dynamics ACTION_BOUND, plus byte-identical replay (the T-006-03-04
  rehearsal). Corpus 12 seeds + 6 fc-sampled + 3 replay-doubled.
- Full suite after: **501 tests / 21 files green**, `just check` clean; the
  purity gate covers the new module automatically.

Coverage gaps, honestly stated:

- **Kan-bearing offered sets are only reached statistically.** Policy-driven
  games never call, so a post-draw offered set containing ankan/shouminkan
  offers arises in the sweep only when a bot happens to draw into a concealed
  quad; no fixture pins "kan offered, discard still chosen". Construction is
  easy (a hand with four copies) — cheap follow-up if wanted.
- **The tsumo arm in the sweep is opportunistic**: closed policy-driven hands do
  win across seeds sometimes (`endPhase` admits 'agari'), but no assertion
  requires a tsumo to *occur* — that vacuity is acceptable here because the
  fixture layer pins the arm directly; T-006-03-04's harness is where win
  occurrence gets measured.
- **Chiitoi/kokushi-shaped discard decisions** are covered only via the
  combinator (`shanten` is the min-of-three) and the shapeless-hand argmin
  fixture, not by dedicated policy fixtures.

## 4. Open concerns / limitations

- **Deliberate deferrals to T-006-03-02** (both pinned by tests and documented
  in the module header): kan offers are never chosen, and an own pre-draw ron
  loses to the draw. The second is behaviorally wrong for a finished bot —
  "always take a legal ron" — but is exactly that ticket's AC; the pinning test
  names the ticket and will be flipped by it.
- **Strength ceiling, by design**: the tie-break is edge-first, not ukeire; the
  policy also never reads ponds/doras (no defense, no value-seeking). "Competent"
  here means never-misplays-shanten + deterministic; strength upgrades were
  explicitly scoped out in design.md §3 and isolated behind `centerDistance`.
- **Trust posture**: `view`/`offered` consistency is trusted (the driver derives
  both from one folded state). A malformed hand surfaces as shanten's RangeError
  — loud, not silent — but there is no cross-validation that `offered` matches
  the view. This is the codebase's established TileId/seed precedent.
- **Dependency on an uncommitted sibling**: `shanten` (T-006-02-02) is still an
  uncommitted working-tree diff. This ticket's commits compile and pass only
  with that diff present; Lisa's serialization is expected to land it — if that
  thread were rolled back instead, this module would not build. Flagging for
  the human eye since it is cross-thread state no test here can guard.

## 5. For the human reviewer

The one decision worth a look is design.md §3's tie-break choice (edge-first
over ukeire) — it fixes the bots' visible personality until a strength ticket
revisits it, and it is what the teaching layer will end up explaining. The
mechanical parts (argmin, arity arithmetic, purity) are property-swept against
real folds. Sweep cost is ~2.5s of test time, budget-commented in the file.
