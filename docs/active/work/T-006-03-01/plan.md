# T-006-03-01 — discard-policy — Plan

Ordered, independently verifiable steps. Each step ends green (`just test`,
`just check`) and commits atomically. Only this ticket's files are ever staged
(`git add src/core/policy.ts src/core/policy.test.ts src/core/index.ts
docs/active/work/T-006-03-01/`) — the working tree carries other threads'
uncommitted diffs (shanten.ts, ticket frontmatter) that must not be swept in.

## Step 1 — `policy.ts` + barrel export

Write `src/core/policy.ts` exactly as structured (module header doctrine,
`CENTER_RANK`, `centerDistance`, `shantenAfterDiscard`, `discardPolicy` with the
three arms + RangeError), add `export * from './policy'` to `src/core/index.ts`.

Verify: `just check` clean (svelte-check + tsc); `just test` still green —
purity.test.ts's glob now covers policy.ts and must pass (only `./` sibling
imports). No behavior consumed yet, so no other suite moves.

Commit: `T-006-03-01: the discard policy — shanten-minimizing, center-edge
tie-break, tsumo-first`.

## Step 2 — example fixtures (`policy.test.ts`, blocks 1–7)

Test-local helpers first: `tilesOf(mpsz)` string→TileId[] builder (explicit
copy allocation so duplicate kinds get distinct ids) and `viewOf(partial)`
SeatView literal builder with inert defaults. Then the seven example describe
blocks from structure.md §4:

1. tsumo arm: tsumo returned over 14 discards + kan offers; `toBe` identity.
2. minimality: unique tenpai-reaching discard chosen; chosen shanten = min over
   offered; post-draw non-raise vs the pre-draw 13.
3. tie-break: honor over middle tile; terminal over 5-adjacent; symmetric
   distance tie → earliest offered; same-kind copies → earliest offered.
4. mustDiscard: one-meld 11-tile hand, no drawn; element-of-set + minimality.
5. draw arm: `[draw]` → returned.
6. contract violations: claim-window-only offered set → RangeError; empty
   offered → RangeError. Message content pinned loosely (match `/own-turn/`).
7. determinism/purity: repeated call `toBe`-identical; view and offered
   structurally unchanged after the call (JSON snapshot compare).

Fixture hands are chosen so expectations are computable by eye AND
double-checked in-test against `shanten` (the test asserts "chosen = argmin",
not a hardcoded tile, wherever the tie-break isn't the subject; tie-break tests
hardcode the expected tile).

Verify: `just test` green, new suite included; `just check` clean.

Commit: `T-006-03-01: policy fixtures — tsumo arm, minimality, tie-breaks,
contract throws`.

## Step 3 — property sweep over seeded games (block 8)

The test-local driver, dynamics.test.ts mold:

```
playPolicy(seed): fold {seed, actions}; at each step take
legalActions(state); if empty → end. Own-turn point (any offered action
with seat === turn of type draw/discard/tsumo… i.e. the offered set's
head is the turn seat's draw, or discards/tsumo are present) →
discardPolicy(seatView(state, turn), legal); assert-and-push. Claim
window with no own-turn arm for turn?  Pre-draw states always offer the
turn seat's draw first, so every non-ended, non-mustDiscard,
non-post-draw state IS an own-turn point for the policy; ryuukyoku's
houtei-only offered set is the one class the policy must not see —
detect via phase and end the walk there (take nothing).
```

Assertions inside the walk, per decision point:

- returned action is reference-identical to an element of `legal`;
- if a tsumo for the turn seat is offered, it is the returned action;
- if the returned action is a discard: its resulting shanten equals the
  minimum over ALL offered discards for that seat, and — when `drawn` was
  non-null — is ≤ the pre-draw hand's shanten;
- the walk terminates within ACTION_BOUND (172, the dynamics arithmetic) —
  policy-driven games end in agari or ryuukyoku.

Corpus: fixed seeds 0–29 (deterministic, fast — each game is ≤ 172 folds of
≤ 172 actions); plus one fc.property over `seedArb` with `numRuns` kept small
(~15) for the sampled layer. Determinism double-run: `playPolicy(seed)` twice →
deep-equal action lists, for three seeds — the T-006-03-04 rehearsal.

Verify: `just test` green (watch runtime — if the sweep exceeds a few seconds,
trim numRuns before committing, not the fixed corpus); `just check` clean.

Commit: `T-006-03-01: property sweep — policy-driven seeded games, minimality
and tsumo-first at every decision point`.

## Step 4 — artifacts

Write `progress.md` (kept current through steps 1–3) and `review.md`; commit
`T-006-03-01: RDSPI artifacts — research through review` (the T-006-01-02
message precedent).

## Testing strategy summary

- **Unit (fixtures)**: every arm, every tie-break key, both discard-offering
  state classes, both throw paths, identity determinism — blocks 1–7.
- **Property (integration)**: minimality/tsumo-first/membership over real folded
  states reached by the policy's own play; termination; replay determinism —
  block 8. No app-layer test: the drive seam is T-006-03-03.
- **AC → test map**: element-of-offered → blocks 1–4 + sweep membership;
  non-raise → block 2 + sweep; tsumo-always → block 1 + sweep; no
  RNG/same-view-same-action → block 7 + double-run.

## Risks / adjustments

- Backtracker cost in the sweep (≤14 shanten calls × ~170 points × 30 seeds ≈
  70k probes): expected well under vitest budget given existing suites' usage;
  fallback is fewer fixed seeds (never fewer assertions per point).
- If another thread commits shanten.ts mid-work, refold from the committed
  state — the combinator's signature is frozen by its AC, so only rebase
  mechanics, not design, could shift.
