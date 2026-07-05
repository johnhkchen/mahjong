// End-to-end coverage of the report-bug dialog (T-013-02-01, E-013), driven through a
// REAL mounted App — the one place App's own reportOpen state, drive.ts's
// buildReportText/buildIssueUrl, and ReportBug.svelte's rendering all meet. Mirrors
// app.controls.svelte.test.ts's fake-timer/flushSync mounting style. jsdom implements
// no <dialog> showModal()/close() at all (ReportBug.svelte's own comment), so this
// file exercises the manual open-attribute fallback and App.svelte's explicit
// `reportOpen` input guards (design.md Decision 8) — the guards are the actual thing
// under test for "input underneath is paused or inert," not any dialog-native
// behavior this environment can't model.

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serializeGameRecord } from '../core'
import { setTerminology } from './dictionary.svelte'
import App from './App.svelte'

const SEED = 1
const BOT_DELAY_MS = 250 // App.svelte's own pacing constant, duplicated for the timer advance

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
  setTerminology('romaji')
})

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

function mountApp(initialSeed: number) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(App, { target, props: { initialSeed } })
  cleanups.push(() => {
    unmount(app)
    target.remove()
  })
  flushSync()
  return target
}

/** Ticks the bot pacing timer forward until `done` is true, or throws past maxTicks —
 *  same shape as app.riichi.tap.svelte.test.ts's own helper, duplicated per this
 *  codebase's established per-file convention. */
async function tickUntil(
  target: HTMLElement,
  done: () => boolean,
  maxTicks = 20,
): Promise<void> {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (done()) return
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
    flushSync()
  }
  throw new Error('tickUntil: exceeded maxTicks')
}

/** The header toggle by CLASS, not aria-label — its label is dictionary-routed
 *  (term('reportBug')), so it reads differently under each terminology; a stable
 *  selector keeps every test able to open the dialog regardless of which terminology
 *  is active. */
function openDialog(target: HTMLElement) {
  target.querySelector<HTMLButtonElement>('.report-bug-toggle')!.click()
  flushSync()
}

function closeDialog(target: HTMLElement) {
  target.querySelector<HTMLButtonElement>('[aria-label="close"]')!.click()
  flushSync()
}

function reportPreview(target: HTMLElement): string {
  return target.querySelector('[aria-label="report preview"]')!.textContent ?? ''
}

function typeMessage(target: HTMLElement, text: string) {
  const textarea = target.querySelector<HTMLTextAreaElement>('[aria-label="message"]')!
  textarea.value = text
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  flushSync()
}

function handButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>('[aria-label="your hand"] button'))
}

/** East's discard pile size — a tedashi discard folds a concealed tile OUT and the
 *  drawn tile INTO the hand (hand size stays 13 either way), so the pond, not the
 *  hand tile count, is the observable proof a discard actually registered — same
 *  technique app.riichi.tap.svelte.test.ts's own `eastPondKinds` uses. */
function eastPondCount(target: HTMLElement): number {
  const start = target.innerHTML.indexOf('aria-label="east pond"')
  const region = target.innerHTML.slice(start, target.innerHTML.indexOf('</ul>', start))
  return (region.match(/class="kind[^"]*">/g) ?? []).length
}

describe('the report-bug dialog, end to end', () => {
  it('shows the exact serialized notation of the live record plus context', () => {
    const target = mountApp(SEED)
    openDialog(target)

    // Fresh boot, no bot ticks advanced: the record is still `{ seed: SEED, hands: [[]] }`.
    const expectedNotation = serializeGameRecord({ seed: SEED, hands: [[]] })
    const preview = reportPreview(target)
    expect(preview).toContain(expectedNotation)
    expect(preview).toContain('terminology: romaji')
    expect(preview).toContain('hand: 0')
    expect(preview).toContain('actions: 0')
  })

  it('reflects the typed message live in the report preview', () => {
    const target = mountApp(SEED)
    openDialog(target)
    typeMessage(target, 'the chi button disappeared')
    expect(reportPreview(target)).toContain('the chi button disappeared')
  })

  it('copy report puts the full report (message + notation + context) on the clipboard', async () => {
    const target = mountApp(SEED)
    openDialog(target)
    typeMessage(target, 'reproduced twice now')
    target.querySelector<HTMLButtonElement>('[aria-label="copy report"]')!.click()
    flushSync()
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(written).toContain('reproduced twice now')
    expect(written).toContain(serializeGameRecord({ seed: SEED, hands: [[]] }))
  })

  it('the issue link is a correctly encoded github.com new-issue URL for a short report', () => {
    const target = mountApp(SEED)
    openDialog(target)
    const link = target.querySelector<HTMLAnchorElement>('[aria-label="open issue"]')!
    expect(link.getAttribute('href')).toMatch(
      /^https:\/\/github\.com\/johnhkchen\/mahjong\/issues\/new\?title=Bug%20report&body=/,
    )
    expect(target.querySelector('.clipboard-first-note')).toBeNull()
  })

  it('falls back to a clipboard-first issue body once the report crosses the length threshold', () => {
    const target = mountApp(SEED)
    openDialog(target)
    typeMessage(target, 'x'.repeat(7000))
    const link = target.querySelector<HTMLAnchorElement>('[aria-label="open issue"]')!
    const href = link.getAttribute('href')!
    expect(href).not.toContain('x'.repeat(100))
    expect(href).toContain(encodeURIComponent('paste the copied report'))
    expect(target.querySelector('.clipboard-first-note')).not.toBeNull()
  })

  it('pauses table input while open, and restores it once closed', async () => {
    const target = mountApp(SEED)
    // A discard is only legally offered once the dealer's own opening draw has
    // landed (App.svelte's forced-action effect) — wait for it, same as the other
    // tap suites' own `tickUntil(..., () => drawnButton(target) !== null)` pattern.
    await tickUntil(target, () => target.querySelector('[aria-label="drawn tile"]') !== null)
    const before = eastPondCount(target)

    openDialog(target)
    handButtons(target)[0]!.click()
    flushSync()
    expect(eastPondCount(target)).toBe(before)

    closeDialog(target)
    handButtons(target)[0]!.click()
    flushSync()
    expect(eastPondCount(target)).toBe(before + 1)
  }, 20_000)

  it('labels the dialog chrome under zh-hant terminology', () => {
    setTerminology('zh-hant')
    const target = mountApp(SEED)
    openDialog(target)
    expect(target.querySelector('[aria-label="回報問題"]')).not.toBeNull()
    expect(target.querySelector('[aria-label="複製回報"]')).not.toBeNull()
    expect(target.querySelector('[aria-label="開啟議題"]')).not.toBeNull()
    expect(target.querySelector('[aria-label="訊息"]')).not.toBeNull()
  })
})
