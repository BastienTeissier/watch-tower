import { describe, expect, test } from 'claude-code/testing'

import { weightOf } from '../hooks/pricing'

const NONE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
const M = 1_000_000

describe('weightOf', () => {
  test('a cache read weighs a tenth of fresh input, a cache write a quarter more', () => {
    const fresh = weightOf('claude-haiku-4-5-20251001', { ...NONE, input: M })

    expect(fresh).toBe(1)
    expect(weightOf('claude-haiku-4-5-20251001', { ...NONE, cacheRead: M })).toBe(0.1)
    expect(weightOf('claude-haiku-4-5-20251001', { ...NONE, cacheWrite: M })).toBe(1.25)
    expect(weightOf('claude-haiku-4-5-20251001', { ...NONE, output: M })).toBe(5)
  })

  test('the most specific prefix wins: Opus 5.5 is cheaper than older Opus', () => {
    expect(weightOf('claude-opus-5-5', { ...NONE, input: M })).toBe(4)
    expect(weightOf('claude-opus-4-8', { ...NONE, input: M })).toBe(5)
    expect(weightOf('claude-sonnet-5-5', { ...NONE, output: M })).toBe(10)
  })

  test('an unknown model is priced at the most expensive known rates', () => {
    const usage = { input: M, output: M, cacheRead: M, cacheWrite: M }

    expect(weightOf('claude-mystery-9', usage)).toBe(weightOf('claude-fable-5', usage))
    expect(weightOf('', usage)).toBeGreaterThan(weightOf('claude-opus-5-5', usage))
  })
})
