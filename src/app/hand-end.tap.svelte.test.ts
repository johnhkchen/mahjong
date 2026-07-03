// T-008-03-02's one client-mount check for the "next hand" control: proves a real
// click reaches through Table's forwarding into HandEnd's own onclick, the one
// thing app.ssr.test.ts structurally cannot prove (SSR output holds no click
// handlers — table.tap.svelte.test.ts's own header comment). Mirrors that file's
// mount/flushSync pattern exactly, against the SAME won/ryuukyoku anchors
// app.ssr.test.ts already uses (seed 542630 tsumo, the BOOT_SEED wall-exhaustion).

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { foldRecord, type HandAction, type TileId } from '../core'
import Table from './Table.svelte'

const SEED = 1

function tsumogiriTurns(live: readonly TileId[], n: number): HandAction[] {
  return Array.from({ length: n }, (_, k): HandAction[] => {
    const seat = (k % 4) as 0 | 1 | 2 | 3
    return [
      { type: 'draw', seat },
      { type: 'discard', seat, tile: live[k] },
    ]
  }).flat()
}

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
})

function mountTable(
  table: import('../core').TableState,
  extra: { scores?: readonly [number, number, number, number]; onnext?: () => void } = {},
) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Table, { target, props: { table, ...extra } })
  cleanups.push(() => {
    unmount(app)
    target.remove()
  })
  flushSync()
  return { target }
}

const dealtWin = foldRecord({ seed: 542630, actions: [] })
const won = foldRecord({
  seed: 542630,
  actions: [
    ...tsumogiriTurns(dealtWin.live, 32),
    { type: 'draw', seat: 0 },
    { type: 'tsumo', seat: 0 },
  ],
})

const dealtBoot = foldRecord({ seed: SEED, actions: [] })
const exhausted = foldRecord({ seed: SEED, actions: tsumogiriTurns(dealtBoot.live, 70) })

describe('next-hand button click (mounted)', () => {
  it('invokes onnext exactly once on a won hand', () => {
    const onnext = vi.fn()
    const { target } = mountTable(won, { onnext })
    const button = target.querySelector<HTMLButtonElement>('.next-hand')
    expect(button).not.toBeNull()
    button!.click()
    expect(onnext).toHaveBeenCalledTimes(1)
  })

  it('invokes onnext exactly once on a ryuukyoku hand', () => {
    const onnext = vi.fn()
    const { target } = mountTable(exhausted, { onnext })
    const button = target.querySelector<HTMLButtonElement>('.next-hand')
    expect(button).not.toBeNull()
    button!.click()
    expect(onnext).toHaveBeenCalledTimes(1)
  })

  it('renders no button at all when onnext is omitted', () => {
    const { target } = mountTable(won)
    expect(target.querySelector('.next-hand')).toBeNull()
  })
})
