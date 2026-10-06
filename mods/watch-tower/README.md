# watch-tower

A Claude Code mod to follow the session's work at a glance: the main thread
and its subagents as a tree, each with its time, tokens and share of the cost,
the session's commits, the attached plan's position, context, quotas and the
prompt cache countdown, with a guard on off-plan edits. Plugin name is
`watch-tower` (a temporary name; `claude-*` names are reserved by Claude Code).

An optional ASCII companion rides along at the bottom: the Buddy, mimicking
the ESP32 Buddy ([claude-ble-buddy](https://github.com/BastienTeissier/claude-ble-buddy))
with no Bridge, no BLE and no hardware.

## Run

```bash
claude --plugin-dir mods/watch-tower    # from the repo root: loads and hot-reloads the mod for that session
```

The pane opens by itself on wide terminals (144+ columns). Anywhere else,
type `/watch-tower`. In `/config`, `watch-tower.companion` turns the companion
on or off (default on) and `watch-tower.species` picks its Species (default
`snail`). A change there reloads the mod with the new value, so neither needs
a restart.

## The pane

From top to bottom:

1. **Agents**: `main` (the turn's thread) and its subagents as a tree, a child
   under its parent. A running agent takes three rows (label and time; model,
   `↑` input, `↓` output and `$` share of the session cost; current action), a
   finished one a single row (`✓` done, `✗` failed with why). Finished agents
   stay until the next prompt; background ones stay while they run. Then
   `Σ turn` and `Σ session` (time, agents, tools, tokens, cache hit rate,
   cost). The rows' costs sum to `Σ turn`, and `Σ session` matches `/cost`.
2. **Commits**: the session's commits, newest first (hash, subject, files
   `+added −removed`), `✓` when the plan names the subject, `!` when it does
   not; `+N earlier` past five; then the branch and its uncommitted count.
3. **Plan**: phase, task X/Y, the next task, and drift.
4. **Context and quotas**: context %, the prompt cache countdown (`❄ cache
   58:12`, TTL detected from the last response or forced with
   `watch-tower.cacheTtl`), the 5h and 7d gauges.
5. **Companion** (when on): its state, sprite, message and `Tap`.

**Expand an agent**: focus its status mark (ctrl+x tab into the pane, then Tab
or the arrows) and press Enter, or click it. The mark becomes `▾` and the
details open under the row: model, tokens and cost, cache read and write, the
prompt it was given in three lines, its last five actions. One agent is open
at a time; pressing again closes it, and a new prompt closes `main` and any
agent it clears.

**Band**: while the pane is not on screen (narrow terminal, or closed), a line
above the prompt sums up the turn (`N agents running`, time, tokens, cost)
while anything runs, above the plan position.

## Files

| File                 | Role                                                          |
| -------------------- | ------------------------------------------------------------- |
| `hooks/register.tsx` | wiring only: session events → state, pane and band rendering, everything that touches `$` (plan file, git, store, the off-plan question) |
| `hooks/machine.ts`   | pure state machine, port of the claude-ble-buddy Bridge's `hooks.py` + `state.py` |
| `hooks/style.ts`     | per-state colour / eye / pulse, port of the firmware's `sprite.cpp` |
| `hooks/species.ts`   | 18 Species × 3 frames, port of the firmware's `species/*.h`     |
| `hooks/plan.ts`      | pure: parse a plan's To Do List, tick tasks from commit subjects, position, off-plan paths |
| `hooks/track.ts`     | pure: the session's track, git state, commits, the attached plan and its drift, moved together |
| `hooks/books.ts`     | pure: the session's books, agents and ledger moved together by each session event |
| `hooks/agents.ts`    | pure: the agent tree, main thread and subagents (after agent-radar) |
| `hooks/rows.ts`      | pure: the pane as rows: tree, expanded details, totals, band summary, commits |
| `hooks/pane.tsx`     | draws rows and gauges with the surface's elements; a pressable row's mark is a Button |
| `hooks/commits.ts`   | pure: parse the session's `git log --shortstat`                |
| `hooks/format.ts`    | pure: times, token counts, dollars, short model names          |
| `hooks/ledger.ts`    | pure: session tokens and cost, each agent's share of the cost |
| `hooks/pricing.ts`   | pure: per-model list prices, to weigh each agent's share     |
| `hooks/cache.ts`     | pure: prompt cache countdown and TTL detection (after token-weather) |
| `types/index.d.ts`   | `$.state` contract                                            |

## Plan tracking

Attach a feature plan and the pane shows where it stands:

```
/watch-tower plan docs/features/<feature>/plan.md   # attach (or run /implement-plan <path>)
/watch-tower plan                                   # where am I?
/watch-tower plan off                               # detach
```

The plan's `## N. To Do List` is read: `###` headings are phases, top-level
checkboxes are tasks, a task's backticked `type(scope): title` is its commit
and its `Files:` line its files. A plan without that section is read whole.

- **Done** = a commit subject in `git log -n 200` equals the task's commit
  title. The mod then ticks `- [ ]` → `- [x]` in the plan file, so the file
  stays the source of truth. Already-ticked boxes count as done.
- **Current** = the first open task with a commit title (so a `Verify` step
  never blocks the position); the pane shows phase, task X/Y, and the next one.
- **Drift** = edited files no task lists, and commit subjects since the attach
  no task names.
- **Off-plan guard**: an Edit / Write / NotebookEdit of a file inside the
  working directory that no task lists is held in the AskUserQuestion dialog —
  `Allow once`, `Allow file` (remembered for the session), `Deny` (Claude reads
  why). Files outside the working directory are not guarded. No plan, no guard.
- The attached plan is remembered per working directory + branch and comes
  back on the next session.

Below 144 columns, where the pane does not open by itself, the band above
the prompt carries the position.

## Event → state mapping

| Mod event                                   | Buddy state    | Message            |
| ------------------------------------------- | -------------- | ------------------ |
| `session.start`, `session.end`              | `IDLE`         | _empty_            |
| `prompt.submit`                             | `THINKING`     | _empty_            |
| `tool.call` Bash (before it runs)           | `WORKING_BASH` | the command        |
| `tool.call` Edit / Write / NotebookEdit     | `WORKING_EDIT` | the file path      |
| `tool.call` other                           | `THINKING`     | tool name          |
| `tool.call` (after it ran)                  | `THINKING`     | _empty_            |
| `turn.complete` (main loop only)            | `HAPPY`        | _empty_            |
| `classic.PermissionRequest`, permission `classic.Notification` | `WAITING` | tool name / message |
| `classic.Notification` (any other)          | `ALERT`        | the message        |
| `session.measure`                           | Quota gauges, context %, cost | 5h + 7d windows |
| `prompt.submit`, `turn.complete`            | turn timer, plan + git refresh | —           |
| `tool.call` Bash with `git commit`/`merge`/`rebase`/… | plan + git refresh | —           |
| `turn.step` (main loop)                     | cache clock restart | —             |
| `turn.step`                                 | the agent's model, tokens and cost share | — |
| `agent.spawn`, `tool.call` / `turn.complete` with `agentId` | agent tree, toast on finish | — |

Differences from the Bridge (ADR-0005 in claude-ble-buddy): `WAITING` is emitted on
permission requests, Quota gauges come from `session.measure` instead of
the statusline script, and the pane's `Tap` button stands in for the
physical button.

## Check

```bash
make check          # from the repo root: validate + test every mod
```
