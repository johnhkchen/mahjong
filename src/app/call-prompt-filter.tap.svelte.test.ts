// T-012-01-02's own end-to-end coverage: by default, a claim window whose only
// offers callPolicy would decline never renders a prompt at all (play proceeds as
// if the player had passed); a window callPolicy would approve, or any window once
// the player, still prompts; the "prompt every legal call" toggle restores full
// prompting live and its choice persists across a reload. Mounts the REAL App
// (app.terminology.svelte.test.ts's/window-outcome-notice.tap.svelte.test.ts's own
// fake-timer/flushSync/mountApp scaffolding).
//
// Fixtures are reused verbatim from sibling suites, never re-mined
// (docs/active/work/T-012-01-02/research.md pins the policy verdict for each):
// - HOUTEI_GAME_SEED's hand-1 walk (houtei-dismissal.tap.svelte.test.ts) reaches a
//   chi offer (3m, uses 1m/2m) callPolicy DECLINES for the player.
// - RACE_GAME_SEED (claim-window-race.tap.svelte.test.ts) reaches a chi offer (8m,
//   uses 6m/7m) callPolicy APPROVES for the player.
const HOUTEI_GAME_SEED = 2654433429 // `2340 ^ 0x9e3779b1 >>> 0` — houtei-dismissal's own frozen constant
const HAND1_SEED = 2723775479 // handSeedOf(HOUTEI_GAME_SEED, 1) — houtei-dismissal's own frozen constant
const RACE_GAME_SEED = 2654435561 // `344 ^ 0x9e3779b1 >>> 0` — claim-window-race's own frozen constant

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  discardPolicy,
  foldRecord,
  kindIndexOf,
  kindOf,
  legalActions,
  seatView,
  type HandAction,
  type TableState,
  type TileId,
} from '../core'
import { claimChoices, forcedAction, PLAYER, riichiPrompt, settleWindow, winChoice } from './drive'
import {
  promptEveryLegalCall,
  setPromptEveryLegalCall,
} from './call-prompt-settings.svelte'
import { setTerminology } from './dictionary.svelte'
import App from './App.svelte'

const BOT_DELAY_MS = 250
const MOUNT_GUARD_MS = 200 // ClaimPrompt.svelte's own mount-guard.ts constant, duplicated for the timer advance
const STORAGE_KEY = 'mahjong-prompt-every-legal-call'

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
  setPromptEveryLegalCall(false)
  setTerminology('romaji')
  localStorage.clear()
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

function claimPrompt(target: HTMLElement): HTMLElement | null {
  return target.querySelector<HTMLElement>('[aria-label="call or pass"]')
}
function callButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>('.prompt .call'))
}
function drawnButton(target: HTMLElement): HTMLButtonElement | null {
  return target.querySelector<HTMLButtonElement>('[aria-label="drawn tile"] button')
}
function toggleButton(target: HTMLElement): HTMLButtonElement {
  return target.querySelector<HTMLButtonElement>('.call-prompt-toggle')!
}
function sortedDisplay(hand: readonly TileId[]): TileId[] {
  return [...hand].sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b)))
}
function handButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>('[aria-label="your hand"] button'))
}

/**
 * One step of a generic driver (window-outcome-notice.tap.svelte.test.ts's own
 * shape): declines every player claim/win via a real "pass" tap (only reachable
 * when this suite has itself set the toggle on for that stretch of the walk —
 * every fixture below either has no player offer at all until its target window,
 * or is driven with the toggle on up to that point), ticks the bot timer when
 * `forcedAction` fires, declines a riichi offer, else plays discardPolicy's own
 * recommendation via a real tap.
 */
