// Watch Tower as a mod: wiring only. Session events drive the state machine
// (machine.ts), a pane draws the active Species in the state's style, the
// attached plan's position (plan.ts), the agent tree with its tokens and cost
// (books.ts) and the prompt cache's countdown. Everything reaching `$` is in this file: the
// validator follows `$` into no import.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer, ToolCallInput } from 'claude-code'

import type { Gauge, Plan, SessionCommits } from '../types'
import { MAIN, describe, icon, label } from './agents'
import { BOOKS, ended, measured, opened, prompted, requested, spawned, toolUsed } from './books'
import { COLD, asTtl, cachePart, ttlFromTranscript } from './cache'
import { MAX_COMMITS, parseLog } from './commits'
import { INITIAL, clearAlert, isAlert, mapEvent, push, toolEvent } from './machine'
import type { BuddyEvent } from './machine'
import { shares, usageOf } from './ledger'
import { companionLines, gaugeLine, rowLine } from './pane'
import { editedPath, isOffPlan, parsePlan, planLabel, position, relativeTo, tickCommits, unplanned } from './plan'
import { weightOf } from './pricing'
import { bandRow, commitRows, totalRows, treeRows } from './rows'
import type { Press } from './rows'
import { speciesFor } from './species'
import { DRIFT_COLOR, GAUGE_STALE_MS, styleFor } from './style'

// The mod's name: pane, command and message prefix. The atoms below repeat it
// literally: the validator reads a state reference only from string literals.
const NAME = 'watch-tower'
const PANE = NAME
const TITLE = 'Watch Tower'
const FRAME_MS = 500
const LOG_DEPTH = '200'

// Held by the host, so they survive a hot reload of this file.
const machine = atom({ plugin: 'watch-tower', key: 'machine' } as const, INITIAL)
const gauges = atom({ plugin: 'watch-tower', key: 'gauges' } as const, null)
const tick = atom({ plugin: 'watch-tower', key: 'tick' } as const, { frame: 0, now: 0 })
const plan = atom({ plugin: 'watch-tower', key: 'plan' } as const, null)
const books = atom({ plugin: 'watch-tower', key: 'books' } as const, BOOKS)
const gitState = atom({ plugin: 'watch-tower', key: 'git' } as const, null)
const sessionBase = atom({ plugin: 'watch-tower', key: 'sessionBase' } as const, null)
const commits = atom({ plugin: 'watch-tower', key: 'commits' } as const, { list: [], total: 0 } as SessionCommits)
const drift = atom({ plugin: 'watch-tower', key: 'drift' } as const, { files: [], commits: [] })
const expanded = atom({ plugin: 'watch-tower', key: 'expanded' } as const, null as string | null)
const allowed = atom({ plugin: 'watch-tower', key: 'allowed' } as const, [] as string[])
const cache = atom({ plugin: 'watch-tower', key: 'cache' } as const, COLD)
const HISTORY_COMMANDS = /\bgit\b.*\b(commit|merge|rebase|cherry-pick|reset|revert|checkout|switch)\b/
// How much of the transcript's end to read for the last response's cache usage.
const TAIL_BYTES = 1024 * 1024

const emit = ($: EngineInterface, event: BuddyEvent) =>
  update($, machine, current => push(current, mapEvent(event)))

/** The end of this session's transcript, where the last response is; '' when unreadable. */
async function readTail($: EngineInterface): Promise<string> {
  try {
    const home = await $.env.get('HOME')
    const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (home === undefined ? undefined : `${home}/.claude`)
    if (configDir === undefined) return ''
    const project = (await $.session.root()).replace(/[^a-zA-Z0-9]/g, '-')
    const path = `${configDir}/projects/${project}/${await $.session.id()}.jsonl`
    const { size } = await $.fs.stat(path)
    if (size <= TAIL_BYTES) {
      const text = await $.fs.read(path)

      return typeof text === 'string' ? text : ''
    }
    const { exitCode, stdout } = await $.process.run(['tail', '-c', String(TAIL_BYTES), path])

    return exitCode === 0 ? stdout : ''
  } catch {
    return ''
  }
}

