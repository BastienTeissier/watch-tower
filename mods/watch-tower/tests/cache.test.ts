import { describe, expect, test } from 'claude-code/testing'

import { WARM_OFF, cachePart, ttlFromTranscript, warmStep } from '../hooks/cache'

const row = (usage: unknown, extra = {}) => JSON.stringify({ type: 'assistant', message: { usage }, ...extra })

describe('ttlFromTranscript', () => {
  test('reads the lifetime the last main-thread response wrote with', () => {
    const text = [
      row({ cache_creation: { ephemeral_5m_input_tokens: 10 } }),
      row({ cache_creation: { ephemeral_1h_input_tokens: 10 } }),
      row({ cache_creation: { ephemeral_5m_input_tokens: 99 } }, { isSidechain: true }),
      '{"type":"user"}',
      'cut by the ta',
    ].join('\n')

    expect(ttlFromTranscript(text)).toBe('1h')
    expect(ttlFromTranscript(row({ cache_creation: { ephemeral_5m_input_tokens: 0 } }))).toBeNull()
    expect(ttlFromTranscript('')).toBeNull()
  })
})

describe('cachePart', () => {
  test('counts down from the last request with the detected or forced lifetime', () => {
    const since = 1_000_000

    expect(cachePart({ lastRequestAt: null, ttl: null }, null, since)).toBeNull()
    expect(cachePart({ lastRequestAt: since, ttl: null }, null, since + 60_000)?.text).toBe('❄ cache 4:00')
    expect(cachePart({ lastRequestAt: since, ttl: '1h' }, null, since + 60_000)?.text).toBe('❄ cache 59:00')
    expect(cachePart({ lastRequestAt: since, ttl: '1h' }, '5m', since + 60_000)?.text).toBe('❄ cache 4:00')
    expect(cachePart({ lastRequestAt: since, ttl: null }, null, since + 4 * 60_000 + 30_000)?.color).toBeDefined()
    expect(cachePart({ lastRequestAt: since, ttl: null }, null, since + 5 * 60_000)).toEqual({
      text: '❄ cache cold',
      color: '#ff3232',
      isCold: true,
    })
  })
})

describe('warmStep', () => {
  const cache = { lastRequestAt: 0, ttl: '5m' as const }
  const ON = { isOn: true, isPinging: false }
  const late = 4 * 60_000 + 30_000

  test('pings once under a minute is left, idle and with no ping waiting', () => {
    expect(warmStep(ON, cache, null, late, false)).toEqual({ warm: { isOn: true, isPinging: true }, shouldPing: true })
    expect(warmStep(ON, cache, null, 3 * 60_000, false).shouldPing).toBe(false)
    expect(warmStep({ isOn: true, isPinging: true }, cache, null, late, false).shouldPing).toBe(false)
    expect(warmStep(ON, cache, null, late, true).shouldPing).toBe(false)
  })

  test('off does nothing; a cold cache turns it off and keeps a waiting ping known', () => {
    expect(warmStep(WARM_OFF, cache, null, late, false)).toEqual({ warm: WARM_OFF, shouldPing: false })
    expect(warmStep({ isOn: true, isPinging: true }, cache, null, 5 * 60_000, false)).toEqual({ warm: { isOn: false, isPinging: true }, shouldPing: false })
    expect(warmStep(ON, { lastRequestAt: null, ttl: null }, null, late, false).warm.isOn).toBe(false)
  })
})
