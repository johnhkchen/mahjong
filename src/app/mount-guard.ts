// T-012-01-01: the one duration a freshly-mounted prompt's input guard and its CSS
// entry beat must agree on (ClaimPrompt.svelte's own @starting-style/transition pair
// is authored against this exact number — see that file's <style> block). Shared as a
// plain import rather than duplicated per component (design.md Decision 2): unlike
// App.svelte's BOT_DELAY_MS, which test files re-declare because they can't import a
// component's internal constant, this is a production-to-production boundary between
// two sibling .svelte files, where an ordinary shared module is the ordinary answer.
export const MOUNT_GUARD_MS = 200

// Mirrors the CSS side's `@media (prefers-reduced-motion: no-preference)` gate: under
// `reduce`, the CSS beat is already zero-length, so the JS guard collapses to 0 too
// rather than leaving buttons inert for a beat nothing on screen is showing.
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
