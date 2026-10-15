// chat-clean's view, as watch-tower switches it: which preset its settings
// match (a port of chat-clean's own modeOf) and the row of buttons that run
// `/feed <mode>`.
import type { ChatMode } from '../types'
import type { Row } from './rows'

export const CHAT_MODES = ['clean', 'normal', 'raw'] as const

/** The key of the button that switches chat-clean to `mode`. */
export const chatKey = (mode: string) => `chat:${mode}`

const FIELDS = ['clear', 'keep', 'group', 'style', 'commands', 'after'] as const
const PRESET: Record<'clean' | 'normal', Record<(typeof FIELDS)[number], unknown>> = {
  clean: { clear: true, keep: false, group: true, style: 'subtle', commands: 'grouped', after: 'clear' },
  normal: { clear: false, keep: true, group: false, style: 'subtle', commands: 'grouped', after: 'keep' },
}

/** The preset chat-clean's `settings` match; clean when none is stored yet, custom when they match none. */
export function chatModeOf(settings: unknown): ChatMode {
  if (settings === null || typeof settings !== 'object') return 'clean'
  const s = settings as Record<string, unknown>
  if (s.raw === true) return 'raw'
  const isPlain = !Array.isArray(s.hide) || s.hide.length === 0
  const match = (['clean', 'normal'] as const).find(mode => isPlain && FIELDS.every(field => PRESET[mode][field] === s[field]))

  return match ?? 'custom'
}

/** `chat` then a button per mode, the current one marked; null without chat-clean. */
export function chatRow(mode: ChatMode | null): Row | null {
  if (mode === null) return null

  return {
    key: 'chat',
    indent: 0,
    spans: [{ text: 'chat', isDim: true }],
    actions: CHAT_MODES.map(one => ({ key: chatKey(one), label: one, isOn: one === mode })),
  }
}
