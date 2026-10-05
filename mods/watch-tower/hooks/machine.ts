// Buddy state machine. Port of the claude-ble-buddy Bridge (hooks.py, state.py):
// same state codes, same event mapping, same alert memory.
import type { Machine, Status } from '../types'

export const STATE = {
  IDLE: 0x00,
  THINKING: 0x01,
  WORKING_BASH: 0x02,
  WORKING_EDIT: 0x03,
  WAITING: 0x04,
  HAPPY: 0x05,
  WORRIED: 0x06,
  ALERT: 0x07,
} as const

export const MAX_MSG_BYTES = 120

const ALERT_CODES: readonly number[] = [STATE.WAITING, STATE.ALERT]
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']

export type BuddyEvent =
  | { kind: 'session' }
  | { kind: 'prompt' }
  | { kind: 'tool'; tool: string; command?: string; filePath?: string }
  | { kind: 'tool-done' }
  | { kind: 'stop' }
  | { kind: 'permission'; message: string }
  | { kind: 'notification'; message: string }

export const INITIAL: Machine = {
  status: { code: STATE.IDLE, msg: '' },
  prior: { code: STATE.IDLE, msg: '' },
}

export function truncate(text: string): string {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length <= MAX_MSG_BYTES) return text

  return new TextDecoder().decode(bytes.slice(0, MAX_MSG_BYTES)).replace(/�+$/, '')
}

export function mapEvent(event: BuddyEvent): Status {
  switch (event.kind) {
    case 'session':
      return { code: STATE.IDLE, msg: '' }
    case 'prompt':
    case 'tool-done':
      return { code: STATE.THINKING, msg: '' }
    case 'tool':
      if (event.tool === 'Bash') {
        return { code: STATE.WORKING_BASH, msg: truncate(event.command ?? '') }
      }
      if (EDIT_TOOLS.includes(event.tool)) {
        return { code: STATE.WORKING_EDIT, msg: truncate(event.filePath ?? '') }
      }
      return { code: STATE.THINKING, msg: truncate(event.tool) }
    case 'stop':
      return { code: STATE.HAPPY, msg: '' }
    case 'permission':
      return { code: STATE.WAITING, msg: truncate(event.message) }
    case 'notification':
      return { code: STATE.ALERT, msg: truncate(event.message) }
  }
}

export function isAlert(code: number): boolean {
  return ALERT_CODES.includes(code)
}

/** Apply a Status. Sustained non-IDLE activities are remembered as `prior`. */
export function push(machine: Machine, status: Status): Machine {
  const isSustained = !isAlert(status.code) && status.code !== STATE.IDLE

  return { status, prior: isSustained ? status : machine.prior }
}

/** The button tap: re-emit the prior activity when in an alert pose, else no-op. */
export function clearAlert(machine: Machine): Machine {
  return isAlert(machine.status.code) ? { ...machine, status: machine.prior } : machine
}
