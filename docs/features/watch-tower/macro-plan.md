# Implementation Plan: Watch Tower

PRD: [prd.md](./prd.md). UFs: `uf1`…`uf8` in this folder.

## 1. Feature Description

**Objective**: turn the `buddy` mod into `watch-tower`: live follow-up of agent work (tree, time, tokens, cost, commits), expand from the pane, companion optional.

**Key Capabilities**:
- **CAN** see main + subagents as a tree, per-agent time / `↑` / `↓` / `$`, turn and session totals
- **CAN** see session commits with size, on-plan / off-plan mark
- **CAN** see a one-line turn summary in the band when pane closed
- **CAN** expand one agent in place
- **CAN** turn the companion off
- **CANNOT** stop any agent from the pane (UF7 dropped), browse past sessions, see per-commit author agent

**Business Rules**:
- `↑` = input + cache-write tokens; cache-read only in hit rate and expanded details
- Agent cost = its weighted-token share × engine session cost; cents rounded by largest remainder so rows sum to `Σ turn`; `Σ session` = engine figure
- Unknown model → most expensive known rates. No engine cost → no `$` anywhere
- Finished agents kept until next prompt; running background agents survive it and stay counted in their spawning turn
- Commits: session scope, newest first, max 5 + `+N earlier`
- Plan tracking, off-plan guard, gauges, cache countdown unchanged

