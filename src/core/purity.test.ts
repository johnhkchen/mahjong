// The boundary gate: src/core/ is the pure engine — no app, DOM, framework, or platform
// imports, ever (CLAUDE.md invariant; AC of T-001-03-01). This test makes the invariant
// executable: every runtime module in core may import only same-directory siblings
// ('./x'), which forbids bare packages and '../' escapes (../app specifically) in one
// rule. Test files may additionally import their tooling, from an explicit allowlist.
// Sources are read via import.meta.glob raw imports — the vite pipeline vitest already
// runs on — so the gate itself needs nothing beyond vitest.

import { describe, expect, it } from 'vitest'

/** Every core source file, path → raw source text, resolved at transform time. */
const sources: Record<string, string> = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Bare imports test files may use; runtime modules get no allowlist at all. */
const TEST_ONLY_ALLOWED = /^(vitest|fast-check|node:)/

// Matches the specifier of static import/export-from declarations, bare side-effect
// imports, and dynamic imports. It scans raw source, so it also fires on quoted
// specifiers inside comments — a deliberate fail-loud bias: a commented example reading
// like a forbidden import fails the gate rather than a clever comment sneaking one past.
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g

function specifiersOf(source: string): string[] {
  return [...source.matchAll(SPECIFIER_RE)].map((m) => m[1])
}

const files = Object.keys(sources)

describe('core import purity', () => {
  it('scans the real core directory (guard against a silently-empty scan)', () => {
    expect(files).toContain('./index.ts')
    expect(files).toContain('./tiles.ts')
    expect(files).toContain('./rng.ts')
    expect(files).toContain('./wall.ts')
  })

  it('runtime modules import only same-directory core siblings', () => {
    for (const file of files.filter((f) => !f.endsWith('.test.ts'))) {
      for (const spec of specifiersOf(sources[file])) {
        expect(spec, `${file} imports '${spec}'`).toMatch(/^\.\//)
      }
    }
  })

  it('test files import only same-directory siblings and allowlisted tooling', () => {
    for (const file of files.filter((f) => f.endsWith('.test.ts'))) {
      for (const spec of specifiersOf(sources[file])) {
        const ok = /^\.\//.test(spec) || TEST_ONLY_ALLOWED.test(spec)
        expect(ok, `${file} imports '${spec}'`).toBe(true)
      }
    }
  })
})
