// What the pane shows, as data: register.tsx maps each Row to elements.
import type { AgentRun, Ledger, Usage } from '../types'
import { MAIN, agentColor, currentAction, icon, label, tree } from './agents'
import { elapsed, shortModel, tokens, usd } from './format'
import { hitRate, sessionCents, turnTotals, upTokens } from './ledger'
import type { Shares } from './ledger'

export type Span = { text: string; color?: string; isDim?: boolean }

/** One line of the pane: `indent` levels of two cells, then spans; `right` stays visible at the end. */
export type Row = { key: string; indent: number; spans: Span[]; right?: string }

const spent = (usage: Usage) => `↑${tokens(upTokens(usage))} ↓${tokens(usage.output)}`
const cost = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : usd(cents))
const joined = (parts: (string | null)[], gap: string) => parts.filter(part => part !== null).join(gap)
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * The agent tree: three rows for a running agent (label and time, model with
 * tokens and cost, current action), one for a finished agent, with why it
 * failed and its tokens and cost after its time.
 */
export function treeRows(agents: AgentRun[], { now, shares }: { now: number; shares: Shares }): Row[] {
  return tree(agents).flatMap(({ run, depth }) => {
    const time = elapsed((run.endedAt ?? now) - run.startedAt)
    const head: Row = {
      key: run.id,
      indent: depth,
      spans: [{ text: `${icon(run)} ${label(run)}`, color: agentColor(run) }],
      right: time,
    }
    if (run.status === 'failed') head.spans.push({ text: `  ${currentAction(run)}`, isDim: true })
    if (run.status !== 'running') return [{ ...head, right: joined([time, spent(run.usage), cost(shares?.[run.id])], ' ') }]

    const model = joined([shortModel(run.model) || '…', spent(run.usage), cost(shares?.[run.id])], ' · ')

    return [
      head,
      { key: `${run.id}:model`, indent: depth + 1, spans: [{ text: model, isDim: true }] },
      { key: `${run.id}:doing`, indent: depth + 1, spans: [{ text: currentAction(run), isDim: true }] },
    ]
  })
}

/** `Σ turn` (when a prompt was sent) and `Σ session`, whose second line holds tokens, hit rate and cost. */
export function totalRows(agents: AgentRun[], ledger: Ledger, { now, shares }: { now: number; shares: Shares }): Row[] {
  const main = agents.find(one => one.id === MAIN)
  const turn = turnTotals(agents, ledger, shares)
  const session = ledger.session
  const rate = hitRate(session.usage)
  const line = (key: string, text: string): Row => ({ key, indent: 0, spans: [{ text, isDim: true }] })
  const rows = [
    line('session', joined([`Σ session  ${elapsed(Math.max(0, now - ledger.startedAt))}`, plural(session.agents, 'agent'), plural(session.tools, 'tool')], '  ')),
    line('session:spent', joined([`           ${spent(session.usage)}`, rate === null ? null : `cache ${rate}%`, cost(sessionCents(ledger))], '  ')),
  ]
  if (main === undefined) return rows

  const turnTime = elapsed((main.endedAt ?? now) - main.startedAt)

  return [line('turn', joined([`Σ turn     ${turnTime}`, plural(turn.agents, 'agent'), spent(turn.usage), cost(turn.cents)], '  ')), ...rows]
}
