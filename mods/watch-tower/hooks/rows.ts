// What the pane shows, as data: register.tsx maps each Row to elements.
import type { AgentRun, Git, Ledger, Plan, SessionCommits, Usage } from '../types'
import { MAIN, agentColor, currentAction, icon, label, tree } from './agents'
import { elapsed, shortModel, tokens, usd } from './format'
import { hitRate, sessionCents, turnTotals, upTokens } from './ledger'
import type { Shares } from './ledger'
import { unplanned } from './plan'
import { DRIFT_COLOR } from './style'

export type Span = { text: string; color?: string; isDim?: boolean }

/** What pressing a row names: the agent whose details it opens or closes. */
export type Press = { agentId: string }

/**
 * One line of the pane: `indent` levels of two cells, then spans; `right`
 * stays visible at the end. A row with `press` is drawn with its first span
 * as a button.
 */
export type Row = { key: string; indent: number; spans: Span[]; right?: string; press?: Press }

const spent = (usage: Usage) => `↑${tokens(upTokens(usage))} ↓${tokens(usage.output)}`
const cost = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : usd(cents))
const joined = (parts: (string | null)[], gap: string) => parts.filter(part => part !== null).join(gap)
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
const PROMPT_LINES = 3
const PROMPT_COLUMNS = 40
const ACTIONS = 5
/** The turn's time: the main thread's, frozen when it ended. */
const turnTime = (main: AgentRun, now: number) => elapsed((main.endedAt ?? now) - main.startedAt)

/** Text in lines of at most `columns`, broken between words; blank lines dropped, a longer word split. */
function wrapped(text: string, columns: number): string[] {
  const lines: string[] = []
  for (const word of text.split(/\s+/).filter(one => one !== '')) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + word.length <= columns) lines[lines.length - 1] = `${last} ${word}`
    else for (let at = 0; at < word.length; at += columns) lines.push(word.slice(at, at + columns))
  }

  return lines
}

/** An expanded agent's details: model with tokens and cost, cache counts, its prompt in three lines, its last actions. */
function details(run: AgentRun, model: string, indent: number): Row[] {
  const line = (key: string, text: string): Row => ({ key: `${run.id}:${key}`, indent, spans: [{ text, isDim: true }] })
  const lines = wrapped(run.prompt, PROMPT_COLUMNS)
  const isCut = lines.length > PROMPT_LINES
  const prompt = lines.slice(0, PROMPT_LINES).map((text, at) => line(`prompt:${at}`, isCut && at === PROMPT_LINES - 1 ? `${text}…` : text))

  return [
    line('model', model),
    line('cache', `cache read ${tokens(run.usage.cacheRead)} · write ${tokens(run.usage.cacheWrite)}`),
    ...prompt,
    ...run.actions.slice(-ACTIONS).map((action, at) => line(`action:${at}`, `· ${action}`)),
  ]
}

/**
 * The agent tree: three rows for a running agent (label and time, model with
 * tokens and cost, current action), one for a finished agent, with why it
 * failed and its tokens and cost after its time. The `expanded` agent shows
 * `▾` and its details instead.
 */
export function treeRows(agents: AgentRun[], { now, shares, expanded }: { now: number; shares: Shares; expanded: string | null }): Row[] {
  return tree(agents).flatMap(({ run, depth }) => {
    const isOpen = run.id === expanded
    const time = elapsed((run.endedAt ?? now) - run.startedAt)
    const color = agentColor(run)
    const isRunning = run.status === 'running'
    const head: Row = {
      key: run.id,
      indent: depth,
      spans: [{ text: isOpen ? '▾' : icon(run), color }, { text: ` ${label(run)}`, color }],
      right: isRunning ? time : joined([time, spent(run.usage), cost(shares?.[run.id])], ' '),
      press: { agentId: run.id },
    }
    if (run.status === 'failed') head.spans.push({ text: `  ${currentAction(run)}`, isDim: true })
    const model = joined([shortModel(run.model) || '…', spent(run.usage), cost(shares?.[run.id])], ' · ')
    if (isOpen) return [head, ...details(run, model, depth + 1)]
    if (!isRunning) return [head]

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

  return [line('turn', joined([`Σ turn     ${turnTime(main, now)}`, plural(turn.agents, 'agent'), spent(turn.usage), cost(turn.cents)], '  ')), ...rows]
}

/**
 * The band's turn summary on one row, so the prompt never moves: how many
 * subagents run (`main` when none does), the turn's time, tokens and cost;
 * null when no agent runs.
 */
export function bandRow(agents: AgentRun[], ledger: Ledger, { now, shares }: { now: number; shares: Shares }): Row | null {
  const running = agents.filter(one => one.status === 'running')
  const first = running[0]
  if (first === undefined) return null

  const main = agents.find(one => one.id === MAIN)
  const subs = running.filter(one => one.parentId !== null).length
  const turn = turnTotals(agents, ledger, shares)
  const time = main === undefined ? null : turnTime(main, now)
  const text = joined([subs === 0 ? 'main' : `${plural(subs, 'agent')} running`, time, spent(turn.usage), cost(turn.cents)], '  ')

  return { key: 'band', indent: 0, spans: [{ text: `${icon(first)} `, color: agentColor(first) }, { text }] }
}

/**
 * The session's commits, newest first: hash and subject, then size; `✓` when
 * the plan names the subject, `!` when it does not, no mark without a plan.
 * Ends with the branch and its uncommitted paths; nothing outside a repo.
 */
export function commitRows(git: Git | null, { list, total }: SessionCommits, plan: Plan | null): Row[] {
  if (git === null) return []
  const earlier = total - list.length
  const line = (key: string, text: string, indent = 0): Row => ({ key, indent, spans: [{ text, isDim: true }] })
  const rows = list.flatMap(commit => {
    const isOff = plan !== null && unplanned(plan, [commit.subject]).length > 0
    const mark = plan === null ? '' : isOff ? '! ' : '✓ '
    const text = `${mark}${commit.hash} ${commit.subject}`
    const head: Row = { key: `commit:${commit.hash}`, indent: 0, spans: [isOff ? { text, color: DRIFT_COLOR } : { text }] }

    return [head, line(`commit:${commit.hash}:size`, `${plural(commit.files, 'file')} +${commit.added} −${commit.removed}`, 2)]
  })
  const more = earlier === 0 ? [] : [line('commits:earlier', `+${earlier} earlier`)]
  const header = rows.length === 0 ? [] : [line('commits', 'commits')]

  return [...header, ...rows, ...more, line('commits:git', `${git.branch}  ±${git.dirty} uncommitted`)]
}