**Visual Design**:
- ASCII mock in [prd.md](./prd.md#visual). Pane order: agents, commits, plan, context + quotas, companion.

---

## 2. Data Model

State contract `mods/watch-tower/types/index.d.ts` (session state, nothing new persisted).

### Creation of New Entities
- `Usage`: `{ input, output, cacheRead, cacheWrite }` token counts
- `Totals`: `{ usage: Usage; weight: number; agents: number; tools: number }` — `weight` = price-weighted tokens
- `Ledger`: `{ startedAt: number; turn: number; session: Totals; costUsd: number | null; contextPct: number | null }`
- `Commit`: `{ hash, subject, files, added, removed }`
- `Row` (not state; view model in `rows.ts`): `{ key?: string; indent: number; spans: { text, color?, isDim?, isBold? }[]; right?: string; press?: { kind: 'toggle'; agentId: string } }`

### Modification of Existing Entities
- `AgentRun`: + `parentId: string | null`, `model`, `prompt`, `turn: number`, `usage: Usage`, `weight: number`, `actions: string[]` (last 5; replaces `last`). Main thread = `AgentRun` with id `main`, recreated each prompt
- `Git`: `{ branch, dirty }` (`commits` count removed; plan drift keeps its own log)
- `Vitals`: removed (turn time → `main` row, cost + context + tool count → `Ledger`)
- `PluginState['watch-tower']`: − `vitals`; + `ledger: Ledger`, `commits: Commit[]`, `sessionBase: string | null`, `expanded: string | null`

### Relationships
- `AgentRun.parentId` → `AgentRun.id` (tree). `AgentRun.turn` = `Ledger.turn` at spawn
- `Σ turn` = agents with `turn === ledger.turn`; `Σ session` = `ledger.session`

---

## 3. Architecture

Pure modules compute; `register.tsx` alone touches `$` and maps `Row[]` to elements.

### Files to Modify:

#### A. `mods/buddy/` → `mods/watch-tower/` (+ `.claude-plugin/marketplace.json`, `Makefile`, `README.md`, `INTENT.md`)
**Purpose**: UF1 rename.

**Changes**:
- `git mv`; plugin name, state key `'buddy'` → `'watch-tower'`, pane id / title, command, `buddy:` message prefix, `MOD ?=`, marketplace entry, tests' `plugin` / `command` / `requestId`
- Docs: lead with agent follow-up, companion as optional extra

**Why**: name says the purpose; own commit keeps the diff reviewable.

---

#### B. `mods/watch-tower/types/index.d.ts`
**Purpose**: state contract for §2.

**Changes**: types and `PluginState` keys as listed in §2.

**Why**: `claude plugin validate` holds every state key to the contract.

---

#### C. `mods/watch-tower/hooks/agents.ts` ⚪ extend
**Purpose**: tree and lifecycle.

**Changes**:
- `spawned` takes parent / model / prompt / turn; `saw` pushes to `actions` (cap 5)
- 🟢 `mainRun(prompt, turn, now)`, `nextTurn(list)` (drop non-running, keep running background), `tree(list)` (depth-first, spawn order, with depth), `charged(list, id, usage, weight)`
- Remove `isShown`, `SHOW_DONE_MS`

**Why**: retention and nesting rules of UF2.

---

#### D. 🟢 `mods/watch-tower/hooks/pricing.ts`
**Purpose**: per-model rates, proportions only.

**Changes**: `RATES` by family (`fable`, `opus`, `sonnet`, `haiku`: input, output per MTok; cache-write ×1.25, cache-read ×0.1); `weightOf(model, usage)`; unknown model → max rates.

**Why**: UF3 cost shares. One small file to edit when prices move.

---

#### E. 🟢 `mods/watch-tower/hooks/ledger.ts` (replaces `session.ts`)
**Purpose**: totals and cost apportionment.

**Changes**:
- `LEDGER` initial; `charged(ledger, usage, weight)`; `turnBegan(ledger)`; `measured(ledger, contextPct, costUsd)`; `agentCounted(ledger)`; `toolCounted(ledger)`
- `shares(agents, ledger)`: cents per agent id = `weight / session.weight × costUsd`, largest-remainder rounding; `null` when no cost
- `turnTotals(agents, ledger)`, `hitRate(usage)`

**Why**: UF3 rules; rows sum to `Σ turn` by construction.

---

#### F. 🟢 `mods/watch-tower/hooks/commits.ts`
**Purpose**: commit list.

**Changes**: `parseLog(stdout)` for `git log --format=%h%x09%s --shortstat <base>..HEAD` → `Commit[]`; `shown(commits, max)` → `{ list, earlier }`.

**Why**: UF4. On-plan mark reuses ⚪ `unplanned()` in `plan.ts`.

---

#### G. 🟢 `mods/watch-tower/hooks/format.ts`
**Purpose**: shared formatters.

**Changes**: ⚪ `elapsed()` moved from `session.ts`; 🟢 `tokens(n)` (`54k`, `1.9M`), `usd(cents)`.

---

#### H. 🟢 `mods/watch-tower/hooks/rows.ts`
**Purpose**: what the pane and band show, as data.

**Changes**:
- `treeRows(agents, { now, expanded, shares })`: 3 rows running, 1 finished, expanded block (cache counts, prompt ≤ 3 lines, ≤ 5 actions)
- `totalRows(...)`, `commitRows(commits, plan)`, `bandRow(agents, ledger, now)` (null when nothing runs)

**Why**: layout rules unit-testable without mounting; `register.tsx` stays wiring.

---

#### I. `mods/watch-tower/hooks/register.tsx`
**Purpose**: wiring.

**Changes**:
- `session.start`: set `sessionBase` (HEAD) and `ledger.startedAt` when unset
- `prompt.submit`: `turnBegan`, `nextTurn`, new `main` run; clear `expanded` if its agent left
- `turn.step`: after `yield* next(e)`, charge `result.usage` to `e.agentId ?? 'main'` and to the ledger (beside the existing cache clock)
- `agent.spawn`: record `parentAgentId`, model, prompt, turn; `agentCounted`
- `tool.call`: existing guard and tracking (also for `main`); `toolCounted`
- `turn.complete`: main → end `main` run; subagent → `ended` (done / failed), toast kept
- `session.measure`: `measured` (context %, cost)
- `refresh()`: also load `commits` from `sessionBase..HEAD`
- `ui.render` Pane: sections in PRD order from `Row[]`; a row with `press` → `Button plain` for the label + `Text` for the rest; handlers `update` `expanded`; companion block only when `options.companion`
- `ui.render` AbovePrompt: `bandRow` above the plan line; shown without a plan too
- Remove vitals wiring and `vitalsLine`

**Why**: the validator follows `$` into no import.

---

#### J. `mods/watch-tower/.claude-plugin/plugin.json`
**Purpose**: UF8 setting.

**Changes**: `userConfig.companion` (boolean, default true, title "Companion").

---

## 4. Test Plan

### Unit Tests
- `agents.test.ts`: tree order + depth with nested spawn; `nextTurn` drops finished, keeps running background; actions capped at 5
- `pricing.test.ts`: cache-read weighs 0.1× input; unknown model = max rates
- `ledger.test.ts`: shares sum to turn total to the cent (3 agents, awkward split); no cost → `null`; `turnTotals` excludes older-turn background agent; hit rate
- `commits.test.ts`: `parseLog` with insertions only / deletions only / no stat (empty commit); `shown` caps at 5 with `earlier`
- `rows.test.ts`: running = 3 rows, finished = 1; expanded block content and ≤ 10 rows; truncated prompt ends `…`; `bandRow` null when idle; commit marks with / without plan
- `format.test.ts`: `tokens` and `usd` boundaries

### Integration Tests (`claude plugin test`, terminal + desktop)
- `tracking.test.ts` ⚪ extended: spawn → row under `main`; `turn.step` usage → `↑` / `↓` on the right row; `session.measure` cost → `$` rows and `Σ` lines; tool calls counted on `Σ session`; next prompt clears finished agents
- commits: fake `git log` output → list in pane; outside a repo → no section
- expand: `ui.press` on a row shows details, second press hides, pressing another moves it
- band: closed pane + running turn → summary line; idle → absent; plan line kept beneath
- companion: `{ options: { companion: false } }` → no sprite, no `Tap`
- ⚪ existing plan / guard / machine / cache tests pass unchanged apart from the rename

---

## 5. To Do List

Commit rule: 1 task = 1 commit. `make check` green after each.

### Phase 0 — Spike
- [x] **Verify the open risks in a live session** (throwaway mod outside the repo, no commit)
  - Subagent with every `tool.call` denied: wraps up or retries?
  - Workflow-launched agents: `agent.spawn` / `turn.step` with `agentId` raised?
  - `turn.step` result carries `usage` for subagents; `session.measure` cost cadence
  - Docked pane `bodyColumns`; how a hook knows the pane is open (for the band)
  - Boolean `userConfig` accepted by `claude plugin validate`
- [x] **Record findings** in Notes below; adjust UF5 tasks if a risk materialised

### Phase 1 — UF1 rename
- [ ] **Rename the mod** — `chore(watch-tower): rename buddy mod to watch-tower`
  - Files: `mods/watch-tower/`, `.claude-plugin/marketplace.json`, `Makefile`
- [ ] **Rewrite the docs** — `docs: present watch-tower as an agent follow-up`
  - Files: `README.md`, `INTENT.md`, `mods/watch-tower/README.md`, `mods/watch-tower/.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` (descriptions)
- [ ] **Verify**: `make check`; `make dev MOD=watch-tower`, `/watch-tower` opens the pane

### Phase 2 — UF2 agent tree
- [ ] **Extend the agent model** — `feat(watch-tower): track agent parent, model, prompt and actions`
  - Files: `mods/watch-tower/types/index.d.ts`, `mods/watch-tower/hooks/agents.ts`, `mods/watch-tower/tests/agents.test.ts`
- [ ] **Add row models and formatters** — `feat(watch-tower): add tree row models`
  - Files: `mods/watch-tower/hooks/rows.ts`, `mods/watch-tower/hooks/format.ts`, `mods/watch-tower/tests/rows.test.ts`
- [ ] **Draw the tree** — `feat(watch-tower): draw the agent tree with a main row`
  - Files: `mods/watch-tower/hooks/register.tsx`, `mods/watch-tower/tests/tracking.test.ts`
- [ ] **Verify**: live turn with 2 parallel subagents

### Phase 3 — UF3 tokens and cost
- [ ] **Add pricing weights** — `feat(watch-tower): add model price weights`
  - Files: `mods/watch-tower/hooks/pricing.ts`, `mods/watch-tower/tests/pricing.test.ts`
- [ ] **Add the ledger** — `feat(watch-tower): add token and cost ledger`
  - Files: `mods/watch-tower/hooks/ledger.ts`, `mods/watch-tower/tests/ledger.test.ts`, `mods/watch-tower/types/index.d.ts`
- [ ] **Show tokens, cost and totals** — `feat(watch-tower): show tokens and cost per agent, turn and session`
  - Files: `mods/watch-tower/hooks/register.tsx`, `mods/watch-tower/hooks/rows.ts`, `mods/watch-tower/tests/tracking.test.ts`
- [ ] **Remove the vitals line** — `refactor(watch-tower): drop session vitals`
  - Files: `mods/watch-tower/hooks/session.ts`, `mods/watch-tower/hooks/register.tsx`, `mods/watch-tower/types/index.d.ts`
- [ ] **Verify**: rows sum to `Σ turn`; `Σ session` matches `/cost`

### Phase 4 — UF4 commits
- [ ] **Parse the commit log** — `feat(watch-tower): parse session commits with size`
  - Files: `mods/watch-tower/hooks/commits.ts`, `mods/watch-tower/tests/commits.test.ts`, `mods/watch-tower/types/index.d.ts`
- [ ] **Show the commit list** — `feat(watch-tower): list session commits in the pane`
  - Files: `mods/watch-tower/hooks/register.tsx`, `mods/watch-tower/hooks/rows.ts`, `mods/watch-tower/tests/tracking.test.ts`

### Phase 5 — UF5 band
- [ ] **Summarise the turn in the band** — `feat(watch-tower): show a turn summary above the prompt`
  - Files: `mods/watch-tower/hooks/register.tsx`, `mods/watch-tower/hooks/rows.ts`, `mods/watch-tower/tests/tracking.test.ts`

### Phase 6 — UF6 expand
- [ ] **Expand an agent in place** — `feat(watch-tower): expand an agent's details`
  - Files: `mods/watch-tower/hooks/register.tsx`, `mods/watch-tower/hooks/rows.ts`, `mods/watch-tower/types/index.d.ts`
- [ ] **Test expand** — `test(watch-tower): cover agent expand`
  - Files: `mods/watch-tower/tests/rows.test.ts`, `mods/watch-tower/tests/pane.test.ts`

### Phase 7 — UF8 companion
- [ ] **Make the companion optional and last** — `feat(watch-tower): add companion toggle`
  - Files: `mods/watch-tower/.claude-plugin/plugin.json`, `mods/watch-tower/hooks/register.tsx`, `mods/watch-tower/tests/pane.test.ts`
- [ ] **Update the docs** — `docs(watch-tower): document tree, ledger, commits and expand`
  - Files: `mods/watch-tower/README.md`, `README.md`, `INTENT.md`
- [ ] **Verify**: `make check`, `make typecheck MOD=watch-tower`, one full live session

---

## 6. Context: Current System Architecture

### Mod `buddy`
- Current behavior: one pane (gauges, companion, plan position, vitals line, cache, git, drift, one line per subagent) + a band with the plan position; off-plan edit guard
- Current limitations: no main row, no tokens or cost per agent, subagents vanish 30 s after finishing, commits are a count since plan attach, band only with a plan, no interaction beyond `Tap`

### Key Files
| File | Purpose |
|------|---------|
| `mods/buddy/hooks/register.tsx` | All wiring and drawing; only file reaching `$` |
| `mods/buddy/hooks/agents.ts` | Pure subagent list |
| `mods/buddy/hooks/session.ts` | Pure vitals + `elapsed()` |
| `mods/buddy/hooks/plan.ts` | Pure plan parsing, position, `unplanned()` |
| `mods/buddy/hooks/cache.ts` | Pure cache countdown |
| `mods/buddy/hooks/machine.ts`, `style.ts`, `species.ts` | Companion state, style, sprites |
| `mods/buddy/types/index.d.ts` | State contract |
| `mods/buddy/tests/tracking.test.ts` | Fake engine (git, fs, clock, spawn) + pane mounts |
| `Makefile` | `check`, `typecheck`, `dev` |

---

## 7. Reference Implementations

- ⚪ `mods/buddy/hooks/agents.ts` + its use in `register.tsx` (`agent.spawn`, `tool.call`, `turn.complete`): pattern for pure reducer + `update($, atom, fn)`
- ⚪ `mods/buddy/hooks/register.tsx` `turn.step` generator: where usage is read (`yield* next(e)` result)
- ⚪ `mods/buddy/hooks/register.tsx` `Tap` button: keyed `Button` + `onPress` writing state
- ⚪ `mods/buddy/hooks/register.tsx` `guard()`: `tool.call` answered with `{ deny }`
- ⚪ `mods/buddy/tests/tracking.test.ts` `engine()`: fake `process.run`, `agent.spawn`, clock
- Plugin-authoring skill: `examples/pane.tsx`, `examples/band.tsx`, `reference.md`; API in `mods/<mod>/.claude-plugin/types/claude-code/index.d.ts`
- agent-radar, token-weather (github.com/hamzafer/claude-code-mods): origin of the subagent lines and cache clock

---

## Notes

- Cost shares are scaled on the **session** cost (agent weight / session weight), agreed and reflected in UF3: stable when background agents overlap turns; rows sum to `Σ turn`, `Σ session` is the engine's figure.
- Tool count kept, on the `Σ session` line (agreed).
- Prices: take current list rates from the Anthropic pricing page at implementation time; only ratios matter.
- Spike findings (Phase 0, 2026-10-05):
  - Graceful stop fails: with every `tool.call` of a background subagent denied, it ended with no report (its `SubagentHandback` call was denied too); the main thread resumed it twice, then did the work itself. **UF7 dropped** (user decision).
  - Boolean `userConfig` passes `claude plugin validate`.
  - Pane open: `$.ui.panes()` gives `isPlaced` / `isShown` per pane (from the types); band can hide when the pane is shown.
  - `turn.step` result carries `usage` with `model` on the main thread (observed); subagents not captured (log overwritten by a second session).

## Unresolved questions

1. Workflow agents visible? — else documented limitation (spike log lost; check during Phase 2's live verify)
