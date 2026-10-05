// The session's tokens and cost, pure: totals since the session started, and
// each agent's share of the cost the engine reports, split by price weight.
import type { ModelUsage } from 'claude-code'

import type { AgentRun, Ledger, Usage } from '../types'

export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export const LEDGER: Ledger = {
  startedAt: 0,
  turn: 0,
  session: { usage: NO_USAGE, weight: 0, agents: 0, tools: 0 },
  costUsd: null,
  contextPct: null,
}

/** One request's usage as the API reports it. */
export function usageOf(usage: ModelUsage): Usage {
  return {
    input: usage.input_tokens,
    output: usage.output_tokens,
    cacheRead: usage.cache_read_input_tokens,
    cacheWrite: usage.cache_creation_input_tokens,
  }
}

export function added(a: Usage, b: Usage): Usage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
  }
}

/** `↑`: input that is new, fresh or written to the cache; cache reads are not. */
export const upTokens = (usage: Usage) => usage.input + usage.cacheWrite

export const turnBegan = (ledger: Ledger): Ledger => ({ ...ledger, turn: ledger.turn + 1 })

export const billed = (ledger: Ledger, usage: Usage, weight: number): Ledger => ({
  ...ledger,
  session: { ...ledger.session, usage: added(ledger.session.usage, usage), weight: ledger.session.weight + weight },
})

export const agentCounted = (ledger: Ledger): Ledger => ({
  ...ledger,
  session: { ...ledger.session, agents: ledger.session.agents + 1 },
})

export const toolCounted = (ledger: Ledger): Ledger => ({
  ...ledger,
  session: { ...ledger.session, tools: ledger.session.tools + 1 },
})

export const measured = (ledger: Ledger, contextPct: number | null, costUsd: number | null): Ledger => ({
  ...ledger,
  contextPct: contextPct ?? ledger.contextPct,
  costUsd: costUsd ?? ledger.costUsd,
})

/**
 * Cents per agent id: its weight over the session's, times the session cost.
 * Agents gone from the list keep their share as a remainder, so the cents
 * add up to the session cost; rounding gives the largest remainders the
 * spare cents. Null when the engine reports no cost.
 */
export function shares(agents: AgentRun[], ledger: Ledger): Record<string, number> | null {
  if (ledger.costUsd === null) return null
  const total = Math.round(ledger.costUsd * 100)
  const listed = agents.reduce((sum, one) => sum + one.weight, 0)
  const weights = [...agents.map(one => one.weight), Math.max(0, ledger.session.weight - listed)]
  const all = weights.reduce((sum, weight) => sum + weight, 0)
  if (all === 0) return Object.fromEntries(agents.map(one => [one.id, 0]))
  const exact = weights.map(weight => (weight / all) * total)
  const cents = exact.map(Math.floor)
  const spare = total - cents.reduce((sum, one) => sum + one, 0)
  const byRemainder = exact.map((value, at) => ({ at, left: value - Math.floor(value) })).sort((a, b) => b.left - a.left)
  for (const { at } of byRemainder.slice(0, spare)) cents[at] = (cents[at] ?? 0) + 1

  return Object.fromEntries(agents.map((one, at) => [one.id, cents[at] ?? 0]))
}

export type TurnTotals = { usage: Usage; agents: number; cents: number | null }

/** The current turn: agents spawned in it, background ones still running included. */
export function turnTotals(agents: AgentRun[], ledger: Ledger, cents: Record<string, number> | null): TurnTotals {
  const turn = agents.filter(one => one.turn === ledger.turn)

  return {
    usage: turn.reduce((sum, one) => added(sum, one.usage), NO_USAGE),
    agents: turn.filter(one => one.parentId !== null).length,
    cents: cents === null ? null : turn.reduce((sum, one) => sum + (cents[one.id] ?? 0), 0),
  }
}

/** Percent of input the prompt cache served; null before any input. */
export function hitRate(usage: Usage): number | null {
  const input = usage.input + usage.cacheRead + usage.cacheWrite

  return input === 0 ? null : Math.round((usage.cacheRead / input) * 100)
}
