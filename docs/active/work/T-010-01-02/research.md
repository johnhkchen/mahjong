# Research — T-010-01-02 toggle-and-persistence

## Ticket ask

A small header toggle (next to "new game", same visual register, ≥44px target) switches the
active terminology live; the choice persists as one `localStorage` key and is read at boot
(SSR-safe: absent storage falls back to the default). Depends on T-010-01-01 (`phase: done`).

## What T-010-01-01 already built (the seam this ticket plugs into)

`src/app/dictionary.svelte.ts` — the one label dictionary, already shipped and wired through
every consumer:

- `Terminology = 'romaji' | 'zh-hant'`, 20 `TermKey`s, `TERMS` table (romaji default = every
  string the views hardcoded pre-T-010-01-01).
- `let current = $state<Terminology>('romaji')` — **module-scoped rune**, not prop-drilled or
  context-provided (its own Decision 1). Every consumer (`ClaimPrompt`, `RiichiPrompt`, `Table`,
  `HandEnd`, `App`) reads `term()`/`windTerm()` directly off this module.
- `term(key): string`, `windTerm(seat: number): string` — reads.
- `activeTerminology(): Terminology` — reads the current value. Its own doc comment: "read by a
  future toggle UI's own display state."
- `setTerminology(next: Terminology): void` — **already exported, currently uncalled by
  anything**. Its own doc comment: "Unused by any consumer in this ticket; exported for
  T-010-01-02." This is the entire mutation surface this ticket needs — no dictionary.svelte.ts
  API changes required, only a caller.

Because `current` is a module-level `$state`, every component that calls `term()`/`windTerm()`
already re-renders reactively the instant `setTerminology()` runs — T-010-01-01's design
explicitly bought this so T-010-01-02 "only adds a setter call on click plus a `localStorage`
read/write effect — zero changes to the components this ticket touches" (dictionary.svelte.ts
top comment, verbatim).

## Where the toggle lives: `src/app/App.svelte`

The `<header>` block (lines 183-186) currently holds exactly two children:

```svelte
<header>
  <span>mahjong</span>
  <button class="new-game" onclick={newGame}>new game</button>
</header>
```

`.new-game`'s CSS (lines 275-290) is the "same visual register" reference the ticket names: `font:
inherit`, `font-size: 0.75rem`, `letter-spacing: 0.15em`, `text-transform: uppercase`, `color:
#a8c7b8`, `background: none`, `border: 1px solid #3d5c4c`, `border-radius: 0.375rem`, `padding:
0.65rem 0.9rem`, `min-height: 44px` (the ≥44px target, already solved once here), `cursor:
pointer`, `:active { background: #1c3a2c }`. A new toggle button styled identically (or sharing
the class) satisfies "same visual register" and "≥44px target" for free.

`header` itself is `display: flex; align-items: center; gap: 1rem` — a third flex child slots in
with no layout rework.

## SSR boot path — what "SSR-safe" constrains

`vite.config.ts` splits the test suite into two Vitest projects:

- **`node`** environment: `src/**/*.test.ts` excluding `*.svelte.test.ts`. `app.ssr.test.ts`
  lives here and calls `render(App, {...})` from `svelte/server`. **No `window`, no
  `localStorage` global exists in this environment** — Node does not expose `localStorage` by
  default (no `--experimental-webstorage` flag set anywhere in this repo's config/scripts).
- **`dom`** (jsdom) environment: `src/**/*.svelte.test.ts`. `app.controls.svelte.test.ts` and
  `app.riichi.tap.svelte.test.ts` live here, `mount()`-ing a real App into a real DOM.
  `localStorage` (via jsdom's `window.localStorage`) IS available.

Any top-level `<script>` code in a `.svelte` component, and any module-top-level code in
`dictionary.svelte.ts`, executes during SSR (`render()` from `svelte/server` runs the component
function on the server, unlike `$effect` which App.svelte's own comment already documents as
"never runs in SSR"). A bare `localStorage.getItem(...)` at either of those scopes would throw
`ReferenceError: localStorage is not defined` under the `node` project and break every
`app.ssr.test.ts` suite. Any localStorage access this ticket adds — read at boot or write on
toggle — must be guarded (`typeof localStorage !== 'undefined'`) or confined to a scope SSR never
executes (`$effect`, or an `onclick` handler, both DOM-only).

The AC's own phrasing ("SSR renders (no localStorage) fall back to the default terminology
without warnings") is exactly this: not merely "don't crash" but "don't even console.warn" —
rules out a try/catch-and-log pattern around an unguarded access; a `typeof` check is silent by
construction.

## `localStorage` precedent in this codebase

`grep -rn localStorage src docs` turns up: architecture.md names `localStorage` as the app's only
persistence mechanism (hand-log history + stats, not yet built); E-010 (this epic) says "First
`localStorage` use in the app — keep it to the single key (broader persistence is its own Tier-3
signal)." **No code in `src/` touches `localStorage` today.** This ticket is the first real
implementation, so there is no existing read/write helper, no existing key-naming convention, and
no existing SSR-guard pattern to imitate in this repo — the guard shape above is derived from the
Vitest project split and Svelte's own SSR/render-vs-effect semantics, not copied from precedent.

## Existing test coverage touching the header/toggle surface area

- `app.controls.svelte.test.ts` (jsdom, `mount()`s a real App, drives it with fake timers via a
  `driveToHandEnd` helper) — covers `.new-game` and `.next-hand` click behavior end-to-end. This
  is the pattern a toggle-click test would follow: `target.querySelector<HTMLButtonElement>(...)
  .click(); flushSync()`.
- `app.riichi.tap.svelte.test.ts` — same jsdom/mount pattern, drives riichi-prompt taps.
- `app.ssr.test.ts` (node, `render()`) — the large SSR regression suite; asserts on `body` string
  content, including romaji-default vocabulary words (`'East'`, `'tenpai'`, `'ryuukyoku'`, etc.).
  None of it calls `setTerminology`, so all of it currently exercises (and pins) the `romaji`
  default. Any new toggle/localStorage code must not perturb these assertions when nothing reads
  a stored `zh-hant` value (default path).
- No test file resets `dictionary.svelte.ts`'s module-scoped `current` between tests today,
  because nothing before this ticket ever mutates it. Once a toggle test calls
  `setTerminology`/clicks the toggle, that mutation is process/module-lifetime, not per-test —
  Vitest's `dom` project reuses one module graph across all tests in a run unless explicitly
  isolated. This is a correctness hazard for any test suite this ticket adds (leakage into other
  `dom`-project test files that assert romaji-default strings), addressed in Design/Plan.

## Constraints recap

- Core (`src/core/`) is untouched by definition — nothing here calls into it.
- `dictionary.svelte.ts`'s public surface is already sufficient (`activeTerminology`,
  `setTerminology`); no changes needed there beyond possibly the persistence read/write, which
  research does not yet decide the location of (Design's job).
- Exactly one `localStorage` key total (ticket AC: "exactly one localStorage key").
- No new dependency: no i18n library, no `svelte-local-storage-store`-style package — the repo has
  no such dependency today (not checked in `package.json` beyond `svelte`/`vite` tooling) and
  E-010's framing ("no i18n framework") argues against introducing one for a single boolean-ish
  toggle.
