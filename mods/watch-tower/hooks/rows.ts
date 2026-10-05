// What the pane shows, as data: register.tsx maps each Row to elements.
import type { AgentRun } from '../types'
import { agentColor, currentAction, icon, label, tree } from './agents'
import { elapsed, shortModel } from './format'

export type Span = { text: string; color?: string; isDim?: boolean }

/** One line of the pane: `indent` levels of two cells, then spans; `right` stays visible at the end. */
export type Row = { key: string; indent: number; spans: Span[]; right?: string }

/**
 * The agent tree: three rows for a running agent (label and time, model,
 * current action), one for a finished agent, with why it failed.
 */
export function treeRows(agents: AgentRun[], now: number): Row[] {
  return tree(agents).flatMap(({ run, depth }) => {
    const head: Row = {
      key: run.id,
      indent: depth,
      spans: [{ text: `${icon(run)} ${label(run)}`, color: agentColor(run) }],
      right: elapsed((run.endedAt ?? now) - run.startedAt),
    }
    if (run.status === 'failed') head.spans.push({ text: `  ${currentAction(run)}`, isDim: true })
    if (run.status !== 'running') return [head]

    return [
      head,
      { key: `${run.id}:model`, indent: depth + 1, spans: [{ text: shortModel(run.model) || '…', isDim: true }] },
      { key: `${run.id}:doing`, indent: depth + 1, spans: [{ text: currentAction(run), isDim: true }] },
    ]
  })
}
