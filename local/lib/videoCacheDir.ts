import os from 'node:os'
import path from 'node:path'
import { envValue } from '@shared/node/env'

/** `AMQ_VIDEO_CACHE_DIR` from the environment or `.env`, else `~/amq-cache`. */
export function videoCacheDir(): string {
  const dir = envValue('AMQ_VIDEO_CACHE_DIR') || '~/amq-cache'
  return dir.startsWith('~/') ? path.join(os.homedir(), dir.slice(2)) : dir
}
