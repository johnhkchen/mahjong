// The retuned T-012-01-01 mount guard (owner hand-log report 2026-07-05): cold prompt
// mounts take fast taps immediately; a prompt mounting within REOPEN_GUARD_WINDOW_MS
// of another prompt's close arms the guard — buttons render visibly disabled for one
// MOUNT_GUARD_MS beat, then work. Component-level: the app-level cold path is
// app.riichi.tap's, the 3-tick (cold by distance) reopening is claim-window-race.tap's.
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { foldRecord, legalActions, type HandAction, type TileId } from '../core'
import { PLAYER, promptChoices } from './drive'
import ClaimPrompt from './ClaimPrompt.svelte'
import { MOUNT_GUARD_MS, REOPEN_GUARD_WINDOW_MS, resetMountGuard } from './mount-guard'

beforeEach(() => {
  vi.useFakeTimers()
  resetMountGuard()
})
afterEach(() => {
  vi.useRealTimers()
})

/** The frozen seed-15 claim window (app.ssr.test.ts's anchor): after eight tsumogiri
 *  turns North discards 3p and East holds claims on it. */
function windowFixture() {
  const dealt = foldRecord({ seed: 15, actions: [] })
  const turns: HandAction[] = Array.from({ length: 8 }, (_, k): HandAction[] => {
    const seat = (k % 4) as 0 | 1 | 2 | 3
    return [
      { type: 'draw', seat },
      { type: 'discard', seat, tile: dealt.live[k] as TileId },
    ]
  }).flat()
  const window15 = foldRecord({ seed: 15, actions: turns })
  return { claimed: window15.claimable!.tile, choices: promptChoices(legalActions(window15), PLAYER) }
}

function mountPrompt(onclaim: () => void) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const { claimed, choices } = windowFixture()
  const instance = mount(ClaimPrompt, { target, props: { claimed, choices, onclaim } })
  flushSync()
  return { target, instance }
}

function firstCall(target: HTMLElement): HTMLButtonElement {
  return target.querySelector<HTMLButtonElement>('.call')!
}

describe('mount guard arming', () => {
  it('cold mount: buttons are enabled and a fast first tap lands', () => {
    let claims = 0
    const { target, instance } = mountPrompt(() => claims++)
    expect(firstCall(target).disabled).toBe(false)
    firstCall(target).click()
    flushSync()
    expect(claims).toBe(1)
    unmount(instance)
  })

  it('hot reopen: buttons are visibly disabled for the beat, then live', () => {
    let claims = 0
    const first = mountPrompt(() => claims++)
    unmount(first.instance) // cleanup marks the close
    first.target.remove()

    // Reopen inside the guard window — one BOT_DELAY_MS tick later.
    vi.advanceTimersByTime(250)
    const second = mountPrompt(() => claims++)
    expect(firstCall(second.target).disabled).toBe(true)
    firstCall(second.target).click()
    flushSync()
    expect(claims).toBe(0) // disabled: the misland tap does nothing, visibly

    vi.advanceTimersByTime(MOUNT_GUARD_MS)
    flushSync()
    expect(firstCall(second.target).disabled).toBe(false)
    firstCall(second.target).click()
    flushSync()
    expect(claims).toBe(1)
    unmount(second.instance)
    second.target.remove()
  })

  it('slow reopen: past the guard window the mount is cold again', () => {
    let claims = 0
    const first = mountPrompt(() => claims++)
    unmount(first.instance)
    first.target.remove()

    vi.advanceTimersByTime(REOPEN_GUARD_WINDOW_MS)
    const second = mountPrompt(() => claims++)
    expect(firstCall(second.target).disabled).toBe(false)
    firstCall(second.target).click()
    flushSync()
    expect(claims).toBe(1)
    unmount(second.instance)
    second.target.remove()
  })
})
