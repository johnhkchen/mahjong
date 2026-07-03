// The E-007 named-risk guard (T-007-03-03): the player's hand renders display-
// sorted while the record keeps draw order, and a tap on the visually-sorted
// position must discard THAT position's exact TileId — including across the
// keyed-each reorders (tedashi merge, claim shrink) that the motion tickets'
// insertion animations mount on. This is the repo's one client-mount suite
// (vitest's `dom` project: jsdom + Svelte's browser build — the .svelte.test.ts
// name selects the project and the rune transform): SSR output holds no click
// handlers and pure TS holds no DOM, so the closure link from a rendered button
// back to its id is testable nowhere else. Document order stands in for visual
// order (the hand ul is a plain flex row — nothing repositions items), and the
// sort is deliberately REPLICATED from Table.svelte rather than exported from
// it: a comparator change in the component must fail here visibly. Everything
// deeper down the chain — tapDiscard's identity-with-offered discipline, the
// owner's no-op on illegal taps — is drive.test.ts's ground; this suite only
// walks the last assertion down onto the rendered surface.

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import {
  foldRecord,
  kindIndexOf,
  kindOf,
  legalActions,
  type HandAction,
  type TableState,
  type TileId,
} from '../core'
import { PLAYER, tapClaim, tapDiscard } from './drive'
import Table from './Table.svelte'

// The frozen anchor seed shared with the other suites (wall golden vector, App boot).
const SEED = 1

/** The display sort Table.svelte owns, replicated as this suite's expectation. */
function sortedDisplay(hand: readonly TileId[]): TileId[] {
  return [...hand].sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b)))
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

// Every mount is torn down after its test — delegated listeners and DOM must not
// leak across cases.
let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
})

/**
 * Mount the stateless Table over a $state props proxy — mutating `props.table`
 * after mount is the app's own update path (one prop in, refolded state assigned).
 * `taps` records every ontap payload in click order; the button queries scope to
 * the labeled regions so the drawn button never pollutes the hand list.
 */
function mountTable(initial: TableState) {
  const taps: TileId[] = []
  const target = document.createElement('div')
  document.body.appendChild(target)
  const props = $state({ table: initial, ontap: (tile: TileId) => taps.push(tile) })
  const app = mount(Table, { target, props })
  cleanups.push(() => {
    unmount(app)
    target.remove()
  })
  flushSync()
  const handButtons = () =>
    Array.from(
      target.querySelectorAll<HTMLButtonElement>('[aria-label="your hand"] button'),
    )
  const drawnButton = () =>
    target.querySelector<HTMLButtonElement>('[aria-label="drawn tile"] button')
  return { taps, props, target, handButtons, drawnButton }
}

// ——— State A: East mid-turn on the boot seed — the drive.test.ts anchor. The dealt
// draw order differs from sorted order and the hand holds duplicate kinds (3m, 3p,
// 4p pairs), so exact-id assertions distinguish physical copies that kind labels
// cannot. Frozen (probed): the stable sort keeps hand order within a kind, so the
// 4p copies land as 50 BEFORE 49 — the mapping is by kind index, never by id.
const afterEastDraw = foldRecord({ seed: SEED, actions: [{ type: 'draw', seat: 0 }] })
const SORTED_A: readonly TileId[] = [8, 11, 36, 45, 46, 50, 49, 53, 64, 82, 86, 95, 118]

describe('display sort renders the hand sorted, record untouched', () => {
  it('fixture sanity: draw order differs from sorted order, duplicate kinds present', () => {
    const raw = afterEastDraw.hands[PLAYER]
    expect(sortedDisplay(raw)).toEqual(SORTED_A)
    expect([...raw]).not.toEqual(SORTED_A)
    expect(new Set(raw.map(kindOf)).size).toBeLessThan(raw.length)
    // The inverted 4p pair — the position where ids and kinds tell different stories.
    expect(kindOf(50)).toBe(kindOf(49))
    expect(SORTED_A.indexOf(50)).toBeLessThan(SORTED_A.indexOf(49))
  })

  it('renders 13 buttons whose document order is the sorted order, by kind label', () => {
    const { handButtons } = mountTable(afterEastDraw)
    const buttons = handButtons()
    expect(buttons).toHaveLength(13)
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(
      SORTED_A.map((id) => `discard ${kindOf(id)}`),
    )
  })
})

describe('tap → exact TileId at every sorted position', () => {
  it('clicking position k reports exactly sorted[k], all 13 positions', () => {
    const { taps, handButtons } = mountTable(afterEastDraw)
    for (const button of handButtons()) button.click()
    // toEqual over the whole id sequence: the duplicate-kind positions (including
    // the 50-before-49 inversion) only pass if each closure holds its OWN id.
    expect(taps).toEqual(SORTED_A)
  })

  it('every reported id builds the offered discard of that exact tile — the seam holds', () => {
    const offered = legalActions(afterEastDraw)
    const { taps, handButtons } = mountTable(afterEastDraw)
    for (const button of handButtons()) button.click()
    for (const [k, id] of taps.entries()) {
      const action = tapDiscard(offered, PLAYER, id)
      // toBe, not toEqual: what the tap builds IS legalActions output.
      expect(action).toBe(
        offered.find((a) => a.type === 'discard' && a.tile === SORTED_A[k]),
      )
    }
  })

  it('the drawn tile is its own surface: never in the sorted list, tap reports it exactly', () => {
    expect(afterEastDraw.drawn).not.toBeNull()
    expect(SORTED_A).not.toContain(afterEastDraw.drawn)
    const { taps, drawnButton } = mountTable(afterEastDraw)
    drawnButton()!.click()
    expect(taps).toEqual([afterEastDraw.drawn])
  })
})

