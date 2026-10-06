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

/** The session's agents and its ledger, moved together by each session event. */
export type Books = { agents: AgentRun[]; ledger: Ledger }

/** `dirty`: uncommitted paths. */
export type Git = { branch: string; dirty: number }

/** One commit of the session: short hash, subject, and its size. */
export type Commit = { hash: string; subject: string; files: number; added: number; removed: number }

/** The newest commits of the session, and how many it holds in all. */
export type SessionCommits = { list: Commit[]; total: number }

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
      books: Books
      git: Git | null
      /** HEAD when the session started, `''` on a branch with no commit yet; commits after it are the session's. */
      sessionBase: string | null
      commits: SessionCommits
      drift: Drift
      /** The agent whose details are open in the tree, null when none. */
      expanded: string | null
      allowed: string[]
      cache: Cache
    }
  }
}
