# Structure — T-010-01-02 toggle-and-persistence

## Modified: `src/app/dictionary.svelte.ts`

Add, immediately above `let current = $state<Terminology>('romaji')`:

```ts
const STORAGE_KEY = 'mahjong-terminology'

function isTerminology(value: string | null): value is Terminology {
  return value === 'romaji' || value === 'zh-hant'
}

/** Reads the persisted terminology at module load — the "read at boot" the toggle
 *  needs. Guarded: the Node test project (app.ssr.test.ts) has no `localStorage`
 *  global, and a malformed/foreign stored value falls back to the default rather
 *  than throwing. */
function loadStored(): Terminology {
  if (typeof localStorage === 'undefined') return 'romaji'
  const stored = localStorage.getItem(STORAGE_KEY)
  return isTerminology(stored) ? stored : 'romaji'
}
```

Change the state initializer:

```diff
-let current = $state<Terminology>('romaji')
+let current = $state<Terminology>(loadStored())
```

Change `setTerminology` to also persist:

```diff
-/** Sets the active terminology. Unused by any consumer in this ticket; exported for T-010-01-02. */
+/** Sets the active terminology and persists the choice to the one storage key
+ *  (T-010-01-02). Guarded the same way loadStored() is — a no-op write under
+ *  the Node test project, never throws. */
 export function setTerminology(next: Terminology): void {
   current = next
+  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next)
 }
```

