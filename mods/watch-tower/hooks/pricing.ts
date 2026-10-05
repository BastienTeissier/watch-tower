// Per-model list prices, pure: only their ratios matter, as each agent's cost is
// its weighted share of the session cost the engine reports. Edit when prices move
// (platform.claude.com/docs/en/about-claude/pricing, read 2026-10-05).
import type { Usage } from '../types'

/** USD per million tokens. A cache write costs 1.25× input (5-minute lifetime). */
type Rate = { input: number; output: number; cacheRead: number }

/** By model id without `claude-`, most specific prefix first. */
const RATES: [prefix: string, rate: Rate][] = [
  ['fable-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['fable', { input: 10, output: 50, cacheRead: 1 }],
  ['opus-5-5', { input: 4, output: 20, cacheRead: 0.2 }],
  ['opus', { input: 5, output: 25, cacheRead: 0.5 }],
  ['sonnet-5', { input: 2, output: 10, cacheRead: 0.2 }],
  ['sonnet', { input: 3, output: 15, cacheRead: 0.3 }],
  ['haiku', { input: 1, output: 5, cacheRead: 0.1 }],
]
// A 1-hour write costs 2× input; weighing all writes at 1.25× slightly under-weights
// agents on a 1h cache, but the shares still add up to the engine's cost.
const CACHE_WRITE = 1.25

/** An unknown model is priced at the most expensive known rates, so it is never under-reported. */
const MAX: Rate = {
  input: Math.max(...RATES.map(([, rate]) => rate.input)),
  output: Math.max(...RATES.map(([, rate]) => rate.output)),
  cacheRead: Math.max(...RATES.map(([, rate]) => rate.cacheRead)),
}

export function rateOf(model: string): Rate {
  const id = model.replace(/^claude-/, '')

  return RATES.find(([prefix]) => id.startsWith(prefix))?.[1] ?? MAX
}

/** The usage's list price in USD: a weight to split the session cost by. */
export function weightOf(model: string, usage: Usage): number {
  const rate = rateOf(model)

  return (
    (usage.input * rate.input +
      usage.cacheWrite * rate.input * CACHE_WRITE +
      usage.cacheRead * rate.cacheRead +
      usage.output * rate.output) /
    1_000_000
  )
}
