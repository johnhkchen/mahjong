# T-005-02-03 — win-prompt-and-hand-end-screen — Review

The handoff: what changed, how it is covered, what a human should look at.

## 1. What changed

| File | Change |
|---|---|
| `src/app/drive.ts` | New `winChoice(offered, player)` — the player's one tsumo/ron offer, an element of the offered set, serving as BOTH the prompt's visibility predicate and the tap's selector (at most one win offer exists per state by the enumeration's shape, and a win action has no `uses` to choose between). `forcedAction`'s wait guard widened to claims ∪ wins — this FIXES a real bug: a ron-only window looked "bot-only" to the claim-guard and the loop auto-passed the player's ron after the timer. `passClaim`'s guard widened the same way (its head-must-be-draw check already scopes the change to window rons). Docs: houtei arms (player's waits by intent; bot-only halts — bots pass houtei), bots "never call, never win", atamahane note for the future bot recorder, FURITEN DIVERGENCE consumption. |
| `src/app/ClaimPrompt.svelte` | Props widened: `win: HandAction \| null` (rendered as the FIRST button — offered order made visible; `tsumo` / `ron <kind>` aria; bare `onwin` signal), `claimed: TileId \| null` (header conditional — the tsumo/houtei moments are windowless), `canPass` (false only at the tsumo point, where declining IS a discard tap). Claim-button aria now reads the choice's own `tile` (type-safe under the nullable `claimed`; same fact). |
| `src/app/App.svelte` | `win` derived via `winChoice`; `takeWin` appends the element verbatim; `pass()` gains the houtei arm — when no draw exists to decline into, a presentation-only `dismissed` flag lowers the prompt (no action exists in the vocabulary; the hand is already provisionally ended). Mount condition is the drive predicate family verbatim: `(prompt.length > 0 \|\| win !== null) && !dismissed`. |
| `src/app/Table.svelte` | The hand-end screen, in the center panel beside the ryuukyoku precedent: `{#if phase === 'agari' && win !== null}` → winner wind (you-marked for East), win form ("wins by tsumo" / "wins by ron from West"), the winning tile as its own `aria-label="winning tile"` chip, and the yaku list (`aria-label="yaku"`) with the fold's recorded names verbatim. |
| `src/app/drive.test.ts` | +4 frozen seat-0 win anchors (mined, geometry comments, never regenerate) + core's bot-win anchors through the player lens; 13 new tests — see §2. |
| `src/app/app.ssr.test.ts` | +8 tests: the three win-prompt moments (props derived from live offers) and the hand-end screen (player tsumo + bot ron readings). |

Commits: 4f25943 (seam), 6147968 (prompt), 52bb595 (app wiring), 898c80a (hand-end).
Verification: 431/431 tests across 17 files (was 401 + 30 new − 0 changed-shape);
svelte-check + tsc clean; `just build` self-contained single file OK (71.3 kB).
The auto-pass regression test was verified RED against the pre-change drive.ts
(git-stash check) before going green.

## 2. Acceptance criteria → coverage

- **"Prompted tsumo/ron at the legal moment"** — drive.test.ts: `winChoice` returns
  the offered element itself (toBe) at the tsumo point (offered index 14), the
  ron-only window, the shanpon window (ron beside live pon/chi offers), and the
  houtei offering; `forcedAction` waits (null) at all four — including the
  regression anchor where the old loop forced the head draw over the player's ron.
  Three full seam walks (deal → tsumo / window ron / houtei ron) end in `agari`
  with the exact win literal and post-win quiescence.
- **"Never when furiten or yakuless"** — the gates live in core (T-005-02-02) and
  the seam only renders offered elements; pinned from the app side anyway: at the
  seed-23798 furiten window and the seed-12754 yakuless window, no ron is offered
  and `winChoice` is null on the completing seat's own lens. A doctored-list test
  proves the legality comes from nowhere but the list.