async function git($: EngineInterface, ...args: string[]): Promise<string | null> {
  const ran = await $.process.run(['git', ...args]).catch(() => null)

  return ran === null || ran.exitCode !== 0 ? null : ran.stdout.trim()
}

const lines = (text: string | null): string[] => (text === null || text === '' ? [] : text.split('\n'))

async function storeKey($: EngineInterface): Promise<string> {
  return `plan:${await $.session.cwd()}:${(await git($, 'rev-parse', '--abbrev-ref', 'HEAD')) ?? ''}`
}

/** Ticks the plan's boxes from the commit log, rewrites the file when a box moved, and parses it. */
async function load($: EngineInterface, path: string, base: string | null): Promise<Plan | null> {
  const md = await $.fs.read(path)
  if (typeof md !== 'string') return null
  const ticked = tickCommits(md, lines(await git($, 'log', '-n', LOG_DEPTH, '--format=%s')))
  if (ticked !== md) await $.fs.write(path, ticked)

  return parsePlan(path, ticked, base)
}

function describePosition(current: Plan): string {
  const at = position(current)
  if (at.current === null) return `${NAME}: plan complete, ${at.done}/${at.total} tasks done.`

  return `${NAME}: ${at.phase?.name ?? ''} ${at.phaseDone}/${at.phaseTotal} — now: ${at.current.title}${at.next === null ? '' : `; next: ${at.next.title}`}.`
}

/** The band's turn summary; null when no agent runs. */
async function summaryRow($: EngineInterface, now: number) {
  const { agents, ledger } = await read($, books)

  return bandRow(agents, ledger, { now, shares: shares(agents, ledger) })
}

/** Re-reads the plan and the commit logs, and takes the git state. */
async function refresh($: EngineInterface): Promise<void> {
  const current = await read($, plan)
  const branch = await git($, 'rev-parse', '--abbrev-ref', 'HEAD')
  const dirty = lines(await git($, 'status', '--porcelain')).length
  // First parent only: a merge counts once, with its size, not as every commit it brought in.
  const base = await read($, sessionBase)
  const range = base === '' ? 'HEAD' : `${base}..HEAD`
  const log = base === null ? null : await git($, 'log', '--first-parent', '-n', String(MAX_COMMITS), '--format=%h%x09%s', '--shortstat', range)
  const total = base === null ? 0 : Number((await git($, 'rev-list', '--first-parent', '--count', range)) ?? 0)

  await update($, gitState, () => (branch === null ? null : { branch, dirty }))
  await update($, commits, () => ({ list: parseLog(log ?? ''), total }))
  if (current === null) return

  const since = current.base == null ? [] : lines(await git($, 'log', '--format=%s', `${current.base}..HEAD`))
  const loaded = await load($, current.path, current.base).catch(() => null)
  if (loaded !== null) await update($, plan, () => loaded)
  await update($, drift, last => ({ ...last, commits: unplanned(loaded ?? current, since) }))
}

/** Attaches the plan at `path` (relative to the working directory) and remembers it for this branch. */
async function attach($: EngineInterface, path: string): Promise<string> {
  const clean = path.replace(/^@/, '')
  const current = await read($, plan)
  if (current?.path === clean) {
    await refresh($)

    return describePosition((await read($, plan)) ?? current)
  }
  const loaded = await load($, clean, await git($, 'rev-parse', 'HEAD')).catch(() => null)
  if (loaded === null) return `${NAME}: cannot read ${clean}.`
  if (loaded.phases.length === 0) return `${NAME}: no checkbox tasks found in ${clean}.`

  await update($, plan, () => loaded)
  await update($, drift, () => ({ files: [], commits: [] }))
  await update($, allowed, () => [])
  await $.store.set(await storeKey($), clean).catch(() => undefined)
  await refresh($)

  return describePosition(loaded)
}

