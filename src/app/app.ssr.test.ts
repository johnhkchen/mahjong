// SSR smoke test: the view renders through the real Svelte compiler, and everything
// on the table is derived from core's seeded record fold — not typed into the markup.
// Asserts content (tile kinds, counts, labels) and aria landmarks only, never classes
// or structure, so Table's and Tile's internals stay free to change.

import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { foldRecord, kindOf } from '../core'
import App from './App.svelte'

// The walking-skeleton boot seed in App.svelte. If the app's seed changes, this is the
// one place the test learns about it.
const BOOT_SEED = 1

/**
 * Every tile-looking text token in the SSR output. Nothing else on the table can
 * match: wind names are words, counts have no single-digit [mpsz] suffix.
 */
function tileTokensOf(body: string): string[] {
  return [...body.matchAll(/>([1-9][mpsz])</g)].map((m) => m[1])
}

describe('dealt-table view (SSR)', () => {
  const { body } = render(App)
  const table = foldRecord({ seed: BOOT_SEED, actions: [] })

  it('renders exactly the 13 dealt tiles and the dora indicator, derived via the core fold', () => {
    const expected = [...table.hands[0].map(kindOf), kindOf(table.doraIndicator)]
    // Multiset equality: containment of the dealt hand + indicator, and nothing more
    // renders as a tile.
    expect([...tileTokensOf(body)].sort()).toEqual([...expected].sort())
  })

  it('names the hand and dora-indicator regions for assistive tech', () => {
    expect(body).toContain('aria-label="your hand"')
    expect(body).toContain('aria-label="dora indicator"')
  })

  it('replaces the wall-count placeholder with the live-wall remaining count', () => {
    expect(body).toContain(`${table.live.length} tiles left`)
    expect(body).not.toContain('tiles in the wall')
  })

  it('renders all four wind seats exactly once', () => {
    for (const wind of ['East', 'South', 'West', 'North']) {
      expect(body.split(wind).length - 1).toBe(1)
    }
  })

  it('exposes the table landmark', () => {
    expect(body).toContain('aria-label="mahjong table"')
  })
})
