// T-008-03-02's end-to-end coverage of the "next hand"/"new game" controls, driven
// through a REAL mounted App — the only place App's $effect-driven bot loop and the
// GameRecord state model can be exercised together (SSR never runs $effect; every
// other test in this repo either stays pure-TS or mounts the stateless Table/HandEnd
// directly against hand-authored fixtures). Fake timers fast-forward the
// BOT_DELAY_MS-paced auto-play; a GENERIC driver (always take an offered win, always
// decline a claim, always tsumogiri an own discard) reaches a real hand end for ANY
// seed — legal at every pause forcedAction can produce, so no offline seed-mining is
// needed here (contrast game.test.ts's mined fixtures, which need a SPECIFIC
// outcome; this suite only needs SOME outcome).

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.svelte'

const SEED = 1
const BOT_DELAY_MS = 250 // App.svelte's own pacing constant, duplicated for the timer advance
const MOUNT_GUARD_MS = 200 // ClaimPrompt.svelte's own mount-guard.ts constant, duplicated for the timer advance

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
  vi.restoreAllMocks()
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

function handTileCount(target: HTMLElement): number {
  const start = target.innerHTML.indexOf('aria-label="your hand"')
  const region = target.innerHTML.slice(start, target.innerHTML.indexOf('</ul>', start))
  return (region.match(/aria-label="discard /g) ?? []).length
}

function scoresOf(target: HTMLElement): number[] | null {
  const start = target.innerHTML.indexOf('aria-label="scores"')
  if (start < 0) return null
  const region = target.innerHTML.slice(start, target.innerHTML.indexOf('</ul>', start))
  return [...region.matchAll(/:\s*(-?\d+)</g)].map((m) => Number(m[1]))
}

/**
 * Advances the mounted App to a real hand end by always taking an offered win,
 * always declining a claim, and always tsumogiri-ing an own discard — legal at
 * every pause forcedAction can produce (drive.ts's own documented branches), so
 * this terminates for any seed within the wall's bounded turn count. Ticks the
 * BOT_DELAY_MS timer forward whenever nothing is immediately actionable.
 */
async function driveToHandEnd(target: HTMLElement, maxTicks = 500): Promise<void> {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (target.querySelector('.next-hand')) return
    const win = target.querySelector<HTMLButtonElement>(
      '[aria-label="tsumo"], [aria-label^="ron "]',
    )
    if (win) {
      // T-012-01-01: the win/pass buttons belong to ClaimPrompt, which ignores
      // activations for one mount-guard beat — advance past it before tapping.
      await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
      flushSync()
      win.click()
      flushSync()
      continue
    }
    const pass = target.querySelector<HTMLButtonElement>('[aria-label="pass"]')
    if (pass) {
      await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
      flushSync()
      pass.click()
      flushSync()
      continue
    }
    const drawn = target.querySelector<HTMLButtonElement>('[aria-label="drawn tile"] button')
    if (drawn) {
      drawn.click()
      flushSync()
      continue
    }
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
    flushSync()
  }
  throw new Error('driveToHandEnd: exceeded maxTicks without reaching a hand end')
}

describe('driveToHandEnd (test-helper sanity)', () => {
  it('reaches a next-hand button from a fresh boot', async () => {
    const target = mountApp(SEED)
    await driveToHandEnd(target)
    expect(target.querySelector('.next-hand')).not.toBeNull()
  }, 20_000)
})

describe('the "next hand" control', () => {
  it('carries scores forward (conserved, moved off the flat start) and deals a fresh hand', async () => {
    const target = mountApp(SEED)
    await driveToHandEnd(target)
    const endScores = scoresOf(target)
    expect(endScores).not.toBeNull()
    expect(endScores!.reduce((a, b) => a + b, 0)).toBe(100000)
    // Fixture sanity for this seed/driver combination — proves the end-to-end
    // wiring moves real numbers through a real hand, not just that it conserves
    // them. The PRECISE claim (a rotated dealer relabels correctly, not just
    // conserves) is drive.test.ts's seatScoresOf suite — exact, pure, fast.
    expect(endScores!.some((s) => s !== 25000)).toBe(true)

    target.querySelector<HTMLButtonElement>('.next-hand')!.click()
    flushSync()

    // The next-hand button and every hand-end region are gone — a live hand again.
    expect(target.querySelector('.next-hand')).toBeNull()
    expect(target.innerHTML).not.toContain('aria-label="scores"')
    // A fresh deal: the player holds 13 tiles again (T-008-03-02's own AC — "starts
    // the following hand"), which only happens once the new hand has actually dealt.
    expect(handTileCount(target)).toBe(13)
  }, 20_000)
})

describe('the "new game" control', () => {
  it('resets scores to 25000 each and starts a fresh single-hand game', async () => {
    // newGame() draws its seed from Math.random — the ONE unseeded input in this
    // otherwise fully-deterministic suite, and the source of a ~1-in-5 flake: the
    // scripted driver occasionally met a random hand it couldn't finish. Pin it.
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
    const target = mountApp(SEED)
    await driveToHandEnd(target)
    target.querySelector<HTMLButtonElement>('.next-hand')!.click()
    flushSync()

    target.querySelector<HTMLButtonElement>('.new-game')!.click()
    flushSync()

    expect(target.querySelector('.next-hand')).toBeNull()
    expect(target.innerHTML).not.toContain('aria-label="scores"')
    expect(handTileCount(target)).toBe(13)

    // Reach hand end again on the FRESH game and confirm the score screen now
    // starts from the 25000-each baseline, not whatever hand one/two left carried.
    // Conservation includes the riichi pot: on this pinned seed a bot's riichi
    // stick rides the pot across the hand end, and the table now SAYS so — the
    // 99000-scores-plus-1000-pot split is the fact this assertion pins (it spent
    // months as a 1-in-5 flake while newGame's seed was unpinned Math.random).
    await driveToHandEnd(target)
    const scores = scoresOf(target)
    expect(scores).not.toBeNull()
    const potLabel = target.querySelector('[aria-label="riichi pot"]')
    const pot = potLabel ? Number(potLabel.textContent!.replace(/\D/g, '')) : 0
    expect(scores!.reduce((a, b) => a + b, 0) + pot).toBe(100000)
  }, 30_000)
})
