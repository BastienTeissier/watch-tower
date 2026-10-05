import { describe, expect, test } from 'claude-code/testing'

import { ended, mainRun, saw, spawned } from '../hooks/agents'
import { elapsed, shortModel } from '../hooks/format'
import { treeRows } from '../hooks/rows'
import type { Row } from '../hooks/rows'

const text = (row: Row) => `${'  '.repeat(row.indent)}${row.spans.map(span => span.text).join('')}${row.right === undefined ? '' : ` | ${row.right}`}`

describe('treeRows', () => {
  test('a running agent takes three rows, a finished one a single row', () => {
    let list = [{ ...mainRun('go', 0), model: 'claude-opus-5-5' }]
    list = spawned(list, { ...mainRun('look', 1_000), id: 'a', parentId: 'main', type: 'Explore', description: 'map events', model: 'claude-haiku-4-5-20251001' })
    list = saw(list, 'a', 'reading hooks/register.tsx')
    list = spawned(list, { ...mainRun('plan', 2_000), id: 'b', parentId: 'main', type: 'Plan', description: 'design ledger' })
    list = ended(list, 'b', false, 152_000, 'answer')

    expect(treeRows(list, 66_000).map(text)).toEqual([
      '● main | 1m06s',
      '  opus-5.5',
      '  starting',
      '  ● Explore: map events | 1m05s',
      '    haiku-4.5',
      '    reading hooks/register.tsx',
      '  ✓ Plan: design ledger | 2m30s',
    ])
  })

  test('a failed agent says why on its one row', () => {
    const list = ended([mainRun('go', 0)], 'main', true, 5_000, 'aborted')

    expect(treeRows(list, 9_000).map(text)).toEqual(['✗ main  stopped: aborted | 5s'])
  })

  test('a subagent spawned without a description is labelled with its type alone', () => {
    const list = ended([{ ...mainRun('look', 0), id: 'a', parentId: 'main', type: 'Explore' }], 'a', false, 2_000, 'answer')

    expect(treeRows(list, 9_000).map(text)).toEqual(['✓ Explore | 2s'])
  })

  test('no agent, no row', () => {
    expect(treeRows([], 0)).toEqual([])
  })
})

describe('format', () => {
  test('elapsed and model names', () => {
    expect([elapsed(59_999), elapsed(60_000), elapsed(3_600_000)]).toEqual(['59s', '1m00s', '1h0m'])
    expect([shortModel('claude-fable-5-1'), shortModel('claude-haiku-4-5-20251001'), shortModel('')]).toEqual(['fable-5.1', 'haiku-4.5', ''])
  })
})
