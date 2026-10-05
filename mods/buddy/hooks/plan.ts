// Plan tracking, pure: parse a feature plan's To Do List, mark tasks done from
// commit subjects, and say which paths the plan covers.
import type { Phase, Plan, Task } from '../types'

const TODO_HEADING = /^## (?:\d+\.\s*)?To Do List\s*$/i
const HEADING = /^#{2,4} (.+)$/
const TASK = /^- \[([ xX])\] (.*)$/
const COMMIT = /`([a-z]+(?:\([^)`]*\))?!?: [^`]+)`/
const FILES = /^\s+- Files?:(.*)$/
const PATH = /^[\w.@\-/[\]*]+$/
const UNPHASED = 'To Do'

export type Position = {
  phase: Phase | null
  phaseDone: number
  phaseTotal: number
  done: number
  total: number
  current: Task | null
  next: Task | null
}

function pathsIn(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)]
    .map(match => match[1] ?? '')
    .filter(token => PATH.test(token) && (token.includes('/') || /\.\w+$/.test(token)))
}

function taskOf(text: string, isDone: boolean): Task {
  const bold = /\*\*(.+?)\*\*/.exec(text)

  return {
    title: (bold?.[1] ?? text.replace(COMMIT, '')).trim().slice(0, 80),
    commit: COMMIT.exec(text)?.[1] ?? null,
    files: [],
    isDone,
  }
}

/**
 * Reads the `## N. To Do List` section: `###` headings are phases, top-level
 * checkboxes are tasks, a task's backticked `type(scope): title` is its commit
 * and its `Files:` line its files. A plan without that section is read whole.
 */
export function parsePlan(path: string, md: string, base: string | null = null): Plan {
  const lines = md.split('\n')
  const start = lines.findIndex(line => TODO_HEADING.test(line))
  const isScoped = start !== -1
  const phases: Phase[] = []
  let phase: Phase | undefined
  let task: Task | undefined

  for (const line of lines.slice(start + 1)) {
    if (isScoped && line.startsWith('## ')) break

    const heading = HEADING.exec(line)
    const box = TASK.exec(line)
    const files = FILES.exec(line)

    if (heading !== null) {
      phase = { name: (heading[1] ?? '').trim(), tasks: [] }
      phases.push(phase)
      task = undefined
    } else if (box !== null) {
      if (phase === undefined) {
        phase = { name: UNPHASED, tasks: [] }
        phases.push(phase)
      }
      task = taskOf(box[2] ?? '', box[1] !== ' ')
      phase.tasks.push(task)
    } else if (files !== null && task !== undefined) {
      task.files.push(...pathsIn(files[1] ?? ''))
    }
  }

  return { path, base, phases: phases.filter(one => one.tasks.length > 0) }
}

/** Ticks every open task whose commit title is among `subjects`; other lines are untouched. */
export function tickCommits(md: string, subjects: readonly string[]): string {
  return md
    .split('\n')
    .map(line => {
      const commit = TASK.test(line) ? COMMIT.exec(line)?.[1] : undefined

      return commit !== undefined && subjects.includes(commit) ? line.replace('- [ ]', '- [x]') : line
    })
    .join('\n')
}

/** Where the plan stands: the first open task with a commit title, else the first open one. */
export function position(plan: Plan): Position {
  const tasks = plan.phases.flatMap(one => one.tasks)
  const open = tasks.filter(one => !one.isDone)
  const current = open.find(one => one.commit !== null) ?? open[0] ?? null
  const phase = plan.phases.find(one => current !== null && one.tasks.includes(current)) ?? null

  return {
    phase,
    phaseDone: phase?.tasks.filter(one => one.isDone).length ?? 0,
    phaseTotal: phase?.tasks.length ?? 0,
    done: tasks.length - open.length,
    total: tasks.length,
    current,
    next: open.find(one => one !== current && tasks.indexOf(one) > tasks.indexOf(current as Task)) ?? null,
  }
}

/** The path relative to `cwd`, or null when it lies outside it. */
export function relativeTo(cwd: string, path: string): string | null {
  if (path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1)
  if (path.startsWith('/') || path.startsWith('~') || path.startsWith('../')) return null

  return path.replace(/^\.\//, '')
}

function covers(entry: string, path: string): boolean {
  if (entry.endsWith('/')) return path.startsWith(entry)
  if (!entry.includes('*')) return entry === path
  const pattern = entry.split('*').map(part => part.replace(/[.[\]]/g, '\\$&')).join('.*')

  return new RegExp(`^${pattern}$`).test(path)
}

/** True when no task of the plan lists `path` (relative to the working directory). */
export function isOffPlan(plan: Plan, path: string): boolean {
  const isListed = plan.phases.some(phase =>
    phase.tasks.some(task => task.files.some(entry => covers(entry, path))),
  )

  return !isListed && path !== plan.path
}

/** The commit subjects no task of the plan names. */
export function unplanned(plan: Plan, subjects: readonly string[]): string[] {
  const titles = plan.phases.flatMap(phase => phase.tasks.map(task => task.commit))

  return subjects.filter(subject => !titles.includes(subject))
}
