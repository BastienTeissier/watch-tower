// Per-state visual style. Port of the claude-ble-buddy firmware's sprite styles
// and gauge helpers.
import { STATE } from './machine'

export type Style = {
  name: string
  shell: string
  eye: string
  isEyeCycling: boolean
  isPulsing: boolean
}

const STYLES: Record<number, Style> = {
  [STATE.IDLE]: { name: 'IDLE', shell: '#508cc8', eye: '.', isEyeCycling: true, isPulsing: false },
  [STATE.THINKING]: { name: 'THINKING', shell: '#a064dc', eye: 'o', isEyeCycling: false, isPulsing: false },
  [STATE.WORKING_BASH]: { name: 'WORKING_BASH', shell: '#32c850', eye: 'o', isEyeCycling: false, isPulsing: false },
  [STATE.WORKING_EDIT]: { name: 'WORKING_EDIT', shell: '#ff8c28', eye: 'o', isEyeCycling: false, isPulsing: false },
  [STATE.WAITING]: { name: 'WAITING', shell: '#f0dc3c', eye: '.', isEyeCycling: true, isPulsing: true },
  [STATE.HAPPY]: { name: 'HAPPY', shell: '#50ff78', eye: '^', isEyeCycling: false, isPulsing: false },
  [STATE.WORRIED]: { name: 'WORRIED', shell: '#b4503c', eye: '.', isEyeCycling: false, isPulsing: false },
  [STATE.ALERT]: { name: 'ALERT', shell: '#ff3232', eye: 'X', isEyeCycling: false, isPulsing: true },
}

/** What left the plan: drift counts and off-plan commits. */
export const DRIFT_COLOR = '#ff8c28'
/** The plan's phase, in the pane and the band. */
export const PLAN_COLOR = '#a064dc'

const UNKNOWN: Style = { name: 'UNKNOWN', shell: '#ff00ff', eye: '?', isEyeCycling: false, isPulsing: false }
const EYE_CYCLE = ['.', 'o', 'O']

export const BODY_COLOR = '#dcc3a0'
export const EYE_COLOR = '#ffffff'
export const GAUGE_STALE_MS = 10 * 60 * 1000

export function styleFor(code: number): Style {
  return STYLES[code] ?? UNKNOWN
}

export function eyeGlyph(style: Style, frame: number): string {
  return (style.isEyeCycling ? EYE_CYCLE[frame % EYE_CYCLE.length] : undefined) ?? style.eye
}

export function gaugeColor(pct: number): string {
  if (pct >= 90) return '#ff3c3c'
  if (pct >= 70) return '#f0dc3c'

  return '#32c850'
}

export function gaugeBar(pct: number, width = 10): string {
  const filled = Math.floor((Math.max(0, Math.min(100, pct)) * width) / 100)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function countdown(secs: number): string {
  if (secs <= 0) return 'now'
  if (secs < 60) return '<1m'
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h${Math.floor((secs % 3600) / 60)}m`

  return `${Math.floor(secs / 86400)}d${Math.floor((secs % 86400) / 3600)}h`
}
