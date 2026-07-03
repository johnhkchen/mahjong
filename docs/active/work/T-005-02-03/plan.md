# T-005-02-03 — win-prompt-and-hand-end-screen — Plan

Ordered, independently verifiable steps; each is one atomic commit unless noted.
Baseline: 401 tests green, `just check`/`just build` clean.

## Step 0 — Mine the seat-0 win anchors (no commit; scratchpad only)

Temporary probe (vitest file or tsx script in the scratchpad, never committed —
the -02 deleted-after-capture precedent):

- Scan seeds 0..N (expect a hit well under 10k, per -02's mining rates): fold the
  empty record, take seat 0's 13 dealt kinds, compute `waits(kinds, [])`; skip if
  empty (not tenpai).
  - **Tsumo candidate**: walk the live wall; the first index k with k ≡ 0 (mod 4)
    and `kindOf(live[k])` ∈ waits, no earlier bot tsumogiri (k' < k, k' ≢ 0) landing
    a wait (else the ron window fires first and all-tsumogiri wouldn't reach k
    cleanly — the prefix must PASS that window explicitly, which is fine for the
    walk test but muddies the unit anchor; prefer a clean first-event tsumo).
    Verify with the derivation stack: `isAgari(kinds + kind)` and
    `yakuOf({...})` non-empty (menzen-tsumo guarantees ≥1 yaku for a closed
    tsumo — every candidate passes the one-yaku gate; still assert it).
  - **Ron candidate**: the first index k with k ≢ 0 (mod 4) and kindOf(live[k]) ∈
    waits, no earlier seat-0 draw completing (k' < k, k' ≡ 0 — else tsumo fires
    first), seat 0 not furiten at that point (under all-tsumogiri seat 0's pond is
    its own draws live[0], live[4], ...— check waits ∩ those kinds empty up to k),
    and `yakuOf(source 'discard')` non-empty (no automatic yaku here — pinfu/
    tanyao/chiitoitsu etc. must carry it; this is the gate most candidates fail).
- Record for each chosen seed: the turn count for the prefix, the winning TileId,
  the expected win-offer literal, the yaku list, and the geometry sentence for the
  frozen comment. Cross-check NOTHING against legalActions (independence rule).
- Bonus sweep (capped ~30 min): a seed where seat 0 holds ron+pon on one discard
  (shanpon), and a seat-0 houtei. Record if found; drop without blocking if not.
- Delete the probe. **Deviation rule**: if no clean anchor exists in scan range,
  record in progress.md and fall back to scripted non-tsumogiri prefixes (tedashi
  swaps, the 29732 precedent) before considering parametric-only coverage.

Verification: probe's own cross-checks pass; anchors reproduce under a fresh fold.

## Step 1 — drive.ts: winChoice + widened guards, with the seam tests (commit 1)

Red first: add the regression test — at the mined ron window, OLD code forces the
head draw (auto-passing the player's ron). Watch it fail, then implement.

1. `winChoice(offered, player)` per structure.md §2 (find tsumo/ron by seat, ?? null),
   docstring carrying: at-most-one rationale, predicate-AND-selector role, the
   atamahane note for the future bot recorder, THE FURITEN DIVERGENCE consumption
   note (never offered ⇒ never appendable through this seam).
2. `forcedAction`: widen the wait guard (claims ∪ wins); docstring bullets per
   structure.md (window wait, houtei halt).
3. `passClaim`: widen the guard; doc the window-ron-only reach (head-check already
   excludes tsumo/houtei).
4. Module header: placeholder bots "never call, never win"; PLAYER exception
   sentence gains the win prompt.
5. drive.test.ts additions (structure.md §6): anchor constants + geometry comments;
   `describe('winChoice')` (identity, seat-scoping incl. one parametric spot-check,
   furiten/yakuless negatives through the seam, doctored rejection, null across
   all existing anchors); forcedAction/passClaim win cases; complementarity battery
   widened with both anchors; the agari walk (pass-everything to the tsumo point,
   take the win, assert phase/win/quiescence).

Verify: `just test` — all green, including every pre-existing drive/dynamics test
untouched (no existing anchor holds a player win offer — asserted by the battery).

## Step 2 — ClaimPrompt.svelte: win button, canPass, nullable claimed (commit 2)

1. Props per structure.md §3 (`win = null`, `canPass = true`, `claimed: TileId | null`,
   `onwin`); header behind `{#if claimed !== null}`; win button first (type-narrow
   guard idiom), `callName` grows tsumo/ron; pass behind `{#if canPass}`; `.win`
   class alias of `.call` chrome.
2. app.ssr.test.ts: `describe('win prompt view (SSR)')` — props DERIVED from live
   offers at both mined anchors (`winChoice(legalActions(fold), PLAYER)`):
   - tsumo point: `aria-label="tsumo"` present, `aria-label="pass"` ABSENT
     (canPass:false), no call buttons, no "call on" header;
   - ron window: `aria-label="ron <kind>"` present, pass present; claims render
     beside it if the shanpon bonus anchor landed (else the ron-only window);
   - existing claim-prompt describes untouched and green (defaults hold).

Verify: `just test && just check` (svelte-check owns the prop-type widening).

## Step 3 — App.svelte: owner wiring (commit 3)

1. `win` derived; `takeWin`; `pass()` widened with the `dismissed` arm; mount
   condition `(prompt.length > 0 || win !== null) && !dismissed`;
   `claimed={table.claimable?.tile ?? null}`; `canPass={win?.type !== 'tsumo'}`;
   comment on `dismissed` naming it houtei-only presentation state.
2. No new SSR assertions needed for App (boot seed 1 deals no win; the existing
   "no prompt at boot" test still pins the mount condition's quiet state) — but
   re-run the suite to prove the widened props flow (svelte-check catches misses).

Verify: `just test && just check`; manual sanity optional (`just dev`, seed is
fixed at 1 — the loop behavior is covered by drive.test.ts, not by hand).

## Step 4 — Table.svelte: hand-end screen with SSR coverage (commit 4)

1. Center-panel block per structure.md §5: winner line (wind + you-mark + by-form +
   ron discarder), `aria-label="winning tile"` tile span, `aria-label="yaku"` list;
   `.win-summary`/`.yaku` styles beside `.ended`.
2. app.ssr.test.ts `describe('hand-end view (SSR)')`:
   - Player tsumo fold (the agari walk's action list, rebuilt inline or via the
     anchor prefix + tsumo action): "East (you) wins by tsumo" text shape,
     winning-tile region equals the win kind, EVERY name in `fold.win.yaku`
     appears, no `aria-current`, no ryuukyoku text, no "call or pass" (render App?
     no — Table direct, per the pattern; the prompt absence at agari is drive-layer
     tested via empty offers).
   - Bot-win fold (seed 3951's frozen ron: turn-0 window, `{type:'ron', seat:3,
     tile:72}` after one scripted turn — the -02 anchor geometry): "North wins by
     ron from East" shape, NO you-mark.
   - Assert the AC triple explicitly in one test name per fact (winner / tile /
     yaku) so the AC maps to named tests.

Verify: `just test && just check && just build` (full sweep — the build proves the
single-file target still compiles the widened components).

## Step 5 — Progress/review bookkeeping (no code)

progress.md updated per step as work lands (deviations recorded before proceeding);
review.md written last: change summary, AC→test map, coverage gaps (expected:
multi-ron window untestable same as -01/-02; houtei dismiss untested if no player
houtei anchor found; bot wins remain unreachable by doctrine), handoffs (real-bot
ticket inherits atamahane; riichi ticket extends winChoice's family; glossary
ticket owns yaku display names).

## Testing strategy summary

- **Unit (drive.test.ts)**: the seam's algebra — identity, scoping, negatives
  (furiten/yakuless through the seam), doctored lists, complementarity, quiescence.
  The bug fix lands red-first.
- **Integration (drive.test.ts walks)**: a full seeded hand reaching agari through
  ONLY the drive functions — the AC's "seeded hand known to reach a win".
- **Render (app.ssr.test.ts)**: prompt-at-the-legal-moment and the hand-end triple,
  props always derived from live folds, aria-anchored, structure-free.
- **Regression net**: 401 existing tests; the guard widenings must be no-ops on
  every pre-win anchor (the batteries assert this directly).

Done means: all steps committed, full sweep green (`just test`, `just check`,
`just build`), AC checkboxes coverable by pointing at named tests.
