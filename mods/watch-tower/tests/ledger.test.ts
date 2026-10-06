import { describe, expect, test } from 'claude-code/testing'

import { mainRun } from '../hooks/agents'
import { LEDGER, NO_USAGE, hitRate, shares, turnTotals, upTokens } from '../hooks/ledger'
import type { AgentRun, Ledger } from '../types'

const run = (id: string, turn: number, weight: number): AgentRun => ({
  ...mainRun('go', turn, 0),
  id,
  parentId: id === 'main' ? null : 'main',
  usage: { input: 10, output: 5, cacheRead: 100, cacheWrite: 20 },
  weight,
})

/** The ledger of turn 2, its session spent `weight` and cost `usd`. */
const costing = (usd: number | null, weight: number): Ledger => ({ ...LEDGER, turn: 2, costUsd: usd, session: { ...LEDGER.session, weight } })

describe('shares', () => {
  test('split in thirds, the cents still sum to the session cost', () => {
    const agents = [run('main', 2, 1), run('a', 2, 1), run('b', 2, 1)]
    const cents = shares(agents, costing(1, 3))

    expect(cents).toEqual({ main: 34, a: 33, b: 33 })
    expect(turnTotals(agents, costing(1, 3), cents).cents).toBe(100)
  })

  test('agents gone from the list keep their share out of the rows', () => {
    // 4 weight units spent by agents of earlier turns: the listed rows get 6/10 of $2.00.
    const agents = [run('main', 2, 3), run('a', 2, 3)]

    expect(shares(agents, costing(2, 10))).toEqual({ main: 60, a: 60 })
  })

  test('a cost reported before any request weighed bills no agent', () => {
    expect(shares([run('main', 2, 0), run('a', 2, 0)], costing(0.03, 0))).toEqual({ main: 0, a: 0 })
  })

  test('no cost reported, no share', () => {
    expect(shares([run('main', 2, 1)], costing(null, 1))).toBeNull()
  })
})

describe('turnTotals', () => {
  test('counts the turn’s agents only, not a background agent of an earlier turn', () => {
    const ledger = costing(1, 3)
    const agents = [run('main', 2, 1), run('a', 2, 1), run('old', 1, 1)]
    const totals = turnTotals(agents, ledger, shares(agents, ledger))

    expect(totals.agents).toBe(1)
    expect(totals.usage).toEqual({ input: 20, output: 10, cacheRead: 200, cacheWrite: 40 })
    expect(totals.cents).toBe(67)
    expect(upTokens(totals.usage)).toBe(60)
  })
})

describe('hitRate', () => {
  test('hit rate is cache reads over all input', () => {
    expect(hitRate(NO_USAGE)).toBeNull()
    expect(hitRate({ input: 2, output: 50, cacheRead: 94, cacheWrite: 4 })).toBe(94)
  })
})
