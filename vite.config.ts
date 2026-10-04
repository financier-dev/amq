/**
 * Dev server only — `npm run build` goes through `build/build.ts`, which builds
 * every target. Both get their config from `build/config.ts`.
 *
 * The dev server serves one userscript at a time, so pick which:
 *
 *   npm run dev                    # the default target
 *   AMQ_TARGET=amq-ui npm run dev
 */

import { defineConfig } from 'vite'

import { configFor } from './build/config'
import { findTarget } from './build/targets'

export default defineConfig(() => configFor(findTarget(process.env.AMQ_TARGET)))
