# T-006-03-02 — call-policy — Plan

Three steps, each independently verifiable and committable. All work is in
`src/core/policy.ts` and `src/core/policy.test.ts`. Verification commands:
`just test` (vitest over src/core) and `just check` (svelte-check + tsc);
`flox activate -- npx vitest run src/core/policy.test.ts` for the tight loop.

## Step 1 — the call branch in policy.ts

1. Extend the import block: `type { Seat }` from './deal', `type { Meld }` from
   './record', `isSimple` from './tiles', `type { WindKind }` from './yaku'.
2. Add the private helpers, in structure.md's shapes:
   - `ROUND_WIND` ('1z', re-stated with the legal.ts-precedent comment);
   - `valueKindsOf(seat)`;
   - `type ClaimOffer`;
   - `claimMeldOf(offer, from)`;
   - `meldIsValueTriplet(meld, valueKinds)`;
   - `yakuAnchor(remainderKinds, melds, seat, postShanten)` — yakuhai arm then
     tanyao arm (offender bound `postShanten + 1`, commented as the deliberate
     heuristic).
3. Add `callPolicy(view, offered)` — ron arm, claim arm (one left-to-right
   pass, FIRST accepted offer wins; accept gate `post < pre && yakuAnchor(...)`
   with post-claim shanten computed inline; decline returns the first offered
   draw), throw arm (RangeError, message naming the contract and pointing
   own-turn points back at discardPolicy).
4. Update the module header (both-branches framing, the frozen call rule, the
   anchor predicate's documented heuristic status, the daiminkan theorem, the
   revised kan/own-ron deferral notes) and reword discardPolicy's throw-message
   tail to name `callPolicy`.

Verify: `just check` clean; existing `just test` still green (nothing consumes
callPolicy yet — the discard suite and every other core suite must be
untouched). Commit: `T-006-03-02: the call policy — ron-first, strict-cut +
yaku-anchor claims, draw as the pass`.

## Step 2 — fixture-layer tests

In policy.test.ts, after the existing fixture describes:

1. Extend `viewOf` with optional `claimable` (default null) and optional
   `phase`.
2. `callPolicy — ron arm` (3 tests): window ron returned by reference over a
   same-seat pon placed earlier in the array; houtei ron (phase 'ryuukyoku',
   offered = the ron only); a foreign ron plus own claim offers → the claim/
   decline logic runs, never the foreign ron.
3. `callPolicy — accepts` (3): yakuhai pon — e.g. hand `55z234m567p24s89s`-
   shaped so pon 5z cuts shanten and the new meld anchors; kuitan chi — all-
   simple hand, chi completing a run cuts shanten, offenders 0; second call on
   an already-anchored open hand (existing yakuhai pon meld in `viewOf` melds).
   Each asserts the exact offered element (toBe) and re-derives the cut via
   `shanten` in-test.
4. `callPolicy — declines` (3): the strand case — a hand whose only claim is a
   terminal-touching chi (e.g. 789m) with no value pair and offenders past the
   bound → returns the draw element by reference; cut-failure — a pon that
   leaves shanten equal (the pair better used as the head) while a yakuhai pair
   anchors → draw; the daiminkan theorem — offered pon and daiminkan of the
   same three copies: the pon may win, the daiminkan never (assert chosen is
   not the daiminkan across both an anchored and unanchored hand).
5. `callPolicy — tie-break` (2): an accepted pon and an accepted chi at one
   window → the pon (earliest offered; claim precedence emergent); copy-variant
   chi offers deliberately reordered → earliest offered wins (the
   curated-subset mold).
6. `callPolicy — contract violations` (2): a post-draw own-turn offered set →
   RangeError matching /call decision/; an empty set → RangeError.
7. `callPolicy — purity and determinism` (2): the discardPolicy purity twins
   (same reference, JSON-snapshot no-mutation; structuredClone structural
   stability).

Fixture arithmetic is verified in-test through `shanten` itself wherever the
value is not the subject (the policy.test.ts convention). Verify: policy suite
green. Commit: `T-006-03-02: call-policy fixtures — arms, anchors, theorem,
tie-breaks`.

## Step 3 — the seeded sweep with calls

1. Rework `playPolicy`: at each step classify the state — ended/empty → stop;
   pre-draw with `claimable` → the call-arbitration path (consult callPolicy
   per offer-holding seat in rotation order; oracle-check each answer:
   membership, ron-taken-if-offered, folded claims re-checked against a
   test-side `cutsAndAnchored(state, claim)` twin; fold earliest non-draw
   answer else the draw); ryuukyoku → consult ron holders, fold the first
   offered ron if any (then the loop ends at agari next iteration);
   otherwise → the existing discardPolicy path with its oracle checks intact.
2. Keep ACTION_BOUND; keep one-expect-per-game (plain throws inside).
3. Existing sweep tests run the new driver unchanged in shape: corpus
   termination, byte-identical replay (now with call actions in the logs),
   fast-check sampled seeds.
4. Add one corpus assertion that the sweep actually exercised the branch: across
   the corpus, at least one game folded a chi/pon and at least one ron or
   tsumo occurred — guarding against a driver bug that silently never consults
   callPolicy. (If the fixed corpus yields no call, widen the corpus seeds, not
   the policy.)

Verify: full `just test` + `just check` green; eyeball sweep runtime stays in
the policy suite's existing budget (~2s — the call path adds shanten probes
only at windows). Commit: `T-006-03-02: policy sweep drives calls — arbitrated
windows, oracle-checked accepts, byte-identical replay`.

## Testing strategy summary

- Unit (fixtures): every arm, both anchor arms, both decline causes, the
  daiminkan theorem, both tie-break keys, throw posture, purity — the AC's
  accept/decline/ron clauses each pinned by a named test.
- Integration (sweep): the AC's "element of the offered set" and ron clauses at
  every real decision point over seeded whole games, plus termination and
  determinism (T-006-03-04 rehearsal).
- Non-regression: discardPolicy suite untouched; `just check` guards types.

## Risks / watch-items

- The strand-decline fixture must fail BOTH anchors — double-check the chosen
  hand has no ≥2 value copies and a non-simple meld tile (or offender count
  past the bound), re-deriving in-test.
- Sweep games may call rarely per seed; the exercised-branch assertion (step
  3.4) keeps the suite honest.
- `viewOf` extension must not disturb existing fixtures (defaults preserve
  current behavior).
