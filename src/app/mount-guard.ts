// T-012-01-01: the one duration a freshly-mounted prompt's input guard and its CSS
// entry beat must agree on (ClaimPrompt.svelte's own @starting-style/transition pair
// is authored against this exact number — see that file's <style> block). Shared as a
// plain import rather than duplicated per component (design.md Decision 2): unlike
// App.svelte's BOT_DELAY_MS, which test files re-declare because they can't import a
// component's internal constant, this is a production-to-production boundary between
// two sibling .svelte files, where an ordinary shared module is the ordinary answer.
export const MOUNT_GUARD_MS = 200

// The misland the guard defends against exists ONLY when this prompt mounted hot on
// the heels of another one closing — a tap (or double-tap ghost) aimed at the old
// prompt landing on the new one's buttons. A prompt mounting cold (no prompt closed
// recently) has no misland to defend against, and guarding it EATS fast first taps:
// the owner's 2026-07-05 hand-log report ("double-prompt") was a primed pon tapped
// within the beat, silently swallowed, re-tapped — the prompt seemed to ask twice.
// So the guard arms only when a prompt closed within this window; prompts mark their
// own close from their unmount cleanup.
// Two BOT_DELAY_MS ticks plus margin: a window reopening within 1-2 ticks (250-500ms)
// is inside double-tap-ghost range; the 3-tick reopening (750ms, the E-011 race
// fixture) mounts cold — a tap that late is deliberate.
export const REOPEN_GUARD_WINDOW_MS = 600

let lastPromptClosedAt = Number.NEGATIVE_INFINITY

/** Prompts call this from their unmount cleanup — the next mount consults it. */
export function markPromptClosed(): void {
  lastPromptClosedAt = Date.now()
}

/** True when a prompt closed recently enough that a misland is possible. */
export function shouldGuardMount(): boolean {
  return Date.now() - lastPromptClosedAt < REOPEN_GUARD_WINDOW_MS
}

/** Test seam: return the module to its boot state between cases. */
export function resetMountGuard(): void {
  lastPromptClosedAt = Number.NEGATIVE_INFINITY
}

// Mirrors the CSS side's `@media (prefers-reduced-motion: no-preference)` gate: under
// `reduce`, the CSS beat is already zero-length, so the JS guard collapses to 0 too
// rather than leaving buttons inert for a beat nothing on screen is showing.
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
