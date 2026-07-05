# Research — T-013-02-01: report-bug-dialog

## Ticket in one line

A header "report bug" affordance opens a dialog: freeform message + an auto-attached,
read-only report (serialized notation of the CURRENT `GameRecord` + context) + two
delivery buttons (copy report; open prefilled GitHub issue, falling back to a
clipboard-first short body past ~6k chars). Dictionary terms for labels. Game input is
paused/inert while open.

## What already exists

### The notation contract (T-013-01-01, done, committed 03eeaca)

`src/core/notation.ts` exports:
- `NOTATION_VERSION` (currently `1`)
- `serializeGameRecord(record: GameRecord): string` — header line `v<version>
  <seed-base36>` then one line per hand, space-separated tokens, all-ASCII
  (`/^[\x20-\x7e\n]*$/`), no trailing newline concerns documented but the format is
  `header + '\n' + handLines.join('\n')` per the grammar comment (`document := header
  ('\n' handLine)+`).
- `parseGameRecord(text: string): GameRecord` — strict inverse; throws `RangeError`
  naming `line <n>, position <p>` on malformed input.
- Both exported from the barrel (`src/core/index.ts:21`).
- Round-trip property-tested; zero DOM imports.

This ticket's report text is `serializeGameRecord(record)` where `record` is the SAME
`$derived<GameRecord>` App.svelte already holds (`App.svelte:63`, `{ seed: gameSeed,
hands }`) — no new engine calls needed, purely a consumer of an existing pure function.

### App.svelte's authoritative state (`src/app/App.svelte`)

- `gameSeed` (`$state<number>`), `hands` (`$state<HandAction[][]>`), `record =
  $derived<GameRecord>({ seed: gameSeed, hands })`, `game = $derived(foldGame(record))`,
  `table = $derived(game.table)`. These are exactly the values a report needs: `record`
  serializes directly; `hands.length - 1` is the active hand index; `activeHand().length`
  (or `hands[hands.length-1].length`) is the action count; `table.phase` may be relevant
  context but isn't named in the AC.
- The header (`<header>` block, lines 276-293) already holds three buttons: `new-game`,
  `terminology-toggle` (aria-label pattern: names the mode a tap switches TO), and
  `call-prompt-toggle`. A fourth "report bug" button is a natural sibling, each styled by
  the shared `.new-game, .terminology-toggle, .call-prompt-toggle` selector
  (`App.svelte:402-421`) that the new button's class would join.
- `activeTerminology()` (from `dictionary.svelte.ts`) is available at the App level for
  context — the AC says "both terminologies covered" for labels, meaning the DIALOG's
  own labels route through `term()`, not that the report text itself needs to
  translate (the report is a machine-parseable notation string, not user-facing prose).

### Dictionary (`src/app/dictionary.svelte.ts`)

- `term(key: TermKey): string` reads the module-scoped `current` terminology rune.
- `TermKey` union and `TERMS` record hold every translatable vocabulary word; adding
  dialog labels (e.g. "report bug", "copy report", "open issue", "message") requires
  new `TermKey` entries UNLESS they count as "generic UI words no ticket ever named as
  translatable" (the module header's own carve-out, e.g. "new game", "next hand"'s
  neighbors) — precedent split: `declareRiichi`/`notYet`/`nextHand` are actual dictionary
  entries (feature-specific verbs), while "new game" stays hardcoded English. The AC's
  "dictionary terms for all labels" phrase reads as a direct instruction to add entries
  for this feature's OWN labels, not to route every incidental UI string through it.
- Guarded `localStorage` pattern (`loadStored`/`setTerminology`) — same guard shape
  (`typeof window === 'undefined'`) will matter if the dialog needs to persist anything,
  though nothing in the AC calls for persistence.

### Existing dialog/prompt patterns — there is no `<dialog>` element anywhere yet

`grep -rn "dialog\|<dialog"` across `src/app` turns up zero uses of the native
`<dialog>` element or `role="dialog"`. Every existing "prompt" (`ClaimPrompt.svelte`,
`RiichiPrompt.svelte`) is an always-in-flow `<aside role="group">` inside the
`.console` slot at the bottom of `App.svelte`'s layout — never a true modal overlay,
never something that needs to intercept background input, because nothing before this
ticket needed to pause the table. This ticket is the FIRST modal in the app:
- AC requires "game input underneath is paused or inert while the dialog is open" — a
  new concern with no existing seam. Candidates: the native `<dialog>` element's
  `showModal()` (built-in inert-background + focus-trap + top-layer, zero custom CSS
  needed for backdrop-blocking) vs. a manual overlay + `inert` attribute on the rest of
  `<main>`.
