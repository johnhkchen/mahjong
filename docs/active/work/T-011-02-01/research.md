# Research — T-011-02-01: window-outcome-notice

## Ticket in one line

When the player's tapped claim/win loses `settleWindow`'s arbitration, surface a
transient console notice naming the winner and their claim (both terminologies),
shown for a readable beat, before the next prompt or turn resumes — and document/test
the console's four-tier cascade (claim prompt > outcome notice > riichi prompt >
tenpai hint).

## Where this sits in E-011

E-011 (`docs/active/epic/E-011.md`) diagnosed two legibility gaps from an owner
playtest ("the chi dialogue appears twice... seems like a race condition"): (1) a
player's tap can lose `settleWindow` with zero feedback, (2) consecutive windows read
as one stuck dialog. T-011-01-01 (done) characterized both defects with jsdom tests
and fixed an unrelated regression (`dismissed` outliving its hand). This ticket
(T-011-02-01) owns gap (1) only — gap (2)'s fix (a fresh-prompt beat, remount keying)
is T-011-02-02, a sibling ticket with no dependency either direction. Both tickets
touch `App.svelte`'s console `{#if}` cascade, so they will need to land without
clobbering each other's branch — not this ticket's problem to sequence, but worth
flagging: whichever lands second should re-read the other's diff to the console block.

## The exact gap (from T-011-01-01's own research/review)

`App.svelte`'s `claim()`/`pass()`/`takeWin()` (lines 128–145) all fold whatever
`settleWindow` returns with no branch anywhere comparing "what I tapped" to "what got
pushed." `claim-window-race.tap.svelte.test.ts` pins this today with a `// DEFECT:`
marker at line 129:
`expect(target.querySelector('.notice, .outcome, [role="alert"], [aria-live]')).toBeNull()`
— this is the literal assertion this ticket flips. A grep across `src/app/` confirms
no `.notice`/`.outcome`/`[role="alert"]`/`[aria-live]` element exists anywhere yet.

## The reference-equality invariant (why the check is cheap)

`settleWindow` (`drive.ts:193`) takes `chosen` (the player's tapped action, or null)
and does `offered.indexOf(chosen)` to seed `best`/`bestAt` before consulting any bot.
Since `chosen` is always an element of `offered` itself when non-null (never
constructed — `tapClaim`/`winChoice` are both `offered.find(...)` results), `best`
starts out AS `chosen` and is only overridden by a bot's `callPolicy` answer sitting
at an earlier `offered` index. Two consequences, load-bearing for this ticket:

1. Whenever `chosen !== null`, `settleWindow` never returns `null` — `best` starts
   non-null. `settled === null` cannot occur from `claim()`/`takeWin()`, only from
   `pass()` (chosen is null there — the houtei dismissal path).
2. `settled === chosen` (reference equality, not shape equality) iff the player's own
   tap won the window. A bot's answer is a DIFFERENT object (`callPolicy`'s own
   return), so a plain `===` check is exact — no need to compare `type`/`seat`/`tile`/
   `uses` by hand, and no risk of a false match between two duplicate-copy variants
   (e.g. two chi options differing only in which physical 6m copy the `uses` names).

`pass()` never has a `chosen` to compare (always calls `settleWindow(..., null)`), so
"never when the player passed" is structurally free PROVIDED a stale notice from an
EARLIER window is actively cleared before/at a later pass — not automatic, a
constraint for Design (see below).

## Claim shapes available at the seam (`src/core/record.ts:77`)

`HandAction`'s `chi`/`pon`/`daiminkan` carry `{ seat, tile, uses }`; `ron` carries
`{ seat, tile }`; `tsumo` carries `{ seat }` only. Every variant carries `seat`. A
window's WINNING action (`settleWindow`'s return, when it isn't the player's own) is
always one of `chi | pon | daiminkan | ron` — never `tsumo` (a bot never reaches a
tsumo through `callPolicy`; tsumo is a self-draw completion, mutually exclusive with
an open claim window) and never `draw` (the null-decline branch, unreachable when
`chosen !== null`, see above). So "the winner's claim type" is drawn from exactly
four call forms, naming the seat (`settled.seat`) and the call (`settled.type`).

## Existing vocabulary machinery (`src/app/dictionary.svelte.ts`)

One label dictionary, `TermKey` already covers `chi`/`pon`/`kan`/`ron`/`tsumo` and
`east`/`south`/`west`/`north` (via `windTerm(seat)`). `ClaimPrompt.svelte` has a
LOCAL, unexported `callName(type)` helper mapping `daiminkan → 'kan'` before calling
`term()` — the exact mapping this ticket's notice also needs (the winner's and the
player's own call must read as the same word `ClaimPrompt` already used for it).
Per the dictionary's own header, sentence scaffolding ("called", "was outranked")
stays plain English in both terminologies (Decision 2, T-010-01-01 design.md) — only
the vocabulary NOUNS (call names, seat names) route through `term()`/`windTerm()`. No
new `TermKey` entries are needed; the existing five call-name keys and four wind keys
cover every string this notice needs.

