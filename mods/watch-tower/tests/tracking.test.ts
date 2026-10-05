import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

import { PLAN_MD } from './fixtures'

const NOW = Date.parse('2026-10-04T10:00:00Z')
const CWD = '/work'
const PLAN = 'docs/plan.md'

const pane = {
  plugin: 'watch-tower',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'watch-tower',
  props: { title: 'Watch Tower', isFocused: false, bodyColumns: 60, placement: 'dock' },
} as any

/** A fake repo: the plan file, a git log the test appends to, and the user's answer to the guard. */
type World = { files: Record<string, string>; subjects: string[]; answer: string; asked: string[]; opened: { id: string; title?: string }[] }

// The engine hands the hooks absolute paths: a fake file is found by its tail.
const fileKey = (world: World, path: string) => Object.keys(world.files).find(key => path.endsWith(key))

function engine(on: On, world: World) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }) as any)
  on('command.register', () => ({ value: {} }) as any)
  on('ui.open', ($, e) => {
    world.opened.push({ id: e.id, title: e.title })

    return { value: { isPlaced: true } } as any
  })
  on('ui.toast', () => ({ value: undefined }) as any)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e) // the engine's own band, one marker here

    return h(Text, { key: 'engine-band' }, 'engine') as any
  })
  on('fs.read', ($, e) => {
    const key = fileKey(world, e.path)
    const text = key === undefined ? undefined : world.files[key]
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)

    return { value: text } as any
  })
  on('fs.write', ($, e) => {
    world.files[fileKey(world, e.path) ?? e.path] = e.text

    return { value: undefined } as any
  })
  on('fs.exists', ($, e) => ({ value: fileKey(world, e.path) !== undefined }) as any)
  on('process.run', ($, e) => {
    const [, sub, flag] = e.argv
    const stdout =
      sub === 'rev-parse' && flag === '--abbrev-ref' ? 'feat/msv' : sub === 'rev-parse' ? 'base0' : sub === 'log' ? world.subjects.join('\n') : ''

    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as any
  })
  on('tool.call', ($, e) => {
    if (e.tool === 'AskUserQuestion') {
      const question = e.questions[0]
      world.asked.push(question?.question ?? '')

      return { result: { questions: e.questions, answers: { [question?.question ?? '']: world.answer } }, text: world.answer } as any
    }

    return { result: '', text: '' } as any
  })
  mock.store(on)
  mock.env(on, { HOME: '/home/me' })

  return mock.clock(on, { now: NOW })
}

const world = (): World => ({ files: { [PLAN]: PLAN_MD }, subjects: [], answer: 'Deny', asked: [], opened: [] })

