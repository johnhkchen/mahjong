# T-005-01-03 — standard-yaku-catalog — Plan

Ordered, independently verifiable steps. Each step ends `just test && just check`
green and commits atomically (message prefix `T-005-01-03:`). The catalog's 27
predicates land in two rule-family groups so every commit carries its own tests;
the public API (D4's five exports) exists from step 1 and only GROWS names.

## Step 0 — baseline

Confirm `just test` and `just check` green on main before touching anything (a
sibling ticket lands on the same branch — know whose failure is whose).
No commit.

## Step 1 — types, guards, and the 15 scan-family yaku

**yaku.ts**: module role comment; `YakuName` (all 27 literals — the TYPE is
complete from day one, only the table grows); `STANDARD_YAKU_NAMES` (frozen, all
27); `WindKind`; `WinContext`; helpers `meldSetOf`, `isMenzen`, `isTsumo`,
`combinedSets`, `allKinds`; the guard block; `standardYakuOf` filtering the
private table. Table wired with the predicates that read circumstances or whole-
tile scans — no set-structure reasoning:

menzen-tsumo, tanyao, yakuhai-haku, yakuhai-hatsu, yakuhai-chun,
yakuhai-seat-wind, yakuhai-round-wind, chiitoitsu, honroutou, honitsu, chinitsu,
haitei, houtei, rinshan, chankan (15).

**index.ts**: append `export * from './yaku'`.

**yaku.test.ts**: header comment; helpers `h`, meld builders (chi/pon/daiminkan/
shouminkan/ankan via tileId), `ctxOf` through the real decomposeAgari (throws on
non-win fixtures; decomposition picked by override when ambiguous, else asserted
unique); `CASES` object with the 15 entries (typed over a name subset for now —
step 3 tightens it to the total Record), iterated: positive ⇒ name ∈ result,
negative ⇒ ∉. Adversarial negatives per design D6 (e.g. tanyao with a single 9m;
honitsu missing its honor → that hand is the chinitsu positive; haitei with
source 'rinshan').

**Verify**: new suite green; purity gate green (the real check that imports are
legal); whole suite + svelte-check/tsc green.

**Commit**: `T-005-01-03: yaku.ts — WinContext, name catalog, scan-family predicates`

## Step 2 — the 12 set-structure yaku

**yaku.ts**: add to the table (catalog order preserved):

pinfu, iipeikou, ryanpeikou, sanshoku-doujun, sanshoku-doukou, ittsuu, chanta,
junchan, toitoi, sanankou, sankantsu, shousangen (12; table now 27 = complete).

Each predicate documented with its convention per design D5 — pinfu's ryanmen
arithmetic, iipeikou/ryanpeikou disjointness, the chanta-family clauses,
sanankou's ron adjustment and ≥3, sankantsu's ≥3.

**yaku.test.ts**: the 12 CASES entries. The load-bearing negatives, derived in
comments: pinfu/kanchan; iipeikou on an open (chi) hand; ryanpeikou shape read as
chiitoitsu form (∉ — form gates it); sanshoku two suits only; ittsuu split across
suits; chanta all-simples run hand; junchan with an honor triplet (→ chanta's
positive instead); toitoi with one chi; sanankou third-triplet-by-ron with no
absorbing run; sankantsu two kans; shousangen three dragon triplets (∉ —
daisangen territory, predicate demands exactly two + pair).

**Verify**: suite green; the step-1 rows unchanged and still green (no predicate
interferes with another's fixtures).

**Commit**: `T-005-01-03: yaku.ts — set-structure predicates complete the catalog`

## Step 3 — totality, interactions, contract

**yaku.test.ts**:
- Tighten `CASES` to `Record<YakuName, …>` — the compiler now enforces the AC's
  per-yaku coverage; add a meta-test asserting CASES keys ≡ STANDARD_YAKU_NAMES ≡
  27, and that STANDARD_YAKU_NAMES is frozen.
- Interaction describes (design D6): ryanpeikou fires without iipeikou;
  chanta/junchan/honroutou pairwise exclusive on boundary hands; double-east
  fires both wind yakuhai; pinfu wait trio (kanchan/penchan/tanki all ∉) +
  otakaze-pair positive + 789-won-on-9 ryanmen edge; sanankou ron adjustment both
  directions (absorbing run present vs absent); honroutou over chiitoitsu AND
  over toitoi (with toitoi co-firing); menzen-tsumo with an ankan; open hand with
  zero yaku → `[]` exactly; kokushi context → `[]`.
- Contract describes: result order equals catalog order on a multi-yaku hand
  (e.g. chinitsu+ittsuu+pinfu+menzen-tsumo); RangeError on arity corruption
  (standard sets+melds ≠ 4; chiitoitsu ctx carrying a meld); purity — repeat call
  deep-equality, ctx and melds unmutated (JSON snapshot before/after).

**Verify**: full suite + check green; eyeball vitest count grew by the expected
order of magnitude (≈70+ new assertions).

**Commit**: `T-005-01-03: yaku suite — per-yaku table totality, interactions, contract`

## Step 4 — review artifact

Write `docs/active/work/T-005-01-03/review.md` (changes, coverage, concerns).
No code. Commit: `T-005-01-03: review — standard yaku catalog handoff`.
(Progress.md is maintained throughout implement, committed with each step.)

## Testing strategy summary

- **Unit (the exhibit)**: the total CASES table — one positive + one adversarial
  negative per yaku, expectations rule-derived in comments. This is the AC.
- **Interaction**: the conventions design D5 encodes as predicate structure
  (disjoint families, adjustments, double-fire) each get a directed test —
  conventions are only real if a test pins them.
- **Contract**: order, purity, guards, `[]`-means-no-yaku, kokushi-silence.
- **Not tested here**: aggregation/one-yaku gate (-04), fold assembly of
  WinContext (-02-01), waits/furiten (-02-02). No integration tests — the module
  has no integration surface yet by design.
- **No property suite**: there is no independent oracle for "the yaku rules"
  short of restating them; fast-check would generate hands but the assertions
  would re-derive the predicate (tautology). If a cheap invariant emerges during
  implementation (e.g. result ⊆ STANDARD_YAKU_NAMES, order-stability under
  context noise), add it opportunistically; do not force one.

## Risks / watchpoints

- **Ambiguous fixture decompositions**: ctxOf asserts uniqueness unless told
  otherwise — forces every ambiguity in fixtures to be a visible, deliberate
  choice (the 111222333m lesson from -01).
- **Default winds vs honor fixtures**: defaults seatWind='1z' roundWind='1z';
  any fixture holding 1z–4z sets winds explicitly or the yakuhai rows lie.
- **Sibling collision (-02 in flight)**: only shared file is index.ts, append-
  only line; if a rebase conflict appears it is one line.
- **Suite runtime**: pure fixtures, no fc loops — negligible; keep it that way.
