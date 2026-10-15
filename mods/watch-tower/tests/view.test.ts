import { describe, expect, test } from 'claude-code/testing'

import { mainRun } from '../hooks/agents'
import { BOOKS } from '../hooks/books'
import { COLD, WARM_OFF } from '../hooks/cache'
import { gaugeColor } from '../hooks/style'
import { parsePlan } from '../hooks/plan'
import type { Row } from '../hooks/rows'
import { TRACK, attached, edited } from '../hooks/track'
import { KEEP_WARM, bandRows, headerRows, paneSections, positionText } from '../hooks/view'
import type { Seen } from '../hooks/view'
import { PLAN_MD } from './fixtures'

const NOW = 60_000
const plan = parsePlan('docs/plan.md', PLAN_MD, 'base0')
const done = parsePlan('docs/plan.md', PLAN_MD.replaceAll('- [ ]', '- [x]'), 'base0')
const text = (row: Row) => `${'  '.repeat(row.indent)}${row.spans.map(span => span.text).join('')}`
const seen = (extra: Partial<Seen> = {}): Seen => ({ books: BOOKS, track: TRACK, expanded: null, cache: COLD, ttl: null, warm: WARM_OFF, gauges: null, now: NOW, ...extra })
const sections = (extra: Partial<Seen> = {}) => paneSections(seen(extra), '/watch-tower plan <path>').map(rows => rows.map(text))

describe('paneSections', () => {
  test('the tree, the commits, then the plan with its drift right under it', () => {
    const books = { agents: [mainRun('go', 1, 0)], ledger: { ...BOOKS.ledger, turn: 1, contextPct: 42 } }
    const track = { ...edited(attached(TRACK, plan), 'hse/models.py', false), git: { branch: 'feat/msv', dirty: 0 } }
    const all = sections({ books, track })
    const [tree, log, where] = all

    expect(tree?.[0]).toBe('● main')
    expect(log).toEqual(['feat/msv  ±0 uncommitted'])
    expect(where).toEqual(['Phase 0 — App skeleton  0/3  (1/5)', '▸ Register the `hse` app', '  next: Wire URLs', 'drift: 1 files, 0 commits'])
    expect(all).toHaveLength(3)
  })

  test('with no plan, how to attach one; a finished plan says so', () => {
    expect(sections()[2]).toEqual(['no plan · /watch-tower plan <path>'])
    expect(sections({ track: attached(TRACK, done) })[2]).toEqual(['Plan complete  0/0  (5/5)'])
  })
})

describe('headerRows', () => {
  test('the context bar, the quota bars lined up under it, then the cache', () => {
    const books = { ...BOOKS, ledger: { ...BOOKS.ledger, contextPct: 42 } }
    const gauges = { five: { pct: 12, resetsAt: null }, week: { pct: 85, resetsAt: null }, sampledAt: NOW }
    const rows = headerRows(seen({ books, gauges, cache: { lastRequestAt: NOW, ttl: '5m' } }))

    expect(rows.map(text)).toEqual(['ctx ████░░░░░░ 42%', '5h  █░░░░░░░░░ 12%', '7d  ████████░░ 85%', '❄ cache 5:00'])
    expect(rows.map(one => one.spans[1]?.color).slice(0, 3)).toEqual([gaugeColor(42), gaugeColor(12), gaugeColor(85)])
  })

  test('the cache row ends with Keep warm, Let turn cold once on, and no button when cold', () => {
    const cache = { lastRequestAt: NOW, ttl: '5m' as const }
    const actionAt = (extra: Partial<Seen>) => headerRows(seen({ cache, ...extra })).find(one => one.key === 'cache')?.action

    expect(actionAt({})).toEqual({ key: KEEP_WARM, label: 'Keep warm' })
    expect(actionAt({ warm: { isOn: true, isPinging: false } })).toEqual({ key: KEEP_WARM, label: 'Let turn cold' })
    expect(actionAt({ now: NOW + 5 * 60_000 })).toBeUndefined()
  })

  test('nothing measured, nothing shown', () => {
    expect(headerRows(seen())).toEqual([])
  })

  test('a gauge sampled long ago dims, the reset countdown does not; the context never does', () => {
    const books = { ...BOOKS, ledger: { ...BOOKS.ledger, contextPct: 91 } }
    const gauges = { five: { pct: 91, resetsAt: NOW + 7_800_000 }, week: null, sampledAt: 0 }
    const [ctx, five] = headerRows(seen({ books, gauges, now: NOW + 11 * 60_000 }))

    expect(ctx?.spans.map(span => span.isDim)).toEqual([true, false, false])
    expect(five?.spans.map(span => [span.text, span.isDim])).toEqual([
      ['5h  ', true],
      ['█████████░', true],
      [' 91%', true],
      [' in 1h59m', true],
    ])
  })
})

describe('gaugeColor', () => {
  test('green below 20%, white below 50%, yellow below 80%, red from there', () => {
    expect([0, 19, 20, 49, 50, 79, 80, 100].map(gaugeColor)).toEqual(['#32c850', '#32c850', '#ffffff', '#ffffff', '#f0dc3c', '#f0dc3c', '#ff3c3c', '#ff3c3c'])
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
