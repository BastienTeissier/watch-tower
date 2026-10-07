import { describe, expect, test } from 'claude-code/testing'

import { currentAction, ended, mainRun, tree } from '../hooks/agents'
import type { AgentRun } from '../types'

const sub = (id: string, parentId: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  ...mainRun('look', 1, 0),
  id,
  parentId,
  description: id,
  type: 'Explore',
  ...extra,
})

const shape = (list: AgentRun[]) => tree(list).map(({ run, depth }) => `${depth}:${run.id}`)

describe('tree', () => {
  test('puts main first and nests subagents under their parent, in spawn order', () => {
    const list = [mainRun('go', 1, 0), sub('a', 'main'), sub('b', 'main'), sub('a1', 'a')]

    expect(shape(list)).toEqual(['0:main', '1:a', '2:a1', '1:b'])
  })

  test('hangs an agent whose parent left under main, and roots subagents when main is absent', () => {
    expect(shape([mainRun('go', 1, 0), sub('x', 'gone')])).toEqual(['0:main', '1:x'])
    expect(shape([sub('a', 'main'), sub('a1', 'a')])).toEqual(['0:a', '1:a1'])
  })
})

describe('lifecycle', () => {
  test('a failed agent takes its running foreground descendants down, not background ones', () => {
    const list = [
      mainRun('go', 1, 0),
      sub('fg', 'main'),
      sub('fg1', 'fg'),
      sub('bg', 'main', { isBackground: true }),
      sub('was', 'main', { status: 'done', endedAt: 4 }),
    ]
    const after = ended(list, 'main', true, 9, 'aborted')

    expect(after.map(one => `${one.id}:${one.status}`)).toEqual(['main:failed', 'fg:failed', 'fg1:failed', 'bg:running', 'was:done'])
    expect(after.find(one => one.id === 'was')?.endedAt).toBe(4)
    expect(ended(list, 'main', false, 9, 'answer').filter(one => one.status === 'running').map(one => one.id)).toEqual(['fg', 'fg1', 'bg'])
  })

  test('a failed agent records why; one not yet seen doing anything is starting', () => {
    const list = [mainRun('go', 1, 0)]
    expect(currentAction(list[0]!)).toBe('starting')
    const after = ended(list, 'main', true, 9, 'aborted')

    expect(after[0]).toMatchObject({ status: 'failed', endedAt: 9 })
    expect(currentAction(after[0]!)).toBe('stopped: aborted')
  })
})
