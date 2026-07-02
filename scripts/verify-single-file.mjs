// @ts-check
// Post-build gate for the single-file compile target (CLAUDE.md invariant: the app
// ships as one self-contained offline dist/index.html). Runs at the end of
// `npm run build`; any rule failure exits 1 and names the rule, so `just build`
// itself fails the moment the artifact stops being self-contained.
//
// Rule boundaries are deliberately stricter than "no external references": even a
// relative src=/href= breaks file:// boot of a lone file, so ANY reference attribute
// fails. A future ticket that legitimately needs one (e.g. the PWA manifest link)
// loosens the rule there, with its own reasoning.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const distDir = resolve(import.meta.dirname, '..', 'dist')

/** @param {string} rule @param {string} detail */
function fail(rule, detail) {
  console.error(`verify-single-file: FAIL [${rule}] ${detail}`)
  process.exit(1)
}

let entries
try {
  entries = readdirSync(distDir)
} catch {
  fail('one-file', `dist/ does not exist — run vite build first (${distDir})`)
}
if (entries.length !== 1 || entries[0] !== 'index.html') {
  fail('one-file', `dist/ must hold exactly [index.html], found [${entries.join(', ')}]`)
}

const htmlPath = resolve(distDir, 'index.html')
const html = readFileSync(htmlPath, 'utf8')

if (html.length <= 10_000) {
  fail('non-trivial', `index.html is ${html.length} bytes — too small to be a real build`)
}

if (!/^<!doctype html>/i.test(html.trimStart())) {
  fail('sanity-anchors', 'missing leading <!doctype html>')
}
if (!html.includes('id="app"')) {
  fail('sanity-anchors', 'missing <div id="app"> mount point')
}

const reference = html.match(/\b(?:src|href)\s*=\s*["'][^"']*["']/)
if (reference) {
  fail('no-references', `found reference attribute: ${reference[0].slice(0, 120)}`)
}

const cssFetch = html.match(/url\(\s*["']?https?:[^)]{0,100}/)
if (cssFetch) {
  fail('no-css-fetch', `found remote url() in CSS: ${cssFetch[0]}`)
}

const bytes = statSync(htmlPath).size
console.log(`verify-single-file: OK — dist/index.html is self-contained (${bytes} bytes)`)
