# UF5: See a turn summary on a narrow terminal

## Context

The pane opens by itself only on terminals 144 columns or wider. Below that, a band above the prompt currently shows the plan position, and only when a plan is attached: with no plan, nothing of the agents is visible.

## Specification

AAU, on a terminal where the pane is not open, while a turn runs or a subagent is active, I see above the prompt one line with:
- the number of running subagents
- the turn's elapsed time
- the turn's `↑` and `↓` tokens
- the turn's cost

And:
- when a plan is attached, the existing plan position line beneath it
- I can type `/watch-tower` to open the full pane

## Success Scenario

- AAU, when subagents start and finish, the band stays one line and only its count changes, so the prompt does not move
- AAU, when I open the pane, the band is no longer shown

## Edge Cases

- AAU, if no subagent is running, the line shows the main thread's turn alone (time, tokens, cost)
- AAU, if no turn is running and no agent is active, the summary line is absent
- AAU, if the session reports no cost, the line omits the `$`
- AAU, if the engine shows its own survey in the band, the summary gives way to it, as the plan line does today
- AAU, if the line is wider than the terminal, it is truncated at the end

## Acceptance Criteria

- [ ] With the pane closed and a turn running, one summary line is shown above the prompt
- [ ] The line never grows beyond one row whatever the number of agents
- [ ] With a plan attached, the plan line is shown beneath the summary
- [ ] The line is absent when nothing is running
- [ ] The line is absent while the pane is open
