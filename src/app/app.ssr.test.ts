// SSR smoke test: the view renders through the real Svelte compiler, and everything
// on the table is derived from core's seeded record fold — not typed into the markup.
// Asserts content (tile kinds, counts, labels) and aria landmarks only, never classes
// or structure, so Table's and Tile's internals stay free to change. Mid-hand and
// wall-exhausted states render Table directly with hand-authored folded records — the
// stateless view's whole contract is its one prop.

import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { foldRecord, kindOf, type HandAction, type TileId } from '../core'
import App from './App.svelte'
import Table from './Table.svelte'

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

/**
 * The tile tokens inside the element labeled `label`, in document order. Slices from
 * the aria-label to the first `closeTag` after it — sound because every labeled tile
 * region is a flat list (no nested elements of its own tag). Fails loudly on a missing
 * label so a rename can't pass as empty-equals-empty.
 */
function regionTokens(body: string, label: string, closeTag = '</ul>'): string[] {
  const start = body.indexOf(`aria-label="${label}"`)
  expect(start, `no element labeled "${label}" in the SSR output`).toBeGreaterThanOrEqual(0)
  const end = body.indexOf(closeTag, start)
  return tileTokensOf(body.slice(start, end + closeTag.length))
}

/**
 * An all-tsumogiri script of n full turns: turn k is seat k%4 drawing and immediately
 * discarding. Draws consume the post-deal live wall head-first (the frozen wall
 * convention), so turn k's tile is live[k] — read off the empty fold, never recomputed.
 */
function tsumogiriTurns(live: readonly TileId[], n: number): HandAction[] {
  return Array.from({ length: n }, (_, k): HandAction[] => {
    const seat = (k % 4) as 0 | 1 | 2 | 3
    return [
      { type: 'draw', seat },
      { type: 'discard', seat, tile: live[k] },
    ]
  }).flat()
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

// Hand-authored mid-hand record: 8 complete turns (each seat discards twice) with
// East's first discard swapped to tedashi of a dealt tile — so East's pond order is a
// fact only the log explains, not any sort — then a pending 9th draw by East. One
// record exercises ponds, turn marker, drawn tile, and wall countdown at once.
const dealt = foldRecord({ seed: BOOT_SEED, actions: [] })
const midHandActions = tsumogiriTurns(dealt.live, 8)
midHandActions[1] = { type: 'discard', seat: 0, tile: dealt.hands[0][0] }
midHandActions.push({ type: 'draw', seat: 0 })
const midHand = foldRecord({ seed: BOOT_SEED, actions: midHandActions })

const PONDS = ['east pond', 'south pond', 'west pond', 'north pond'] as const

describe('mid-hand table view (SSR)', () => {
  const { body } = render(Table, { props: { table: midHand } })

  it('renders all four ponds with their tiles in discard order', () => {
    for (const [seat, label] of PONDS.entries()) {
      // Ordered deep-equal, not multiset: the pond's order IS its meaning.
      expect(regionTokens(body, label), label).toEqual(midHand.ponds[seat].map(kindOf))
    }
  })

  it('marks exactly the active seat', () => {
    expect(midHand.turn).toBe(0) // fixture sanity: it is East's turn
    expect(body.split('aria-current="true"').length - 1).toBe(1)
    // East is the first seat in document order — the one marked seat precedes South's.
    expect(body.indexOf('aria-current="true"')).toBeLessThan(body.indexOf('South'))
  })

  it('shows the freshly drawn tile apart from the 13-tile sorted hand', () => {
    expect(midHand.drawn).not.toBeNull()
    expect(regionTokens(body, 'drawn tile', '</span>')).toEqual([kindOf(midHand.drawn!)])
    expect(regionTokens(body, 'your hand')).toHaveLength(13)
  })

  it('counts down the live wall', () => {
    expect(midHand.live.length).toBe(61) // fixture sanity: 70 − 9 draws
    expect(body).toContain(`${midHand.live.length} tiles left`)
  })
})

// Wall-exhausted record: all 70 post-deal live tiles drawn and discarded tsumogiri —
// the fold ends in ryuukyoku exactly as the last discard lands.
describe('wall-exhausted table view (SSR)', () => {
  const exhausted = foldRecord({ seed: BOOT_SEED, actions: tsumogiriTurns(dealt.live, 70) })
  const { body } = render(Table, { props: { table: exhausted } })

  it('shows the ryuukyoku end state with the wall at zero', () => {
    expect(exhausted.phase).toBe('ryuukyoku')
    expect(body).toContain('ryuukyoku')
    expect(body).toContain('0 tiles left')
  })

  it('marks no seat as active once the hand has ended', () => {
    expect(body).not.toContain('aria-current')
  })
})
