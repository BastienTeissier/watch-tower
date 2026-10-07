// The pane and the band as rows, pure: from the session's state to what they
// show. register.tsx reads the state, pane.tsx draws the rows; every way the
// plan's position is written lives here.
import type { Books, Cache, CacheTtl, Gauge, Gauges, Phase, Plan, Track } from '../types'
import { cachePart } from './cache'
import { shares } from './ledger'
import { position } from './plan'
import { bandRow, commitRows, totalRows, treeRows } from './rows'
import type { Row, Span } from './rows'
import { DRIFT_COLOR, GAUGE_STALE_MS, PLAN_COLOR, countdown, gaugeBar, gaugeColor } from './style'

/** What the pane shows, read at one frame; `ttl` is the cache lifetime the options force, null to detect it. */
export type Seen = {
  books: Books
  track: Track
  expanded: string | null
  cache: Cache
  ttl: CacheTtl | null
  gauges: Gauges | null
  now: number
}

const row = (key: string, spans: Span[], indent = 0): Row => ({ key, indent, spans })
const dim = (key: string, text: string, indent = 0): Row => row(key, [{ text, isDim: true }], indent)

/** The band's short phase name: `Phase 0 — App skeleton` → `P0`. */
const shortPhase = (phase: Phase | null) => phase?.name.replace(/^Phase\s+/i, 'P').replace(/\s+[—–-]\s+.*$/, '') ?? ''

/** The plan's position in words, as the slash command answers. */
export function positionText(plan: Plan): string {
  const at = position(plan)
  if (at.current === null) return `plan complete, ${at.done}/${at.total} tasks done.`

  return `${at.phase?.name ?? ''} ${at.phaseDone}/${at.phaseTotal} — now: ${at.current.title}${at.next === null ? '' : `; next: ${at.next.title}`}.`
}

/** The plan's phase, current and next task, then the drift; `hint` says how to attach one when none is. */
function planRows({ plan, drift }: Track, hint: string): Row[] {
  const { files, commits } = drift
  const left = files.length === 0 && commits.length === 0 ? [] : [row('drift', [{ text: `drift: ${files.length} files, ${commits.length} commits`, color: DRIFT_COLOR }])]
  if (plan === null) return [dim('plan', `no plan · ${hint}`), ...left]

  const at = position(plan)
  const head = row('plan', [
    { text: at.phase?.name ?? 'Plan complete', color: PLAN_COLOR, isBold: true },
    { text: `  ${at.phaseDone}/${at.phaseTotal}  (${at.done}/${at.total})`, isDim: true },
  ])
  const now = at.current === null ? [] : [row('plan:now', [{ text: `▸ ${at.current.title}` }])]
  const next = at.next === null ? [] : [dim('plan:next', `next: ${at.next.title}`, 1)]

  return [head, ...now, ...next, ...left]
}

/** One quota gauge, dimmed when its sample is stale; null when unknown. */
function gaugeRow(label: string, gauge: Gauge | null, now: number, isStale: boolean): Row | null {
  if (gauge === null) return null
  const resets = gauge.resetsAt === null ? [] : [{ text: ` in ${countdown(Math.floor((gauge.resetsAt - now) / 1000))}`, isDim: true }]

  return row(`gauge:${label}`, [
    { text: `${label} `, isDim: true },
    { text: gaugeBar(gauge.pct), color: gaugeColor(gauge.pct), isDim: isStale },
    { text: ` ${gauge.pct}%`, isDim: isStale },
    ...resets,
  ])
}

/** The context and the cache's countdown on one row, then the quota gauges. */
function statusRows({ books, cache, ttl, gauges, now }: Seen): Row[] {
  const { contextPct } = books.ledger
  const warm = cachePart(cache, ttl, now)
  const spans: Span[] = [
    ...(contextPct === null ? [] : [{ text: `ctx ${contextPct}%  `, isDim: true }]),
    ...(warm === null ? [] : [{ text: warm.text, color: warm.color, isDim: warm.isCold }]),
  ]
  const isStale = gauges !== null && now - gauges.sampledAt > GAUGE_STALE_MS
  const rows = [
    spans.length === 0 ? null : row('ctx', spans),
    gaugeRow('5h', gauges?.five ?? null, now, isStale),
    gaugeRow('7d', gauges?.week ?? null, now, isStale),
  ]

  return rows.filter(one => one !== null)
}

/**
 * The pane above the companion, in sections: the agent tree and its totals,
 * the commits, the plan and its drift, the context and quotas. `hint` is the
 * command that attaches a plan.
 */
export function paneSections(seen: Seen, hint: string): Row[][] {
  const { books: { agents, ledger }, track, expanded, now } = seen
  const cents = shares(agents, ledger)

  return [
    [...treeRows(agents, { now, shares: cents, expanded }), ...totalRows(agents, ledger, { now, shares: cents })],
    commitRows(track),
    planRows(track, hint),
    statusRows(seen),
  ]
}

/** Above the prompt: the turn summary while the pane is not on screen, then the plan's position; empty when neither. */
export function bandRows({ agents, ledger }: Books, plan: Plan | null, now: number, isPaneShown: boolean): Row[] {
  const summary = isPaneShown ? null : bandRow(agents, ledger, { now, shares: shares(agents, ledger) })
  const at = plan === null ? null : position(plan)
  const where =
    at === null
      ? null
      : row('band:plan', [
          { text: ` ${shortPhase(at.phase)} ${at.phaseDone}/${at.phaseTotal}`, color: PLAN_COLOR, isBold: true },
          { text: at.current === null ? '  plan complete' : `  ▸ ${at.current.title}` },
          ...(ledger.contextPct === null ? [] : [{ text: `  ctx ${ledger.contextPct}%`, isDim: true }]),
        ])

  return [summary, where].filter(one => one !== null)
}
