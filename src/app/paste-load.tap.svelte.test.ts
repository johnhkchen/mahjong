// End-to-end coverage of the paste-to-reproduce loader (T-013-02-02, E-013's owner
// half), driven through a REAL mounted App — the one place App's own loadRecord,
// drive.ts's loadPastedRecord, and ReportBug.svelte's paste UI all meet. Mirrors
// report-bug.tap.svelte.test.ts's mounting/tick helper style (T-013-02-01's own
// closest sibling) rather than sharing a module — the established per-test-file
// duplication convention.

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  foldGame,
  foldRecord,
  handSeedOf,
  kindIndexOf,
  kindOf,
  parseGameRecord,
  serializeGameRecord,
  type GameRecord,
  type HandAction,
  type TileId,
} from '../core'
import { buildReportText, seatScoresOf } from './drive'
import App from './App.svelte'

const SEED = 1
const BOT_DELAY_MS = 250 // App.svelte's own pacing constant, duplicated per this codebase's convention

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
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

async function tickUntil(
  target: HTMLElement,
  done: () => boolean,
  maxTicks = 20,
): Promise<void> {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (done()) return
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
    flushSync()
  }
  throw new Error('tickUntil: exceeded maxTicks')
}

function openDialog(target: HTMLElement) {
  target.querySelector<HTMLButtonElement>('.report-bug-toggle')!.click()
  flushSync()
}

function pasteAndLoad(target: HTMLElement, text: string) {
  const textarea = target.querySelector<HTMLTextAreaElement>('[aria-label="paste report"]')!
  textarea.value = text
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  flushSync()
  target.querySelector<HTMLButtonElement>('[aria-label="load report"]')!.click()
  flushSync()
}

function pasteErrorText(target: HTMLElement): string | null {
  return target.querySelector('.paste-error')?.textContent ?? null
}

function dialogIsOpen(target: HTMLElement): boolean {
  return target.querySelector('dialog')?.hasAttribute('open') ?? false
}

function handButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>('[aria-label="your hand"] button'))
}

/** The player's rendered hand, as kind strings — Table.svelte's own display sort
 *  (kindIndexOf ascending), so this can be compared directly against an
 *  independently-computed, identically-sorted reference. */
function handKinds(target: HTMLElement): string[] {
  return handButtons(target).map((b) => b.getAttribute('aria-label')!.replace('discard ', ''))
}

/** One seat's rendered pond, as kind strings in discard order — scoped to the
 *  labeled `<ul>` the same way report-bug.tap.svelte.test.ts's own eastPondCount
 *  scopes to "east pond", generalized to any of the four labels and to kinds
 *  rather than a bare count. */
function pondKinds(target: HTMLElement, label: string): string[] {
  return Array.from(
    target.querySelectorAll<HTMLElement>(`[aria-label="${label}"] .kind`),
  ).map((el) => el.textContent ?? '')
}

function scoresText(target: HTMLElement): string | null {
  return target.querySelector('[aria-label="scores"]')?.textContent ?? null
}

/** Verbatim copy of drive.test.ts's own fixture helper — no shared helper module
 *  exists in src/app/ (established per-file duplication convention). Draws consume
 *  the post-deal live wall head-first, so turn k's tile is live[k]. */
function tsumogiriTurns(live: readonly TileId[], n: number): HandAction[] {
  return Array.from({ length: n }, (_, k): HandAction[] => {
    const seat = (k % 4) as 0 | 1 | 2 | 3
    return [
      { type: 'draw', seat },
      { type: 'discard', seat, tile: live[k] },
    ]
  }).flat()
}

// A mid-game (still 'playing') fixture: hand 0's own wall (handSeedOf(gameSeed, 0),
// game.ts's own per-hand seed derivation — NOT gameSeed directly) dealt out, six
// tsumogiri turns in, one full go-around plus East's second draw/discard.
const MID_GAME_SEED = 7
const midGameDealt = foldRecord({ seed: handSeedOf(MID_GAME_SEED, 0), actions: [] })
const MID_GAME_RECORD: GameRecord = {
  seed: MID_GAME_SEED,
  hands: [tsumogiriTurns(midGameDealt.live, 6)],
}

