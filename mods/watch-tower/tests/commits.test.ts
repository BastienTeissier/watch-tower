import { describe, expect, test } from 'claude-code/testing'

import { parseLog, shown } from '../hooks/commits'

const LOG = [
  'e41c7a2\tfeat(watch-tower): add companion toggle',
  '',
  ' 4 files changed, 38 insertions(+), 6 deletions(-)',
  '9b03f1d\tchore: drop a file',
  '',
  ' 1 file changed, 2 deletions(-)',
  '77aa001\tdocs: one line',
  '',
  ' 1 file changed, 1 insertion(+)',
  'c0ffee1\tchore: empty commit',
].join('\n')

describe('parseLog', () => {
  test('hash, subject and size of each commit, newest first', () => {
    expect(parseLog(LOG)).toEqual([
      { hash: 'e41c7a2', subject: 'feat(watch-tower): add companion toggle', files: 4, added: 38, removed: 6 },
      { hash: '9b03f1d', subject: 'chore: drop a file', files: 1, added: 0, removed: 2 },
      { hash: '77aa001', subject: 'docs: one line', files: 1, added: 1, removed: 0 },
      { hash: 'c0ffee1', subject: 'chore: empty commit', files: 0, added: 0, removed: 0 },
    ])
  })

  test('a subject with a tab keeps it; no output, no commit', () => {
    expect(parseLog('abc1234\tfix:\tthing')[0]?.subject).toBe('fix:\tthing')
    expect(parseLog('')).toEqual([])
  })
})

describe('shown', () => {
  test('caps the list and counts the earlier ones', () => {
    const commits = parseLog(LOG)

    expect(shown(commits, 2)).toEqual({ list: commits.slice(0, 2), earlier: 2 })
    expect(shown(commits, 5)).toEqual({ list: commits, earlier: 0 })
  })
})
