// svelte-check and eslint-plugin-svelte read preprocessors from this file,
// not from the vite config.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
}
