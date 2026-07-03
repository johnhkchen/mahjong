# T-006-03-04 — determinism-termination-harness — Review

## What changed

One commit (`14b0761`), one file CREATED, nothing modified or deleted anywhere:

- **`src/core/selfplay.test.ts`** (257 lines) — the AI-vs-AI self-play harness.
  Test-only; no runtime module touched, no barrel change, no app change. The
  purity gate picked it up automatically (imports: `./index`, vitest,
  fast-check — all allowlisted).

`policy.test.ts`'s -02 rehearsal and `drive.ts`'s -03 wiring are deliberately
untouched: the rehearsal stays as the oracle-depth pin, this file is the
invariant-breadth harness.

## The behavior, in three sentences

`selfPlay(seed)` drives a whole hand with all four seats botted — discardPolicy
at own-turn points, callPolicy at claim windows and houtei, cross-seat
arbitration by earliest non-draw answer in offered order — advancing state only
by refolding the growing record, and guarding its own soundness (every folded
action is a reference member of the offered set; the action count never passes
the vocabulary bound of 174). The corpus suite double-plays 40 seeds and asserts
each replay is byte-identical as a serialized whole record and each game ends in
agari or ryuukyoku within the bound; an fc layer extends the same invariant over
10 seeds sampled from the full [0, 2^32) domain. Four mined anchors (menzen-
tsumo, window ron through folded claims, houtei ron out of ryuukyoku, ryuukyoku
with the length arithmetic 2·FULL_TURNS + 2·claims) freeze exact end facts so
any drift — in the harness's re-stated arbitration OR in future policy/legal
behavior — breaks loudly and is re-mined deliberately.

## AC → proof map

| AC clause | Pinned by |
|---|---|
| drives all four seats via the policy | every decision from the policy pair over `seatView` projections; membership guard (teeth-checked) |
| same seed replays a byte-identical action log end to end | `playTwiceChecked`: `JSON.stringify` equality of two independent runs' whole records, corpus + fc |
| every seeded full-botted game reaches an ended phase | ended-phase throw per seed; corpus aggregates prove BOTH phases actually occur |
| within the bounded turn count | driver tripwire (throw past 174) + explicit `longest ≤ ACTION_BOUND` expect |
| asserted across a sample of seeds | 40-seed literal corpus (mined: 37 agari / 3 ryuukyoku / 95 claims) + 10 fc-sampled seeds |

## Test coverage

- Full suite: **23 files / 548 tests green** (`just test`; 542 → 548),
  `just check` clean (svelte-check + tsc, 0 errors). New file isolated runtime
  ~4.8s against 60s contention-proof timeouts (the -02 convention).
- **Non-vacuity is pinned, not statistical**: agari AND ryuukyoku both present,
  claims > 0, tsumo wins > 0, ron wins > 0 across the corpus — termination is
  never proven on trivial games alone. The comment states the rule: widen the
  corpus, never weaken the check.
- **Teeth verified by deliberate failure** (run and reverted, documented in
  progress.md): a shape-equal clone smuggled past the policies fails the
  membership guard at step 0 on every suite; a flipped anchor literal fails
  naming the exact mismatch.
- **Double-keying**: anchor win facts are re-read from `foldRecord(record).win`
  rather than trusted from mining prose, so a wrong mine cannot freeze a wrong
  behavior; seed 19's length is the call-arithmetic identity, not a bare number.

### Coverage gaps (known, deliberate)

- **In-process determinism only.** Two independent playthroughs in one run;
  cross-process/cross-platform determinism rests on the frozen conventions
  (integer rng, no ambient reads) pinned by their own suites. The header states
  this honestly. A CI matrix comparing anchor logs across platforms would be
  the next strengthening if ever wanted.
- **The harness does not re-verify policy correctness** (minimality, claim cut,
  anchors) — by design; those are policy.test.ts's oracle-laden pins. A policy
  bug that is deterministic would pass here and fail there.
- **No kan appears in the corpus logs** (the policy structurally never opens a
  daiminkan — the -02 theorem — and never chooses own-turn kans; ankan/
  shouminkan trajectories live in dynamics.test.ts's generators). When a
  strength ticket teaches the bots kans, the anchors re-mine and the corpus
  tallies could gain a kan count.
- **Ryuukyoku is thin in the corpus (3 of 40)** — enough to pin, but a bots-
  play-defensively future could shift the mix; the widen-don't-weaken rule
  covers it.

## Open concerns for a human reviewer

1. **The arbitration now exists in three places** (policy.test.ts sweep,
   drive.ts, this harness) — sanctioned by the independent-statements doctrine
   and locked by anchors/oracles/walks respectively, but a fourth statement
   should trigger extraction instead; the attract-mode ticket is the natural
   point to promote ONE runtime self-play driver and shrink the test-local
   copies against it.
2. **Anchors are brittle BY INTENT.** Any behavior-changing policy/legal/yaku
   ticket breaks all four; the header instructs re-mining deliberately, never
   loosening. Expect that churn — it is the alarm working.
3. **JSON.stringify as "byte-identical"**: faithful because action literals are
   built with fixed key order by legalActions and the record shape is built
   here; if a future action variant ever carried non-deterministic key order,
   the comparison silently strengthens to key-order equality — acceptable
   (stricter, and that's the serialization persistence will use), noted for
   awareness.
4. **One code commit, not the planned two; four anchors, not three** —
   deviations documented with rationale in progress.md (mining came back fast
   and complete; seed 13's houtei ron was too valuable to skip).

## Follow-ups (future tickets, not this one)

- Attract mode: promote a runtime self-play driver (app-side, drive.ts-shaped
  or a core export — that ticket's design call) and consider replaying the
  frozen anchor seeds as its smoke test.
- Strength/difficulty tickets: own-turn kan selection will re-mine the anchors
  and should add a kan tally to the corpus non-vacuity set.
- S-006-03 is complete with this ticket (01 discard policy, 02 call policy,
  03 drive wiring, 04 this harness).
