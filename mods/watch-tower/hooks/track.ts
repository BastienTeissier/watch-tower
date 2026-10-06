// The session's track, pure: its git state and commits, the attached plan,
// and what drifted from it, moved together so they never disagree. register.tsx
// gathers the facts from git and the plan file; every write goes through here.
import type { Git, Plan, SessionCommits, Track } from '../types'
import { isOffPlan, unplanned } from './plan'

export const TRACK: Track = {
  git: null,
  sessionBase: null,
  commits: { list: [], total: 0 },
  plan: null,
  drift: { files: [], commits: [] },
  allowed: [],
}

/** What one look at git and the plan file found; `plan` is the file read again, null when unreadable. */
export type Facts = { git: Git | null; commits: SessionCommits; plan: Plan | null; since: string[] }

/** The session's base is HEAD at its first start; a reload keeps it. */
export const began = (track: Track, head: string | null): Track => ({ ...track, sessionBase: track.sessionBase ?? head })

/** A plan attached: nothing has drifted from it yet, and no file is allowed off it. */
export const attached = (track: Track, plan: Plan): Track => ({ ...track, plan, drift: { files: [], commits: [] }, allowed: [] })

export const detached = (track: Track): Track => ({ ...track, plan: null })

/**
 * Takes a look's facts. The plan read again replaces the attached one only
 * when it is still the same file: one detached or swapped while git ran stays so.
 * `since` holds the subjects committed after the plan was attached.
 */
export function observed(track: Track, facts: Facts): Track {
  const { git, commits } = facts
  if (track.plan === null) return { ...track, git, commits }
  const plan = facts.plan?.path === track.plan.path ? facts.plan : track.plan

  return { ...track, git, commits, plan, drift: { ...track.drift, commits: unplanned(plan, facts.since) } }
}

/** True when an edit of `path` must be asked about: a plan is attached, lists no such file, and it was never allowed. */
export const holds = (track: Track, path: string): boolean =>
  track.plan !== null && isOffPlan(track.plan, path) && !track.allowed.includes(path)

/** An off-plan edit went ahead: it drifts once, and `isAllowed` lets the file through from now on. */
export function edited(track: Track, path: string, isAllowed: boolean): Track {
  const { drift, allowed } = track

  return {
    ...track,
    drift: drift.files.includes(path) ? drift : { ...drift, files: [...drift.files, path] },
    allowed: isAllowed && !allowed.includes(path) ? [...allowed, path] : allowed,
  }
}

/** A session commit against the plan: named by a task, drifted from it, or neither (no plan, or before it). */
export function commitMark(track: Track, subject: string): 'planned' | 'drift' | null {
  if (track.plan === null) return null
  if (track.drift.commits.includes(subject)) return 'drift'

  return unplanned(track.plan, [subject]).length === 0 ? 'planned' : null
}
