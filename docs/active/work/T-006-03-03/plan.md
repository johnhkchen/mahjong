# T-006-03-03 — drive-seam-wiring — Plan

## Steps

### Step 1 — Baseline

Run `just test` and `just check` to confirm a green baseline before touching
anything. (The tree carries uncommitted sibling work in shanten.* and ticket
frontmatter — ours must not depend on or disturb it.)

Verify: both commands exit 0 (or any pre-existing failure is recorded in
progress.md as not-ours).

### Step 2 — Mine the frozen anchors (scratchpad, no repo changes)

Write a scratchpad script (vitest-style or `flox activate -- npx tsx`) that,
for each anchor state, prints the policy outcome the new code will produce:

- seed 1, `beforeSouthDraw` (1 tsumogiri turn): South's chi decision on
  East's 8s — callPolicy accept (which element) or decline (head draw).
- seed 1, `afterSouthDraw`: discardPolicy's choice for South (tile id) —
  is it the drawn tile or a hand tile?
- seed 3, `raceWindow3`: South's pon decision — decides the
  player-chi-vs-bot-pon settle outcome.
- seed 5, `ponWindow5`: North's four chi variants — the pass-at-mixed-window
  outcome.
- seed 15 / seed 212 windows: bot answers (for settle/wait assertions).
- seed 3951 turn 35 (bot tsumo), seed 3951 turn 0 (bot ron), seed 147508
  (bot houtei ron): confirm the offered element the policy takes.
- seed 1 full walk under the NEW driver (player: decline every prompt,
  tsumogiri every turn): end phase, action count, per-seat melds, win — the
  walk test's frozen facts.
- Re-check the playToWin geometries (542630, 887141, 362857, 1038928) under
  policy bots: do the mined first-win events survive S/W/N playing well? For
  each destroyed geometry, mine a replacement seed with the same shape (the
  suite documents the method; keep the derivation comment style).

Record every mined value in progress.md as it is captured.

### Step 3 — drive.ts rewrite (the production change)

Per structure.md §drive.ts: new header, widened imports, delete `passClaim`,
add `botSeatsHoldingOffers` + `settleWindow`, rework `forcedAction` arms.

Verify: `just check` — App.svelte and drive.test.ts now fail to compile
(expected, fixed in steps 4–5); `tsc` on drive.ts itself is clean. (In
practice steps 3–5 land as one atomic commit; the split here is authoring
order, not commit order.)

### Step 4 — App.svelte rewiring

Per structure.md §App.svelte: `$effect` passes `table`; `claim`/`pass`/
`takeWin` route through `settleWindow`; comments updated.

Verify: `just check` clean except drive.test.ts.

### Step 5 — drive.test.ts rework

Per structure.md §drive.test.ts, using step-2's mined values:

1. Mechanical: `forcedAction(state, offered, player)` call sites — note the
   suite mostly holds `offered` only; each call site gains its state (all
   anchors already bind their folds to names).
2. Delete the passClaim describe; add the settleWindow describe.
3. Rework the forcedAction bot-arm tests (auto-pass → settle, tsumogiri →
   policy discard, never-win → takes tsumo/ron/houtei-ron).
4. Replace the full-hand walk; update playToWin walks (settleWindow decline
   in the driver chain), re-anchored where step 2 said so.
5. Every new assertion pairs a frozen literal with an in-test oracle
   (`toBe(callPolicy(seatView(...)))` / shanten-minimality re-derivation),
   the sweep's style — never trusting the subject alone, never prose-only.

Verify: `just test` — full suite green, including core (untouched) and SSR.

### Step 6 — Commit

One commit (or two if the walk rework reads better separate): subject
`T-006-03-03: policy through the drive seam — S/W/N draw, discard, call, win`
with the standard Co-Authored-By trailer. Only `src/app/drive.ts`,
`src/app/drive.test.ts`, `src/app/App.svelte` staged — do NOT stage the
sibling shanten/ticket-frontmatter modifications already in the tree.

### Step 7 — End-to-end sanity

`just build` (the single-file target still compiles with Svelte changes);
optional `just dev` smoke is skipped in this headless session — the SSR test
plus the walk tests are the executable behavior evidence.

## Testing strategy

- **Unit (selector level)**: settleWindow gets the doctored-list and
  identity teeth the other selectors have; forcedAction's every arm has a
  named frozen anchor.
- **Integration (walk level)**: the seed-1 policy walk (deal → end, player
  declining) proves S/W/N draw/discard/call autonomously through the SAME
  code path App.svelte runs; playToWin proves the player's wins still fold
  through the seam with live bots; identity containment at every append
  keeps "the app never computes legality" load-bearing.
- **Oracles**: every bot-behavior expectation is double-keyed — a frozen
  literal (regression pin) AND an independent re-derivation (policy call on
  a fresh projection, or shanten arithmetic) so a wrong mine cannot freeze a
  wrong behavior.
- **AC trace**: "routes non-PLAYER decisions to the policy" = forcedAction
  arm tests; "instead of tsumogiri arm and claim auto-pass" = the flipped
  anchors; "S/W/N drawing, discarding, calling, winning on their own" = the
  walk + tsumo/ron/houtei tests; "at the existing pace" = App diff shows no
  pacing change (review.md notes it); "no difficulty selector present" =
  no such export/prop exists (review.md notes it; the walk uses none).

## Risks / watchpoints

- **Mixed-window UX shift**: a player tap can now lose to a bot ron/pon by
  precedence — intended (design §B), called out for the human reviewer.
- **playToWin geometry rot**: bots claiming/winning can consume the mined
  win events; step 2 re-mines proactively rather than debugging test
  failures reactively.
- **settleWindow null at non-houtei states**: only reachable if the head is
  not a draw and no candidate exists — the tsumo point via a defensive
  `pass()` call; App guards null → `dismissed`, and `canPass` already hides
  that path. Documented, not specially cased.
- **Perf per tick**: ≤ 4 seatView projections + ≤ 14 shanten calls per
  forced action — trivial next to the existing per-append refold.
