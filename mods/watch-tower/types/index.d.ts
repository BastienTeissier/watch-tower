export type Status = { code: number; msg: string }

/** Current Status plus the last sustained activity, re-emitted when an alert clears. */
export type Machine = { status: Status; prior: Status }

/** One Quota gauge: percent used and reset time in epoch ms, null when unknown. */
export type Gauge = { pct: number; resetsAt: number | null }

export type Gauges = { five: Gauge | null; week: Gauge | null; sampledAt: number }

/** Animation frame counter and the wall clock at that frame. */
export type Tick = { frame: number; now: number }

/** One checkbox of a plan's To Do List; `commit` is its `type(scope): title`, null when it names none. */
export type Task = { title: string; commit: string | null; files: string[]; isDone: boolean }

export type Phase = { name: string; tasks: Task[] }

/** The attached plan; `path` is relative to the working directory, `base` the HEAD it was attached at. */
export type Plan = { path: string; base: string | null; phases: Phase[] }

export type Vitals = {
  turnStartedAt: number | null
  lastTurnMs: number
  tools: number
  contextPct: number | null
  costUsd: number | null
}

/** Token counts of model requests: fresh input, output, input read from and written to the prompt cache. */
export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }

/** Totals since the session started; `weight` is their list price, to split the cost by. */
export type Totals = { usage: Usage; weight: number; agents: number; tools: number }

/** `turn` counts prompts; `costUsd` and `contextPct` are the engine's last measure. */
export type Ledger = { startedAt: number; turn: number; session: Totals; costUsd: number | null; contextPct: number | null }

export type AgentStatus = 'running' | 'done' | 'failed'

/**
 * One agent of the turn: the main thread (id `main`) or a subagent under its
 * parent. `actions` holds what it was last seen doing, newest last; `turn`
 * is the prompt it was spawned in, `usage` and `weight` what its requests spent.
 */
export type AgentRun = {
  id: string
  parentId: string | null
  description: string
  type: string
  model: string
  prompt: string
  isBackground: boolean
  status: AgentStatus
  startedAt: number
  endedAt: number | null
  tools: number
  actions: string[]
  turn: number
  usage: Usage
  weight: number
}

/** `dirty`: uncommitted paths; `commits`: commits since the plan was attached. */
export type Git = { branch: string; dirty: number; commits: number }

/** What left the plan: edited files no task lists, commit subjects no task names. */
export type Drift = { files: string[]; commits: string[] }

export type CacheTtl = '5m' | '1h'

/** The prompt cache's clock: when the main thread's last request ended, and the lifetime it wrote with. */
export type Cache = { lastRequestAt: number | null; ttl: CacheTtl | null }

declare module 'claude-code' {
  interface PluginState {
    'watch-tower': {
      machine: Machine
      gauges: Gauges | null
      tick: Tick
      plan: Plan | null
      vitals: Vitals
      agents: AgentRun[]
      ledger: Ledger
      git: Git | null
      drift: Drift
      allowed: string[]
      cache: Cache
    }
  }
}