## Presentational component precedent

`ClaimPrompt.svelte` and `RiichiPrompt.svelte` are each a small, computation-free
console-branch component: props in (already-derived facts), `term()`/`windTerm()`
calls for vocabulary, one small `<style>` block matching the shared dark-felt
palette (`#124534`/`#2e7d4f`/`#eaf3ee`). `HandEnd.svelte` uses `role="status"` on its
own reveal — the one precedent in this codebase for an ARIA status role on a
presentation div. The bare tenpai hint (`App.svelte`'s `<p class="hint">`) is the one
console branch that is NOT a component — but it's a single literal string with no
internal composition; this notice composes a seat name + two call names, closer in
shape to `RiichiPrompt` than to the bare hint.

## App.svelte's console cascade today (`App.svelte:222–236`)

```
{#if (prompt.length > 0 || win !== null) && !dismissed}
  <ClaimPrompt .../>
{:else if riichi !== null}
  <RiichiPrompt .../>
{:else if hint !== null}
  <p class="hint">...</p>
{/if}
```

Three tiers today; this ticket inserts a fourth (`notice`) between claim prompt and
riichi. `prompt`/`win`/`riichi`/`hint` are all `$derived` reads over `offered`/`table`
— presentation-only, never authoritative (App.svelte's own header comment). `notice`
would be the first PURELY EPHEMERAL piece of console state (not derived from `table`
at all — it must survive across the reactive re-derivation that happens the instant
`activeHand().push(settled)` re-folds the game, since the notice describes an event
that already happened, not the current table fact).

## Per-hand reset precedent (the exact bug class to not repeat)

`dismissed` (line 76) is presentation-only, per-hand state, reset in both `newHand()`
(line 171 — the T-011-01-01(c) regression-tested fix, commit 3bcf9d3) and `newGame()`
(line 182, always did this). Any new ephemeral state that can outlive a hand boundary
needs the identical two resets, or it repeats the exact bug T-011-01-01 just
regression-tested.

## Pacing (`BOT_DELAY_MS = 250`, `App.svelte:96`)

The forced-action `$effect` ticks one bot action per 250ms regardless of what the
console currently shows — the console has never gated or paused the underlying fold,
and this ticket must not change that. A notice's "readable beat" is a dwell-TIME
concern (how long it stays visible before auto-clearing), not a pacing concern for
the loop itself.

## Existing frozen fixtures usable WITHOUT new mining (`src/app/drive.test.ts`)

Pure-function-level (`foldRecord`, no `App` mount) fixtures already frozen and
reusable for unit-testing a new `windowOutcome()`-shaped function:

- **Seed 3, `raceWindow3`** (line 90): South's pon `SOUTH_PON_3` precedes East's two
  chi variants (`EAST_CHI_A`/`EAST_CHI_B`) in offered order — the LOSS case at the
  pure level (tapping either East chi loses to South's pon).
- **Seed 5, `ponWindow5`** (line 97): East's own pon `EAST_PON_5` — North holds chi
  variants on the SAME tile, but pon precedes chi in `claimOffers`' frozen order
  (`legal.ts:264`), and no ron exists in this window, so East's pon is uncontested —
  a WIN case (tapping it should settle to itself).
- **Seed 212, `kanWindow212`** (line 110): East holds all three remaining copies of a
  kind — `EAST_KAN_212`, the sole offer of any kind on this window — another
  uncontested WIN case, a different call type (daiminkan).

These three cover loss + two win shapes at the pure-function layer with zero new
mining. `T-011-01-01`'s own `claim-window-race.tap.svelte.test.ts` (seed 344,
App-mounted) already has ONE mined mixed-race window (chi loses to pon) plus a SECOND
window (chi on 2s) reached three ticks later — whether that second window is
uncontested for the player is not documented in T-011-01-01's artifacts and needs
empirical confirmation in Implement (candidate reuse for the App-mounted "wins" case,
continuing the SAME fixture rather than mining a new one — see design.md).

## Constraints carried into Design

- No `src/core/` changes (view/drive-only, per E-011's own scoping).
- No new runtime dependencies; no CSS motion work here (T-011-02-02's job).
- Both terminologies must be covered for every new user-facing string.
- `just test` and `just check` must stay green throughout.
- The console cascade order must be BOTH documented (a comment in `App.svelte`) and
  tested (an assertion that a fresh claim prompt preempts a still-live notice).
