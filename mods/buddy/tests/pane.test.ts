import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-02T10:00:00Z')
const SURFACES = ['terminal', 'desktop'] as const

const pane = (surface: (typeof SURFACES)[number]) =>
  ({
    plugin: 'buddy',
    surface,
    component: 'Pane',
    requestId: 'buddy',
    props: { title: 'Buddy', isFocused: false, bodyColumns: 40, placement: 'dock' },
  }) as any

/** Stands for the engine beneath the mod: a fixed clock and the calls the mod makes. */
function engine(on: On) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: {} }) as any)
  on('ui.open', () => ({ value: { isPlaced: true } }) as any)
  on('classic.Notification', () => ({}) as any)
  on('classic.PermissionRequest', () => ({}) as any)
  on('session.measure', ($, e) => ({ changed: e.changed }))

  return mock.clock(on, { now: NOW })
}

describe('buddy pane', () => {
  test('follows a tool call, an alert and the tap', async ($, on) => {
    engine(on)

    let surface: (typeof SURFACES)[number] = 'terminal'
    on('tool.call', async () => {
      const ui = await $.ui.mount(pane(surface))
      expect(await ui.find({ type: 'Text', text: /WORKING_BASH/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /make check/ })).toBeDefined()
      // The default Species is the snail: its slime trail is on the last row.
      expect(await ui.find({ type: 'Text', text: /~~~~~~/ })).toBeDefined()
      await ui.unmount()

      return { result: '', text: '' } as any
    })

    for (surface of SURFACES) {
      await $.session.start({ surface, cwd: '/work', isInteractive: true })
      await $.tool.call({ tool: 'Bash', command: 'make check' })

      const ui = await $.ui.mount(pane(surface))
      expect(await ui.find({ type: 'Text', text: /THINKING/ })).toBeDefined()
      expect(await ui.find({ key: 'tap' })).toBeUndefined()

      await $.classic.Notification({ message: 'Claude is idle', notification_type: 'idle_prompt' })
      expect(await ui.find({ type: 'Text', text: /ALERT/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Claude is idle/ })).toBeDefined()

      await ui.press({ key: 'tap' })
      expect(await ui.find({ type: 'Text', text: /THINKING/ })).toBeDefined()
      expect(await ui.find({ key: 'tap' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('a permission request puts the Buddy in WAITING', async ($, on) => {
    engine(on)
    await $.session.start({ surface: 'terminal', cwd: '/work', isInteractive: true })
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} } as any)

    const ui = await $.ui.mount(pane('terminal'))
    expect(await ui.find({ type: 'Text', text: /WAITING/ })).toBeDefined()
    await ui.unmount()
  })

  test('the Species option picks the silhouette', { options: { species: 'duck' } }, async ($, on) => {
    engine(on)
    await $.session.start({ surface: 'terminal', cwd: '/work', isInteractive: true })

    const ui = await $.ui.mount(pane('terminal'))
    expect(await ui.find({ type: 'Text', text: /IDLE/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: />/ })).toBeDefined()
    await ui.unmount()
  })

  test('gauges show once a measurement arrives and dim when stale', async ($, on) => {
    const clock = engine(on)
    await $.session.start({ surface: 'terminal', cwd: '/work', isInteractive: true })

    const ui = await $.ui.mount(pane('terminal'))
    expect(await ui.find({ type: 'Text', text: /5h/ })).toBeUndefined()

    await $.session.measure({
      context: { window: 200_000 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 42, resetsAt: new Date(NOW + 7_800_000).toISOString() },
        { kind: 'seven_day', percentUsed: 91.4 },
      ],
      changed: ['rateLimits'],
    })
    await clock.advance(500)

    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /in 2h9m/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /91%/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /42%/ }))?.props.dimColor).toBeFalsy()

    await clock.advance(11 * 60 * 1000)
    expect((await ui.find({ type: 'Text', text: /42%/ }))?.props.dimColor).toBe(true)
    await ui.unmount()
  })
})
