import { describe, expect, test } from 'claude-code/testing'

import { isOffPlan, parsePlan, position, relativeTo, tickCommits, unplanned } from '../hooks/plan'
import { PLAN_MD } from './fixtures'

const plan = parsePlan('docs/plan.md', PLAN_MD)

describe('parsePlan', () => {
  test('reads phases, tasks, commit titles and files from the To Do List alone', () => {
    expect(plan.phases.map(one => one.name)).toEqual(['Phase 0 — App skeleton', 'Phase 1 — UF1 list & detail'])
    expect(plan.phases[0]?.tasks.map(one => one.title)).toEqual(['Register the `hse` app', 'Wire URLs', 'Verify'])
    expect(plan.phases[0]?.tasks[0]).toEqual({
      title: 'Register the `hse` app',
      commit: 'chore(hse): add hse app skeleton',
      files: ['hse/__init__.py', 'hse/apps.py', 'core/settings.py'],
      isDone: false,
    })
    // Backticks that are not paths stay out of the files.
    expect(plan.phases[0]?.tasks[1]?.files).toEqual(['hse/urls.py', 'core/urls.py'])
    expect(plan.phases[0]?.tasks[2]?.commit).toBeNull()
    expect(plan.phases[1]?.tasks[0]?.isDone).toBe(true)
  })

  test('reads a plan without a To Do List whole, phases from its headings', () => {
    const loose = parsePlan('p.md', '# T\n\n## Acceptance Criteria\n- [ ] one\n- [x] two\n')

    expect(loose.phases).toEqual([
      {
        name: 'Acceptance Criteria',
        tasks: [
          { title: 'one', commit: null, files: [], isDone: false },
          { title: 'two', commit: null, files: [], isDone: true },
        ],
      },
    ])
  })
})

describe('tickCommits', () => {
  test('ticks the one task whose commit title was committed and nothing else', () => {
    const ticked = tickCommits(PLAN_MD, ['chore(hse): add hse app skeleton', 'fix: unrelated'])

    expect(ticked).toContain('- [x] **Register the `hse` app**')
    expect(ticked).toContain('- [ ] **Wire URLs**')
    expect(ticked.split('\n')).toHaveLength(PLAN_MD.split('\n').length)
    expect(tickCommits(PLAN_MD, [])).toBe(PLAN_MD)
  })
})

describe('position', () => {
  test('points at the first open task with a commit title', () => {
    const at = position(plan)

    expect(at.phase?.name).toBe('Phase 0 — App skeleton')
    expect(at.current?.title).toBe('Register the `hse` app')
    expect(at.next?.title).toBe('Wire URLs')
    expect([at.phaseDone, at.phaseTotal, at.done, at.total]).toEqual([0, 3, 1, 5])
  })

  test('rolls into the next phase past a Verify step and reports completion', () => {
    const later = parsePlan('p.md', tickCommits(PLAN_MD, ['chore(hse): add hse app skeleton', 'chore(hse): wire urls']))
    const at = position(later)

    expect(at.phase?.name).toBe('Phase 1 — UF1 list & detail')
    expect(at.current?.title).toBe('List templates')
    expect(at.next).toBeNull()

    const done = position(parsePlan('p.md', tickCommits(PLAN_MD, ['chore(hse): add hse app skeleton', 'chore(hse): wire urls', 'feat(hse): add msv list templates'])))
    expect(done.current?.title).toBe('Verify')
    expect(done.phase?.name).toBe('Phase 0 — App skeleton')
  })
})

describe('isOffPlan', () => {
  test('covers exact files, folders and globs listed anywhere in the plan, and the plan itself', () => {
    expect(isOffPlan(plan, 'hse/apps.py')).toBe(false)
    expect(isOffPlan(plan, 'templates/hse/msv/list.html')).toBe(false)
    expect(isOffPlan(plan, 'styles/hse.css')).toBe(false)
    expect(isOffPlan(plan, 'docs/plan.md')).toBe(false)
    expect(isOffPlan(plan, 'hse/models.py')).toBe(true)
    expect(isOffPlan(plan, 'styles/hse.scss')).toBe(true)
  })

  test('relativeTo keeps paths inside the working directory only', () => {
    expect(relativeTo('/work', '/work/hse/apps.py')).toBe('hse/apps.py')
    expect(relativeTo('/work', './hse/apps.py')).toBe('hse/apps.py')
    expect(relativeTo('/work', '/other/x.py')).toBeNull()
    expect(relativeTo('/work', '../shared/x.py')).toBeNull()
  })
})

describe('unplanned', () => {
  test('keeps the commit subjects no task names', () => {
    expect(unplanned(plan, ['chore(hse): wire urls', 'fix: typo', 'wip'])).toEqual(['fix: typo', 'wip'])
  })
})