async function detach($: EngineInterface): Promise<string> {
  await update($, plan, () => null)
  await $.store.delete(await storeKey($)).catch(() => undefined)

  return `${NAME}: plan detached.`
}

/** Re-attaches the plan this branch had last time, when its file is still there. */
async function restore($: EngineInterface): Promise<void> {
  if ((await read($, plan)) !== null) return
  const path = await $.store.get(await storeKey($)).catch(() => undefined)
  if (typeof path === 'string' && (await $.fs.exists(path).catch(() => false))) await attach($, path)
}

/** Holds an edit of a file the plan does not list until you allow it; the reason to deny, else undefined. */
async function guard($: EngineInterface, e: ToolCallInput): Promise<string | undefined> {
  const current = await read($, plan)
  const path = editedPath(e)
  if (current === null || path === null) return undefined
  const rel = relativeTo(await $.session.cwd(), path)
  if (rel === null || !isOffPlan(current, rel) || (await read($, allowed)).includes(rel)) return undefined

  const at = position(current)
  const answer = await $.ui
    .ask(`Off-plan edit: ${rel}. Current task: ${at.current?.title ?? 'none'}. Allow it?`, {
      header: 'Off-plan',
      options: ['Allow once', 'Allow file', 'Deny'],
    })
    .catch(() => 'Deny')

  if (answer === 'Deny') {
    return `${NAME}: ${rel} is not listed in the plan (${current.path}) and the user declined this edit. Current task: ${at.current?.title ?? 'none'}.`
  }
  if (answer === 'Allow file') await update($, allowed, list => [...list, rel])
  await update($, drift, last => (last.files.includes(rel) ? last : { ...last, files: [...last.files, rel] }))

  return undefined
}

