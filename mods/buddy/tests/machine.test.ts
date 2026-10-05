import { describe, expect, test } from 'claude-code/testing'

import { INITIAL, STATE, clearAlert, mapEvent, push, truncate } from '../hooks/machine'

describe('mapEvent', () => {
  test('maps each event as the Bridge maps its hook', () => {
    expect(mapEvent({ kind: 'session' })).toEqual({ code: STATE.IDLE, msg: '' })
    expect(mapEvent({ kind: 'prompt' })).toEqual({ code: STATE.THINKING, msg: '' })
    expect(mapEvent({ kind: 'tool', tool: 'Bash', command: 'ls -la' })).toEqual({
      code: STATE.WORKING_BASH,
      msg: 'ls -la',
    })
    for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) {
      expect(mapEvent({ kind: 'tool', tool, filePath: '/a/b.py' })).toEqual({
        code: STATE.WORKING_EDIT,
        msg: '/a/b.py',
      })
    }
    expect(mapEvent({ kind: 'tool', tool: 'Read' })).toEqual({ code: STATE.THINKING, msg: 'Read' })
    expect(mapEvent({ kind: 'tool-done' })).toEqual({ code: STATE.THINKING, msg: '' })
    expect(mapEvent({ kind: 'stop' })).toEqual({ code: STATE.HAPPY, msg: '' })
    expect(mapEvent({ kind: 'permission', message: 'Bash' })).toEqual({ code: STATE.WAITING, msg: 'Bash' })
    expect(mapEvent({ kind: 'notification', message: 'hey' })).toEqual({ code: STATE.ALERT, msg: 'hey' })
  })

  test('truncates the message to 120 bytes without splitting a character', () => {
    expect(truncate('x'.repeat(200))).toHaveLength(120)
    expect(truncate('é'.repeat(100))).toBe('é'.repeat(60))
    expect(truncate('a' + 'é'.repeat(100))).toBe('a' + 'é'.repeat(59))
  })
})

describe('alert memory', () => {
  const bash = { code: STATE.WORKING_BASH, msg: 'make check' }
  const alert = { code: STATE.ALERT, msg: 'look' }

  test('clearing an alert re-emits the prior activity', () => {
    const alerted = push(push(INITIAL, bash), alert)

    expect(alerted.status).toEqual(alert)
    expect(clearAlert(alerted).status).toEqual(bash)
  })

  test('IDLE never shadows the prior activity', () => {
    const alerted = push(push(push(INITIAL, bash), { code: STATE.IDLE, msg: '' }), alert)

    expect(clearAlert(alerted).status).toEqual(bash)
  })

  test('falls back to IDLE when nothing was ever active', () => {
    expect(clearAlert(push(INITIAL, alert)).status).toEqual(INITIAL.status)
  })

  test('is a no-op outside an alert pose', () => {
    const working = push(INITIAL, bash)

    expect(clearAlert(working)).toBe(working)
  })
})
