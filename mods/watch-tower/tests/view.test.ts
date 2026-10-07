import { describe, expect, test } from 'claude-code/testing'

import { mainRun } from '../hooks/agents'
import { BOOKS } from '../hooks/books'
import { COLD } from '../hooks/cache'
import { parsePlan } from '../hooks/plan'
import type { Row } from '../hooks/rows'
import { TRACK, attached, edited } from '../hooks/track'
import { bandRows, paneSections, positionText } from '../hooks/view'
import type { Seen } from '../hooks/view'
import { PLAN_MD } from './fixtures'

const NOW = 60_000
const plan = parsePlan('docs/plan.md', PLAN_MD, 'base0')
const done = parsePlan('docs/plan.md', PLAN_MD.replaceAll('- [ ]', '- [x]'), 'base0')
const text = (row: Row) => `${'  '.repeat(row.indent)}${row.spans.map(span => span.text).join('')}`
const seen = (extra: Partial<Seen> = {}): Seen => ({ books: BOOKS, track: TRACK, expanded: null, cache: COLD, ttl: null, gauges: null, now: NOW, ...extra })
const sections = (extra: Partial<Seen> = {}) => paneSections(seen(extra), '/watch-tower plan <path>').map(rows => rows.map(text))

describe('paneSections', () => {
  test('the tree, the commits, the plan with its drift right under it, then the context and quotas', () => {
    const books = { agents: [mainRun('go', 1, 0)], ledger: { ...BOOKS.ledger, turn: 1, contextPct: 42 } }
    const track = { ...edited(attached(TRACK, plan), 'hse/models.py', false), git: { branch: 'feat/msv', dirty: 0 } }
    const [tree, log, where, status] = sections({ books, track, gauges: { five: { pct: 42, resetsAt: null }, week: null, sampledAt: NOW } })

    expect(tree?.[0]).toBe('● main')
    expect(log).toEqual(['feat/msv  ±0 uncommitted'])
    expect(where).toEqual(['Phase 0 — App skeleton  0/3  (1/5)', '▸ Register the `hse` app', '  next: Wire URLs', 'drift: 1 files, 0 commits'])
    expect(status).toEqual(['ctx 42%  ', '5h ████░░░░░░ 42%'])
  })

  test('with no plan, how to attach one; a finished plan says so', () => {
    expect(sections()[2]).toEqual(['no plan · /watch-tower plan <path>'])
    expect(sections({ track: attached(TRACK, done) })[2]).toEqual(['Plan complete  0/0  (5/5)'])
  })

  test('a gauge sampled long ago dims, the reset countdown does not', () => {
    const gauges = { five: { pct: 91, resetsAt: NOW + 7_800_000 }, week: null, sampledAt: 0 }
    const [row] = paneSections(seen({ gauges, now: NOW + 11 * 60_000 }), '')[3] ?? []

    expect(row?.spans.map(span => [span.text, span.isDim])).toEqual([
      ['5h ', true],
      ['█████████░', true],
      [' 91%', true],
      [' in 1h59m', true],
    ])
  })
})

describe('bandRows', () => {
  test('the turn summary only while the pane is hidden, then the short phase, the task and the context', () => {
    const books = { agents: [mainRun('go', 1, 0)], ledger: { ...BOOKS.ledger, contextPct: 12 } }

    expect(bandRows(books, plan, NOW, false).map(text)).toEqual(['● main  1m00s  ↑0k ↓0k', ' P0 0/3  ▸ Register the `hse` app  ctx 12%'])
    expect(bandRows(books, plan, NOW, true).map(text)).toEqual([' P0 0/3  ▸ Register the `hse` app  ctx 12%'])
    expect(bandRows(BOOKS, done, NOW, true).map(text)).toEqual(['  0/0  plan complete'])
    expect(bandRows(BOOKS, null, NOW, false)).toEqual([])
  })
})

describe('positionText', () => {
  test('the phase, the task now and the next one; a finished plan counts its tasks', () => {
    expect(positionText(plan)).toBe('Phase 0 — App skeleton 0/3 — now: Register the `hse` app; next: Wire URLs.')
    expect(positionText(done)).toBe('plan complete, 5/5 tasks done.')
  })
})
