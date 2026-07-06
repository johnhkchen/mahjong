// KanPrompt (owner report #6): the own-turn kan affordance — declare echoes the
// offered element verbatim; "not now" is a bare dismissal signal. Mount-guard
// behavior is the shared mount-guard.ts contract (mount-guard.tap.svelte.test.ts).
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HandAction } from '../core'
import KanPrompt from './KanPrompt.svelte'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const ANKAN: HandAction = { type: 'ankan', seat: 0, uses: [0, 1, 2, 3] }

describe('KanPrompt', () => {
  it('declare echoes the offered element; pass signals a bare dismissal', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let declared: HandAction | null = null
    let passed = 0
    const app = mount(KanPrompt, {
      target,
      props: {
        choices: [ANKAN],
        ondeclare: (choice: HandAction) => {
          declared = choice
        },
        onpass: () => passed++,
      },
    })
    flushSync()

    const declare = target.querySelector<HTMLButtonElement>('[aria-label="declare kan 1m"]')
    expect(declare).not.toBeNull()
    declare!.click()
    flushSync()
    expect(declared).toBe(ANKAN) // the element itself, never rebuilt

    target.querySelector<HTMLButtonElement>('[aria-label="pass kan"]')!.click()
    flushSync()
    expect(passed).toBe(1)

    unmount(app)
    target.remove()
  })
})
