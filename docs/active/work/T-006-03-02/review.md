# T-006-03-02 — call-policy — Review

## What changed

Two files, three commits (`fd40e83`, `2aa072c`, `d96a436`); no files created or
deleted; nothing outside `src/core/` touched.

- **`src/core/policy.ts`** — grew the call branch. New public export
  `callPolicy(view: SeatView, offered: readonly HandAction[]): HandAction`
  (public via the existing barrel), new private helpers (`ROUND_WIND`,
  `valueKindsOf`, `ClaimOffer`, `isClaimOffer`, `claimMeldOf`, `isValueTriplet`,
  `meldTiles`, `yakuAnchor`), a rewritten module header documenting both
  branches, and a one-line reword of discardPolicy's throw message.
  `discardPolicy` and its helpers are byte-for-byte untouched.
- **`src/core/policy.test.ts`** — 16 new fixture tests (six describes), a
  two-field extension of the `viewOf` fixture builder (backward-compatible
  defaults), and the seeded sweep reworked to drive claim windows and houtei
  through callPolicy with cross-seat arbitration and independent per-step
  oracles.

## The behavior, in three sentences

At a claim window or houtei, a seat offered a ron always takes it (legality
already guarantees it is a yaku-bearing, non-furiten win). A chi/pon is taken
iff it strictly lowers shanten AND the post-call hand keeps a yaku anchor —
a value-kind triplet meld, a concealed value pair, or the kuitan shape (all
meld tiles simple, ≤ post-shanten + 1 non-simple concealed tiles); the first
accepted offer in the frozen offered order wins, and declining returns the
offered draw (the pass). Daiminkan is structurally never taken — melding a
concealed triplet cannot lower shanten — which the header documents as a
theorem of the cut rule and a test pins.

## Test coverage

- **Every AC clause has a named fixture**: accept-with-yaku (yakuhai pon,
  kuitan chi, already-anchored second call), decline-to-draw on the yakuless
  open strand, ron always (window and houtei), element-of-offered (reference-
  identity purity tests). Fixture shanten values are re-derived in-test through
  `shanten` itself, never asserted from prose.
- **Sweep layer**: seeded whole games driven by the policy pair with the
  T-006-03-03 arbitration rule rehearsed in-test; per-step oracles re-derive
  membership, ron-taken, strict cut, and the anchor predicate independently of
  the policy's own code; termination within the unchanged ACTION_BOUND;
  byte-identical replay (the T-006-03-04 invariant, now over logs containing
  calls); an exercised-branch assertion (≥ 1 claim folded across the corpus).
- Full suite: 22 files / 533 tests green; `just check` clean.

### Coverage gaps (known, deliberate)

- **Rons in the sweep corpus are not asserted** (`ronsFolded` is tracked but
  the corpus may legitimately contain none); ron behavior is pinned at the
  fixture layer and by the sweep's per-seat oracle whenever one does occur.
- **The tanyao offender bound (`≤ post-shanten + 1`) has no boundary fixture**
  — both kuitan fixtures sit at 0 offenders. The bound is exercised
  incidentally by the sweep's anchor oracle (an exact twin), but a fixture
  pinning "offenders exactly at / one past the bound" would sharpen it.

## Open concerns for a human reviewer

1. **The anchor predicate is deliberately conservative.** Only yakuhai and
   kuitan anchor an accept; honitsu/toitoi/chanta-viable calls are declined.
   That is the designed teachable baseline ("competent", not strong) and is
   extend-only widenable, but it shapes bot personality noticeably: the bots
   will mostly call for value pairs and all-simples hands.
2. **The offender bound is a heuristic, documented as such** — an offender
   inside a needed set (e.g. a 789m run in an otherwise-simple hand) can beat
   it, accepting a call whose tanyao is not actually reachable without cost.
   The failure mode is a bot with a stranded open hand in rare shapes; the
   one-yaku win gate makes that a no-win hand, not an engine error.
3. **"Stay closed for riichi" is not modeled** — the riichi family is absent
   from the yaku vocabulary (by design, a later epic), so opening a closed
   1-shanten hand for a small cut is priced at zero lost riichi value. Expect
   the call rate to look slightly eager until that ticket lands.
4. **The pass is another seat's draw.** callPolicy's decline returns the turn
   seat's offered draw even when consulted for a non-turn seat — sanctioned by
   the AC ("selects the pass/next-draw") and the drive.ts doctrine, but the
   T-006-03-03 driver must treat "returned the draw" as *this seat declined*,
   not as "fold the draw immediately" (another seat may still claim). The
   sweep's arbitration shows the intended composition.
5. **Sweep timeouts were raised to 60s** after a transient CPU-contention
   flake (sibling agent suites sharing the machine); isolated runtime is ~3s.
   If CI shows real growth here, the corpus comment explains the budget.

## Follow-ups already ticketed

- T-006-03-03 wires drive.ts to the policy pair (replacing bot auto-pass) —
  the sweep's arbitration loop is the reference implementation.
- T-006-03-04 hardens determinism/termination across all four botted seats;
  the byte-identical replay test here is its rehearsal.
- Own-turn ankan/shouminkan selection and richer anchors (toitoi, honitsu,
  ukeire-aware tie-breaks) are future strength/difficulty tickets — all
  extend-only against the frozen arms.
