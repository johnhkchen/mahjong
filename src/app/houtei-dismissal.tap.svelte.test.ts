// T-011-01-01, sequence (c): regression coverage for the houtei `dismissed` reset
// at hand boundaries (commit 3bcf9d3). Pre-E-008, `dismissed` never outlived a
// hand; continuation (T-008-03-02-era work) let it leak into the NEXT hand,
// silently hiding every one of its prompts until the bug was fixed inline
// (App.svelte's `newHand()` now resets `dismissed = false`, mirroring
// `newGame()`). Unlike the race/reopen suite (T-011-01-01 sequences a/b), this
// one is expected to ALREADY PASS — the fix shipped before this ticket.
//
// Mounts the REAL App (app.riichi.tap.svelte.test.ts's fake-timer/flushSync
// pattern) and drives it end to end with a GENERIC step-driver: at every forced
// point it ticks the bot-pacing timer once (mirroring App's own $effect); at the
// player's own discard turn it plays discardPolicy's own recommendation (or
// declines a riichi offer when one is up) via a REAL tap on the matching sorted
// hand position (table.tap.svelte.test.ts's own sortedDisplay convention); at any
// claim/win offered to the player it taps "pass". The driver never hardcodes the
// mined action list — it recomputes each step from a state fold the test builds
// alongside the mounted app, using the exact same functions App.svelte imports
// (forcedAction/discardPolicy/riichiPrompt/settleWindow), so the two stay in
// lockstep by construction.
//
// GAME_SEED (frozen, mined): a scratchpad scan over raw hand-0 seeds, driving the
// player like a bot (discardPolicy on his own turns, riichi offers declined,
// every claim/win declined) via the same forcedAction/settleWindow driving
// drive.test.ts and App.svelte both use. Seed 2340: 146 actions reach ryuukyoku
// on South's discard of 2m — the ONLY offer left is the player's houtei ron
// (`offered.length === 1`), which the player declines (the dismissal branch:
// `settleWindow` returns null with nothing to fold). `2340 ^ 0x9e3779b1 >>> 0`
// is the GAME seed whose hand 0 core seed is 2340 (game.ts's own
// `handSeedOf(gameSeed, 0)`); hand 1's core seed (`handSeedOf(gameSeed, 1)`)
// reaches a claim window for the player in just 14 actions (2 of the player's
// own discards plus bot ticks): North pons South's 7z, then chis... no — offers
// the player a chi on North's 3m (uses 1m 2m). If `dismissed` were NOT reset,
// this window — and every prompt in the new hand — would render invisibly.
const HOUTEI_GAME_SEED = 2654433429 // `2340 ^ 0x9e3779b1 >>> 0`

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
import {
  claimChoices,
  forcedAction,
  PLAYER,
  riichiPrompt,
  settleWindow,
  winChoice,
} from './drive'
import { setPromptEveryLegalCall } from './call-prompt-settings.svelte'
import App from './App.svelte'

const BOT_DELAY_MS = 250
const MOUNT_GUARD_MS = 200 // ClaimPrompt.svelte/RiichiPrompt.svelte's own mount-guard.ts constant, duplicated for the timer advance

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
  // T-012-01-02: this suite's own generic step() driver predates the call-prompt
  // filter and assumes every offered claim/win renders a prompt — restore the
  // default (filtered) setting so no toggle state leaks into a sibling file.
  setPromptEveryLegalCall(false)
  localStorage.clear()
})

beforeEach(() => {
  vi.useFakeTimers()
  // Unrelated to this file's own regression (the dismissed-reset bug): this
  // suite's fixtures include at least one claim callPolicy itself would decline
  // (T-012-01-02's research.md), which the default filtered setting would auto-
  // pass without ever rendering a prompt — "prompt every legal call" restores
  // this suite's pre-ticket assumption that every offered claim/win is visible.
  setPromptEveryLegalCall(true)
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

/** Table.svelte's own display sort, replicated (table.tap.svelte.test.ts's convention). */
function sortedDisplay(hand: readonly TileId[]): TileId[] {
  return [...hand].sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b)))
}

function handButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>('[aria-label="your hand"] button'))
}

function drawnButton(target: HTMLElement): HTMLButtonElement | null {
  return target.querySelector<HTMLButtonElement>('[aria-label="drawn tile"] button')
}

function claimPrompt(target: HTMLElement): HTMLElement | null {
  return target.querySelector<HTMLElement>('[aria-label="call or pass"]')
}