async function step(
  target: HTMLElement,
  state: TableState,
  offered: readonly HandAction[],
  actions: HandAction[],
): Promise<'dismissed' | 'acted'> {
  const win = winChoice(offered, PLAYER)
  const playerClaims = claimChoices(offered, PLAYER)
  if (win !== null || playerClaims.length > 0) {
    const settled = settleWindow(state, offered, PLAYER, null)
    const passBtn = target.querySelector<HTMLButtonElement>('[aria-label="pass"]')
    if (passBtn === null) throw new Error('step: expected a pass button on an offered claim/win')
    await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
    flushSync()
    passBtn.click()
    flushSync()
    if (settled === null) return 'dismissed'
    actions.push(settled)
    return 'acted'
  }
  const forced = forcedAction(state, offered, PLAYER, true)
  if (forced !== null) {
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
    flushSync()
    actions.push(forced)
    return 'acted'
  }
  const rp = riichiPrompt(state, offered, PLAYER)
  if (rp !== null) {
    const notYet = target.querySelector<HTMLButtonElement>('.riichi .pass')
    if (notYet === null) throw new Error("step: expected the riichi prompt's decline button")
    await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
    flushSync()
    notYet.click()
    flushSync()
    actions.push(rp.decline)
    return 'acted'
  }
  const rec = discardPolicy(seatView(state, PLAYER), offered)
  if (rec.type !== 'discard' || rec.seat !== PLAYER) {
    throw new Error(`step: discardPolicy returned an unexpected action: ${JSON.stringify(rec)}`)
  }
  if (state.drawn === rec.tile) {
    const button = drawnButton(target)
    if (button === null) throw new Error('step: expected the drawn-tile button')
    button.click()
  } else {
    const sorted = sortedDisplay(state.hands[PLAYER])
    const index = sorted.indexOf(rec.tile)
    if (index < 0) throw new Error('step: discardPolicy tile not found in the sorted hand')
    handButtons(target)[index]!.click()
  }
  flushSync()
  actions.push(rec)
  return 'acted'
}

/** Drives a whole hand forward until `stop` reports true (checked BEFORE acting
 *  each step) or the driver hits the houtei dismissal itself
 *  (houtei-dismissal.tap.svelte.test.ts's own shape). */
async function driveUntil(
  target: HTMLElement,
  coreSeed: number,
  actions: HandAction[],
  stop: (state: TableState, offered: readonly HandAction[]) => boolean,
  guardLimit = 200,
): Promise<'stopped' | 'dismissed'> {
  for (let guard = 0; guard < guardLimit; guard++) {
    const state = foldRecord({ seed: coreSeed, actions })
    const offered = legalActions(state)
    if (offered.length === 0) throw new Error('driveUntil: the hand ended before the stop condition')
    if (stop(state, offered)) return 'stopped'
    const result = await step(target, state, offered, actions)
    if (result === 'dismissed') return 'dismissed'
  }
  throw new Error('driveUntil: exceeded guardLimit')
}

