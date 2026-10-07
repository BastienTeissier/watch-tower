import { describe, expect, test } from 'claude-code/testing'

import { BOOKS, ended, measured, opened, prompted, requested, spawned, toolUsed } from '../hooks/books'
import type { Spawn } from '../hooks/books'
import { shares, turnTotals } from '../hooks/ledger'
import type { Books } from '../types'

const USAGE = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }
const spawn = (id: string, extra: Partial<Spawn> = {}): Spawn => ({
  id,
  parentId: 'main',
  description: id,
  type: 'Explore',
  model: '',
  prompt: 'look',
  isBackground: false,
  ...extra,
})
const ids = (books: Books) => books.agents.map(one => one.id)

describe('books', () => {
  test('the session clock starts once', () => {
    expect(opened(opened(BOOKS, 5), 9).ledger.startedAt).toBe(5)
  })

  test('a prompt opens a turn with a new main run; finished agents leave, running background ones stay', () => {
    let books = prompted(BOOKS, 'go', 0)
    books = spawned(books, spawn('done'), 1)
    books = spawned(books, spawn('bg', { isBackground: true }), 2)
    books = ended(books, 'done', false, 3, 'answer')
    books = prompted(books, 'next', 4)

    expect(books.ledger.turn).toBe(2)
    expect(ids(books)).toEqual(['main', 'bg'])
    expect(books.agents[0]).toMatchObject({ prompt: 'next', turn: 2, startedAt: 4, status: 'running' })
    expect(books.agents[1]?.turn).toBe(1)
  })

  test('a subagent spawns in the current turn and counts once, even spawned again under its id', () => {
    let books = prompted(prompted(BOOKS, 'go', 0), 'again', 0)
    books = spawned(books, spawn('a'), 1)
    books = spawned(books, spawn('a', { description: 'retry' }), 2)

    expect(books.ledger.session.agents).toBe(1)
    expect(books.agents.filter(one => one.id === 'a')).toEqual([expect.objectContaining({ description: 'retry', turn: 2, startedAt: 2 })])
  })

  test('a request charges the session and its agent together, and names the agent’s model', () => {
    let books = spawned(prompted(BOOKS, 'go', 0), spawn('a'), 1)
    books = requested(books, 'a', 'claude-haiku-4-5-20251001', USAGE, 0.5)
    books = requested(books, 'main', 'claude-opus-5-5', USAGE, 0.25)

    expect(books.ledger.session).toMatchObject({ usage: { input: 2, output: 4, cacheRead: 6, cacheWrite: 8 }, weight: 0.75 })
    expect(books.agents.find(one => one.id === 'a')).toMatchObject({ model: 'claude-haiku-4-5-20251001', usage: USAGE, weight: 0.5 })
    expect(books.agents[0]).toMatchObject({ model: 'claude-opus-5-5', weight: 0.25 })
  })

  test('what the listed agents spent never exceeds the session, so their cents sum to the session cost', () => {
    // An unlisted agent's request, and agents that leave at the next prompt, stay in the session alone.
    let books = spawned(prompted(BOOKS, 'go', 0), spawn('a'), 1)
    books = requested(books, 'gone', 'claude-opus-5-5', USAGE, 1)
    books = requested(books, 'a', 'claude-opus-5-5', USAGE, 1)
    books = ended(books, 'a', false, 2, 'answer')
    books = requested(prompted(books, 'next', 3), 'main', 'claude-opus-5-5', USAGE, 2)
    books = measured(books, null, 2)

    const listed = books.agents.reduce((sum, one) => sum + one.weight, 0)
    expect(listed).toBeLessThanOrEqual(books.ledger.session.weight)
    // main spent 2 of the session's 4 weight units: half of $2.00.
    expect(shares(books.agents, books.ledger)).toEqual({ main: 100 })
    expect(turnTotals(books.agents, books.ledger, shares(books.agents, books.ledger)).cents).toBe(100)
  })

  test('a tool call counts for the session and its agent, which keeps its last five actions', () => {
    let books = spawned(prompted(BOOKS, 'go', 0), spawn('a'), 1)
    for (let n = 1; n <= 7; n += 1) books = toolUsed(books, 'a', `step ${n}`)
    books = toolUsed(books, 'gone', 'lost')

    expect(books.ledger.session.tools).toBe(8)
    expect(books.agents.find(one => one.id === 'a')).toMatchObject({ tools: 7, actions: ['step 3', 'step 4', 'step 5', 'step 6', 'step 7'] })
  })

  test('a failure takes running foreground descendants down; a measure without a figure keeps the last', () => {
    let books = spawned(spawned(prompted(BOOKS, 'go', 0), spawn('fg'), 1), spawn('bg', { isBackground: true }), 1)
    books = ended(books, 'main', true, 9, 'aborted')

    expect(books.agents.map(one => `${one.id}:${one.status}`)).toEqual(['main:failed', 'fg:failed', 'bg:running'])
    expect(measured(measured(books, 42, 1.8), null, null).ledger).toMatchObject({ contextPct: 42, costUsd: 1.8 })
  })
})
