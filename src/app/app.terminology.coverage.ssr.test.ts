// T-010-01-03's own coverage: every AC-named surface (prompts, seat labels, furiten badge,
// hand-end/score screens) rendered under BOTH terminologies, asserting the exact expected
// label at each site. Deliberately NOT this file's job: the toggle's own click/persist
// behavior (app.terminology.svelte.test.ts owns that) or a translation-correctness review
// (the zh-hant literals below are read off dictionary.svelte.ts's current values, not
// verified against a native speaker — same caveat T-010-01-01/02 review.md already carry).
// Expected labels are hand-copied literals, not imported from the (module-private) TERMS
// table — importing it would make the assertion tautological against its own source.

import { render } from 'svelte/server'
import { afterEach, describe, expect, it } from 'vitest'
import {
  foldRecord,
  furitenSeal,
  legalActions,
  scoreBreakdownOf,
  yakulessTenpai,
  type HandAction,
  type TileId,
} from '../core'
import { PLAYER, promptChoices, riichiPrompt, winChoice } from './drive'
import { setTerminology, type TermKey, type Terminology } from './dictionary.svelte'
import ClaimPrompt from './ClaimPrompt.svelte'
import RiichiPrompt from './RiichiPrompt.svelte'
import Table from './Table.svelte'

const TERMINOLOGIES: readonly Terminology[] = ['romaji', 'zh-hant']

const EXPECTED: Record<Terminology, Record<TermKey, string>> = {
  romaji: {
    chi: 'chi',
    pon: 'pon',
    kan: 'kan',
    ron: 'ron',
    tsumo: 'tsumo',
    riichi: 'riichi',
    ryuukyoku: 'ryuukyoku',
    tenpai: 'tenpai',
    noten: 'noten',
    furiten: 'furiten',
    east: 'East',
    south: 'South',
    west: 'West',
    north: 'North',
    declareRiichi: 'declare riichi',
    notYet: 'not yet',
    nextHand: 'next hand',
    dora: 'dora',
    fu: 'fu',
    han: 'han',
  },
  'zh-hant': {
    chi: '吃',
    pon: '碰',
    kan: '槓',
    ron: '胡',
    tsumo: '自摸',
    riichi: '立直',
    ryuukyoku: '流局',
    tenpai: '聽牌',
    noten: '未聽',
    furiten: '振聽',
    east: '東',
    south: '南',
    west: '西',
    north: '北',
    declareRiichi: '宣告立直',
    notYet: '暫不',
    nextHand: '下一局',
    dora: '寶牌',
    fu: '符',
    han: '翻',
  },
}

const BOOT_SEED = 1

/** Verbatim copy of app.ssr.test.ts's own fixture helper — no shared helper module exists
 *  in src/app/ (established per-file duplication convention). */
function tsumogiriTurns(live: readonly TileId[], n: number): HandAction[] {
  return Array.from({ length: n }, (_, k): HandAction[] => {
    const seat = (k % 4) as 0 | 1 | 2 | 3
    return [
      { type: 'draw', seat },
      { type: 'discard', seat, tile: live[k] },
    ]
  }).flat()
}

/** Slices the substring inside the element labeled `label`, same technique as
 *  app.ssr.test.ts's regionTokens — scope assertions to one region so a term's glyph
 *  can't coincidentally match elsewhere (e.g. an honor-tile face, T-010-01-01 review.md's
 *  own documented East/南 collision risk). */
function region(body: string, label: string, closeTag: string): string {
  const start = body.indexOf(`aria-label="${label}"`)
  expect(start, `no element labeled "${label}" in the SSR output`).toBeGreaterThanOrEqual(0)
  const end = body.indexOf(closeTag, start)
  return body.slice(start, end + closeTag.length)
}

/** The seat's own wind text — the SSR string equivalent of
 *  app.terminology.svelte.test.ts's DOM-based seatWindText: the wind label is the first
 *  text node inside `<div class="seat {area} ...">`, before any nested tag (the you-mark
 *  span or the pond list), so slicing to the next `<` isolates it from tile glyphs that
 *  could themselves spell a wind kanji. The class attribute itself is not just "seat
 *  {area}" — Svelte SSR appends its own scoped-style hash plus any active `class:` toggles
 *  (`you`, `active`) after it, so the marker only anchors the attribute's start; the
 *  closing quote is found separately before scanning on to the tag's `>`. */
function seatWindLabel(body: string, area: 'east' | 'south' | 'west' | 'north'): string {
  const marker = `class="seat ${area} `
  const start = body.indexOf(marker)
  expect(start, `no seat region for ${area}`).toBeGreaterThanOrEqual(0)
  const classEnd = body.indexOf('"', start + marker.length)
  const tagEnd = body.indexOf('>', classEnd)
  const nextTag = body.indexOf('<', tagEnd + 1)
  return body.slice(tagEnd + 1, nextTag).trim()
}

