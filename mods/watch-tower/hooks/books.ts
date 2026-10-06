// The session's books, pure: its agents and its ledger, moved together by
// each session event so they never disagree. The ledger counts every request,
// tool and agent of the session; an agent holds its own share of them, and
// whatever its agents spent is never more than the session's.
import type { AgentRun, Books, Usage } from '../types'
import { ACTIONS, MAIN, ended as endedRuns, mainRun } from './agents'
import { LEDGER, added } from './ledger'

export const BOOKS: Books = { agents: [], ledger: LEDGER }

/** What a spawn names; the rest of the run starts empty. */
export type Spawn = Pick<AgentRun, 'id' | 'parentId' | 'description' | 'type' | 'model' | 'prompt' | 'isBackground'>

const each = (books: Books, id: string, change: (run: AgentRun) => AgentRun): AgentRun[] =>
  books.agents.map(one => (one.id === id ? change(one) : one))

/** The session's clock starts at its first start; a reload keeps it. */
export function opened(books: Books, now: number): Books {
  return books.ledger.startedAt === 0 ? { ...books, ledger: { ...books.ledger, startedAt: now } } : books
}

/** A new prompt: a new turn and a new main run; finished agents leave, running background agents stay. */
export function prompted(books: Books, text: string, now: number): Books {
  const turn = books.ledger.turn + 1
  const kept = books.agents.filter(one => one.id !== MAIN && one.status === 'running')

  return { agents: [mainRun(text, turn, now), ...kept], ledger: { ...books.ledger, turn } }
}

/** A subagent spawned in this turn; spawned again under the same id, it starts over but counts once. */
export function spawned(books: Books, spawn: Spawn, now: number): Books {
  const isNew = !books.agents.some(one => one.id === spawn.id)
  const run = { ...mainRun(spawn.prompt, books.ledger.turn, now), ...spawn }
  const { session } = books.ledger

  return {
    agents: [...books.agents.filter(one => one.id !== spawn.id), run],
    ledger: isNew ? { ...books.ledger, session: { ...session, agents: session.agents + 1 } } : books.ledger,
  }
}

/** One model request of agent `id`: the session pays it, and so does the agent when it is listed. */
export function requested(books: Books, id: string, model: string, usage: Usage, weight: number): Books {
  const { session } = books.ledger

  return {
    agents: each(books, id, one => ({ ...one, model, usage: added(one.usage, usage), weight: one.weight + weight })),
    ledger: { ...books.ledger, session: { ...session, usage: added(session.usage, usage), weight: session.weight + weight } },
  }
}

/** One tool call of agent `id`, `action` saying what it does. */
export function toolUsed(books: Books, id: string, action: string): Books {
  const { session } = books.ledger

  return {
    agents: each(books, id, one => ({ ...one, tools: one.tools + 1, actions: [...one.actions, action].slice(-ACTIONS) })),
    ledger: { ...books.ledger, session: { ...session, tools: session.tools + 1 } },
  }
}

/** Agent `id` ended; a failure takes its running foreground descendants with it. */
export function ended(books: Books, id: string, isFailed: boolean, now: number, reason: string): Books {
  return { ...books, agents: endedRuns(books.agents, id, isFailed, now, reason) }
}

/** The engine's measure: a missing figure keeps the last one. */
export function measured(books: Books, contextPct: number | null, costUsd: number | null): Books {
  const { ledger } = books

  return { ...books, ledger: { ...ledger, contextPct: contextPct ?? ledger.contextPct, costUsd: costUsd ?? ledger.costUsd } }
}