- **"Seeded hand known to reach a win"** — mined anchors: tsumo 542630, shanpon
  ron 887141, ron-only 362857, houtei 1038928 (all seat-0 winners; seat-0 dealt
  tenpai runs ~1/8000, hence the 2M-seed scan). Mining probes were temporary and
  deleted; anchors were cross-checked against isAgari/waits/yakuOf at capture,
  never against legalActions.
- **"Hand-end screen renders winner, winning tile, and yaku names" +
  "app.ssr.test.ts render assertion"** — hand-end describe: "East (you) wins by
  tsumo", winning-tile region equals the fold's kind, every recorded yaku name
  present, no active-seat marker, no ryuukyoku line; plus the bot reading ("North
  wins by ron from East", no you-mark). Win-prompt describe covers the three
  prompt moments' render shapes.

## 3. Design decisions a reviewer should weigh

1. **`winChoice` is singular and dual-role** (predicate + selector) — grounded in
   the enumeration: at most one player win offer exists per state. If a future
   rule ever offers two (none known), the function's contract must be revisited.
2. **Declining a tsumo has no pass button** — the discard taps are the decline
   (the post-draw tap surface is already live). No dismissal state exists there.
3. **The houtei decline is a presentation flag** (`dismissed` in App), because the
   vocabulary has no decline action and the hand is already provisionally ended.
   It never resets — safe for a single hand; the game-start/next-hand ticket must
   reset it alongside the seed/actions (flagged as a handoff, §5).
4. **Placeholder bots never win** — extends the "never call" doctrine: forcedAction
   steps over bot tsumo offers (reverse discard scan) and lets bot rons/houtei go
   stale. A real-bot ticket replaces exactly these arms and inherits the atamahane
   note on `winChoice` (first offered ron = head-bump order).
5. **Yaku render as the record's romaji names** — deliberately no English display
   map here; the teaching glossary (STANDARD_YAKU_NAMES' documented consumer) is
   its own ticket and should be the single naming authority.
6. **Hand-end is inline in Table's center panel**, not an overlay component — the
   ryuukyoku precedent slot; the post-hand review screen (vision.md) will decide
   the richer shape later.

## 4. Test-coverage gaps (known, accepted)

- **The houtei dismiss flow has no automated test** — `dismissed` lives in App's
  interactive loop; SSR can't tap, and the $effect loop never runs in SSR. The
  logic is three lines; the SSR houtei-prompt render and the drive-level
  "passClaim null at houtei" tests cover its inputs. A browser-driven test rig is
  future work (no precedent in the repo yet).
- **No live-app drive of a win** — the boot seed is fixed at 1, which ends in
  ryuukyoku; the win prompt is unreachable by hand until the game-start ticket
  adds seed selection. Coverage is via the seam walks (real folds, real offers,
  every append an offered element) and SSR renders — the same evidence level the
  claim prompt (T-004-02-02) shipped with.
- **Multiple simultaneous rons** — still no fixture (the -01/-02 gap); `winChoice`
  handles it by construction (`find` = first = the player's own when his exists).
- **No player rinshan/haitei tsumo anchor** — the prompt path is source-agnostic
  (core stamps the source; the seam never reads it), so coverage rides on core's
  seed-29732 rinshan anchor.

## 5. Open concerns / handoffs

- **Next-hand reset**: the game-start/next-hand ticket must reset `dismissed`
  with the record (seed/actions) — it is the one piece of App state beside them.
- **Riichi epic**: extends the prompt family with declaration offers; the
  win-first button order and the `canPass` semantics are now the shape to extend.
- **Real-bot ticket**: replaces forcedAction's tsumogiri arm and the auto-pass
  behavior; `winChoice`'s doc carries the atamahane rule it must honor.
- **Yaku glossary ticket**: owns display names/explanations; the hand-end list is
  its render target.
- No TODOs left in code; no skipped tests; nothing needs human intervention.
