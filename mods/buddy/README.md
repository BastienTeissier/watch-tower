# buddy

The Buddy as a Claude Code mod: an on-screen pane that mimics the ESP32
Buddy ([claude-ble-buddy](https://github.com/BastienTeissier/claude-ble-buddy)) with no Bridge, no BLE and no hardware. Plugin name is `buddy`
(`claude-*` names are reserved by Claude Code).

## Run

```bash
claude --plugin-dir mods/buddy    # from the repo root: loads and hot-reloads the mod for that session
```

The pane opens by itself on wide terminals (144+ columns). Anywhere else,
type `/buddy`. Pick a Species in `/config` (`buddy.species`, default `snail`).

## Files

| File                 | Role                                                          |
| -------------------- | ------------------------------------------------------------- |
| `hooks/register.tsx` | wiring only: session events → state, pane and band rendering, everything that touches `$` (plan file, git, store, the off-plan question) |
| `hooks/machine.ts`   | pure state machine, port of the claude-ble-buddy Bridge's `hooks.py` + `state.py` |
| `hooks/style.ts`     | per-state colour / eye / pulse, port of the firmware's `sprite.cpp` |
| `hooks/species.ts`   | 18 Species × 3 frames, port of the firmware's `species/*.h`     |
| `hooks/plan.ts`      | pure: parse a plan's To Do List, tick tasks from commit subjects, position, off-plan paths |
| `hooks/session.ts`   | pure: session vitals (turn time, tool count, context %, cost) |
| `hooks/agents.ts`    | pure: one line per subagent (after agent-radar)              |
| `hooks/cache.ts`     | pure: prompt cache countdown and TTL detection (after token-weather) |
| `types/index.d.ts`   | `$.state` contract                                            |

## Plan tracking

Attach a feature plan and the pane shows where it stands:

```
/buddy plan docs/features/<feature>/plan.md   # attach (or run /implement-plan <path>)
/buddy plan                                   # where am I?
/buddy plan off                               # detach
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

Below the plan: vitals (`ctx 42%  $1.80  turn 3m05s  tools 57`), the prompt
cache countdown (`❄ cache 58:12`, TTL detected from the last response or
forced with `buddy.cacheTtl`), `branch  ±dirty  +commits`, drift, and one
line per running subagent (finished ones linger 30 s). Below 144 columns a
one-line band above the prompt carries the position instead.

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
| `agent.spawn`, `tool.call` / `turn.complete` with `agentId` | subagent lines, toast on finish | — |

Differences from the Bridge (ADR-0005 in claude-ble-buddy): `WAITING` is emitted on
permission requests, Quota gauges come from `session.measure` instead of
the statusline script, and the pane's `Tap` button stands in for the
physical button.

## Check

```bash
make check          # from the repo root: validate + test every mod
```
