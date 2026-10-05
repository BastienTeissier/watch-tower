# PRD: Watch Tower

## Why

- While Claude Code works through a delegated task, I cannot see which agents are running, what each one is doing, how long it has run, what it consumes, or what has been committed. I find out by reading the transcript or asking.
- The `buddy` mod already shows a few indicators (a vitals line, one line per subagent, a commit count), but they are thin, and the mod is named after its decorative companion instead of its real purpose.
- This feature turns the mod into a live follow-up of agent work: one glance at the pane answers who is working, on what, for how long, at what cost, and what got committed.

## Result

### Acceptance Criteria

- [ ] The mod installs and runs as `watch-tower`; plan tracking, the off-plan guard, quota gauges and the cache countdown behave as before
- [ ] The pane shows the main thread and every subagent of the current turn as a tree, with status, elapsed time and current action
- [ ] Each agent shows new input tokens, output tokens and a cost in $; a turn line and a session line show totals
- [ ] Agent costs of a turn sum to the session cost growth the engine reports for that turn
- [ ] The session's commits are listed with subject and size
- [ ] On a terminal where the pane is not open, a one-line band above the prompt summarises the running turn
- [ ] An agent row can be expanded in place to show its prompt, recent actions and cache counts
- [ ] With the companion setting off, the pane shows no companion rows
- [ ] A session with no subagent and no commit shows the main thread row, the totals and an empty commits section without error

### Features

- Live agent tree: main thread as root, subagents nested under their parent
- Per-agent time, tokens (`↑` new input, `↓` output) and cost
- Turn totals and session totals, with the tool call count and the prompt cache hit rate
- Session commit list with size, marked on-plan or off-plan when a plan is attached
- One-line turn summary band for narrow terminals
- Expand an agent in place
- Optional companion

### Visual

Pane, one subagent expanded:

```
Watch Tower
● main                               4m12s
  fable-5.1 · ↑54k ↓8k · $1.12
  editing hooks/ledger.ts
  ▾ Explore: map usage events        1m05s
    haiku-4.5 · ↑46k ↓2k · $0.06
    cache read 310k · write 12k
    prompt: Map every event the mod hooks
      that carries token usage…
    · reading hooks/register.tsx
    · searching agentId
    · reading types/index.d.ts
  ✓ Plan: design ledger   2m30s ↑27k ↓4k $0.62
Σ turn     4m12s  2 agents   ↑127k ↓14k $1.80
Σ session  1h42m  11 agents  57 tools
           ↑1.9M ↓160k  cache 94%  $14.30
────────────────────────────────────────────
commits
✓ e41c7a2 feat(watch-tower): add companion toggle
    4 files +38 −6
! 9b03f1d chore: ignore generated types
    1 file +2 −0
main  ±3 uncommitted
────────────────────────────────────────────
Phase 2: Ledger  1/4  (5/14)
▸ feat(watch-tower): add agent ledger
  next: feat(watch-tower): add commit list
drift: 1 files, 1 commits
────────────────────────────────────────────
ctx 42%  ❄ cache 58:12
5h ████████░░░░░░░░ 48% in 2h10m
7d ███░░░░░░░░░░░░░ 21% in 4d02h
────────────────────────────────────────────
WORKING_EDIT
(companion)
```

Band, narrow terminal:

```
● 2 agents running  4m12s  ↑127k ↓14k  $1.80
 Phase 2 1/4  ▸ feat(watch-tower): add agent ledger  ctx 42%
```

An interactive HTML prototype was reviewed during design; it was throwaway and is not kept in the repo.

### Use cases / edge cases

- **Turn with parallel subagents**: each has its own rows and numbers; costs are split between them and still sum to the real total.
- **Nested subagents**: a subagent spawned by a subagent is indented under its parent.
- **Background agent outliving its turn**: it stays in the tree until it finishes, and its tokens count in the turn that spawned it.
- **Turn with no subagent**: the tree is the main row alone.
- **Unknown model**: its cost share uses the most expensive known rates, so it is never under-reported.
- **Session without cost reporting**: `$` figures are omitted; tokens and time still show.
- **Subscription account**: `$` is notional (API rates); the quota gauges remain the real constraint.
- **Commit made outside Claude during the session**: it appears in the list at the next refresh.
- **More commits than fit**: the newest are listed, the rest counted as `+N earlier`.
- **No plan attached**: commits carry no on-plan / off-plan mark.
- **Working directory that is not a git repository**: the commits section is absent.

### User Flows

