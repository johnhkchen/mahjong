import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Lets `lang="ts"` in components typecheck via svelte-check as well as build via Vite.
  preprocess: vitePreprocess(),
}
