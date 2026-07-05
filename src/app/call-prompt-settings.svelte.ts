// The "prompt every legal call" toggle (T-012-01-02): one localStorage key, read at
// boot, module-scoped $state rune — dictionary.svelte.ts's own terminology-toggle
// shape (T-010-01-02), duplicated for this second, unrelated setting rather than
// widened into that module (design.md Decision 4: the dictionary is vocabulary
// content, this is a boolean preference). False (filtered — the new default,
// drive.ts's claimWindowInterrupts consulting callPolicy) unless the player has
// explicitly restored full prompting.

const STORAGE_KEY = 'mahjong-prompt-every-legal-call'

/** Reads the persisted toggle at module load, guarded on `window` (not
 *  `localStorage`) directly — the Node test project runs plain Node, where
 *  `globalThis.localStorage` is itself an accessor that warns the instant it's
 *  read, even via `typeof` (dictionary.svelte.ts's own documented reason). A
 *  malformed/absent stored value falls back to the default (false) rather than
 *  throwing. */
function loadStored(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

// Module-scoped rune, not prop-drilled or context-provided — dictionary.svelte.ts's
// own Decision 1 (T-010-01-01) applied a second time: every consumer reads
// `promptEveryLegalCall()` directly.
let current = $state<boolean>(loadStored())

/** The toggle's current value — read by drive.ts's callers and App.svelte's own
 *  button for its display state. */
export function promptEveryLegalCall(): boolean {
  return current
}

/** Sets the toggle and persists the choice to the one storage key. Guarded the
 *  same way loadStored() is — a no-op write under the Node test project, never
 *  throws and never warns. */
export function setPromptEveryLegalCall(next: boolean): void {
  current = next
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, String(next))
}
