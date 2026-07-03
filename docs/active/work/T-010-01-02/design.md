# Design — T-010-01-02 toggle-and-persistence

## Decision 1 — Persistence logic lives in `dictionary.svelte.ts`, not `App.svelte`

The `localStorage` read (boot) and write (on every `setTerminology` call) both live inside
`dictionary.svelte.ts`, next to the `current` state they serve, not in `App.svelte`'s script or
a component `$effect`.

- `setTerminology()` becomes the single mutation path. It already is — no consumer bypasses it —
  so folding the write into it means **every** future caller (this ticket's toggle, and any later
  UI) persists for free, with no risk of a caller mutating `current` without saving.
- The initial read seeds the module's `let current = $state<Terminology>(...)` initializer
  directly, replacing the hardcoded `'romaji'` literal with a guarded `loadStored()` call. Module
  top-level code runs exactly once per module lifetime (browser: at first import/app boot; Vitest
  `dom` project: once per test file's fresh module graph) — the natural, and only, "read at boot"
  hook available; there is no separate boot/init function in this app to hang it on (`main.ts` is
  a three-line `mount()` call, architecture.md's own "thin view" framing argues against adding
  app-lifecycle ceremony there for one read).
- Keeps `dictionary.svelte.ts`'s existing shape as "the one thing that owns terminology state" —
  `App.svelte` stays a caller (`activeTerminology()`/`setTerminology()`), exactly as it already is
  for every other consumer, rather than becoming a second file that knows about the storage key.

**Rejected: an `$effect` in `App.svelte`** (the shape the T-010-01-01 comment speculatively named,
"a localStorage read/write effect"). An effect reacting to `activeTerminology()` changes and
writing to `localStorage` would work, but effects only run after mount (never in SSR, confirmed
by App's own existing `$effect` comment) — so the *initial* read still needs a separate,
non-effect path anyway (module init or a plain top-level read), and now persistence logic is
split across two files and two mechanisms (module init read + component effect write) for no
behavioral gain. A guarded synchronous read/write in one file is simpler and has no timing
window where a rapid toggle-then-navigate could race an effect's scheduling — not a real risk
here (SPA, no navigation), but the synchronous version has strictly fewer moving parts.

**Rejected: reading `localStorage` unconditionally.** Breaks `app.ssr.test.ts` (Node project, no
`localStorage` global) per research.md. Every access is guarded with `typeof localStorage !==
'undefined'` — silent by construction, satisfying the AC's "without warnings" (no try/catch
needed; a `typeof` check never throws).

## Decision 2 — One key, exact shape

```ts
const STORAGE_KEY = 'mahjong-terminology'

function isTerminology(value: string | null): value is Terminology {
  return value === 'romaji' || value === 'zh-hant'
}

function loadStored(): Terminology {
  if (typeof localStorage === 'undefined') return 'romaji'
  return isTerminology(localStorage.getItem(STORAGE_KEY)) ? (localStorage.getItem(STORAGE_KEY) as Terminology) : 'romaji'
}
```

(Structure.md pins the exact non-duplicated read.) Malformed/foreign values (a wiped or
hand-edited key, a future third terminology written by a newer build then loaded by this one)
fall back to `'romaji'` rather than throwing or rendering `undefined` — `isTerminology` is a type
guard, not a cast. This satisfies "exactly one `localStorage` key" (AC) and needs no version/
migration scheme since the value set is closed (`Terminology`) and small.

**Rejected: storing a boolean** (`isZhHant: true/false`). `Terminology` is already the domain
type everywhere else (`term()`, `setTerminology()`, `activeTerminology()`); storing its own string
values keeps the persisted format self-describing and trivially extensible if a third
terminology is ever added (no boolean-to-enum migration), at the cost of nothing measurable for
two values.

## Decision 3 — Toggle button: a second header control, own class, shared visual register via CSS

`App.svelte`'s `<header>` gets a second `<button>` beside `.new-game`, styled through a shared
selector rather than a shared class name:

```css
.new-game,
.terminology-toggle {
  /* existing .new-game declarations, unchanged */
}
.new-game:active,
.terminology-toggle:active {
  background: #1c3a2c;
}
```

**Rejected: literally applying `class="new-game"` to the toggle button too.** `new-game` is a
functional class name (`.new-game` means "start a new game" everywhere else it's read — the class
selector, not just the text, is what `app.controls.svelte.test.ts` clicks via
`target.querySelector<HTMLButtonElement>('.new-game')!`). Reusing the name for a different action
is a latent trap: a future test or reader would reasonably assume `.new-game` means "the new-game
button," singular. A comma-selector gets the identical rendered CSS ("same visual register," the
AC's own phrase) without overloading what the class name means.

## Decision 4 — Button content: names the terminology you'd switch TO, not the one you're in

```ts
const TERMINOLOGY_LABEL: Record<Terminology, string> = { romaji: 'romaji', 'zh-hant': '中文' }
function otherTerminology(t: Terminology): Terminology {
  return t === 'romaji' ? 'zh-hant' : 'romaji'
}
```

Button text and `aria-label` both read `TERMINOLOGY_LABEL[otherTerminology(activeTerminology())]`
(text) and `` `switch to ${TERMINOLOGY_LABEL[otherTerminology(activeTerminology())]}` `` (aria).
Tapping "中文" while in `romaji` switches to `zh-hant`; the button then relabels itself "romaji"
— it always names the destination, never the current state. This is the CLAUDE.md brand-voice
rule applied at UI-control scale ("labels orient by what you'd DO with it," "verb-forward where
it earns it"): the visible glyph plus the `aria-label`'s "switch to" verb together say exactly
what tapping does, not just what mode you're in. `TERMINOLOGY_LABEL` is a new, small, local map
in `App.svelte` — deliberately NOT added to `dictionary.svelte.ts`'s `TERMS` table, because a
terminology's own display name is not itself a translatable game term (it doesn't change meaning
under the *other* terminology — "中文" names Chinese in both terminologies, same as "romaji"
names romanized Japanese in both).

**Rejected: showing the current terminology name (status-indicator style), toggling on tap.**
Reads as a mode indicator, not a control — matches neither `.new-game`'s existing verb-forward
label nor the brand-voice guidance. Also indistinguishable at a glance from a disabled/inert
label since nothing about "romaji" (while active) visually implies "tap to change this."

**Rejected: an icon-only toggle (a globe/translate glyph).** No icon system exists in this
codebase (`Tile.svelte`'s inline SVGs are game art, not a UI icon set); introducing one for a
single control is disproportionate, and CLAUDE.md's plain-language stance favors a real word
over an icon a first-time visitor has to decode.

## Decision 5 — Test scope: this ticket's own behavior, not T-010-01-03's coverage

T-010-01-03 (`dual-terminology-coverage`, depends on this ticket) already owns "a parameterized
suite renders the key surfaces under each terminology" — the exhaustive term-by-term SSR sweep.
This ticket's tests stay narrow, proving exactly its own AC:

1. **Toggle relabels live, without disturbing the running hand.** A mounted `App`'s wind text
   (`Table.svelte`'s `{seat.wind}`, always rendered, unconditional on hand progress — research.md)
   flips from `East`/`South`/`West`/`North` to `東`/`南`/`西`/`北` on one click, and the player's
   dealt hand tile count / DOM identity is unaffected (no `hands`/`gameSeed` state exists in
   `dictionary.svelte.ts`, so this is really "the click doesn't touch game state" — cheap to
   assert directly by re-reading `handTileCount` before/after, reusing `app.controls.svelte.test.ts`'s
   own helper shape).
2. **Persists via exactly one `localStorage` key, read fresh on a simulated reload.** Toggling,
   then re-importing the module fresh (`vi.resetModules()` + dynamic `import()`, since
   `dictionary.svelte.ts`'s `current` is seeded once at module-load time — see Decision 1) proves
   the *stored* value drives the next boot, not just in-memory state carried within one test run.
   A literal `location.reload()` isn't meaningful in jsdom without a real navigation, so module
   reset is the faithful jsdom equivalent of "reload the page."
3. **SSR path never touches `localStorage` and never warns.** Extends the existing
   `app.ssr.test.ts` (Node project, already has no `localStorage` global) with an explicit check
   that `render(App, ...)` completes and shows default-terminology content, plus a
   `console.warn`/`console.error` spy asserting neither fired — turning the AC's "without
   warnings" into a real assertion instead of an implicit non-crash.

**Rejected: a full dual-terminology click-through-every-surface suite here.** Duplicates
T-010-01-03's explicit scope (its own ticket depends on this one finishing first specifically so
it can write that suite against a real toggle) — writing it now either gets thrown away or
creates two suites asserting the same thing from two tickets, against this project's own
dependency graph.

## Decision 6 — Module-state leakage across tests is a real hazard; every mutating test resets

Per research.md, `dictionary.svelte.ts`'s `current` is a singleton for the lifetime of one
Vitest `dom`-project test *file* (fresh module graph per file, not per test). Every test that
calls `setTerminology`/clicks the toggle must restore `'romaji'` (and clear the `localStorage`
key) in `afterEach`, so no test's mutation leaks into a sibling test in the same file, and so
running this new file alongside `app.controls.svelte.test.ts`/`app.riichi.tap.svelte.test.ts` in
the same Vitest worker never lets one file's toggle click perturb another file's romaji-default
assertions. (Whether Vitest actually shares a worker/module graph *across* files is a pool-
dependent implementation detail this design does not rely on — resetting defensively in
`afterEach` costs nothing and removes the question entirely.)
