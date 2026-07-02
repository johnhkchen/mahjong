# T-004-02-01 — drive-claim-window-selection — Progress

All plan steps complete. Two code commits plus this artifacts commit.

## Step 1 — Scratchpad scans ✅

Temporary `src/app/zz-scan.test.ts` (written, run, deleted — never committed).
Findings, all frozen into drive.test.ts anchor comments:

- **1a (multi-variant anchor):** better than planned — seed 3's existing race
  window ALREADY holds two East chi variants ([37,47] and [37,44], duplicate
  3p copies of one shape), and seed 15 after 8 tsumogiri turns gives East a
  pon [44,47] PLUS two shape-distinct chis [41,51]/[51,55] on North's 45
  (3p). No extra scanning needed; seed 15 became the multi-type order anchor.
- **1b (anchor re-verification):** seed-3 facts confirmed off fresh folds
  (window {seat:3, tile:42}; head draw seat 0; South pon uses [43,41] hand
  order; NOTE — legalActions' canonical chi uses are [37,47], low-high, not
  record.test.ts's fold-accepted [47,37] ordering). Seed-5 confirmed: window
  {seat:2, tile:94}, head draw seat 3, East pon [93,95].
- **1c (walk rehearsal):** seed 1 opens exactly TWO East-claimable windows on
  the all-tsumogiri/tap-first trajectory (chi offers at actions #96 and #104,
  North's 96=7s and 18=5m discards). Pass-everything trajectory byte-identical:
  140 actions, ryuukyoku, ponds [18,18,17,17]. Pinned `passes = 2`.

## Steps 2–3 — drive.ts + drive.test.ts ✅ (commit `08ed674`)

drive.ts as structured: `ClaimAction`/`isClaim`, exported `ClaimChoice`,
`claimChoices`, module-local `usesEqual`, `tapClaim`, `passClaim`, and
`forcedAction` with the claim guard FIRST (before the draw arm — the seed-3
own-draw geometry documented in both the code and the test). Header rewritten:
bot auto-pass is the placeholder-bot policy; the player's claims wait.

drive.test.ts: 28 tests (15 before). New describes: claimChoices (4),
tapClaim (6), passClaim (4, incl. the complementarity property over all eight
anchored states), forcedAction +2 (both wait geometries), the walk rewritten
with the explicit pass policy and pinned pass count, and the seed-3
claim-through-the-seam walk (chi → meld asserted on the fold → forced-null +
pass-null at mustDiscard → tapDiscard → bots resume).

No plan deviations. One naming nit vs plan: the anchor consts are
`EAST_CHI_A/B`, `SOUTH_PON_3`, `EAST_PON_5` rather than prefix-named folds
only — same content.

## Step 4 — App.svelte ✅ (commit `ecd6fa1`)

Effect driver: `forcedAction(offered, PLAYER) ?? passClaim(offered, PLAYER)`
with the interim-auto-pass comment naming T-004-02-02. Import extended.

## Verification record

- `just test`: **192 passed** (175 at HEAD~2, +17), ~1s.
- `just check`: svelte-check 0 errors 0 warnings; tsc clean.
- `just build`: single-file dist/index.html self-contained, 51.6 kB — OK.
- Runtime behavior of the shipped app is byte-identical to before by
  construction (scan 1c) — the walk test is the headless equivalent of the
  dev loop; visible claim flow lands with -02-02.

## Remaining

Nothing. review.md is the handoff.
