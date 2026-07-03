# Review — T-009-02-01 bot-riichi-policy

## 1. Summary

Extends `discardPolicy` (`src/core/policy.ts`) so bots declare riichi on purpose: whenever
the discard tie-break it already runs lands on tenpai (shanten 0), the matching `riichi`
offer for that exact tile is declared instead of the plain discard, unless doing so would
lock in a dead wait (every kind that could ever complete the hand already fully visible to
the seat's own hand and melds — a hand that can win by neither ron nor tsumo). Furiten
(wait sitting in the seat's own pond) is deliberately **not** an exception — a furiten riichi
can still tsumo and is a real, if conservative, choice; only a truly unwinnable hand is
avoided.

The key structural insight (verified empirically, not assumed): `legal.ts`'s `riichiOffers`
scans the exact same candidate tiles, in the exact same order, under the exact same
shanten-0 condition the discard arm's own minimality scoring already uses. So whenever the
existing tie-break's minimum is 0, a matching riichi offer for that tile is *guaranteed*
present (when the seat is riichi-eligible at all). No new scan or comparator was needed —
only a one-tile lookup into `offered` plus the dead-wait check. This kept the change to
exactly one arm of one function, with zero changes to `legal.ts`, `record.ts`, `seatview.ts`,
or `index.ts` (the riichi vocabulary, its offering, and `SeatView`'s surface were already
everything this ticket needed).

Five commits, each independently green (`just test src/core/policy.test.ts` + `just check`):

1. `9d5a944` — `isDeadWait` helper, added but unwired (isolated for review).
2. `90b34c5` — wired into `discardPolicy`; all 34 pre-existing tests passed unchanged,
   confirming the new branch is a no-op against every fixture that doesn't offer riichi.
3. `5926715` — three curated tests: declares (realistic full offered set, unique shanten-0
   tile), declines on a dead wait (curated 2-element offered set — the realistic full
   offered set never reaches this candidate at all, see §3), ignores another seat's offer.
4. `64a77f6` — extends the standing purity/determinism checks to a riichi-returning case.
5. `c32c1aa` — widens the seeded whole-game sweep: a `riichiFolded` counter, a per-step
   shanten-0 oracle re-derivation for folded riichi actions (generalizing the existing
   discard-minimality check, since both variants carry `.tile`), and a non-vacuous
   `riichis > 0` assertion over the fixed 12-seed corpus.

## 2. Files changed

Only `src/core/policy.ts` and `src/core/policy.test.ts` (155 insertions, 6 deletions across
5 commits — `git diff --stat HEAD~5 HEAD`). No `src/app/` changes. No new files.

`docs/active/work/T-009-02-01/` holds all six phase artifacts.

## 3. Notable findings during implementation

- **The realistic full offered set can "protect" a bot from its own dead-wait exception
  without the exception ever firing.** Research/Plan's dead-wait fixture
  (`1111m234p567p789s` + drawn `9m`) turned out to have *five* shanten-0 candidates, not
  one: each of the four `1m` copies (leaving a live `9m` tanki wait) and the drawn `9m`
  itself (leaving the dead `1111m...` tenpai). All five tie on center-distance (1 and 9 are
  symmetric), and the existing tie-break's "earliest offered" rule picks a `1m` copy (hand
  order, scanned first) over the drawn `9m` (offered last) — so with a *realistic* offered
  set, the policy never actually reaches the pathological candidate; it happens to prefer
  the live wait anyway, for an unrelated reason (offered order). The decline test therefore
  uses a **curated** two-element `offered` array (mirroring the file's existing "breaks a
  same-kind copies tie by offered order" test) to isolate the dead-wait candidate directly.
  This was verified non-vacuous by temporarily disabling the `isDeadWait` guard and
  confirming the isolated test then fails (reverted immediately, never committed) — real
  bot play may rarely (if ever) hit this exception given the tie-break's own bias, but the
  rule is still correct and worth having for the shapes the tie-break doesn't protect
  against (e.g., a dead-wait tile that is *not* tied with a live alternative).
- **A pre-existing failure in the shared repo, unrelated to this ticket, confirmed and
  isolated rather than assumed.** `just test` on the full repo shows 6 failing tests across
  4 files (`src/app/drive.test.ts`, `src/core/game.dynamics.test.ts` ×2,
  `src/core/selfplay.test.ts` ×2, `src/core/settlement.property.test.ts`,
  `src/app/app.controls.svelte.test.ts`) — a zero-sum settlement violation (deltas summing
  to −1000/−2000 instead of 0) and two mined-seed action-count mismatches. **None of these
  touch `policy.ts` or `policy.test.ts`.** Verified via an isolated `git worktree` checked
  out at this ticket's final commit (`c32c1aa`) with zero uncommitted files present — the
  same 6 failures reproduce there, proving they predate this ticket's work. The shared
  working tree also currently holds an uncommitted, in-progress edit to
  `src/core/dynamics.test.ts` from the concurrent T-009-01-04 thread (per Lisa's documented
  multi-thread-one-branch model); confirmed this ticket's own commits never touch that file.
  **The failure shape (zero-sum violations around riichi settlement) most likely traces to
  the recently-landed riichi pricing commits already on `main`** (`de1dd64` "Price ura-dora
  and the riichi yaku family through settlementOf/scoreBreakdownOf" is the leading
  suspect) — **flagging for a human reviewer to track separately; not fixed here, out of
  this ticket's scope.**

## 4. Test coverage

- **Unit** (3 new tests): declare (realistic offered set, non-vacuous shanpon wait),
  decline-on-dead-wait (curated offered set, verified non-vacuous), cross-seat isolation.
- **Purity/determinism** (2 new tests): the riichi branch specifically re-verified against
  the same repeated-call-identity and structural-equality invariants every other branch
  already holds to.
- **Property/integration** (sweep widened, not duplicated): every seeded corpus game is
  still driven end-to-end through `discardPolicy`/`callPolicy` exclusively; a folded riichi
  action is now independently re-derived as shanten-0 (mirroring the discard-arm's own
  oracle) and the corpus is asserted to actually produce at least one riichi declaration
  (checked stable across three standalone runs — fixed seeds, so this is not flaky by
  construction, only ever "always ≥1" or "always 0").
- **Gaps**: no property-level coverage of the dead-wait *decline* path specifically (by
  design — Design §5 explains why: it's a rare, adversarial hand shape that a random 12-seed
  corpus is unlikely to ever construct; forcing the corpus to hit it would be
  flaky-by-construction, so it stays unit-only, same posture as `callPolicy`'s
  "never takes a daiminkan" theorem test).

## 5. Open concerns for a human reviewer

1. **The pre-existing settlement/dynamics/selfplay failures (§3) need triage** — not
   introduced by this ticket, but blocking a fully-green `just test` on `main` right now.
   Likely traces to the riichi pricing work already merged ahead of this ticket
   (commits `cb2a73a`..`de1dd64`).
2. **`pool!` non-null assertion** in the new `discardPolicy` step (`policy.ts`) relies on the
   same invariant the pre-existing code already trusted implicitly (`pool` is assigned
   inside the loop that also sets `best`, so `best !== null` implies `pool !== null`) — not
   a new risk, but worth a reviewer's eye since it's the one non-null assertion this ticket
   adds.
3. **The dead-wait exception may rarely fire in real play**, per §3's finding — the
   tie-break's own earliest-offered bias tends to prefer live waits when a dead one ties on
   center-distance. This is fine (the rule is correct whenever it *does* apply, and doesn't
   need to fire often to be worth having), but a reviewer expecting to see it show up in the
   whole-game sweep's corpus should not be surprised that it doesn't (Design §5's explicit
   choice, not an oversight).
