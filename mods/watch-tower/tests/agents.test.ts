import { describe, expect, test } from 'claude-code/testing'

import { currentAction, ended, mainRun, modelSeen, nextTurn, saw, spawned, tree } from '../hooks/agents'
import type { AgentRun } from '../types'

const sub = (id: string, parentId: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  ...mainRun('look', 0),
  id,
  parentId,
  description: id,
  type: 'Explore',
  ...extra,
})

const shape = (list: AgentRun[]) => tree(list).map(({ run, depth }) => `${depth}:${run.id}`)

describe('tree', () => {
  test('puts main first and nests subagents under their parent, in spawn order', () => {
    let list = [mainRun('go', 0)]
    list = spawned(list, sub('a', 'main'))
    list = spawned(list, sub('b', 'main'))
    list = spawned(list, sub('a1', 'a'))

    expect(shape(list)).toEqual(['0:main', '1:a', '2:a1', '1:b'])
  })

  test('hangs an agent whose parent left under main, and roots subagents when main is absent', () => {
    expect(shape([mainRun('go', 0), sub('x', 'gone')])).toEqual(['0:main', '1:x'])
    expect(shape([sub('a', 'main'), sub('a1', 'a')])).toEqual(['0:a', '1:a1'])
  })
})

describe('lifecycle', () => {
  test('nextTurn drops main and finished agents, keeps a running background agent', () => {
    const list = [mainRun('go', 0), sub('done', 'main', { status: 'done' }), sub('bg', 'main')]

    expect(nextTurn(list).map(one => one.id)).toEqual(['bg'])
  })

  test('keeps the last 5 actions, newest as the current one', () => {
    let list = [sub('a', 'main')]
    expect(currentAction(list[0]!)).toBe('starting')
    for (let n = 1; n <= 7; n += 1) list = saw(list, 'a', `step ${n}`)

    expect(list[0]?.actions).toEqual(['step 3', 'step 4', 'step 5', 'step 6', 'step 7'])
    expect(list[0]?.tools).toBe(7)
    expect(currentAction(list[0]!)).toBe('step 7')
  })

  test('a failed agent records why; a model is learnt once seen', () => {
    let list = modelSeen([mainRun('go', 0)], 'main', 'claude-opus-5-5')
    expect(modelSeen(list, 'main', 'claude-opus-5-5')).toBe(list)
    list = ended(list, 'main', true, 9, 'aborted')

    expect(list[0]).toMatchObject({ model: 'claude-opus-5-5', status: 'failed', endedAt: 9 })
    expect(currentAction(list[0]!)).toBe('stopped: aborted')
  })
})
