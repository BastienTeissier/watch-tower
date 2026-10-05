// Agents of the turn, pure: the main thread and its subagents as a tree, each
// with what it was last seen doing (after agent-radar, github.com/hamzafer/claude-code-mods).
import type { AgentRun, Usage } from '../types'
import { NO_USAGE, added } from './ledger'

export const MAIN = 'main'
/** How many recent actions an agent keeps. */
const ACTIONS = 5

/** The main thread's run for prompt number `turn`; its model is learnt from its first request. */
export function mainRun(prompt: string, turn: number, now: number): AgentRun {
  return {
    id: MAIN,
    parentId: null,
    description: '',
    type: MAIN,
    model: '',
    prompt,
    isBackground: false,
    status: 'running',
    startedAt: now,
    endedAt: null,
    tools: 0,
    actions: [],
    turn,
    usage: NO_USAGE,
    weight: 0,
  }
}

/** A new prompt: finished agents and the old main run leave, running background agents stay. */
export function nextTurn(list: AgentRun[]): AgentRun[] {
  return list.filter(one => one.id !== MAIN && one.status === 'running')
}

export function spawned(list: AgentRun[], run: AgentRun): AgentRun[] {
  return [...list.filter(one => one.id !== run.id), run]
}

export function saw(list: AgentRun[], id: string, action: string): AgentRun[] {
  return list.map(one =>
    one.id === id ? { ...one, tools: one.tools + 1, actions: [...one.actions, action].slice(-ACTIONS) } : one,
  )
}

/** The model an agent's request ran on; the same list when it is already known. */
export function modelSeen(list: AgentRun[], id: string, model: string): AgentRun[] {
  if (!list.some(one => one.id === id && one.model !== model)) return list

  return list.map(one => (one.id === id ? { ...one, model } : one))
}

/** One request's usage and price weight, added to the agent that made it. */
export function charged(list: AgentRun[], id: string, usage: Usage, weight: number): AgentRun[] {
  return list.map(one => (one.id === id ? { ...one, usage: added(one.usage, usage), weight: one.weight + weight } : one))
}

/**
 * The agent and, when it failed, its running foreground descendants: the
 * engine may not report the end of a subagent whose parent was interrupted.
 */
export function ended(list: AgentRun[], id: string, isFailed: boolean, now: number, reason: string): AgentRun[] {
  const gone = new Set([id])
  for (let grew = isFailed; grew; ) {
    grew = false
    for (const one of list) {
      const isTakenDown = one.status === 'running' && !one.isBackground && one.parentId !== null && gone.has(one.parentId)
      if (isTakenDown && !gone.has(one.id)) {
        gone.add(one.id)
        grew = true
      }
    }
  }

  return list.map(one =>
    gone.has(one.id)
      ? {
          ...one,
          status: isFailed ? 'failed' : 'done',
          endedAt: now,
          actions: isFailed ? [...one.actions, `stopped: ${reason}`].slice(-ACTIONS) : one.actions,
        }
      : one,
  )
}

/**
 * Depth-first from `main`, children in spawn order. An agent whose parent has
 * left the list (a background agent of an earlier turn) hangs under `main`.
 */
export function tree(list: AgentRun[]): { run: AgentRun; depth: number }[] {
  const ids = new Set(list.map(one => one.id))
  const parentOf = (one: AgentRun) =>
    one.id === MAIN ? null : one.parentId !== null && ids.has(one.parentId) ? one.parentId : MAIN
  const walk = (parent: string | null, depth: number): { run: AgentRun; depth: number }[] =>
    list
      .filter(one => parentOf(one) === parent)
      .flatMap(run => [{ run, depth }, ...walk(run.id, depth + 1)])
  const rooted = walk(null, 0)

  // Without a main run (before the first prompt), subagents are the roots.
  return ids.has(MAIN) ? rooted : walk(MAIN, 0)
}

/** `main`, the type alone when the spawn gave no description, else `type: description`. */
export function label(run: AgentRun): string {
  if (run.id === MAIN) return MAIN

  return run.description === '' ? run.type : `${run.type}: ${run.description}`
}

/** What the agent is doing now: its latest action. */
export function currentAction(run: AgentRun): string {
  return run.actions[run.actions.length - 1] ?? 'starting'
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
