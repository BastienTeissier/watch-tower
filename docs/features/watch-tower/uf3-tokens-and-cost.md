# UF3: See tokens and cost per agent, turn and session

## Context

Numbers added to the agent tree of UF2, plus two totals lines under it. They replace the current vitals line (`ctx 42%  $1.80  turn 3m05s  tools 57`).

## Specification

AAU, while a turn runs, I see:
- on each agent: `↑` new input tokens, `↓` output tokens, and a cost in `$`
  - on the second line of a running agent, next to its model
  - at the end of the single line of a finished agent
- a `Σ turn` line: turn elapsed time, number of subagents, summed `↑` and `↓`, turn cost
- a `Σ session` line: session elapsed time, number of subagents since the session started, number of tool calls since the session started, summed `↑` and `↓`, session cost
- the prompt cache hit rate
- context % next to the cache countdown, lower in the pane

Rules:
- `↑` counts input that is new: fresh input plus input written to the prompt cache. Input read from the cache is not in `↑`; it appears only in the hit rate (and in an agent's details, UF6).
- Token counts are abbreviated (`54k`, `1.9M`).
- The session cost is the figure the engine reports. An agent's cost is its share of it: each agent's tokens are weighted with a per-model price table, and its cost is its weight over the whole session's weight, times the session cost. `Σ turn` cost is the sum of the costs of the turn's agents.
- Costs are marked nowhere as exact: on a subscription they are notional (API rates).

## Success Scenario

- AAU, when a subagent on a cheaper model reads a lot, I see a large `↑` and a small `$` on its row compared with the main thread
- AAU, when I add the `$` of all rows of the turn, I get the `Σ turn` cost
- AAU, when I submit the next prompt, `Σ turn` restarts from zero and `Σ session` keeps growing

## Edge Cases

- AAU, if an agent runs on a model the price table does not know, its share is computed at the most expensive known rates
- AAU, if the session reports no cost, no `$` is shown anywhere; tokens and times still are
- AAU, if an agent has made no model request yet, it shows `↑0k ↓0k`
- AAU, if a background agent outlives its turn, its tokens and cost count in the turn that spawned it
- AAU, after `/clear`, the tree and `Σ turn` restart; `Σ session` continues

## Acceptance Criteria

- [ ] Every agent row shows `↑`, `↓` and `$`
- [ ] `↑` excludes cache-read tokens
- [ ] The sum of agent costs in a turn equals the `Σ turn` cost to the cent
- [ ] `Σ session` cost equals the engine's reported session cost
- [ ] `Σ session` shows the number of tool calls since the session started, subagents' included
- [ ] `Σ turn` resets on each prompt; `Σ session` does not
- [ ] An unknown model is priced at the most expensive known rates
- [ ] With no cost reported, the pane shows no `$` and no error
- [ ] The old vitals line is gone; context % is shown with the cache countdown
