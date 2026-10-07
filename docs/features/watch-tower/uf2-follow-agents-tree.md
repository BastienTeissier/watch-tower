# UF2: Follow agents in a live tree

## Context

Top section of the pane, visible whenever the pane is open. It replaces the current one-line-per-subagent list, which has no row for the main thread and drops a finished agent after 30 seconds.

## Specification

AAU, while a turn runs, I see at the top of the pane:
- one row for the main thread, labelled `main`, as the root of the tree
- each subagent indented under the agent that spawned it, labelled with its type and short description
- for a running agent, three lines: its label and elapsed time; its model; what it is doing right now (running a command, editing or reading a file, searching, using a tool)
- for a finished agent, a single line with its label and final elapsed time
- a status mark per agent: `●` running, `✓` finished, `✗` failed or interrupted
- elapsed times that advance live without my doing anything

## Success Scenario

- AAU, when Claude spawns three subagents in parallel, I see three rows appear under `main`, each with its own timer and current action
- AAU, when a subagent finishes, I see its row collapse to one line with `✓` and its final time, and I still get the existing toast
- AAU, when I submit the next prompt, finished agents of the previous turn are cleared and the tree starts over with `main`

## Error Scenario

- AAU, when a subagent ends on an error or is interrupted, I see it as `✗` with the reason, kept until the next prompt

## Edge Cases

- AAU, if a subagent spawns its own subagent, the child is indented one level deeper under it
- AAU, if a background agent is still running when I submit the next prompt, it stays in the tree until it finishes
- AAU, if a turn has no subagent, I see the `main` row alone
- AAU, if a label is wider than the pane, it is truncated and the elapsed time stays visible
- AAU, between turns, the `main` row shows the last turn's duration and is not marked running

## Acceptance Criteria

- [ ] The main thread has a row, first in the tree
- [ ] Subagents are nested under their parent, in spawn order
- [ ] A running agent shows three lines; a finished one shows one
- [ ] A finished or failed agent stays visible until the next prompt
- [ ] A running background agent survives the next prompt
- [ ] Timers of running agents advance at least once per second
- [ ] The current action updates on each tool call of that agent
