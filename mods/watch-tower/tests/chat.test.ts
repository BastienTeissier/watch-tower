import { describe, expect, test } from 'claude-code/testing'

import { chatModeOf, chatRow } from '../hooks/chat'

const clean = { raw: false, clear: true, keep: false, group: true, style: 'subtle', commands: 'grouped', after: 'clear', hide: [] }
const normal = { raw: false, clear: false, keep: true, group: false, style: 'subtle', commands: 'grouped', after: 'keep', hide: [] }

describe('chatModeOf', () => {
  test('each preset by its settings; clean when nothing is stored; custom off the presets', () => {
    expect(chatModeOf(clean)).toBe('clean')
    expect(chatModeOf(normal)).toBe('normal')
    expect(chatModeOf({ ...normal, raw: true, style: 'expanded' })).toBe('raw')
    expect(chatModeOf(undefined)).toBe('clean')
    expect(chatModeOf({ ...clean, hide: ['tool'] })).toBe('custom')
    expect(chatModeOf({ ...clean, style: 'line' })).toBe('custom')
  })
})

describe('chatRow', () => {
  test('no row without chat-clean; a button per mode, the current one on', () => {
    expect(chatRow(null)).toBeNull()
    expect(chatRow('normal')?.actions).toEqual([
      { key: 'chat:clean', label: 'clean', isOn: false },
      { key: 'chat:normal', label: 'normal', isOn: true },
      { key: 'chat:raw', label: 'raw', isOn: false },
    ])
    expect(chatRow('custom')?.actions?.some(one => one.isOn)).toBe(false)
  })
})