- `mount-guard.ts` (`MOUNT_GUARD_MS = 200`, `prefersReducedMotion()`) is the existing
  "ignore taps for one beat after mount" pattern shared by `ClaimPrompt`/`RiichiPrompt`,
  authored to stop a fast double-tap or window-race from misfiring a button in a
  freshly-mounted prompt. Relevant precedent for whether the report dialog needs the
  same guard (it opens on a deliberate header tap, not a reactive/timed remount, so the
  race this guards against likely doesn't apply here — worth deciding explicitly in
  Design, not assuming).

### Component conventions (Svelte 5, this codebase)

- `$props()` destructured with typed inline interface; callbacks are `on<verb>?: () =>
  void` optional props, never required.
- Components are presentation-only: no core computation inside `.svelte` files: pure
  reads/calls into `drive.ts` or `core` barrel, string formatting only.
- `aria-label` used pervasively for interaction-test hooks (`querySelector('[aria-label=...]')`)
  and accessibility together — tests select by `aria-label`, not by test-id.
- Style blocks are scoped per component, hand-authored CSS (no Tailwind/UI kit), dark
  palette (`#124534` background family, `#a8c7b8` muted text) matching the existing
  console prompt look. CLAUDE.md-global brand guidance (b28.dev clay/steel-blue palette,
  Lora/Karla) is NOT currently applied anywhere in this app — the whole app uses its own
  dark-green mahjong-table palette instead, so a new dialog should match the APP's
  existing look, not the b28.dev brand kit (no `b28-clay.css` import anywhere in this
  repo; out of scope to introduce here).

### Test conventions

Two vitest projects (`vite.config.ts`): `node` (`*.test.ts`, excludes `*.svelte.test.ts`)
and `dom`/jsdom (`*.svelte.test.ts`). Tap-interaction suites for App-level features are
named `<feature>.tap.svelte.test.ts` and mount a REAL `App` via `mount()`/`flushSync()`
from `svelte`, with `vi.useFakeTimers()` to drive `BOT_DELAY_MS`/`MOUNT_GUARD_MS` timers
deterministically (`app.riichi.tap.svelte.test.ts`'s pattern, `call-prompt-filter.tap.
svelte.test.ts` likely the newest instance). `app.terminology.coverage.ssr.test.ts`
appears to be a coverage sweep asserting every rendered string is dictionary-routed
under both terminologies — worth checking directly before Design decides how the new
dialog's labels get covered.

No test file anywhere yet mocks `navigator.clipboard` — jsdom does not implement the
Clipboard API by default (`navigator.clipboard` is `undefined` in jsdom), so the AC's
"jsdom clipboard mock" is new test infrastructure this ticket must add (likely
`Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, ...})`
in the test file, or a shared setup addition to `vitest-dom-setup.ts`).

### GitHub issue URL construction

No existing code in this repo builds a `github.com/.../issues/new?...` URL. The AC
needs: `https://github.com/johnhkchen/mahjong/issues/new?title=...&body=...`
URL-encoded, with a length check (~6k chars total) that swaps to a short
clipboard-first body when exceeded. This is new, self-contained logic — a candidate for
a small pure helper function (framework-agnostic, easily unit-testable without
mounting), analogous to how `drive.ts` holds pure app-level logic separate from the
`.svelte` view files.

### Context fields named by the ticket

"the serialized notation of the CURRENT GameRecord plus context (terminology, hand
index, action count, app origin)":
- terminology: `activeTerminology()` (dictionary.svelte.ts)
- hand index: `hands.length - 1` (0-based active hand)
- action count: `activeHand().length` (or `hands[hands.length-1].length`)
- app origin: likely `location.origin`/`location.href` (guarded like the `bootSeed`
  `typeof location !== 'undefined'` check at `App.svelte:43`) — the deployed origin
  (`mahjong.b28.dev`) vs. a dev server, relevant for the maintainer to know what build
  reported the bug. Needs a guard for the SSR/node test project where `location` is
  undefined.

## Assumptions / open questions carried into Design

1. Whether to use the native `<dialog>`/`showModal()` element (gets modal input-inertness
   and backdrop for free) vs. a manual overlay + `inert` attribute — the AC's "paused or
   inert" language is satisfied by either; `<dialog>` is less code and is a real platform
   primitive with no dependency.
2. Whether the report dialog needs the same `mount-guard.ts` double-tap protection as
   `ClaimPrompt`/`RiichiPrompt` (probably not — it opens from a deliberate discrete header
   tap, not a reactive/keyed remount during live play).
3. Whether new dictionary entries are needed for every dialog label or whether some
   (e.g. "message", a generic textarea placeholder) fall under the existing "generic UI
   words" carve-out — needs an explicit decision, not silence, since the AC says "both
   terminologies covered."
4. Exact ~6k char threshold: measure the FULL encoded URL length (`https://github.com/...`
   + encoded title + encoded body) against 6000, not just the body.
5. Whether "copy report" copies message+notation+context together as one blob (the AC:
   "copy puts the full report on the clipboard") — yes, per AC wording; the GitHub issue
   body should be the same content structure, just also URL-encoded and (when over
   threshold) replaced with a short "paste from clipboard" instruction body.