// An ended (agari) fixture: gameSeed chosen so hand 0's own wall (handSeedOf) is
// EXACTLY app.terminology.coverage.ssr.test.ts's own already-proven seed 542630 —
// 32 tsumogiri turns then East's own draw completes a tsumo. handSeedOf's XOR step
// is its own inverse, so gameSeed = 542630 ^ imul(1, GOLDEN_RATIO_32); confirmed
// against handSeedOf(gameSeed, 0) === 542630 directly.
const ENDED_GAME_SEED = 2654944791
const endedDealt = foldRecord({ seed: handSeedOf(ENDED_GAME_SEED, 0), actions: [] })
const ENDED_GAME_RECORD: GameRecord = {
  seed: ENDED_GAME_SEED,
  hands: [
    [
      ...tsumogiriTurns(endedDealt.live, 32),
      { type: 'draw', seat: 0 },
      { type: 'tsumo', seat: 0 },
    ],
  ],
}

describe('the paste-to-reproduce loader, end to end', () => {
  it('loads a mid-game record: hand and pond match an independently-folded reference', () => {
    const target = mountApp(SEED)
    openDialog(target)
    pasteAndLoad(target, serializeGameRecord(MID_GAME_RECORD))

    const reference = foldGame(MID_GAME_RECORD).table
    const expectedHand = [...reference.hands[0]]
      .sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b)))
      .map(kindOf)
    expect(handKinds(target)).toEqual(expectedHand)
    expect(pondKinds(target, 'east pond')).toEqual(reference.ponds[0].map(kindOf))
    expect(pondKinds(target, 'south pond')).toEqual(reference.ponds[1].map(kindOf))
    expect(pondKinds(target, 'west pond')).toEqual(reference.ponds[2].map(kindOf))
    expect(pondKinds(target, 'north pond')).toEqual(reference.ponds[3].map(kindOf))
    // A successful load closes the dialog (design.md Decision 4).
    expect(dialogIsOpen(target)).toBe(false)
  })

  it('extracts the notation from a full copied-report blob (message + context + notation)', () => {
    const target = mountApp(SEED)
    openDialog(target)
    const blob = buildReportText({
      message: 'reproduce this exact spot',
      notation: serializeGameRecord(MID_GAME_RECORD),
      terminology: 'romaji',
      handIndex: 0,
      actionCount: MID_GAME_RECORD.hands[0].length,
      origin: 'https://mahjong.b28.dev',
    })
    pasteAndLoad(target, blob)

    const reference = foldGame(MID_GAME_RECORD).table
    const expectedHand = [...reference.hands[0]]
      .sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b)))
      .map(kindOf)
    expect(handKinds(target)).toEqual(expectedHand)
    expect(pondKinds(target, 'east pond')).toEqual(reference.ponds[0].map(kindOf))
  })

  it('shows the parser\'s exact message on malformed paste and leaves the running game untouched', async () => {
    const target = mountApp(SEED)
    await tickUntil(target, () => target.querySelector('[aria-label="drawn tile"]') !== null)
    const before = pondKinds(target, 'east pond').length

    openDialog(target)
    const garbage = 'not notation at all'
    let expectedMessage = ''
    try {
      parseGameRecord(garbage)
      throw new Error('expected parseGameRecord to throw for this fixture')
    } catch (error) {
      expectedMessage = (error as Error).message
    }
    pasteAndLoad(target, garbage)

    expect(pasteErrorText(target)).toBe(expectedMessage)
    // A failed load does not close the dialog, and does not touch the live game.
    expect(dialogIsOpen(target)).toBe(true)
    expect(pondKinds(target, 'east pond').length).toBe(before)

    // The running game is still live: closing the dialog and tapping still discards.
    target.querySelector<HTMLButtonElement>('[aria-label="close"]')!.click()
    flushSync()
    handButtons(target)[0]!.click()
    flushSync()
    expect(pondKinds(target, 'east pond').length).toBe(before + 1)
  })

  it('loads regardless of phase — an ended (agari) record shows its scores, no phase rejection', () => {
    const target = mountApp(SEED)
    openDialog(target)
    pasteAndLoad(target, serializeGameRecord(ENDED_GAME_RECORD))

    const game = foldGame(ENDED_GAME_RECORD)
    const expectedScores = seatScoresOf(game.scores, game.dealer)
    const scores = scoresText(target)
    expect(scores).not.toBeNull()
    // East (dealer, seat 0) is always listed first — HandEnd's own seat-order loop.
    expect(scores).toContain(`${expectedScores[0]}`)
    expect(target.querySelector('.next-hand')).not.toBeNull()
  })
})
