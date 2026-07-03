// T-010-01-02's own coverage: the header toggle relabels live without disturbing the
// running hand, and the choice persists through exactly one localStorage key, read at
// boot. Deliberately narrow — T-010-01-03 owns the exhaustive parameterized sweep of
// every surface under both terminologies (design.md Decision 5); this file only proves
// the toggle's own contract.

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.svelte'
import { setTerminology } from './dictionary.svelte'

const SEED = 1
const STORAGE_KEY = 'mahjong-terminology'
const WINDS_ROMAJI = ['East', 'South', 'West', 'North'] as const
const WINDS_ZH = ['東', '南', '西', '北'] as const

let cleanups: Array<() => void> = []

afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  // Reset the statically-imported dictionary module's singleton state so no test's
  // toggle click leaks into a sibling test in this file (design.md Decision 6).
  // setTerminology() itself writes STORAGE_KEY, so the reset write must happen
  // BEFORE the clear, or the clear would be immediately undone.
  setTerminology('romaji')
  localStorage.clear()
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

function clickToggle(target: HTMLElement) {
  target.querySelector<HTMLButtonElement>('.terminology-toggle')!.click()
  flushSync()
}

function handTileLabels(target: HTMLElement): string[] {
  const start = target.innerHTML.indexOf('aria-label="your hand"')
  const region = target.innerHTML.slice(start, target.innerHTML.indexOf('</ul>', start))
  return [...region.matchAll(/aria-label="discard ([^"]+)"/g)].map((m) => m[1])
}

/**
 * The seat's own wind label text, and nothing else — NOT `.seat`'s full textContent,
 * which (for the player's east seat) also contains the dealt hand's tile glyphs.
 * Those glyphs can themselves spell a wind kanji (e.g. an honor tile "2z" renders as
 * "南" — Tile.svelte's physical tile face, unrelated to seat labeling, T-010-01-01
 * review.md's own documented distinction). `{seat.wind}` is always the seat div's
 * first child text node, before the optional "you" mark and the pond/hand lists.
 */
function seatWindText(target: HTMLElement, area: 'east' | 'south' | 'west' | 'north'): string {
  const seat = target.querySelector(`.seat.${area}`)!
  return seat.childNodes[0].textContent!.trim()
}

describe('the terminology toggle', () => {
  it('relabels the wind names live, on one click', () => {
    const target = mountApp(SEED)
    const areas = ['east', 'south', 'west', 'north'] as const

    areas.forEach((area, i) => expect(seatWindText(target, area)).toBe(WINDS_ROMAJI[i]))

    clickToggle(target)

    areas.forEach((area, i) => expect(seatWindText(target, area)).toBe(WINDS_ZH[i]))
  })

  it('flips the toggle button itself to name the OTHER terminology', () => {
    const target = mountApp(SEED)
    const button = () => target.querySelector('.terminology-toggle')!
    expect(button().textContent).toContain('中文')
    expect(button().getAttribute('aria-label')).toBe('switch to 中文')

    clickToggle(target)

    expect(button().textContent).toContain('romaji')
    expect(button().getAttribute('aria-label')).toBe('switch to romaji')
  })

  it('does not disturb the running hand', () => {
    const target = mountApp(SEED)
    const before = handTileLabels(target)
    expect(before).toHaveLength(13)

    clickToggle(target)

    expect(handTileLabels(target)).toEqual(before)
  })

  it('toggles back to the default on a second click', () => {
    const target = mountApp(SEED)
    const areas = ['east', 'south', 'west', 'north'] as const

    clickToggle(target)
    clickToggle(target)

    areas.forEach((area, i) => expect(seatWindText(target, area)).toBe(WINDS_ROMAJI[i]))
  })
})

describe('terminology persistence', () => {
  it('writes exactly one localStorage key on toggle', () => {
    const target = mountApp(SEED)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    clickToggle(target)

    expect(localStorage.getItem(STORAGE_KEY)).toBe('zh-hant')
    const allKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    expect(allKeys.filter((k) => k?.startsWith('mahjong'))).toEqual([STORAGE_KEY])
  })

  /**
   * Mounts a completely fresh App — a fresh 'svelte' runtime AND a fresh
   * dictionary.svelte.ts module graph, both re-imported after vi.resetModules() —
   * the faithful jsdom equivalent of "reload the page": dictionary.svelte.ts's
   * `current` is seeded once at module-load time (design.md Decision 1), so only a
   * genuinely fresh module graph proves "read at boot," not just in-memory state
   * carried within one test run. Mixing the top-of-file static `mount`/`flushSync`
   * with a freshly re-imported App would pair two different Svelte runtime
   * instances and throw `effect_orphan` — every piece here must come from the
   * SAME post-reset import.
   */
  async function mountFreshApp(initialSeed: number) {
    const [{ default: FreshApp }, { mount: freshMount, flushSync: freshFlush, unmount: freshUnmount }] =
      await Promise.all([import('./App.svelte'), import('svelte')])
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = freshMount(FreshApp, { target, props: { initialSeed } })
    freshFlush()
    return {
      target,
      cleanup: () => {
        freshUnmount(app)
        target.remove()
      },
    }
  }

  it('a fresh module load reads the persisted value back — simulated reload', async () => {
    localStorage.setItem(STORAGE_KEY, 'zh-hant')
    vi.resetModules()
    const { target, cleanup } = await mountFreshApp(SEED)
    try {
      expect(seatWindText(target, 'east')).toBe('東')
    } finally {
      cleanup()
    }
  })

  it('boots to the default (romaji) when the key is absent', async () => {
    localStorage.clear()
    vi.resetModules()
    const { target, cleanup } = await mountFreshApp(SEED)
    try {
      expect(seatWindText(target, 'east')).toBe('East')
    } finally {
      cleanup()
    }
  })

  it('falls back to the default on a malformed stored value, without throwing', async () => {
    localStorage.setItem(STORAGE_KEY, 'pig-latin')
    vi.resetModules()
    const { target, cleanup } = await mountFreshApp(SEED)
    try {
      expect(seatWindText(target, 'east')).toBe('East')
    } finally {
      cleanup()
    }
  })
})
