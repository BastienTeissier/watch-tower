import { describe, expect, test } from 'claude-code/testing'

import { charged, ended, mainRun, saw, spawned } from '../hooks/agents'
import { elapsed, shortModel, tokens, usd } from '../hooks/format'
import { parseLog } from '../hooks/commits'
import { LEDGER, agentCounted, billed, measured, toolCounted, turnBegan } from '../hooks/ledger'
import { commitRows, totalRows, treeRows } from '../hooks/rows'
import type { Row } from '../hooks/rows'

const text = (row: Row) => `${'  '.repeat(row.indent)}${row.spans.map(span => span.text).join('')}${row.right === undefined ? '' : ` | ${row.right}`}`

describe('treeRows', () => {
  test('a running agent takes three rows, a finished one a single row, each with tokens and cost', () => {
    let list = [{ ...mainRun('go', 1, 0), model: 'claude-opus-5-5' }]
    list = spawned(list, { ...mainRun('look', 1, 1_000), id: 'a', parentId: 'main', type: 'Explore', description: 'map events', model: 'claude-haiku-4-5-20251001' })
    list = saw(list, 'a', 'reading hooks/register.tsx')
    list = spawned(list, { ...mainRun('plan', 1, 2_000), id: 'b', parentId: 'main', type: 'Plan', description: 'design ledger' })
    list = ended(list, 'b', false, 152_000, 'answer')
    // ↑ is fresh input plus cache writes; cache reads are left out.
    list = charged(list, 'a', { input: 40_000, output: 2_000, cacheRead: 310_000, cacheWrite: 6_000 }, 1)

    expect(treeRows(list, { now: 66_000, shares: { main: 112, a: 6, b: 62 } }).map(text)).toEqual([
      '● main | 1m06s',
      '  opus-5.5 · ↑0k ↓0k · $1.12',
      '  starting',
      '  ● Explore: map events | 1m05s',
      '    haiku-4.5 · ↑46k ↓2k · $0.06',
      '    reading hooks/register.tsx',
      '  ✓ Plan: design ledger | 2m30s ↑0k ↓0k $0.62',
    ])
    expect(treeRows(list, { now: 66_000, shares: null }).map(text)[1]).toBe('  opus-5.5 · ↑0k ↓0k')
  })

  test('a failed agent says why on its one row', () => {
    const list = ended([mainRun('go', 1, 0)], 'main', true, 5_000, 'aborted')

    expect(treeRows(list, { now: 9_000, shares: null }).map(text)).toEqual(['✗ main  stopped: aborted | 5s ↑0k ↓0k'])
  })

  test('a subagent spawned without a description is labelled with its type alone', () => {
    const list = ended([{ ...mainRun('look', 1, 0), id: 'a', parentId: 'main', type: 'Explore' }], 'a', false, 2_000, 'answer')

    expect(treeRows(list, { now: 9_000, shares: null }).map(text)).toEqual(['✓ Explore | 2s ↑0k ↓0k'])
  })

  test('no agent, no row', () => {
    expect(treeRows([], { now: 0, shares: null })).toEqual([])
  })
})

describe('totalRows', () => {
  test('Σ turn sums the turn, Σ session the whole session with tools, hit rate and the engine cost', () => {
    const usage = { input: 2_000, output: 14_000, cacheRead: 1_500_000, cacheWrite: 125_000 }
    let ledger = turnBegan({ ...LEDGER, startedAt: 0 })
    ledger = toolCounted(agentCounted(agentCounted(billed(ledger, usage, 1))))
    ledger = measured(ledger, 42, 14.3)
    const list = charged([mainRun('go', 1, 60_000), { ...mainRun('look', 1, 61_000), id: 'a', parentId: 'main' }], 'a', usage, 1)

    expect(totalRows(list, ledger, { now: 312_000, shares: { main: 0, a: 180 } }).map(text)).toEqual([
      'Σ turn     4m12s  1 agent  ↑127k ↓14k  $1.80',
      'Σ session  5m12s  2 agents  1 tool',
      '           ↑127k ↓14k  cache 92%  $14.30',
    ])
  })

  test('before any prompt, Σ session alone, with no cost when none is reported', () => {
    expect(totalRows([], LEDGER, { now: 5_000, shares: null }).map(text)).toEqual(['Σ session  5s  0 agents  0 tools', '           ↑0k ↓0k'])
  })

  test('before the first clock tick, the session time reads 0s, never negative', () => {
    expect(totalRows([], { ...LEDGER, startedAt: 5_000 }, { now: 0, shares: null }).map(text)[0]).toBe('Σ session  0s  0 agents  0 tools')
  })
})

describe('commitRows', () => {
  const git = { branch: 'main', dirty: 2 }
  const list = parseLog(['a1a1a1a\tfeat: one', ' 1 file changed, 3 insertions(+)', 'b2b2b2b\tfix: two', ' 2 files changed, 1 deletion(-)'].join('\n'))

  test('lists the commits it holds, counts the rest of the session, then the branch', () => {
    expect(commitRows(git, { list, total: 7 }, null).map(text)).toEqual([
      'commits',
      'a1a1a1a feat: one',
      '    1 file +3 −0',
      'b2b2b2b fix: two',
      '    2 files +0 −1',
      '+5 earlier',
      'main  ±2 uncommitted',
    ])
  })

  test('no earlier line when every commit is shown; the branch alone when there are none', () => {
    expect(commitRows(git, { list, total: 2 }, null).map(text)).not.toContain('+0 earlier')
    expect(commitRows(git, { list: [], total: 0 }, null).map(text)).toEqual(['main  ±2 uncommitted'])
    expect(commitRows(null, { list, total: 2 }, null)).toEqual([])
  })
})

describe('format', () => {
  test('elapsed and model names', () => {
    expect([elapsed(59_999), elapsed(60_000), elapsed(3_600_000)]).toEqual(['59s', '1m00s', '1h0m'])
    expect([shortModel('claude-fable-5-1'), shortModel('claude-haiku-4-5-20251001'), shortModel('')]).toEqual(['fable-5.1', 'haiku-4.5', ''])
  })

  test('tokens and dollars', () => {
    expect([0, 499, 54_321, 999_499, 999_500, 1_940_000].map(tokens)).toEqual(['0k', '0k', '54k', '999k', '1.0M', '1.9M'])
    expect([0, 6, 180, 1430].map(usd)).toEqual(['$0.00', '$0.06', '$1.80', '$14.30'])
  })
})
