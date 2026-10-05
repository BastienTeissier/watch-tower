// The session's commits, pure: parsed from `git log --format=%h%x09%s --shortstat`.
import type { Commit } from '../types'

/** How many commits the pane lists; the log asks for no more, the rest are only counted. */
export const MAX_COMMITS = 5

const HEAD = /^([0-9a-f]{4,})\t(.*)$/
const STAT = /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/

/** Newest first, as git lists them; a commit with no stat line (empty) counts 0 files. */
export function parseLog(stdout: string): Commit[] {
  const commits: Commit[] = []
  for (const line of stdout.split('\n')) {
    const head = HEAD.exec(line)
    if (head !== null) {
      commits.push({ hash: head[1] ?? '', subject: head[2] ?? '', files: 0, added: 0, removed: 0 })
      continue
    }
    const stat = STAT.exec(line)
    const last = commits.at(-1)
    if (stat === null || last === undefined) continue
    last.files = Number(stat[1])
    last.added = Number(stat[2] ?? 0)
    last.removed = Number(stat[3] ?? 0)
  }

  return commits
}
