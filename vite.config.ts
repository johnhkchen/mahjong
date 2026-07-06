/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The build's own identity, stamped into bug reports (E-013): the git short SHA at
// build time, or 'dev' outside a repo/CI oddity. A report from a stale tab is then
// self-identifying — the second owner report (2026-07-05) was undiagnosable between
// "bug survived the fix" and "tab predates the fix" without this.
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.svelte.test.ts'],
        },
      },
      {
        // The client-mount suites (jsdom) need Svelte's browser build; the
        // node project must keep the server build for svelte/server renders.
        extends: true,
        resolve: { conditions: ['browser'] },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.svelte.test.ts'],
          // Node's own built-in `localStorage` global shadows jsdom's real one in
          // this environment/version combination — see the file's own comment.
          setupFiles: ['./src/app/vitest-dom-setup.ts'],
        },
      },
    ],
  },
})
