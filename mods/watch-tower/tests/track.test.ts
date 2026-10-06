import { describe, expect, test } from 'claude-code/testing'

import { parsePlan, tickCommits } from '../hooks/plan'
import { TRACK, attached, began, commitMark, detached, edited, holds, observed } from '../hooks/track'
import type { Facts } from '../hooks/track'
import { PLAN_MD } from './fixtures'

const plan = parsePlan('docs/plan.md', PLAN_MD, 'base0')
const look = (extra: Partial<Facts> = {}): Facts => ({
  git: { branch: 'feat/msv', dirty: 1 },
  commits: { list: [], total: 0 },
  plan,
  since: [],
  ...extra,
})

describe('track', () => {
  test('the session base is HEAD at the first start; a reload keeps it', () => {
    expect(began(began(TRACK, 'abc'), 'def').sessionBase).toBe('abc')
    expect(began(began(TRACK, null), 'def').sessionBase).toBe('def')
  })

  test('attaching starts over: nothing drifted, nothing allowed', () => {
    const before = edited(observed(attached(TRACK, plan), look({ since: ['wip: scratch'] })), 'hse/models.py', true)
    const again = attached(before, plan)

    expect(before.drift).toEqual({ files: ['hse/models.py'], commits: ['wip: scratch'] })
    expect(again).toMatchObject({ drift: { files: [], commits: [] }, allowed: [] })
  })

  test('a look takes git and the plan read again, and drifts the commits no task names', () => {
    const ticked = parsePlan('docs/plan.md', tickCommits(PLAN_MD, ['chore(hse): add hse app skeleton']), 'base0')
    const track = observed(attached(TRACK, plan), look({ plan: ticked, since: ['chore(hse): add hse app skeleton', 'wip: scratch'] }))

    expect(track.git).toEqual({ branch: 'feat/msv', dirty: 1 })
    expect(track.plan).toBe(ticked)
    expect(track.drift.commits).toEqual(['wip: scratch'])
  })

  test('a plan detached or swapped while git ran stays so; an unreadable file keeps the attached plan', () => {
    const other = parsePlan('docs/other.md', PLAN_MD, 'base0')

    expect(observed(detached(attached(TRACK, plan)), look()).plan).toBeNull()
    expect(observed(attached(TRACK, other), look()).plan).toBe(other)
    expect(observed(attached(TRACK, plan), look({ plan: null })).plan).toBe(plan)
    // Without a plan a look still takes git, and nothing drifts.
    expect(observed(TRACK, look({ since: ['wip: scratch'] }))).toMatchObject({ git: { branch: 'feat/msv' }, drift: { commits: [] } })
  })

  test('an edit off the plan is held until its file is allowed, and drifts once', () => {
    const track = attached(TRACK, plan)

    expect(holds(TRACK, 'hse/models.py')).toBe(false)
    expect(holds(track, 'hse/apps.py')).toBe(false)
    expect(holds(track, 'hse/models.py')).toBe(true)

    const once = edited(edited(track, 'hse/models.py', false), 'hse/models.py', false)
    expect(once.drift.files).toEqual(['hse/models.py'])
    expect(holds(once, 'hse/models.py')).toBe(true)
    expect(holds(edited(once, 'hse/models.py', true), 'hse/models.py')).toBe(false)
  })

  test('a commit is planned when a task names it, drift when it came after the plan unnamed, else unmarked', () => {
    const track = observed(attached(TRACK, plan), look({ since: ['chore(hse): add hse app skeleton', 'wip: after'] }))

    expect(commitMark(track, 'chore(hse): add hse app skeleton')).toBe('planned')
    expect(commitMark(track, 'wip: after')).toBe('drift')
    expect(commitMark(track, 'wip: before the plan')).toBeNull()
    expect(commitMark(TRACK, 'wip: after')).toBeNull()
  })
})
