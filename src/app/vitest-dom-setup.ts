// Vitest's jsdom environment refuses to copy jsdom's own `localStorage` getter onto
// the global scope whenever `globalThis` already has an own `localStorage` property —
// and Node 20+ ships exactly that: a built-in `localStorage` accessor that resolves to
// `undefined` (and emits an ExperimentalWarning on every touch, even a bare `typeof`)
// unless the process is started with `--experimental-webstorage
// --localstorage-file=...`. The net effect, discovered while implementing T-010-01-02:
// `window.localStorage` in this repo's `dom` Vitest project is Node's broken global,
// not jsdom's real Storage — nothing in `src/` or `vite.config.ts` caused this; it is
// a Node-version/vitest-version interaction, irrelevant to any real browser. This
// setup file (wired into the `dom` project only, vite.config.ts) replaces the broken
// global with a small spec-shaped in-memory Storage so tests exercise working
// persistence, the same as an actual browser's `localStorage`.
class MemoryStorage implements Storage {
  #data = new Map<string, string>()

  get length(): number {
    return this.#data.size
  }

  clear(): void {
    this.#data.clear()
  }

  getItem(key: string): string | null {
    return this.#data.has(key) ? this.#data.get(key)! : null
  }

  key(index: number): string | null {
    return [...this.#data.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#data.set(key, String(value))
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})
