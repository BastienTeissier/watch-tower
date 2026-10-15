// Prompt cache countdown, pure (after token-weather, github.com/hamzafer/claude-code-mods):
// the cache stays warm for its lifetime after the main thread's last request.
import type { Cache, CacheTtl, Warm } from '../types'

export const TTL_MS: Record<CacheTtl, number> = { '5m': 5 * 60_000, '1h': 60 * 60_000 }
const WARN_BELOW_MS = 60_000

export const COLD: Cache = { lastRequestAt: null, ttl: null }
export const WARM_OFF: Warm = { isOn: false, isPinging: false }
/** What a keep-warm ping says to the model. */
export const KEEP_WARM_TEXT = 'No action required, message only to keep cache warm'

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

/** How long the cache stays warm from `now`; null before any request. */
function msLeft(cache: Cache, override: CacheTtl | null, now: number): number | null {
  return cache.lastRequestAt === null ? null : cache.lastRequestAt + TTL_MS[override ?? cache.ttl ?? '5m'] - now
}

/** What the cache row says at `now`; null before any request. */
export function cachePart(cache: Cache, override: CacheTtl | null, now: number): CachePart | null {
  const left = msLeft(cache, override, now)
  if (left === null) return null
  if (left <= 0) return { text: '❄ cache cold', color: '#ff3232', isCold: true }
  const secs = Math.ceil(left / 1000)
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  return { text: `❄ cache ${clock}`, color: left < WARN_BELOW_MS ? '#f0dc3c' : undefined, isCold: false }
}

/**
 * One look at keep warm: it turns itself off once the cache is cold, and pings
 * when under a minute is left, nothing runs and no ping waits for its turn.
 */
export function warmStep(warm: Warm, cache: Cache, override: CacheTtl | null, now: number, isBusy: boolean): { warm: Warm; shouldPing: boolean } {
  const left = msLeft(cache, override, now)
  if (!warm.isOn) return { warm, shouldPing: false }
  if (left === null || left <= 0) return { warm: { ...warm, isOn: false }, shouldPing: false }
  const shouldPing = left < WARN_BELOW_MS && !isBusy && !warm.isPinging

  return { warm: shouldPing ? { ...warm, isPinging: true } : warm, shouldPing }
}