Update the two stale doc comments that named this ticket as *future* work (now current):
- Top-of-file comment (line ~62-63): "a future toggle (T-010-01-02) only needs to call
  `setTerminology()` on click plus a `localStorage` read/write effect" → past tense, drop "future"
  and "effect" (Decision 1 — it's a guarded synchronous read/write, not a Svelte `$effect`).
- `activeTerminology()`'s doc comment ("read by a future toggle UI's own display state") → drop
  "future," name `App.svelte`'s toggle directly.

No changes to `term()`, `windTerm()`, `TERMS`, `TermKey`, `Terminology`, or any existing export's
signature — every existing consumer (`ClaimPrompt`, `RiichiPrompt`, `Table`, `HandEnd`, `App`)
needs zero changes for this reason (T-010-01-01's whole design bet, confirmed).

## Modified: `src/app/App.svelte`

Script section — extend the existing dictionary import and add the toggle's own small local map
and handler, placed near the other top-level consts (`BOT_DELAY_MS`) since neither is `$state`/
`$derived`:

```diff
-import { term } from './dictionary.svelte'
+import { activeTerminology, setTerminology, term, type Terminology } from './dictionary.svelte'
```

```ts
// The toggle's own display names — NOT a dictionary.svelte.ts TERMS entry: a
// terminology's name doesn't change meaning under the other terminology (design.md
// Decision 4).
const TERMINOLOGY_LABEL: Record<Terminology, string> = { romaji: 'romaji', 'zh-hant': '中文' }

function otherTerminology(t: Terminology): Terminology {
  return t === 'romaji' ? 'zh-hant' : 'romaji'
}

function toggleTerminology() {
  setTerminology(otherTerminology(activeTerminology()))
}
```

Markup — `<header>` gains a second button, after `.new-game`:

```diff
 <header>
   <span>mahjong</span>
   <button class="new-game" onclick={newGame}>new game</button>
+  <button
+    class="terminology-toggle"
+    onclick={toggleTerminology}
+    aria-label={`switch to ${TERMINOLOGY_LABEL[otherTerminology(activeTerminology())]}`}
+  >
+    {TERMINOLOGY_LABEL[otherTerminology(activeTerminology())]}
+  </button>
 </header>
```

Style section — widen the `.new-game` rule's selector, add the shared `:active` selector:

```diff
-  .new-game {
+  /* Same visual register (ticket's own phrase) — both header controls share every
+     declaration below via one selector, not a shared class name (design.md Decision 3:
+     `.new-game` stays a functionally meaningful class elsewhere, e.g.
+     app.controls.svelte.test.ts's `querySelector('.new-game')`). */
+  .new-game,
+  .terminology-toggle {
     font: inherit;
     font-size: 0.75rem;
     letter-spacing: 0.15em;
     text-transform: uppercase;
     color: #a8c7b8;
     background: none;
     border: 1px solid #3d5c4c;
     border-radius: 0.375rem;
     padding: 0.65rem 0.9rem;
     min-height: 44px;
     cursor: pointer;
   }
-  .new-game:active {
+  .new-game:active,
+  .terminology-toggle:active {
     background: #1c3a2c;
   }
```

`loadStored()`/`setTerminology()` guard on `typeof window === 'undefined'`, not `typeof
localStorage === 'undefined'` — discovered during implementation (progress.md) that
`globalThis.localStorage` is itself a Node 20+ accessor which emits an ExperimentalWarning the
instant it's *read*, even via `typeof`; gating on `window`'s absence (true in the Node vitest
project, false everywhere else) never touches that accessor at all.

## New: `src/app/vitest-dom-setup.ts` (discovered during implementation, not in the original plan)

A `dom`-project-only Vitest `setupFiles` entry. Node's own `localStorage` global (see above) also
shadows jsdom's real `Storage` implementation inside Vitest's jsdom environment (its
`populateGlobal()` key-filter skips copying any window property that already exists as an own
property of `global`, and `localStorage` is exactly such a property under Node 20+) — so
`window.localStorage` in the `dom` project was Node's broken, always-`undefined` accessor, not a
working Storage. This file replaces it with a small in-memory `Storage`-shaped class
(`getItem`/`setItem`/`removeItem`/`clear`/`key`/`length`), wired via `vite.config.ts`'s `dom`
project `test.setupFiles`. Needed for `app.terminology.svelte.test.ts` to exercise real
persistence at all; irrelevant to production (real browsers ship a working `localStorage`, this
is purely a Node/jsdom/Vitest version-interaction test-environment gap).

## Modified: `vite.config.ts`

Add `setupFiles: ['./src/app/vitest-dom-setup.ts']` to the `dom` project's `test` block. No other
change; the `node` project is untouched (it never had a working `localStorage` to begin with —
`dictionary.svelte.ts`'s `window`-gated guard is what keeps that project passing without one).

No other file in `src/app/` or `src/core/` changes.

## New: `src/app/app.terminology.svelte.test.ts`

jsdom project (`*.svelte.test.ts` glob), mirrors `app.controls.svelte.test.ts`'s `mountApp`
helper (duplicated locally rather than imported — that file doesn't export it, and the two
helpers are three lines each; not worth a shared test-utils module for this).

```ts
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.svelte'

const SEED = 1
let cleanups: Array<() => void> = []

function mountApp(initialSeed: number) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(App, { target, props: { initialSeed } })
  cleanups.push(() => { unmount(app); target.remove() })
  flushSync()
  return target
}

afterEach(async () => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  localStorage.clear()
  // Reset the dictionary module's singleton state so no test's toggle click
  // leaks into a sibling test (design.md Decision 6).
  const { setTerminology } = await import('./dictionary.svelte')
  setTerminology('romaji')
})

describe('the terminology toggle', () => {
  it('relabels visible wind names live, on one click', () => { ... })
  it('does not disturb the running hand (tile count, hand identity unchanged)', () => { ... })
  it('toggles back on a second click', () => { ... })
})

describe('terminology persistence', () => {
  it('writes the single localStorage key on toggle', () => { ... })
  it('a fresh module load reads the persisted value back (simulated reload)', async () => {
    // vi.resetModules() + dynamic re-import of both dictionary.svelte and App,
    // per design.md Decision 5.2.
  })
  it('an absent key boots to the default (romaji)', () => { ... })
  it('a malformed stored value falls back to the default, no throw', () => { ... })
})
```

## Modified: `src/app/app.ssr.test.ts`

One new `describe` block appended (Node project — proves the SSR/no-`localStorage` path
explicitly rather than relying on it being implicitly untested):

```ts
describe('terminology (SSR, no localStorage)', () => {
  it('renders the default romaji terminology and never touches console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { body } = render(App, { props: { initialSeed: BOOT_SEED } })
    expect(body).toContain('East') // default terminology, unchanged from every other SSR test
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    warn.mockRestore()
    error.mockRestore()
  })
})
```

Placed near the top-level `describe('dealt-table view (SSR)', ...)` block, after it, since both
share `BOOT_SEED`.

## Ordering

1. `dictionary.svelte.ts` first — self-contained, no dependents change behavior (existing
   consumers keep working identically since `loadStored()` returns `'romaji'` whenever
   `localStorage` is empty/absent, matching today's hardcoded default byte-for-byte).
2. `App.svelte` — the toggle control, depends on step 1's `setTerminology`/`activeTerminology`
   already being callable (they already are; step 1 only changes their *internals*, not their
   signatures).
3. `app.terminology.svelte.test.ts` — new file, depends on step 2 existing (queries the toggle
   button).
4. `app.ssr.test.ts` addition — independent of steps 2-3, could run anytime after step 1; ordered
   last only because it is the smallest, lowest-risk change.

Each step leaves the full existing suite green before the next starts (plan.md verifies this
explicitly per step).
