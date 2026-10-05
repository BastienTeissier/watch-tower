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

/**
 * A fake repo: the plan file, a git log the test appends to (oldest first),
 * the git commands run, and the user's answer to the guard.
 */
type World = {
  files: Record<string, string>
  subjects: string[]
  isRepo: boolean
  /** No commit yet: anything naming HEAD fails until the first one. */
  isUnborn: boolean
  runs: string[][]
  answer: string
  asked: string[]
  opened: { id: string; title?: string }[]
}

/** The hash of the commit at `at` in the log; `base0` stands before the first one. */
const hashOf = (at: number) => (at + 1).toString(16).padStart(7, '0')

/** What `git <argv>` prints: `base..HEAD` ranges, `-n`, `rev-list --count` and `--shortstat` are honoured. */
function gitOut(world: World, argv: string[]): string {
  const [sub, flag] = argv
  const head = world.subjects.length === 0 ? 'base0' : hashOf(world.subjects.length - 1)
  if (sub === 'rev-parse') return flag === '--abbrev-ref' ? 'feat/msv' : flag === '--git-dir' ? '.git' : head

  const base = argv.find(arg => arg.endsWith('..HEAD'))?.slice(0, -'..HEAD'.length)
  const from = base === undefined || base === 'base0' ? 0 : world.subjects.findIndex((_, at) => hashOf(at) === base) + 1
  const range = world.subjects.map((subject, at) => ({ subject, hash: hashOf(at) })).slice(from)
  if (sub === 'rev-list') return String(range.length)
  if (sub !== 'log') return ''

  const n = argv.indexOf('-n')
  const newest = range.reverse().slice(0, n === -1 ? undefined : Number(argv[n + 1]))
  if (!argv.includes('--shortstat')) return newest.map(commit => commit.subject).join('\n')

  return newest.map(commit => `${commit.hash}\t${commit.subject}\n\n 1 file changed, 2 insertions(+)`).join('\n')
}

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
    const argv = e.argv.slice(1)
    world.runs.push(argv)
    const isOk = world.isRepo && !(world.isUnborn && world.subjects.length === 0 && argv.some(arg => arg.includes('HEAD')))
    const stdout = isOk ? gitOut(world, argv) : ''

    return { value: { exitCode: isOk ? 0 : 128, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as any
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

/** One model request of `agentId` (the main thread when absent), read to its end. */
async function step($: any, model: string, agentId?: string) {
  const stream = $.turn.step({ turnId: 't', index: 0, model, messageCount: 1, agentId })
  while (!(await stream.next()).done);
}

const USAGE = { input_tokens: 4_000, output_tokens: 8_000, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 50_000 }

const world = (): World => ({ files: { [PLAN]: PLAN_MD }, subjects: [], isRepo: true, isUnborn: false, runs: [], answer: 'Deny', asked: [], opened: [] })

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

  test('a child sits under its parent, timers run, main freezes when its turn ends or is interrupted', async ($, on) => {
    const repo = world()
    const clock = engine(on, repo)
    let spawns = 0
    on('agent.spawn', () => ({ agentId: `a${(spawns += 1)}`, model: 'claude-sonnet-5-5' }) as any)
    on('turn.complete', ($, e) => ({ text: e.answer ?? '' }) as any)
    on('prompt.submit', ($, e) => ({ text: e.text }) as any)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    await $.prompt.submit({ text: 'map the models' })
    await $.agent.spawn({ subagentType: 'Explore', description: 'parent', prompt: 'look' } as any)
    await $.agent.spawn({ subagentType: 'Explore', description: 'child', prompt: 'look', parentAgentId: 'a1' } as any)

    const ui = await $.ui.mount(pane)
    expect(await ui.find({ type: 'Text', text: /^ {2}● Explore: parent/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ {4}● Explore: child/ })).toBeDefined()

    await clock.advance(65_000)
    expect(await ui.find({ type: 'Text', text: / 1m05s$/ })).toBeDefined()

    // Esc on the main thread: its foreground subagents end with it, and its time stops.
    await $.turn.complete({ turnId: 't1', reason: 'aborted', answer: '', usage: null } as any)
    await clock.advance(10_000)
    expect(await ui.find({ type: 'Text', text: /✗ main/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✗ Explore: child/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / 1m05s ↑0k ↓0k$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /●/ })).toBeUndefined()

    await $.prompt.submit({ text: 'next' })
    await $.turn.complete({ turnId: 't2', reason: 'answer', answer: 'ok', usage: null } as any)
    await clock.advance(5_000)
    expect(await ui.find({ type: 'Text', text: /✓ main/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: / 0s ↑0k ↓0k$/ })).toBeDefined()
    await ui.unmount()
  })

  test('requests charge their agent, the engine cost is split into rows that sum to Σ turn', async ($, on) => {
    const repo = world()
    const clock = engine(on, repo)
    on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-haiku-4-5-20251001' }) as any)
    on('prompt.submit', ($, e) => ({ text: e.text }) as any)
    on('session.measure', ($, e) => ({ changed: e.changed }))
    // The fake API answers each request with the same usage, on the model asked for.
    on('turn.step', async function* ($, e) {
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { ...USAGE, model: e.model } } as any
    })
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    await $.prompt.submit({ text: 'map the models' })
    await $.agent.spawn({ subagentType: 'Explore', description: 'find the models', prompt: 'look' } as any)
    await step($, 'claude-opus-5-5')
    await step($, 'claude-haiku-4-5-20251001', 'a1')
    await $.tool.call({ tool: 'Read', file_path: `${CWD}/hse/models.py`, agentId: 'a1' } as any)
    await $.session.measure({ context: { window: 200_000, percent: 42 }, rateLimits: [], cost: { usd: 1 }, changed: ['cost'] } as any)

    const ui = await $.ui.mount(pane)
    await clock.advance(500)
    // Same tokens, priced 0.444 on Opus 5.5 and 0.1155 on Haiku 4.5: 79¢ and 21¢ of the $1.00 spent.
    expect(await ui.find({ type: 'Text', text: /opus-5\.5 · ↑54k ↓8k · \$0\.79/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /haiku-4\.5 · ↑54k ↓8k · \$0\.21/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Σ turn .* 1 agent  ↑108k ↓16k  \$1\.00/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Σ session .* 1 agent  1 tool/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /↑108k ↓16k  cache 63%  \$1\.00/ })).toBeDefined()
    // The context fill sits with the cache countdown; the old vitals line is gone.
    expect(await ui.find({ type: 'Text', text: /^ctx 42%  ❄ cache 5:00$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /tools 1|turn \d/ })).toBeUndefined()

    await $.prompt.submit({ text: 'next' })
    await clock.advance(500)
    expect(await ui.find({ type: 'Text', text: /Σ turn .* 0 agents  ↑0k ↓0k  \$0\.00/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /↑108k ↓16k  cache 63%  \$1\.00/ })).toBeDefined()
    await ui.unmount()
  })

  test('commits of the session appear after the command that made them, marked against the plan, and outlive the prompt', async ($, on) => {
    const repo = world()
    const clock = engine(on, repo)
    on('prompt.submit', ($, e) => ({ text: e.text }) as any)
    repo.subjects.push('chore: before the session')
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    const ui = await $.ui.mount(pane)
    expect(await ui.find({ type: 'Text', text: /^feat\/msv  ±0 uncommitted$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^commits$/ })).toBeUndefined()

    repo.subjects.push('wip: scratch')
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "wip: scratch"' })
    await clock.advance(500)
    expect(await ui.find({ type: 'Text', text: /^0000002 wip: scratch$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ {4}1 file \+2 −0$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /before the session/ })).toBeUndefined()

    await $.command.run({ command: 'watch-tower', args: `plan ${PLAN}` } as any)
    repo.subjects.push('chore(hse): add hse app skeleton', 'b', 'c', 'd', 'e')
    await $.tool.call({ tool: 'Bash', command: 'git commit -m e' })
    await $.prompt.submit({ text: 'next' })
    await clock.advance(500)
    expect(await ui.find({ type: 'Text', text: /^! 0000007 e$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^✓ 0000003 chore\(hse\): add hse app skeleton$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /wip: scratch/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^\+1 earlier$/ })).toBeDefined()
    // Only the shown commits are diffed, along the first parent: a merge counts once.
    expect(repo.runs.filter(argv => argv.includes('--shortstat')).at(-1)).toEqual(
      expect.arrayContaining(['-n', '5', '--first-parent', '0000001..HEAD']),
    )
    await ui.unmount()
  })

  test('a session started before the first commit lists every commit the branch gets', async ($, on) => {
    const repo = { ...world(), isUnborn: true }
    const clock = engine(on, repo)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    repo.subjects.push('feat: first')
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: first"' })
    const ui = await $.ui.mount(pane)
    await clock.advance(500)
    expect(await ui.find({ type: 'Text', text: /^0000001 feat: first$/ })).toBeDefined()
    await ui.unmount()
  })

  test('outside a git repository, no commits section and nothing fails', async ($, on) => {
    const repo = { ...world(), isRepo: false }
    engine(on, repo)
    await $.session.start({ surface: 'terminal', cwd: CWD, isInteractive: true })

    const ui = await $.ui.mount(pane)
    expect(await ui.find({ type: 'Text', text: /uncommitted/ })).toBeUndefined()
    await ui.unmount()
  })
})
