# UF4: See the commits performed

## Context

A "commits" section of the pane, below the agent tree. Today the pane shows only a count (`+3 commits`), and only since a plan was attached.

## Specification

AAU, during a session, I see in the commits section:
- every commit made on the current branch since the session started, newest first
- per commit: short hash and subject on one line, then its size on a second line (`3 files +120 −8`)
- when a plan is attached: `✓` in front of a commit whose subject is a plan task, `!` and the drift colour for one the plan does not name
- at most 5 commits, then `+N earlier`
- the branch name and the number of uncommitted paths

## Success Scenario

- AAU, when Claude commits, I see the commit appear at the top of the list without my doing anything
- AAU, when a commit touches far more files than I expected, I see it from its size line
- AAU, when I submit a new prompt, the list is kept: it covers the session, not the turn

## Edge Cases

- AAU, if no commit was made this session, the section shows only the branch and uncommitted count
- AAU, if I commit from another terminal during the session, that commit appears at the next refresh (end of turn, or the next git command Claude runs)
- AAU, if no plan is attached, commits carry no mark
- AAU, if history is rewritten (amend, rebase), the list reflects the branch as it now stands
- AAU, if the working directory is not a git repository, the section is absent
- AAU, if a subject is wider than the pane, it is truncated; the hash stays visible

## Acceptance Criteria

- [ ] A commit made by Claude appears in the list right after the command that made it
- [ ] Each commit shows short hash, subject, files changed, lines added and removed
- [ ] The list covers the session and survives new prompts
- [ ] No more than 5 commits are listed; the rest are counted
- [ ] With a plan attached, on-plan and off-plan commits are told apart
- [ ] Outside a git repository the section does not render and nothing fails