describe('the call-prompt filter, end to end', () => {
  it('auto-passes a policy-declined claim window by default — no prompt ever renders', async () => {
    const target = mountApp(HOUTEI_GAME_SEED)
    expect(promptEveryLegalCall()).toBe(false) // fixture sanity: the default

    // Hand 0's walk toward its lone houtei ron (houtei-dismissal.tap.svelte.test.ts's
    // own fixture) crosses at least one other claim window along the way — this test
    // is not about THAT window, so the toggle is held on here purely so the generic
    // decline-everything driver can rely on a pass button always being present,
    // exactly like houtei-dismissal.tap.svelte.test.ts's own suite does throughout.
    setPromptEveryLegalCall(true)
    const hand0Actions: HandAction[] = []
    const outcome = await driveUntil(target, 2340, hand0Actions, () => false)
    expect(outcome).toBe('dismissed')
    target.querySelector<HTMLButtonElement>('.next-hand')!.click()
    flushSync()
    // Restore the default before reaching the window actually under test.
    setPromptEveryLegalCall(false)

    // Hand 1's chi window (seed 2723775479, 1m/2m chi on 3m) is the fixture
    // research.md pins as policy-DECLINED. Drive to the state just before it and
    // assert no prompt has rendered across the transition.
    const hand1Actions: HandAction[] = []
    for (let guard = 0; guard < 200; guard++) {
      const state = foldRecord({ seed: HAND1_SEED, actions: hand1Actions })
      const offered = legalActions(state)
      if (offered.length === 0) throw new Error('reached hand end before the target window')
      if (claimChoices(offered, PLAYER).length > 0) break
      await step(target, state, offered, hand1Actions)
    }
    const beforeState = foldRecord({ seed: HAND1_SEED, actions: hand1Actions })
    const beforeOffered = legalActions(beforeState)
    expect(claimChoices(beforeOffered, PLAYER)).toHaveLength(1)
    expect(claimPrompt(target)).toBeNull()
    const handTilesBefore = handButtons(target).length

    // No prompt renders across several bot ticks (the app's own $effect auto-
    // settles the window internally via forcedAction — nothing was tapped), and
    // play keeps proceeding: the player's hand is untouched (the chi never
    // landed) and the app reaches its own next forced draw within a few ticks —
    // proof the window didn't silently stall waiting for a tap that never comes.
    for (let tick = 0; tick < 10 && drawnButton(target) === null; tick++) {
      await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
      flushSync()
      expect(claimPrompt(target)).toBeNull()
    }
    expect(drawnButton(target)).not.toBeNull()
    expect(handButtons(target)).toHaveLength(handTilesBefore)
  }, 20_000)

  it('a policy-approved window still prompts by default (seed 344, the race fixture)', async () => {
    const target = mountApp(RACE_GAME_SEED)
    expect(promptEveryLegalCall()).toBe(false)

    for (let round = 0; round < 5; round++) {
      for (let tick = 0; tick < 30 && drawnButton(target) === null; tick++) {
        await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
        flushSync()
      }
      drawnButton(target)!.click()
      flushSync()
    }
    for (let tick = 0; tick < 30 && claimPrompt(target) === null; tick++) {
      await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
      flushSync()
    }
    expect(claimPrompt(target)).not.toBeNull()
    expect(callButtons(target)).toHaveLength(1)
    expect(callButtons(target)[0]!.getAttribute('aria-label')).toBe('chi 8m with 6m 7m')
  }, 20_000)

  it('the toggle restores full prompting for the same declined window, live', async () => {
    const target = mountApp(HOUTEI_GAME_SEED)
    toggleButton(target).click()
    flushSync()
    expect(promptEveryLegalCall()).toBe(true)

    const hand0Actions: HandAction[] = []
    const outcome = await driveUntil(target, 2340, hand0Actions, () => false)
    expect(outcome).toBe('dismissed')
    target.querySelector<HTMLButtonElement>('.next-hand')!.click()
    flushSync()

    const hand1Actions: HandAction[] = []
    for (let guard = 0; guard < 200; guard++) {
      const state = foldRecord({ seed: HAND1_SEED, actions: hand1Actions })
      const offered = legalActions(state)
      if (claimChoices(offered, PLAYER).length > 0) break
      await step(target, state, offered, hand1Actions)
    }
    const prompt = claimPrompt(target)
    expect(prompt).not.toBeNull()
    const chiButton = callButtons(target)[0]
    expect(chiButton?.getAttribute('aria-label')).toBe('chi 3m with 1m 2m')
  }, 20_000)

  it('names its own label in both terminologies', async () => {
    const target = mountApp(1)
    expect(toggleButton(target).textContent).toBe('prompt every call')
    expect(toggleButton(target).getAttribute('aria-label')).toBe('prompt every call')

    toggleButton(target).click()
    flushSync()
    expect(toggleButton(target).textContent).toBe('quiet calls')

    target.querySelector<HTMLButtonElement>('.terminology-toggle')!.click()
    flushSync()
    expect(toggleButton(target).textContent).toBe('安靜叫牌')
    toggleButton(target).click()
    flushSync()
    expect(toggleButton(target).textContent).toBe('提示每次叫牌')
  })

  it('writes exactly one localStorage key on toggle, and persists across a reload', async () => {
    const target = mountApp(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    toggleButton(target).click()
    flushSync()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')

    const [{ default: FreshApp }, { mount: freshMount, flushSync: freshFlush, unmount: freshUnmount }] =
      await Promise.all([import('./App.svelte'), import('svelte')])
    const freshTarget = document.createElement('div')
    document.body.appendChild(freshTarget)
    const app = freshMount(FreshApp, { target: freshTarget, props: { initialSeed: 1 } })
    freshFlush()
    try {
      expect(toggleButton(freshTarget).textContent).toBe('quiet calls')
    } finally {
      freshUnmount(app)
      freshTarget.remove()
    }
  })
})
