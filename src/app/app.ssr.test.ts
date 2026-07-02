// SSR smoke test: the view renders through the real Svelte compiler, and the displayed
// wall count is derived from core's seeded wall build — not typed into the markup.
// Asserts content (count, labels) and the aria landmark only, never classes or structure,
// so Table's internals stay free to change.

import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { buildWall } from '../core'
import App from './App.svelte'

// The walking-skeleton boot seed in App.svelte. If the app's seed changes, this is the
// one place the test learns about it.
const BOOT_SEED = 1

describe('empty table view (SSR)', () => {
  const { body } = render(App)

  it('displays the wall count derived from the seeded core wall build', () => {
    const expected = buildWall(BOOT_SEED).length
    expect(body).toContain(`>${expected}<`)
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
