/*
 * Reads a Discord channel through Discord's HTTP API. Sends one request at a
 * time and waits whenever Discord's rate limit asks for it.
 *
 * The token gives full access to its account. Never print it.
 */

const API = 'https://discord.com/api/v10'
const PAGE_SIZE = 100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface DiscordChannel {
  id: string
  name: string
  guild_id?: string
}

/** A message as Discord's API gives it. Only the fields used here are typed. */
export interface DiscordMessage {
  id: string
  timestamp: string
  [field: string]: unknown
}

/** Discord refused the token as a user token and as a bot token. */
export class DiscordAuthError extends Error {
  constructor() {
    super('Discord refused the token (HTTP 401).')
  }
}

export class DiscordClient {
  /** A bot token needs the "Bot " prefix and a user token does not. */
  private prefix = ''

  constructor(private readonly token: string) {}

  private async get<T>(path: string): Promise<T> {
    for (;;) {
      const res = await fetch(API + path, {
        headers: { Authorization: this.prefix + this.token },
      })
      if (res.status === 401 && this.prefix === '') {
        this.prefix = 'Bot '
        continue
      }
      if (res.status === 401) throw new DiscordAuthError()
      if (res.status === 429) {
        const body = (await res.json()) as { retry_after?: number }
        await sleep((body.retry_after ?? 1) * 1000 + 250)
        continue
      }
      if (!res.ok) {
        throw new Error(
          `Discord ${path}: HTTP ${res.status} ${await res.text()}`
        )
      }
      const remaining = Number(res.headers.get('x-ratelimit-remaining'))
      const resetAfter = Number(res.headers.get('x-ratelimit-reset-after'))
      if (remaining === 0 && resetAfter) await sleep(resetAfter * 1000 + 100)
      return (await res.json()) as T
    }
  }

  channel(channelId: string): Promise<DiscordChannel> {
    return this.get(`/channels/${channelId}`)
  }

  /**
   * Every message posted after the message `afterId`, oldest first. Without
   * `afterId`, the whole channel. `onPage` gets the count so far.
   */
  async messagesAfter(
    channelId: string,
    afterId = '0',
    onPage?: (count: number) => void
  ): Promise<DiscordMessage[]> {
    const messages: DiscordMessage[] = []
    let after = afterId
    for (;;) {
      // With `after`, Discord gives the oldest messages after it, newest first.
      const page = await this.get<DiscordMessage[]>(
        `/channels/${channelId}/messages?limit=${PAGE_SIZE}&after=${after}`
      )
      if (page.length === 0) break
      page.sort((a, b) => compareIds(a.id, b.id))
      messages.push(...page)
      after = page[page.length - 1].id
      onPage?.(messages.length)
      if (page.length < PAGE_SIZE) break
    }
    return messages
  }
}

/** Orders Discord IDs, which are too large for a JavaScript number. */
export function compareIds(a: string, b: string): number {
  const x = BigInt(a)
  const y = BigInt(b)
  return x < y ? -1 : x > y ? 1 : 0
}
