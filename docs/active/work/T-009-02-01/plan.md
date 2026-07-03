# Plan — T-009-02-01 bot-riichi-policy

Six steps, each independently runnable (`just test` / `just check` green) and each an
atomic commit. No step depends on anything outside this ticket's two files.

## Step 1 — `isDeadWait` helper + import, no behavior change yet

- Add `import { waits } from './waits'` to `src/core/policy.ts`.
- Add the `isDeadWait` helper (Structure §2.2), placed after `shantenAfterDiscard`.
- Not yet called from `discardPolicy` — dead code for one commit, deliberately, so the
  helper's own shape can be typechecked/reviewed in isolation before it is wired in.
- Verify: `just check` (typecheck only; no test exercises unused code, and none should be
  added for it yet — testing happens once it's wired in, Step 3).

## Step 2 — wire the riichi step into `discardPolicy`

- Replace the single `if (best !== null) return best` line with the new step (Structure
  §2.3).
- Append the new header paragraph (Structure §2.4).
- Verify: `just test` — every *existing* test must still pass unchanged (no existing fixture
  contains a `riichi` action in its `offered` array, so this step should be a no-op against
  the current suite; a red run here means the placement broke something the design didn't
  anticipate, and is a stop-and-reassess signal, not a "fix the test" signal).

## Step 3 — the three curated riichi tests

- Add the `describe('discard arm — riichi')` block (Structure §3.2, three tests: declares,
  declines-on-dead-wait, ignores-another-seat).
- Build each fixture and hand-verify the shanten/waits numbers *in the test itself* (the
  established convention — `afterDiscard`/`shanten` calls inline, not hardcoded magic
  numbers), reusing Research §4's two concrete tile strings verbatim:
  - declare: `123m456p789s1122z` hand, `5z` drawn.
  - decline: `1111m234p567p789s` hand, `9m` drawn, curated 2-element `offered`.
- Verify: `just test`, all three green, and confirm by temporarily reverting Step 2's riichi
  branch (or asserting against `git stash`) that the decline test would in fact go the
  *other* way without the exception — i.e., confirm the test is not vacuously true. (A
  scratch check, not a committed artifact.)

## Step 4 — purity/determinism extension

- Add the one riichi-containing fixture to each of the two `describe('purity and
  determinism')` tests (Structure §3.3), reusing the "declare" fixture from Step 3.
- Verify: `just test`.

## Step 5 — sweep extension

- Add the `riichiFolded` counter and per-step oracle check inside `playPolicy` (Structure
  §3.4, first bullet).
- Add the non-vacuous `riichiFolded > 0` assertion to the corpus-sweep test (Structure §3.4,
  second bullet).
- Verify: `just test`, paying particular attention to:
  - the corpus assertion is not flaky — run the full `policy.test.ts` file standalone
    several times (`npx vitest run src/core/policy.test.ts` a handful of times) to confirm
    `riichiFolded` is reliably `> 0` over the fixed 12-seed corpus (deterministic seeds, so
    either it is always `> 0` or never — one run suffices to know which, but run twice to be
    sure nothing here is accidentally seed-order-sensitive);
  - the byte-identical-replay test and the `fc.assert`-driven sampled-seeds test still pass
    (they exercise `playPolicy` again under the same corpus/seed space, now riichi-aware —
    a determinism regression here would mean the new branch reads something un-pure).
- If the fixed 12-seed corpus (`CORPUS_SEEDS`, seeds 0–11) never folds a riichi, widen it
  (per the existing comment's own instruction: "widen the corpus rather than weakening the
  check") rather than relaxing the assertion.

## Step 6 — full-suite confirmation pass

- `just test` (whole suite) and `just check` (svelte-check + tsc), matching T-009-01-01's
  own Step 8 precedent of an un-seeded, whole-repo confirmation before calling Implement
  done.
- Skim `git diff` for the two touched files against Structure's file list — confirm nothing
  outside `policy.ts`/`policy.test.ts` changed.
- No `src/app/` changes expected; confirm `git status` shows none.

## Testing strategy summary

- **Unit** (hand-built fixtures, Step 3): both AC halves — declare and non-declare — pinned
  exactly, plus the standing "ignores other seats" cross-seat isolation test every other
  arm already has.
- **Purity/determinism** (Step 4): the riichi branch specifically re-verified against the
  same two invariants (repeat-call identity, structural-equality) every other branch is held
  to.
- **Property/integration** (Step 5): the seeded whole-game sweep, extended rather than
  duplicated — riichi declarations must occur in the sample (AC's own wording, mirrored in
  T-009-02-02's acceptance criteria too) and must be individually sound (shanten-0
  re-derivation) and offered-set-member (already covered generically by the sweep's existing
  `legal.includes(chosen)` check, which is type-agnostic).
- **No new integration/e2e surface** — this ticket touches `src/core/` only; the app-level
  wiring (bot seats actually calling `discardPolicy` during play) is pre-existing
  (T-006-03-03/04) and unaffected in shape, only in what it may now return.

## Deviation protocol

If any step's verification surfaces something Design/Structure didn't anticipate (e.g. the
12-seed corpus turns out to never hit a riichi opportunity, or the `pool!` non-null
assertion in Structure §2.3 turns out unsafe in some path not considered), stop, document
the deviation and its rationale in `progress.md` before proceeding, per the RDSPI workflow
rule — do not silently patch around it.
