# T-005-01-04 — yakuman-and-yaku-gate — Plan

Two atomic commits executing structure.md, each leaving `just test` and
`just check` green. Fixture hands are worked out here so implementation is
transcription, not derivation.

## Step 1 — yakuman.ts + barrel (commit 1)

Write `src/core/yakuman.ts` per structure.md §Module order: header
(conventions: gate refusal `[]`, yakuman-supersedes, stacking; exclusions:
tenhou/chiihou, double variants), YakumanName, YAKUMAN_NAMES, WinYakuName,
Win, allKindsOf/countOf, ten predicates, YAKUMAN table, yakuOf. Append
`export * from './yakuman'` to index.ts.

**Verify:** `just check` clean; `just test` still green (330 tests, nothing
imports the new module yet); purity sweep covers the new file.

**Commit:** `T-005-01-04: yakuman.ts — catalog, win gate, aggregator`

## Step 2 — yakuman.test.ts (commit 2)

Helpers (h, meld builders, winOf), the total CASES table, four describes.

### Fixture hands (derived here; all verified as wins by construction)

Positive / negative per yakuman — negatives MUST still be wins:

- **kokushi** +: `19m19p19s12345677z` tsumo (13 orphans, 7z doubled).
  −: `1199m1199p1199s11z` — all-terminal/honor chiitoitsu, near in spirit,
  no kokushi form.
- **suuankou** +: `111m333m555p777s44s` tsumo (`source:'wall'`,
  winningKind `1m`) — four concealed triplets self-drawn.
  −: same hand `source:'discard'`, winningKind `1m` — the ron demotes the
  fourth triplet (sanankou + toitoi remain, asserted in the supersession
  describe).
- **daisangen** +: `555z666z777z123m44m` — three dragon triplets.
  −: `555z666z77z123m444m` — two triplets + chun pair = shousangen.
- **shousuushii** +: `111z222z333z44z234m` — three wind triplets + North
  pair. −: `111z222z333z234m44m` — third wind triplet but a NUMBER pair;
  the fourth wind is absent.
- **daisuushii** +: `111z222z333z444z55m` — all four wind triplets.
  −: the shousuushii positive (fourth wind only paired).
- **tsuuiisou** +: `111z222z333z555z66z` — honors only (also shousuushii?
  no: winds 1z/2z/3z tripled but 4z count is 0, not 2 — shousuushii needs
  the wind pair; 66z is hatsu. Stacks with nothing but suuankou if tsumo —
  use `source:'discard'`, winningKind `1z` to demote; contains-assertion is
  robust either way).
  −: `111z222z333z555z88m` — one number pair breaks all-honors.
- **chinroutou** +: `111m999m111p999p11s` — terminal triplets + terminal
  pair. −: `111m999m111p111z11s` — an honor triplet makes it honroutou,
  not chinroutou.
- **ryuuiisou** +: `223344s666s88s666z` — 234s×2, 666s, 88s pair, hatsu
  triplet; every tile ∈ {2s,3s,4s,6s,8s,6z}. Needs `pick`-free handling:
  223344s has two standard readings? (223344 → 234+234 or 22+33+44 pairs…
  triplet reading needs three of a kind — none; run reading unique standard;
  chiitoitsu impossible with 666s/666z) — single standard reading, fine.
  −: `234s456s666s88s66z`? 66z is a PAIR of hatsu — wait, need 4 sets+pair:
  234s 456s 666s + 66z pair is only 3 sets. Use `223344s456s88s666z`? 5s is
  not green — but is it a win: 234s 234s 456s 666z + 88s ✓. Near-miss: one
  5s inside an otherwise green hand.
- **chuuren-poutou** +: `1112345678999m` + second `9m`… encode as
  `11123456789999m`? No — 14 tiles: `1112345678999m` is 13, add `5m` →
  `11123455678999m` tsumo, winningKind `5m`. Counts 3/1/1/1/2/1/1/1/3 ✓;
  single suit, no melds ✓ (readings may be multiple — irrelevant, the
  predicate is multiset).
  −: `111m234m456m789m88m` — chinitsu, but rank-9 count is 1 (< 3): the
  nine-gates multiset broken while still a clean win.
- **suukantsu** +: `11s` concealed + `[ankan('2z'), daiminkan('9p'),
  shouminkan('5s'), ankan('3m')]` — four kans + pair (concealed arity
  14 − 12 = 2 ✓). −: same but fourth kan downgraded to `pon('3m')` (13 − 9 =
  wait: melds 4 ⇒ concealed 2; with pon still 4 melds ⇒ 2 concealed ✓) —
  sankantsu, not suukantsu.

### Gate / supersession / union fixtures

- Yakuless completion → `[]`: -03's shape — `456p789s345s99p` +
  `chi('1m')`, `source:'discard'` (open, no flush, terminal 9s kills
  tanyao, junk pair, no circumstance).
- Supersession: the suuankou positive — result contains 'suuankou' and NONE
  of menzen-tsumo/toitoi/sanankou; exact list `['suuankou']`.
- Demotion visibility: the suuankou negative — exact standard-order list
  containing toitoi + sanankou (derive full expected list in a comment:
  toitoi, sanankou; no menzen-tsumo — ron; pair 44s simple, triplets include
  honors? `111m333m555p777s44s`: no honors, not all simples (1m terminal) —
  expect exactly `['toitoi', 'sanankou']`).
- Stacking: `111z222z333z444z55z` tsumo — daisuushii + tsuuiisou + suuankou
  (+ kokushi? no). Expected exact list in YAKUMAN_NAMES order:
  `['suuankou', 'daisuushii', 'tsuuiisou']`.
- Kokushi supersedes trivially: kokushi positive → exact `['kokushi']`.
- Union: `223344m556677p88s` tsumo, winningKind `8s`(tanki keeps pinfu out;
  also 2m? — choose `8s`): standard reading fires menzen-tsumo, tanyao,
  ryanpeikou; chiitoitsu reading fires menzen-tsumo, tanyao, chiitoitsu.
  Expected exact union in catalog order:
  `['menzen-tsumo', 'tanyao', 'chiitoitsu', 'ryanpeikou']`.
- Contract: purity on a mid-size fixture; RangeError ×3 (not-a-win
  `19m19p19s1234567z` + junk? use a 14-tile non-win like
  `123m456m789m123p1s5z`… must be arity-correct but non-winning:
  `123m456m789m12p15s` ✓; winningKind not in concealed: spread a good Win
  with `winningKind:'9z'`-style absent kind (use `1z` absent from hand);
  arity throw: pass 13 concealed with no melds through yakuOf).

**Verify:** `just test` (expect ~330 + ~35 new), `just check`.

**Commit:** `T-005-01-04: yakuman suite — per-yakuman table, gate,
supersession, union`

## Step 3 — progress.md + review.md

Track deviations in progress.md as they happen; close with review.md
(changes, coverage, open concerns: union semantics for the scoring epic,
tenhou/chiihou deferral, double-variant names, test-helper duplication).

## Testing strategy summary

Unit only, engine-pure (no integration surface exists until -02-01). Rigor
mechanism = the type-total CASES table (compile-enforced AC) + adversarial
still-winning negatives + exact-list contract tests. No property suite —
same no-oracle rationale as -03. Verification criteria per step: green
`just test`/`just check`, purity sweep inclusion, and the AC sentence
mapped: per-yakuman ± tests (table), `[]` for yakuless (gate test),
suppression documented in module + pinned by the supersession tests.