describe('plan tracking', () => {
  test('/watch-tower opens the Watch Tower pane', async ($, on) => {
    const repo = world()
    engine(on, repo)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    const { text } = await $.command.run({ command: 'watch-tower', args: '' } as any)
    expect(text).toBe('Watch Tower pane opened.')
    expect(repo.opened.at(-1)).toEqual({ id: 'watch-tower', title: 'Watch Tower' })
  })

  test('/watch-tower plan attaches the plan, the pane and the band show its position', async ($, on) => {
    const repo = world()
    engine(on, repo)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    const { text } = await $.command.run({ command: 'watch-tower', args: `plan ${PLAN}` } as any)
    expect(text).toContain('Phase 0 — App skeleton 0/3')
    expect(text).toContain('now: Register the `hse` app')

    const ui = await $.ui.mount(pane)
    expect(await ui.find({ type: 'Text', text: /Phase 0 — App skeleton/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /▸ Register the `hse` app/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /next: Wire URLs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /feat\/msv/ })).toBeDefined()
    await ui.unmount()

    const band = await $.ui.mount({
      ...pane,
      component: 'AbovePrompt',
      requestId: 'band',
      props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { bodyRows: 4 } },
    })
    expect(await band.find({ type: 'Text', text: /P0 0\/3/ })).toBeDefined()
    await band.unmount()
  })

  test('a commit named by the plan ticks its box and moves the position', async ($, on) => {
    const repo = world()
    engine(on, repo)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })
    await $.command.run({ command: 'watch-tower', args: `plan ${PLAN}` } as any)

    repo.subjects.push('chore(hse): add hse app skeleton', 'wip: scratch')
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "chore(hse): add hse app skeleton"' })

    expect(repo.files[PLAN]).toContain('- [x] **Register the `hse` app**')
    const ui = await $.ui.mount(pane)
    expect(await ui.find({ type: 'Text', text: /▸ Wire URLs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /drift: 0 files, 1 commits/ })).toBeDefined()
    await ui.unmount()
  })

  test('the guard holds an off-plan edit, denies it on Deny and remembers Allow file', async ($, on) => {
    const repo = world()
    engine(on, repo)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    // No plan attached: nothing is asked.
    await $.tool.call({ tool: 'Edit', file_path: `${CWD}/hse/models.py`, old_string: 'a', new_string: 'b' })
    expect(repo.asked).toHaveLength(0)

    await $.command.run({ command: 'watch-tower', args: `plan ${PLAN}` } as any)

    // Listed in the plan, or outside the working directory: passes without a question.
    await $.tool.call({ tool: 'Edit', file_path: `${CWD}/hse/apps.py`, old_string: 'a', new_string: 'b' })
    await $.tool.call({ tool: 'Write', file_path: '/elsewhere/notes.md', content: 'x' })
    expect(repo.asked).toHaveLength(0)

    const denied = await $.tool.call({ tool: 'Edit', file_path: `${CWD}/hse/models.py`, old_string: 'a', new_string: 'b' })
    expect(repo.asked[0]).toContain('Off-plan edit: hse/models.py')
    expect(repo.asked[0]).toContain('Register the `hse` app')
    expect(denied.deny).toContain('hse/models.py is not listed in the plan')

    repo.answer = 'Allow file'
    const allowed = await $.tool.call({ tool: 'Edit', file_path: `${CWD}/hse/models.py`, old_string: 'a', new_string: 'b' })
    expect(allowed.deny).toBeUndefined()
    await $.tool.call({ tool: 'Edit', file_path: `${CWD}/hse/models.py`, old_string: 'b', new_string: 'c' })
    expect(repo.asked).toHaveLength(2)

    const ui = await $.ui.mount(pane)
    expect(await ui.find({ type: 'Text', text: /drift: 1 files, 0 commits/ })).toBeDefined()
    await ui.unmount()
  })

  test('/watch-tower plan off detaches and a new session restores the branch plan from the store', async ($, on) => {
    const repo = world()
    engine(on, repo)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })
    await $.command.run({ command: 'watch-tower', args: `plan ${PLAN}` } as any)

    // A reload runs session.start again: the plan comes back from the store.
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })
    expect((await $.command.run({ command: 'watch-tower', args: 'plan' } as any)).text).toContain('now: Register')

    expect((await $.command.run({ command: 'watch-tower', args: 'plan off' } as any)).text).toBe('watch-tower: plan detached.')
    expect((await $.command.run({ command: 'watch-tower', args: 'plan' } as any)).text).toBe('watch-tower: no plan attached.')
  })

  test('the tree shows main and its subagents, finished ones until the next prompt', async ($, on) => {
    const repo = world()
    const clock = engine(on, repo)
    on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-sonnet-5-5' }) as any)
    on('turn.complete', ($, e) => ({ text: e.answer ?? '' }) as any)
    on('prompt.submit', ($, e) => ({ text: e.text }) as any)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    await $.prompt.submit({ text: 'map the models' })
    await $.agent.spawn({ subagentType: 'Explore', description: 'find the models', prompt: 'look' } as any)
    await $.tool.call({ tool: 'Read', file_path: `${CWD}/hse/models.py`, agentId: 'a1' } as any)

    const ui = await $.ui.mount(pane)
    expect(await ui.find({ type: 'Text', text: /● main/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /● Explore: find the models/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /sonnet-5\.5/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /reading hse\/models\.py/ })).toBeDefined()

    await $.turn.complete({ agentId: 'a1', turnId: 't1', reason: 'answer', answer: 'done', usage: null } as any)
    await clock.advance(31_000)
    expect(await ui.find({ type: 'Text', text: /✓ Explore: find the models/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /reading hse\/models\.py/ })).toBeUndefined()

    await $.prompt.submit({ text: 'next' })
    await clock.advance(500)
    expect(await ui.find({ type: 'Text', text: /find the models/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /● main/ })).toBeDefined()
    await ui.unmount()
  })
})
