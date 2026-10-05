// Prompt cache countdown, pure (after token-weather, github.com/hamzafer/claude-code-mods):
// the cache stays warm for its lifetime after the main thread's last request.
import type { Cache, CacheTtl } from '../types'

export const TTL_MS: Record<CacheTtl, number> = { '5m': 5 * 60_000, '1h': 60 * 60_000 }
const WARN_BELOW_MS = 60_000

export const COLD: Cache = { lastRequestAt: null, ttl: null }

export function asTtl(value: unknown): CacheTtl | null {
  return value === '5m' || value === '1h' ? value : null
}

/**
 * The lifetime the latest main-thread response wrote to the cache with, from the
 * transcript's tail; null when it wrote nothing (a pure hit) or none was found.
 */
export function ttlFromTranscript(text: string): CacheTtl | null {
  const lines = text.split('\n')

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let entry: any
    try {
      entry = JSON.parse(lines[i] ?? '')
    } catch {
      continue
    }
    if (entry?.type !== 'assistant' || entry.isSidechain || !entry.message?.usage) continue
    const written = entry.message.usage.cache_creation
    if (Number(written?.ephemeral_1h_input_tokens) > 0) return '1h'
    if (Number(written?.ephemeral_5m_input_tokens) > 0) return '5m'

    return null
  }

  return null
}

export type CachePart = { text: string; color: string | undefined; isCold: boolean }

/** What the cache row says at `now`; null before any request. */
export function cachePart(cache: Cache, override: CacheTtl | null, now: number): CachePart | null {
  if (cache.lastRequestAt === null) return null
  const left = cache.lastRequestAt + TTL_MS[override ?? cache.ttl ?? '5m'] - now
  if (left <= 0) return { text: '❄ cache cold', color: '#ff3232', isCold: true }
  const secs = Math.ceil(left / 1000)
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  return { text: `❄ cache ${clock}`, color: left < WARN_BELOW_MS ? '#f0dc3c' : undefined, isCold: false }
}