export const register: Register = (on, options) => {
  const hasCompanion = options.companion !== false
  const species = speciesFor(String(options.species))
  const ttlOverride = asTtl(options.cacheTtl)
  let timer: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Show the Watch Tower pane; `plan <path>` attaches a plan, `plan off` detaches it',
    })
    await emit($, { kind: 'session' })
    const startedAt = await $.clock.now()
    await update($, books, last => opened(last, startedAt))
    // A branch with no commit yet has no HEAD: every commit it gets is the session's.
    const head = (await git($, 'rev-parse', 'HEAD')) ?? ((await git($, 'rev-parse', '--git-dir')) === null ? null : '')
    await update($, sessionBase, last => last ?? head)
    timer?.cancel()
    timer = $.clock.every(FRAME_MS, async () => {
      const now = await $.clock.now()
      await update($, tick, last => ({ frame: last.frame + 1, now }))
    })
    void $.ui.open({ id: PANE, title: TITLE })
    await restore($)
    await refresh($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await emit($, { kind: 'session' })
    if (e.reason === 'clear' || e.reason === 'resume') await update($, cache, last => ({ ...last, lastRequestAt: null }))

    return next(e)
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const [verb, arg] = e.args.trim().split(/\s+/, 2)
    if (verb === 'plan' && arg === 'off') return { text: await detach($) }
    if (verb === 'plan' && arg !== undefined) return { text: await attach($, arg) }
    if (verb === 'plan') {
      const current = await read($, plan)

      return { text: current === null ? `${NAME}: no plan attached.` : describePosition(current) }
    }
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Watch Tower pane opened.' }
  })

  on('command.run', { command: 'implement-plan' }, async ($, e, next) => {
    const path = e.args.trim().split(/\s+/)[0]
    if (path !== undefined && path !== '') $.ui.toast(await attach($, path))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await emit($, { kind: 'prompt' })
    const now = await $.clock.now()
    const { agents } = await update($, books, last => prompted(last, e.text, now))
    // An agent cleared with the last turn takes its details with it; so does main, a new run each prompt.
    await update($, expanded, id => (id !== MAIN && agents.some(one => one.id === id) ? id : null))
    const path = /^\/implement-plan\s+(\S+)/.exec(e.text)?.[1]
    if (path !== undefined) $.ui.toast(await attach($, path))

    return next(e)
  })

  // One model request: it names the agent's model and charges its usage; the main thread's restarts the cache's clock.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (result.usage !== null) {
      const { model } = result.usage
      const usage = usageOf(result.usage)
      const weight = weightOf(model, usage)
      const id = e.agentId ?? MAIN
      await update($, books, last => requested(last, id, model, usage, weight))
    }
    if (e.agentId === undefined && result.stopReason !== null) {
      const now = await $.clock.now()
      await update($, cache, last => ({ ...last, lastRequestAt: now }))
    }

    return result
  })

  on('tool.call', async ($, e, next) => {
    const denied = await guard($, e)
    if (denied !== undefined) return { deny: denied }

    await emit($, toolEvent(e))
    await update($, books, last => toolUsed(last, e.agentId ?? MAIN, describe(e)))
    const ran = await next(e)
    await emit($, { kind: 'tool-done' })
    if (e.tool === 'Bash' && HISTORY_COMMANDS.test(e.command)) await refresh($)

    return ran
  })

  on('agent.spawn', async ($, e, next) => {
    const spawn = await next(e)
    if (spawn.agentId !== undefined) {
      const run = {
        id: spawn.agentId,
        parentId: e.parentAgentId ?? MAIN,
        description: e.description,
        type: e.subagentType,
        model: spawn.model,
        prompt: e.prompt,
        isBackground: e.background,
      }
      const now = await $.clock.now()
      await update($, books, last => spawned(last, run, now))
    }

    return spawn
  })

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    const isFailed = e.reason === 'error' || e.reason === 'aborted'
    if (e.agentId === undefined) {
      await update($, books, last => ended(last, MAIN, isFailed, now, e.reason))
      await emit($, { kind: 'stop' })
      await refresh($)
      if (ttlOverride === null) {
        const ttl = ttlFromTranscript(await readTail($))
        if (ttl !== null) await update($, cache, last => ({ ...last, ttl }))
      }
    } else {
      const id = e.agentId
      const { agents } = await update($, books, last => ended(last, id, isFailed, now, e.reason))
      const one = agents.find(run => run.id === id)
      if (one !== undefined) $.ui.toast(`${icon(one)} ${label(one)} ${isFailed ? 'failed' : 'done'} (${one.tools} tools)`)
    }

    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    await emit($, { kind: 'permission', message: e.tool_name })

    return next(e)
  })

  on('classic.Notification', async ($, e, next) => {
    const kind = e.notification_type === 'permission_prompt' ? 'permission' : 'notification'
    await emit($, { kind, message: e.message })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const sampledAt = await $.clock.now()
    const gauge = (kind: string): Gauge | null => {
      const limit = e.rateLimits.find(one => one.kind === kind)
      if (limit === undefined) return null
      const resetsAt = limit.resetsAt === undefined ? NaN : Date.parse(limit.resetsAt)

      return { pct: Math.round(limit.percentUsed), resetsAt: Number.isNaN(resetsAt) ? null : resetsAt }
    }
    await update($, gauges, () => ({ five: gauge('five_hour'), week: gauge('seven_day'), sampledAt }))
    await update($, books, last => measured(last, e.context.percent ?? null, e.cost?.usd ?? null))

    return next(e)
  })

  // Above the prompt: the turn summary while the pane is not on screen, then the plan position.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e)
    if (e.props.hasSurvey) return rest

    // Read every frame, so the band looks again when the pane leaves the screen.
    const { now } = await read($, tick)
    const isPaneShown = (await $.ui.panes()).some(pane => pane.id === PANE && pane.isPlaced && pane.isShown)
    const { ledger } = await read($, books)
    const summary = isPaneShown ? null : await summaryRow($, now)
    const current = await read($, plan)
    if (summary === null && current === null) return rest

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const at = current === null ? null : position(current)

    return (
      <Box flexDirection="column">
        {summary !== null && rowLine(ui, summary)}
        {at !== null && (
          <Text wrap="truncate-end">
            <Text bold color="#a064dc">{` ${planLabel(at.phase)} ${at.phaseDone}/${at.phaseTotal}`}</Text>
            <Text>{at.current === null ? '  plan complete' : `  ▸ ${at.current.title}`}</Text>
            {ledger.contextPct !== null && <Text dimColor>{`  ctx ${ledger.contextPct}%`}</Text>}
          </Text>
        )}
        {rest}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const { status } = await read($, machine)
    const sample = await read($, gauges)
    const { frame, now } = await read($, tick)
    const current = await read($, plan)
    const { agents: team, ledger } = await read($, books)
    const cents = shares(team, ledger)
    const open = await read($, expanded)
    const crew = [...treeRows(team, { now, shares: cents, expanded: open }), ...totalRows(team, ledger, { now, shares: cents })]
    // One agent open at a time: pressing another moves the details, pressing it again closes them.
    const toggle = ({ agentId }: Press) => void update($, expanded, id => (id === agentId ? null : agentId))
    const log = commitRows(await read($, gitState), await read($, commits), current)
    const left = await read($, drift)
    const warm = cachePart(await read($, cache), ttlOverride, now)
    const style = styleFor(status.code)
    const isStale = sample !== null && now - sample.sampledAt > GAUGE_STALE_MS
    const at = current === null ? null : position(current)
    const rule = '─'.repeat(Math.max(10, Math.min(40, e.props.bodyColumns - 2)))

    return (
      <Box flexDirection="column" paddingX={1}>
        {crew.map(row => rowLine(ui, row, toggle))}
        {crew.length > 0 && <Text dimColor>{rule}</Text>}
        {log.map(row => rowLine(ui, row))}
        {log.length > 0 && <Text dimColor>{rule}</Text>}
        {at !== null && current !== null && (
          <Box flexDirection="column">
            <Text wrap="truncate-end">
              <Text bold color="#a064dc">{at.phase?.name ?? 'Plan complete'}</Text>
              <Text dimColor>{`  ${at.phaseDone}/${at.phaseTotal}  (${at.done}/${at.total})`}</Text>
            </Text>
            {at.current !== null && <Text wrap="truncate-end">{`▸ ${at.current.title}`}</Text>}
            {at.next !== null && <Text dimColor wrap="truncate-end">{`  next: ${at.next.title}`}</Text>}
          </Box>
        )}
        {at === null && <Text dimColor>no plan · /{NAME} plan {'<path>'}</Text>}
        {(left.files.length > 0 || left.commits.length > 0) && (
          <Text color={DRIFT_COLOR} wrap="truncate-end">
            {`drift: ${left.files.length} files, ${left.commits.length} commits`}
          </Text>
        )}
        <Text dimColor>{rule}</Text>
        {(ledger.contextPct !== null || warm !== null) && (
          <Text wrap="truncate-end">
            {ledger.contextPct !== null && <Text dimColor>{`ctx ${ledger.contextPct}%  `}</Text>}
            {warm !== null && (
              <Text color={warm.color} dimColor={warm.isCold}>
                {warm.text}
              </Text>
            )}
          </Text>
        )}
        {gaugeLine(ui, '5h', sample?.five ?? null, now, isStale)}
        {gaugeLine(ui, '7d', sample?.week ?? null, now, isStale)}
        {hasCompanion &&
          companionLines(ui, {
            species,
            style,
            frame,
            message: status.msg,
            rule,
            onTap: isAlert(status.code) ? () => void update($, machine, clearAlert) : undefined,
          })}
      </Box>
    )
  })
}
