// End-to-end coverage of the riichi declare/decline prompt (T-009-03-01), driven
// through a REAL mounted App — the one place App's $effect-driven bot loop and the
// console's riichi branch can be exercised together (SSR never runs $effect; the
// pure selectors have their own exact coverage in drive.test.ts). Mirrors
// app.controls.svelte.test.ts's fake-timer/flushSync mounting style.

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.svelte'

// The drive.test.ts/app.ssr.test.ts riichi anchor is the per-HAND seed 397 (East's
// own opening draw leaves exactly one tenpai-preserving discard, tile 130/6z/hatsu),
// but App mounts on a GAME seed and derives hand 0's seed via game.ts's handSeedOf
// (gameSeed XOR (1 * the golden-ratio constant) for handIndex 0) — never the raw
// gameSeed. This is the inverse: the one gameSeed whose hand 0 lands on seed 397,
// computed once and frozen (never regenerate: `397 ^ 0x9e3779b1 >>> 0`).
const RIICHI_GAME_SEED = 2654435388
const BOT_DELAY_MS = 250 // App.svelte's own pacing constant, duplicated for the timer advance
const MOUNT_GUARD_MS = 200 // RiichiPrompt.svelte's own mount-guard.ts constant, duplicated for the timer advance

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
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

function eastPondKinds(target: HTMLElement): string[] {
  const start = target.innerHTML.indexOf('aria-label="east pond"')
  const region = target.innerHTML.slice(start, target.innerHTML.indexOf('</ul>', start))
  return [...region.matchAll(/class="kind[^"]*">([^<]+)</g)].map((m) => m[1])
}

function handButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>('[aria-label="your hand"] button'))
}

function drawnButton(target: HTMLElement): HTMLButtonElement | null {
  return target.querySelector<HTMLButtonElement>('[aria-label="drawn tile"] button')
}

/** Ticks the bot pacing timer forward until `done` is true, or throws past maxTicks. */
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

describe('the riichi prompt, end to end', () => {
  it('declaring folds the riichi action and locks the seat — only the drawn tile discards on the next turn', async () => {
    const target = mountApp(RIICHI_GAME_SEED)
    await tickUntil(target, () => target.querySelector('[aria-label="declare riichi"]') !== null)

    // T-012-01-01: a tap landing inside the prompt's mount-guard beat is inert — the
    // button is rendered but the activation does nothing, no pond/hand change at all.
    target.querySelector<HTMLButtonElement>('[aria-label="declare riichi"]')!.click()
    flushSync()
    expect(eastPondKinds(target)).not.toContain('6z')
    expect(target.querySelector('[aria-label="riichi prompt"]')).not.toBeNull()

    // The same activation, after the beat, lands normally.
    await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
    flushSync()
    target.querySelector<HTMLButtonElement>('[aria-label="declare riichi"]')!.click()
    flushSync()

    // The declared tile (130, kind 6z) lands in East's pond immediately.
    expect(eastPondKinds(target)).toContain('6z')
    expect(target.querySelector('[aria-label="riichi prompt"]')).toBeNull()

    // Drive the three bot turns forward to East's next draw — no player input is
    // needed for any of it (bot-only windows settle themselves).
    await tickUntil(target, () => drawnButton(target) !== null)

    const pondBefore = eastPondKinds(target).length
    // A locked seat's non-drawn hand tiles are no longer offered: tapping one is a
    // no-op through the seam (tapDiscard finds nothing to fold).
    handButtons(target)[0]!.click()
    flushSync()
    expect(eastPondKinds(target)).toHaveLength(pondBefore)

    // Only the drawn tile's own button still folds — the forced tsumogiri.
    drawnButton(target)!.click()
    flushSync()
    expect(eastPondKinds(target)).toHaveLength(pondBefore + 1)
  }, 20_000)

  it('declining folds the plain discard and leaves the seat free to choose on its next turn', async () => {
    const target = mountApp(RIICHI_GAME_SEED)
    await tickUntil(target, () => target.querySelector('[aria-label="not yet"]') !== null)

    await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
    flushSync()
    target.querySelector<HTMLButtonElement>('[aria-label="not yet"]')!.click()
    flushSync()

    // The same tile (130, kind 6z) lands in East's pond — a plain discard, not a
    // riichi declaration.
    expect(eastPondKinds(target)).toContain('6z')
    expect(target.querySelector('[aria-label="riichi prompt"]')).toBeNull()

    await tickUntil(target, () => drawnButton(target) !== null)

    const pondBefore = eastPondKinds(target).length
    // Unlocked: an arbitrary hand tile (not the drawn one) folds a real discard.
    handButtons(target)[0]!.click()
    flushSync()
    expect(eastPondKinds(target)).toHaveLength(pondBefore + 1)
  }, 20_000)
})
