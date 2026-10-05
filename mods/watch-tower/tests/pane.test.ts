import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

import { pressKey } from '../hooks/pane'

const NOW = Date.parse('2026-10-02T10:00:00Z')
const SURFACES = ['terminal', 'desktop'] as const

const pane = (surface: (typeof SURFACES)[number]) =>
  ({
    plugin: 'watch-tower',
    surface,
    component: 'Pane',
    requestId: 'watch-tower',
    props: { title: 'Watch Tower', isFocused: false, bodyColumns: 40, placement: 'dock' },
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

describe('watch-tower pane', () => {
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

  test('pressing an agent opens its details, again closes them, another moves them, a new prompt clears a gone one', async ($, on) => {
    engine(on)
    on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-sonnet-5-5' }) as any)
    on('turn.complete', ($, e) => ({ text: e.answer ?? '' }) as any)
    on('prompt.submit', ($, e) => ({ text: e.text }) as any)

    for (const surface of SURFACES) {
      await $.session.start({ surface, cwd: '/work', isInteractive: true })
      await $.prompt.submit({ text: 'map the models' } as any)
      await $.agent.spawn({ subagentType: 'Explore', description: 'find', prompt: 'look for models' } as any)

      const ui = await $.ui.mount(pane(surface))
      expect(await ui.find({ type: 'Text', text: /look for models/ })).toBeUndefined()

      await ui.press({ key: pressKey('a1') })
      expect((await ui.find({ key: pressKey('a1') }))?.text).toBe('▾')
      expect(await ui.find({ type: 'Text', text: /look for models/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /cache read 0k · write 0k/ })).toBeDefined()

      await ui.press({ key: pressKey('main') })
      expect((await ui.find({ key: pressKey('a1') }))?.text).toBe('●')
      expect((await ui.find({ key: pressKey('main') }))?.text).toBe('▾')
      expect(await ui.find({ type: 'Text', text: /^map the models$/ })).toBeDefined()

      await ui.press({ key: pressKey('main') })
      expect(await ui.find({ type: 'Button', text: '▾' })).toBeUndefined()

      // A new prompt starts a new main run, closed.
      await ui.press({ key: pressKey('main') })
      await $.prompt.submit({ text: 'again' } as any)
      expect((await ui.find({ key: pressKey('main') }))?.text).toBe('●')

      // The finished subagent is cleared at the next prompt, and its details with it.
      await ui.press({ key: pressKey('a1') })
      await $.turn.complete({ agentId: 'a1', turnId: 't', reason: 'answer', answer: '', usage: null } as any)
      await $.prompt.submit({ text: 'next' } as any)
      expect(await ui.find({ key: pressKey('a1') })).toBeUndefined()
      // A new agent under the same id starts closed.
      await $.agent.spawn({ subagentType: 'Explore', description: 'again', prompt: 'look' } as any)
      expect((await ui.find({ key: pressKey('a1') }))?.text).toBe('●')
      await ui.unmount()
    }
  })

  test('the pane reads agents, plan, context and quotas, then the companion last', async ($, on) => {
    engine(on)
    on('prompt.submit', ($, e) => ({ text: e.text }) as any)

    for (const surface of SURFACES) {
      await $.session.start({ surface, cwd: '/work', isInteractive: true })
      await $.prompt.submit({ text: 'go' } as any)
      await $.session.measure({
        context: { window: 200_000, percent: 12 },
        rateLimits: [{ kind: 'five_hour', percentUsed: 42 }],
        changed: ['context', 'rateLimits'],
      } as any)

      const ui = await $.ui.mount(pane(surface))
      const texts: string[] = (await ui.findAll({ type: 'Text' })).map((one: any) => one.text)
      const at = (pattern: RegExp) => texts.findIndex(text => pattern.test(text))
      expect(at(/^ main$/)).toBeGreaterThanOrEqual(0)
      expect(at(/^ main$/)).toBeLessThan(at(/^no plan/))
      expect(at(/^no plan/)).toBeLessThan(at(/ctx 12%/))
      expect(at(/ctx 12%/)).toBeLessThan(at(/5h/))
      expect(at(/5h/)).toBeLessThan(at(/^THINKING$/))
      expect(at(/^THINKING$/)).toBeLessThan(at(/~~~~~~/))
      await ui.unmount()
    }
  })

  test('with the companion off, no state, sprite, message or Tap; the rest stays', { options: { companion: false } }, async ($, on) => {
    engine(on)
    on('prompt.submit', ($, e) => ({ text: e.text }) as any)

    for (const surface of SURFACES) {
      await $.session.start({ surface, cwd: '/work', isInteractive: true })
      await $.prompt.submit({ text: 'go' } as any)
      await $.classic.Notification({ message: 'Claude is idle', notification_type: 'idle_prompt' })

      const ui = await $.ui.mount(pane(surface))
      expect(await ui.find({ key: pressKey('main') })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^no plan/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /ALERT/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /Claude is idle/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /~~~~~~/ })).toBeUndefined()
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
