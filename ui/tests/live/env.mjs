/*
 * Credentials for the live-site tests.
 *
 * Read from `.env`, which is gitignored and must stay that way — it holds a
 * real account password. Nothing here ever prints a value, and neither should
 * anything that calls it: a failing assertion should say "login failed", not
 * echo what it tried.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)

/** Minimal `KEY=value` parser — avoids a dependency for two lines of config. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
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

export function credentials() {
  const file = readEnvFile(path.join(repo, '.env'))
  const username =
    process.env.AMQ_TEST_ACCOUNT_USERNAME ?? file.AMQ_TEST_ACCOUNT_USERNAME
  const password =
    process.env.AMQ_TEST_ACCOUNT_PASSWORD ?? file.AMQ_TEST_ACCOUNT_PASSWORD

  if (!username || !password) {
    throw new Error(
      'Missing credentials. Copy .env.example to .env and fill in ' +
        'AMQ_TEST_ACCOUNT_USERNAME and AMQ_TEST_ACCOUNT_PASSWORD.'
    )
  }
  return { username, password }
}

/**
 * Whether the run may change anything on the account.
 *
 * Off unless asked for, and deliberately awkward to turn on. Everything these
 * tests need — the library payload, the serializer round-trip against real
 * quizzes — is answerable without a single write, and a quiz saved by a test
 * is a quiz the account owner then has to clean up.
 */
export const allowWrites = process.env.AMQ_LIVE_ALLOW_WRITES === '1'

export { repo }