describe('keyed reorder preserves the mapping — the tedashi merge', () => {
  // Discarding sorted[0] (8:3m) shifts every surviving li one slot left and merges
  // the former drawn tile (100:8s) into the sorted hand at position 11 (probed) —
  // the maximal keyed reorder one action can produce.
  const offered = legalActions(afterEastDraw)
  const discard = tapDiscard(offered, PLAYER, SORTED_A[0])!
  const next = foldRecord({
    seed: SEED,
    actions: [{ type: 'draw', seat: 0 }, discard],
  })
  const SORTED_B = sortedDisplay(next.hands[PLAYER])

  it('fixture sanity: the reorder is real — one id gone, the drawn id merged mid-hand', () => {
    expect(discard).toEqual({ type: 'discard', seat: 0, tile: 8 })
    expect(SORTED_B).toEqual([11, 36, 45, 46, 50, 49, 53, 64, 82, 86, 95, 100, 118])
    expect(SORTED_B.indexOf(100)).toBe(11)
    expect(next.turn).toBe(1)
    expect(next.drawn).toBeNull()
  })

  it('after the refold: order, taps, and per-tile node identity all survive the move', () => {
    const { taps, props, target, handButtons, drawnButton } = mountTable(afterEastDraw)
    const nodeBefore = new Map(SORTED_A.map((id, k) => [id, handButtons()[k]]))
    const drawnBefore = drawnButton()!

    props.table = next
    flushSync()

    const buttons = handButtons()
    expect(buttons).toHaveLength(13)
    expect(drawnButton()).toBeNull() // not the player's turn — the slot unmounted
    for (const button of buttons) button.click()
    // The mapping fact is the component's even off-turn (taps are the owner's no-op).
    expect(taps).toEqual(SORTED_B)
    for (const [k, id] of SORTED_B.entries()) {
      if (id === 100) {
        // The merged tile is a NEW list item — not the old drawn button rekeyed.
        expect(buttons[k]).not.toBe(drawnBefore)
        expect(nodeBefore.has(id)).toBe(false)
      } else {
        // Every surviving tile kept its exact node: keyed-by-id reconciliation
        // MOVES buttons, never repurposes one for a different tile. This is the
        // assertion that fails loudly if the each is ever keyed by index/unkeyed.
        expect(buttons[k]).toBe(nodeBefore.get(id))
      }
    }
    // The discarded tile's button left the hand entirely.
    expect(target.contains(nodeBefore.get(8)!)).toBe(false)
  })
})

describe('keyed reorder preserves the mapping — the claim shrink (seed 15)', () => {
  // The drive.test.ts pon anchor: after eight tsumogiri turns North discards 45 (3p)
  // and East pons with [44, 47] — sorted positions 7 and 8 leave the 13-tile hand at
  // once, mid-list, and the claim discard is owed from the remaining 11.
  const dealt15 = foldRecord({ seed: 15, actions: [] })
  const prefix = tsumogiriTurns(dealt15.live, 8)
  const window15 = foldRecord({ seed: 15, actions: prefix })
  const SORTED_W = sortedDisplay(window15.hands[PLAYER])
  const pon = tapClaim(legalActions(window15), PLAYER, { type: 'pon', uses: [44, 47] })!
  const claimed = foldRecord({ seed: 15, actions: [...prefix, pon] })
  const SORTED_C = sortedDisplay(claimed.hands[PLAYER])

  it('fixture sanity: an unsorted 13 shrinks to 11, losing two mid-sort positions', () => {
    expect([...window15.hands[PLAYER]]).not.toEqual(SORTED_W)
    expect([SORTED_W.indexOf(44), SORTED_W.indexOf(47)]).toEqual([7, 8])
    expect(SORTED_C).toEqual(SORTED_W.filter((id) => id !== 44 && id !== 47))
    expect(claimed.mustDiscard).toBe(true)
  })

  it('after the claim: 11 buttons, sorted order, exact ids, nodes moved not repurposed', () => {
    const { taps, props, target, handButtons } = mountTable(window15)
    const nodeBefore = new Map(SORTED_W.map((id, k) => [id, handButtons()[k]]))

    props.table = claimed
    flushSync()

    const buttons = handButtons()
    expect(buttons).toHaveLength(11)
    for (const button of buttons) button.click()
    expect(taps).toEqual(SORTED_C)
    for (const [k, id] of SORTED_C.entries()) {
      expect(buttons[k]).toBe(nodeBefore.get(id))
    }
    for (const gone of [44, 47]) {
      expect(target.contains(nodeBefore.get(gone)!)).toBe(false)
    }
    // And the owed claim discard is live for every one of the 11, by exact id.
    const mustDiscard = legalActions(claimed)
    for (const id of SORTED_C) {
      const action = tapDiscard(mustDiscard, PLAYER, id)
      expect(action).toBe(
        mustDiscard.find((a) => a.type === 'discard' && a.tile === id),
      )
    }
  })
})