| UF | Name | File |
|----|------|------|
| UF1 | Rename the mod to watch-tower | [uf1-rename-to-watch-tower.md](./uf1-rename-to-watch-tower.md) |
| UF2 | Follow agents in a live tree | [uf2-follow-agents-tree.md](./uf2-follow-agents-tree.md) |
| UF3 | See tokens and cost per agent, turn and session | [uf3-tokens-and-cost.md](./uf3-tokens-and-cost.md) |
| UF4 | See the commits performed | [uf4-commit-list.md](./uf4-commit-list.md) |
| UF5 | See a turn summary on a narrow terminal | [uf5-narrow-terminal-band.md](./uf5-narrow-terminal-band.md) |
| UF6 | Expand an agent's details | [uf6-expand-agent.md](./uf6-expand-agent.md) |
| UF7 | ~~Stop a running subagent~~ (dropped, see Out of Scope) | — |
| UF8 | Turn the companion off | [uf8-companion-toggle.md](./uf8-companion-toggle.md) |

*(Each UF is documented in its own file. Notion integration was skipped: no `--db` / `--epic` given.)*

Order: UF1 first. UF3, UF5 and UF6 build on UF2. UF4 and UF8 are independent.

## Decisions

| Topic | Decision | Why |
|-------|----------|-----|
| Purpose | Live glance while Claude works | The stated problem is being blind while it runs |
| Where | The existing pane, agents on top | One place to look; the data is already tracked there |
| Agent rows | Three lines running, one finished; kept until the next prompt | Final time and tokens matter after an agent ends |
| Tokens | `↑` new input (fresh + cache-write), `↓` output; cache reads only as a hit rate | Cache reads dominate volume and would drown the signal |
| Cost | Per-agent share from a price table (agent weight over session weight), scaled to the engine's real session cost | Rows always sum to the real figure; a stale table only skews the split |
| Scope | Tree and `Σ turn` per turn; `Σ session` cumulative | Both questions are asked; one line each |
| Commits | Subject plus size, session scope | Each commit is a milestone; size reveals surprises |
| Narrow terminals | One stable line in the band | Keeps the glance without pushing the prompt around |
| Interaction | Expand in place; no stop from the pane | Other agents stay visible; stopping a subagent was dropped after the spike |
| Name | `watch-tower` (temporary), renamed in its own change | The name should say the purpose; a rename mixed with features is unreviewable |

### Out of Scope

- History across sessions (a browsable ledger of past sessions)
- A turn-end debrief beyond the existing "agent finished" toast
- Stopping a subagent from the pane (UF7, dropped after the spike: denying an agent's tool calls also denied its report hand-back, so its parent got nothing)
- Stopping the main thread from the pane (Esc already does it)
- Attributing each commit to the agent that made it
- Alerts or thresholds on consumption
- Changes to plan tracking, the off-plan guard, quota gauges or the cache countdown
- The final name of the mod

### Open risks

- **Workflow-launched agents** may not be announced to mods. If they are not, they will not appear in the tree and this will be documented as a limitation.
- **Docked pane width** is set by the engine and was not measured; the layout must truncate cleanly at any width.

## Technical Specification

### Architecture

- One mod (`mods/watch-tower/`), one hooks module for wiring, pure modules for logic (existing principle of the repo).
- New pure logic: a ledger (per-agent tokens, time, cost shares; turn and session totals) and a commit list. Existing agent tracking is extended with parent, model, prompt and action history.
- State lives in the mod's session state contract; nothing new is persisted across sessions.

### Libraries & tools

- Claude Code mods API (2.1.287+): `agent.spawn`, `turn.step`, `turn.complete`, `tool.call`, `session.measure`, pane and band rendering.
- `git` through the engine's process runner, for the commit list.
- No new dependency.

### Data Requirements

- Per agent: id, parent, description, type, model, prompt, status, start and end times, the four token counts, recent actions.
- Per turn and per session: summed tokens, agent count, elapsed time, cost.
- Per commit: short hash, subject, files changed, lines added and removed, on-plan flag.
- A price table per model family, used for proportions only.

### Rights & Permissions

| Permission | Description | User Roles |
|------------|-------------|------------|
| None | A mod runs locally with the access Claude Code has; there is a single user | The person running the session |

### Testing strategy

- Unit tests for the pure modules: ledger sums, cost apportionment (rows sum to the total, unknown model, no cost reported), commit parsing, agent tree ordering and retention.
- Pane and band tests through `claude plugin test`, on terminal and desktop surfaces: tree rendering, expand, companion off, narrow band.
- `make check` green before and after the rename.
- One live session to verify the open risk (Workflow agents).

## Production strategy

- Personal mod, no analytics and no alerting.
- Success: during a delegated run I no longer ask "where are you?" or scroll the transcript to know who is working and what it costs.
- A hook that fails is skipped by the engine and named in the transcript while developing; the mod must never block a turn (the off-plan guard stays the one deliberate exception).
