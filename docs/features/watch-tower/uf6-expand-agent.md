# UF6: Expand an agent's details

## Context

In the agent tree of the pane (UF2, UF3). The tree is readable without interaction; expanding is for when I want to know what an agent was asked and what it has been doing.

## Specification

AAU, with the pane focused (ctrl+x tab, or a click), I can:
- move between agent rows with Tab and the arrow keys
- press Enter (or click) on an agent's row to expand it in place

AAU, on an expanded agent, I see under its row, indented:
- its model, `↑`, `↓` and `$`
- its cache counts: tokens read from the cache and written to it
- the prompt it was given, cut to three lines
- its last five actions, most recent last
- a `▾` mark on its row in place of the status mark

And:
- pressing the row again collapses it
- expanding another agent collapses the one that was open: one agent is expanded at a time
- the other agents stay visible around it

## Success Scenario

- AAU, when I expand a running subagent, I see its action list keep updating while it works
- AAU, when I expand a finished agent, I see its final numbers, its prompt and its last actions
- AAU, when I expand `main`, I see the same details for the main thread (its prompt being my last prompt)

## Edge Cases

- AAU, if an agent has fewer than five actions, I see those it has
- AAU, if the expanded agent is cleared at the next prompt, nothing is expanded any more
- AAU, if I press Esc, focus returns to the prompt and the expansion stays as it was
- AAU, if a prompt is longer than three lines, it ends with `…`

## Acceptance Criteria

- [ ] Each agent row can be focused and pressed, by keyboard and by click
- [ ] Pressing a row toggles its details in place
- [ ] At most one agent is expanded at any time
- [ ] The details show cache read, cache write, the prompt (three lines at most) and up to five actions
- [ ] An expanded block is at most about ten rows tall
- [ ] The details of a running agent update live
