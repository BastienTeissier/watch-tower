// Session vitals, pure: what the pane shows of the working session beside the plan.
import type { Vitals } from '../types'

export const VITALS: Vitals = {
  turnStartedAt: null,
  lastTurnMs: 0,
  tools: 0,
  contextPct: null,
  costUsd: null,
}

export const turnStarted = (vitals: Vitals, now: number): Vitals => ({ ...vitals, turnStartedAt: now })

export const turnEnded = (vitals: Vitals, now: number): Vitals => ({
  ...vitals,
  turnStartedAt: null,
  lastTurnMs: vitals.turnStartedAt === null ? vitals.lastTurnMs : now - vitals.turnStartedAt,
})

export const toolRan = (vitals: Vitals): Vitals => ({ ...vitals, tools: vitals.tools + 1 })

export const measured = (vitals: Vitals, contextPct: number | null, costUsd: number | null): Vitals => ({
  ...vitals,
  contextPct: contextPct ?? vitals.contextPct,
  costUsd: costUsd ?? vitals.costUsd,
})

/** The running turn's time at `now`, else the last turn's. */
export function turnMs(vitals: Vitals, now: number): number {
  return vitals.turnStartedAt === null ? vitals.lastTurnMs : Math.max(0, now - vitals.turnStartedAt)
}

export function elapsed(ms: number): string {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s`

  return `${Math.floor(secs / 3600)}h${Math.floor((secs % 3600) / 60)}m`
}

export function vitalsLine(vitals: Vitals, now: number): string {
  return [
    vitals.contextPct === null ? null : `ctx ${vitals.contextPct}%`,
    vitals.costUsd === null ? null : `$${vitals.costUsd.toFixed(2)}`,
    `turn ${elapsed(turnMs(vitals, now))}`,
    `tools ${vitals.tools}`,
  ]
    .filter(part => part !== null)
    .join('  ')
}
