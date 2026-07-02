# mahjong — every recipe runs through the pinned flox toolchain (node + npm + just).
# Canonical commands live in package.json scripts; this file is the flox entry point
# and the fresh-clone bootstrap.

[private]
default:
    @just --list

# local Vite dev server
dev: _deps
    flox activate -- npm run dev

# vitest over src/ (property tests, scoring tables, app SSR)
test: _deps
    flox activate -- npm run test

# svelte-check + tsc
check: _deps
    flox activate -- npm run check

# vite build → single self-contained dist/index.html
build: _deps
    flox activate -- npm run build

# ship the one file to Cloudflare static (mahjong.b28.dev) — requires CF auth
deploy: build
    flox activate -- npm run deploy

# validate the deploy (wrangler dry-run) — no auth, no network account state
deploy-check: build
    flox activate -- npm run deploy:check

# install exact locked deps iff node_modules is missing or older than the lockfile
[private]
_deps:
    @[ node_modules/.package-lock.json -nt package-lock.json ] || flox activate -- npm ci