function nextHandButton(target: HTMLElement): HTMLButtonElement | null {
  return target.querySelector<HTMLButtonElement>('.next-hand')
}

/**
 * One step of the generic driver: given the state this instant (a fold over the
 * test's own tracked `actions`, alongside — never ahead of — the mounted App's
 * own internal fold), perform exactly the real tap or timer tick App's own
 * effect/handlers would resolve, and append whatever landed to `actions`. Claims
 * and wins offered to the player are always declined (drives toward ryuukyoku
 * without ever needing to model a player win). Returns 'dismissed' the one time
 * `settleWindow` returns null with nothing offered — the houtei decline itself —
 * without tapping anything further (the caller asserts there).
 */
async function step(
  target: HTMLElement,
  state: TableState,
  offered: readonly HandAction[],
  actions: HandAction[],
): Promise<'dismissed' | 'acted'> {
  const win = winChoice(offered, PLAYER)
  const playerClaims = claimChoices(offered, PLAYER)
  if (playerClaims.length > 0 || win !== null) {
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
    const notYet = target.querySelector<HTMLButtonElement>('[aria-label="not yet"]')
    if (notYet === null) throw new Error('step: expected the riichi prompt\'s decline button')
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
 * each step, so the caller can assert on the exact state that made it stop) or
 * the driver reports the houtei dismissal itself. */
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

describe('the houtei dismissal reset at hand boundaries (seed 2340, commit 3bcf9d3 regression)', () => {
  it('hides the prompt on a declined houtei ron, then shows the very next prompt after "next hand"', async () => {
    const target = mountApp(HOUTEI_GAME_SEED)
    const HOUTEI_SEED = 2340

    // Drive hand 0 all the way to the lone houtei ron and decline it.
    const hand0Actions: HandAction[] = []
    const outcome = await driveUntil(target, HOUTEI_SEED, hand0Actions, () => false)
    expect(outcome).toBe('dismissed')

    // Fixture sanity: ryuukyoku, and the ron the player just declined was the
    // ONLY thing offered (the lone-houtei geometry this fixture was mined for).
    const dismissedState = foldRecord({ seed: HOUTEI_SEED, actions: hand0Actions })
    expect(dismissedState.phase).toBe('ryuukyoku')
    const dismissedOffered = legalActions(dismissedState)
    expect(dismissedOffered).toHaveLength(1)
    expect(dismissedOffered[0]!.type).toBe('ron')
    expect((dismissedOffered[0] as { seat: number }).seat).toBe(PLAYER)
    expect(kindOf((dismissedOffered[0] as { tile: TileId }).tile)).toBe('2m')

    // The dismissal itself: no prompt renders even though the ron is technically
    // still "offered" (nothing was appended to the log — the state didn't move).
    expect(claimPrompt(target)).toBeNull()
    // The hand has ended either way — the next-hand control is live.
    const nextButton = nextHandButton(target)
    expect(nextButton).not.toBeNull()

    // The fix under test: newHand() resets `dismissed`, not merely appends a
    // fresh hand.
    nextButton!.click()
    flushSync()
    expect(claimPrompt(target)).toBeNull() // nothing offered yet — a fresh deal

    // Drive hand 1 forward to its first claim window (2 of the player's own
    // discards plus bot ticks, frozen/mined: North pons South's 7z, discards,
    // and its own next discard opens a chi for the player on 3m).
    const HAND1_SEED = 2723775479 // handSeedOf(HOUTEI_GAME_SEED, 1) — frozen, mined alongside HOUTEI_SEED
    const hand1Actions: HandAction[] = []
    const reached = await driveUntil(target, HAND1_SEED, hand1Actions, (_state, offered) =>
      claimChoices(offered, PLAYER).length > 0 || winChoice(offered, PLAYER) !== null,
    )
    expect(reached).toBe('stopped')

    // The regression itself: this prompt is VISIBLE. Pre-3bcf9d3, `dismissed`
    // from hand 0's houtei decline would still read true here and hide it.
    const prompt = claimPrompt(target)
    expect(prompt).not.toBeNull()
    const chiButton = target.querySelector<HTMLButtonElement>('.prompt .call')
    expect(chiButton).not.toBeNull()
    expect(chiButton!.getAttribute('aria-label')).toBe('chi 3m with 1m 2m')
  }, 20_000)
})
