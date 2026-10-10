/*
 * Credentials for the Node code that logs in to the real site: the local
 * scripts and the live tests.
 *
 * They come from `.env`, which holds a real account password and must stay
 * gitignored. Never print a value, here or in a caller.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repo = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

/** Minimal `KEY=value` parser, so `.env` needs no dependency. */
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
 * The `.env` prefix of an account: `<prefix>_USERNAME` and
 * `<prefix>_PASSWORD`. The live tests use a throwaway account. The local
 * scripts usually need the account whose list and settings matter.
 */
export type Account = 'AMQ_ACCOUNT' | 'AMQ_TEST_ACCOUNT'

export interface Credentials {
  username: string
  password: string
  /** The account these belong to. Safe to print; the values are not. */
  account: Account
}

/**
 * Returns the first of `accounts` that `.env` or the environment fills in.
 *
 * The default prefers the real account and falls back to the test account.
 * The live tests can write, so they pass `['AMQ_TEST_ACCOUNT']` and never use
 * the real account.
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
