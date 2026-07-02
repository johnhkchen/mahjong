# Vend — Cleared demand (compacted ledger)

Signals pulled, cleared, and verified — moved off the live board (`docs/active/demand.md`)
to keep it lean. One line per epic: what it delivered. Full cards live in
`docs/active/epic/`; full proofs in `docs/active/work/<ticket>/`.

---

- **E-001 walking-skeleton** (foundation signal, pre-seeded) — delivered the full delivery
  spine: pinned flox toolchain (node 24.16.0, just 1.54.0), Vite + Svelte 5 + vitest +
  singlefile scaffold with justfile recipes, pure `src/core/` tile domain (34 kinds / 136 ids)
  + seeded RNG (mulberry32) + wall build under the project's first property tests (26 tests),
  empty-table view derived from a seeded wall, and a self-contained offline `dist/index.html`
  (37KB, zero external refs) with a validated `just deploy` recipe. 6/6 tickets done.
