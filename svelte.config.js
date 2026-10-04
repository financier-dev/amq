// svelte-check and eslint-plugin-svelte resolve preprocessors from here rather
// than from the vite config.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
}