afterEach(() => setTerminology('romaji'))

for (const terminology of TERMINOLOGIES) {
  const t = EXPECTED[terminology]

  describe(`${terminology} terminology`, () => {
    describe('seat labels', () => {
      it('names all four seats in the active terminology', () => {
        setTerminology(terminology)
        const dealt = foldRecord({ seed: BOOT_SEED, actions: [] })
        const { body } = render(Table, { props: { table: dealt } })
        expect(seatWindLabel(body, 'east')).toBe(t.east)
        expect(seatWindLabel(body, 'south')).toBe(t.south)
        expect(seatWindLabel(body, 'west')).toBe(t.west)
        expect(seatWindLabel(body, 'north')).toBe(t.north)
      })
    })

    describe('claim prompt', () => {
      it('labels chi/pon call buttons — the seed-15 mixed claim window', () => {
        setTerminology(terminology)
        const dealt15 = foldRecord({ seed: 15, actions: [] })
        const window15 = foldRecord({ seed: 15, actions: tsumogiriTurns(dealt15.live, 8) })
        const choices = promptChoices(legalActions(window15), PLAYER)
        const { body } = render(ClaimPrompt, {
          props: { claimed: window15.claimable!.tile, choices },
        })
        expect(body).toContain(`aria-label="${t.pon} 3p with 3p 3p"`)
        expect(body).toContain(`aria-label="${t.chi} 3p with 2p 4p"`)
        expect(body).toContain(`aria-label="${t.chi} 3p with 4p 5p"`)
      })

      it('labels a daiminkan choice as kan — the seed-212 anchor', () => {
        setTerminology(terminology)
        const dealt212 = foldRecord({ seed: 212, actions: [] })
        const window212 = foldRecord({ seed: 212, actions: tsumogiriTurns(dealt212.live, 6) })
        const kanChoices = promptChoices(legalActions(window212), PLAYER)
        const { body } = render(ClaimPrompt, {
          props: { claimed: window212.claimable!.tile, choices: kanChoices },
        })
        expect(body).toContain(`aria-label="${t.kan} 8s with 8s 8s 8s"`)
      })
    })

    describe('win prompt', () => {
      it('labels the tsumo button — the seed-542630 tsumo point', () => {
        setTerminology(terminology)
        const dealtT = foldRecord({ seed: 542630, actions: [] })
        const point = foldRecord({
          seed: 542630,
          actions: [...tsumogiriTurns(dealtT.live, 32), { type: 'draw', seat: 0 }],
        })
        const offered = legalActions(point)
        const { body } = render(ClaimPrompt, {
          props: {
            claimed: point.claimable?.tile ?? null,
            choices: promptChoices(offered, PLAYER),
            win: winChoice(offered, PLAYER),
            canPass: false,
          },
        })
        expect(body).toContain(`aria-label="${t.tsumo}"`)
      })

      it('labels the ron button — the seed-887141 shanpon window', () => {
        setTerminology(terminology)
        const dealtS = foldRecord({ seed: 887141, actions: [] })
        const window = foldRecord({ seed: 887141, actions: tsumogiriTurns(dealtS.live, 4) })
        const offered = legalActions(window)
        const { body } = render(ClaimPrompt, {
          props: {
            claimed: window.claimable!.tile,
            choices: promptChoices(offered, PLAYER),
            win: winChoice(offered, PLAYER),
            onpass: () => {},
          },
        })
        expect(body).toContain(`aria-label="${t.ron} 8m"`)
      })
    })

    describe('riichi prompt', () => {
      it('asks the question and labels both buttons — the seed-397 anchor', () => {
        setTerminology(terminology)
        const dealtR = foldRecord({ seed: 397, actions: [] })
        const riichiPoint = foldRecord({ seed: 397, actions: [{ type: 'draw', seat: 0 }] })
        const offered = legalActions(riichiPoint)
        const found = riichiPrompt(riichiPoint, offered, PLAYER)
        expect(found).not.toBeNull()
        const { body } = render(RiichiPrompt, { props: { tile: found!.tile } })
        expect(body).toContain(`you're ${t.tenpai}`)
        expect(body).toContain(`declare ${t.riichi}`)
        expect(body).toContain(`aria-label="${t.declareRiichi}"`)
        expect(body).toContain(`aria-label="${t.notYet}"`)
      })
    })

    describe('furiten badge', () => {
      it('names the sealed terms — the seed-3951 sealed window', () => {
        setTerminology(terminology)
        const RON_SEED = 3951
        const liveRon = foldRecord({ seed: RON_SEED, actions: [] }).live
        const sealed = foldRecord({ seed: RON_SEED, actions: tsumogiriTurns(liveRon, 2) })
        const seal = furitenSeal(sealed, 3)
        expect(seal).not.toBeNull()
        const { body } = render(Table, { props: { table: sealed, furitenTile: seal } })
        const badge = region(body, 'furiten', '</p>')
        expect(badge).toContain(t.furiten)
        expect(badge).toContain(t.ron)
        expect(badge).toContain(t.tsumo)
      })
    })

    describe('yakuless notice', () => {
      it('names tsumo/riichi in the notice sentence — the seed-20899 anchor', () => {
        setTerminology(terminology)
        const state = foldRecord({ seed: 20899, actions: [] })
        const { body } = render(Table, { props: { table: state, yakulessTenpai: true } })
        const notice = region(body, 'yakuless tenpai', '</p>')
        expect(notice).toContain(t.tsumo)
        expect(notice).toContain(t.riichi)
      })
    })

    describe('hand-end screens', () => {
      it('labels the tsumo-win headline, dora, and fu/han line — the seed-542630 win', () => {
        setTerminology(terminology)
        const dealtWin = foldRecord({ seed: 542630, actions: [] })
        const won = foldRecord({
          seed: 542630,
          actions: [
            ...tsumogiriTurns(dealtWin.live, 32),
            { type: 'draw', seat: 0 },
            { type: 'tsumo', seat: 0 },
          ],
        })
        const { body } = render(Table, { props: { table: won } })
        const breakdown = scoreBreakdownOf(won)
        expect(breakdown.kind).toBe('agari')
        if (breakdown.kind !== 'agari') throw new Error('unreachable')

        expect(body.replace(/\s+/g, ' ')).toContain(`${t.east} (you) wins by ${t.tsumo}`)
        expect(body).toContain(`aria-label="dora">${t.dora} ${breakdown.doraHan}<`)
        const points = region(body, 'points line', '</p>')
        expect(points).toContain(`${breakdown.fu}${t.fu}`)
        expect(points).toContain(`${breakdown.han}${t.han}`)
        const scores = region(body, 'scores', '</ul>')
        expect(scores).toContain(`${t.east}:`)
        expect(scores).toContain(`${t.south}:`)
        expect(scores).toContain(`${t.west}:`)
        expect(scores).toContain(`${t.north}:`)
      })

      it("names a bot ron winner by wind — the seed-3951 anchor", () => {
        setTerminology(terminology)
        const live3951 = foldRecord({ seed: 3951, actions: [] }).live
        const botWon = foldRecord({
          seed: 3951,
          actions: [...tsumogiriTurns(live3951, 1), { type: 'ron', seat: 3, tile: 72 }],
        })
        const { body } = render(Table, { props: { table: botWon } })
        expect(body.replace(/\s+/g, ' ')).toContain(
          `${t.north} wins by ${t.ron} from ${t.east}`,
        )
      })

      it('shows the ryuukyoku headline and tenpai/noten list — the wall-exhausted anchor', () => {
        setTerminology(terminology)
        const dealt = foldRecord({ seed: BOOT_SEED, actions: [] })
        const exhausted = foldRecord({ seed: BOOT_SEED, actions: tsumogiriTurns(dealt.live, 70) })
        const { body } = render(Table, { props: { table: exhausted } })
        const breakdown = scoreBreakdownOf(exhausted)
        expect(breakdown.kind).toBe('ryuukyoku')
        if (breakdown.kind !== 'ryuukyoku') throw new Error('unreachable')

        expect(body).toContain(t.ryuukyoku)
        const WINDS = [t.east, t.south, t.west, t.north]
        const tenpaiList = region(body, 'tenpai', '</ul>')
        for (const [seat, isTenpai] of breakdown.tenpai.entries()) {
          expect(tenpaiList).toContain(`${WINDS[seat]}: ${isTenpai ? t.tenpai : t.noten}`)
        }
      })

      it('labels the next-hand button', () => {
        setTerminology(terminology)
        const dealtWin = foldRecord({ seed: 542630, actions: [] })
        const won = foldRecord({
          seed: 542630,
          actions: [
            ...tsumogiriTurns(dealtWin.live, 32),
            { type: 'draw', seat: 0 },
            { type: 'tsumo', seat: 0 },
          ],
        })
        const { body } = render(Table, { props: { table: won, onnext: () => {} } })
        expect(body).toContain(t.nextHand)
      })
    })
  })
}
