/*
 * Credentials for everything that logs in to the real site from Node — the
 * local scripts and the live tests.
 *
 * Read from `.env`, which is gitignored and must stay that way — it holds a
 * real account password. Nothing here ever prints a value, and neither should
 * anything that calls it.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repo = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

/** Minimal `KEY=value` parser — avoids a dependency for a few lines of config. */
function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/**
 * The `.env` prefix of an account: `<prefix>_USERNAME` / `<prefix>_PASSWORD`.
 *
 * Two, because the live tests want a throwaway account and the local scripts
 * usually want the one whose list and settings matter.
 */
export type Account = 'AMQ_ACCOUNT' | 'AMQ_TEST_ACCOUNT'

export interface Credentials {
  username: string
  password: string
  /** Which account these belong to — safe to print, unlike the values. */
  account: Account
}

/**
 * The first of `accounts` that `.env` (or the environment) has filled in.
 *
 * The default prefers the real account and falls back to the test one. A
 * caller that must never touch the real one — the live tests, which can write
 * — passes `['AMQ_TEST_ACCOUNT']`.
 */
export function credentials(
  accounts: Account[] = ['AMQ_ACCOUNT', 'AMQ_TEST_ACCOUNT']
): Credentials {
  const file = readEnvFile(path.join(repo, '.env'))
  const read = (key: string) => process.env[key] ?? file[key]

  for (const account of accounts) {
    const username = read(`${account}_USERNAME`)
    const password = read(`${account}_PASSWORD`)
    if (username && password) return { username, password, account }
  }

  throw new Error(
    'Missing credentials. Copy .env.example to .env and fill in ' +
      accounts
        .map((account) => `${account}_USERNAME and ${account}_PASSWORD`)
        .join(', or ') +
      '.'
  )
}
