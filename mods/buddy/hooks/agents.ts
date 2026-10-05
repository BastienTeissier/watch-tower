// Subagents, pure: one line per agent with what it was last seen doing
// (after agent-radar, github.com/hamzafer/claude-code-mods).
import type { AgentRun } from '../types'

/** A finished agent stays listed this long. */
export const SHOW_DONE_MS = 30_000
const KEEP = 30

export function spawned(list: AgentRun[], run: AgentRun): AgentRun[] {
  return [run, ...list.filter(one => one.id !== run.id)].slice(0, KEEP)
}

export function saw(list: AgentRun[], id: string, last: string): AgentRun[] {
  return list.map(one => (one.id === id ? { ...one, tools: one.tools + 1, last } : one))
}

export function ended(list: AgentRun[], id: string, isFailed: boolean, now: number, reason: string): AgentRun[] {
  return list.map(one =>
    one.id === id
      ? { ...one, status: isFailed ? 'failed' : 'done', endedAt: now, last: isFailed ? `stopped: ${reason}` : 'finished' }
      : one,
  )
}

/** Running, or finished less than SHOW_DONE_MS ago. */
export function isShown(run: AgentRun, now: number): boolean {
  return run.status === 'running' || (run.endedAt !== null && now - run.endedAt < SHOW_DONE_MS)
}

export function icon(run: AgentRun): string {
  return run.status === 'running' ? '●' : run.status === 'done' ? '✓' : '✗'
}

export function agentColor(run: AgentRun): string {
  return run.status === 'running' ? '#f0dc3c' : run.status === 'done' ? '#50ff78' : '#ff3232'
}

/** A short label for one tool call: what a person would say the agent is doing. */
export function describe(input: Record<string, unknown>): string {
  const tool = String(input.tool)
  const text = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : '')
  const file = (path: string) => path.split('/').slice(-2).join('/')

  if (tool === 'Bash') return `running ${text('description') || text('command').slice(0, 50)}`
  if (tool === 'Edit' || tool === 'Write') return `editing ${file(text('file_path'))}`
  if (tool === 'Read') return `reading ${file(text('file_path'))}`
  if (tool === 'Grep' || tool === 'Glob') return `searching ${text('pattern').slice(0, 30)}`
  if (tool.startsWith('mcp__')) return `using ${tool.split('__').slice(1).join(' ')}`

  return `using ${tool}`
}
