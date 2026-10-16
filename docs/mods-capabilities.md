# Claude Code mods: what they can do

What a mod can do, what data it can read and which interactions it can offer.
This is written against Claude Code **2.1.287**, the first build with mods. The
generated types file is the source of truth for every signature:
`<mod>/.claude-plugin/types/claude-code/index.d.ts`, about 14k lines. Grep it for an
event name such as `'tool.call'` or a component such as `Pane: {`.

Sources: the bundled `plugin-authoring` skill (its `reference.md` and the types),
the [launch post](https://claude.dev/blog/getting-started-with-claude-code-mods/), and
what we learned building `mods/watch-tower`.

---

## 1. What a mod is

A mod is a plugin with a **hooks module**: a small TS/JS file running inside the
session.

```
my-mod/
  .claude-plugin/plugin.json   { "name", "version", "description", "types"?, "userConfig"?, "dependencies"? }
  hooks/hooks.json             { "modules": ["./register.tsx"] }
  hooks/register.tsx           export const register: Register = (on, options) => { ... }
  types/index.d.ts             optional: the PluginState contract for $.state
```

- `on(event, matcher?, hook)` adds a hook. Every hook has the shape `($, e, next)`:
  - `$` is the engine interface, spelled noun then method (`$.ui.toast`, `$.fs.read`…).
  - `e` is the event's input, a frozen plain value.
  - `next(e)` runs the plugins beneath, then core, and resolves to the event's result.
- A hook can act on an event in three ways:
  - **observe**: `await next(e)`, then react to the result;
  - **rewrite**: `next({ ...e, x })`;
  - **answer**: return a result without calling `next`, so core never runs.
- Matchers narrow a hook to one case: `on('tool.call', { tool: 'Bash' }, …)` or
  `on('ui.render', { component: 'Pane', requestId: 'x' }, …)`.
- **Sandbox**: there is no DOM, no Node and no `fetch` global. Everything outside the
  module goes through `$`. A hook has a time budget of about 10 s, and time spent
  inside `$` calls does not count; `next.signal` tells the hook when it was abandoned.
- JSX compiles against a global `h`. Elements come from the surface: `$.ui.resolve(e)`
  returns `{ Box, Text, Button, … }`, and `e.surface` is one of
  `terminal | desktop | vscode | mobile`.
- **Reloads**: a reload runs `register` and `session.start` again. `$.state` and
  `$.store` survive it; module variables do not.

---

## 2. What a mod can intercept or change (engine events)

| Area | Events | What you can do |
|---|---|---|
| **Tools** | `tool.call`, `tool.check`, `tool.describe` | Deny a call or rewrite its input (`{ deny }`); read the result after `next`; decide permission (`{ decision: 'allow' \| 'deny' \| 'ask' }`); rewrite the description the model sees, or move a tool behind ToolSearch |
| **Prompt (user side)** | `prompt.submit`, `prompt.edit`, `prompt.fill`, `prompt.suggest` | Rewrite what the person sends; react to each keystroke or paste; control drafts written into the box and the dim Tab suggestion |
| **Prompt (model side)** | `prompt.compose`, `prompt.section`, `prompt.context`, `prompt.attachment`, `skill.prompt`, `attribution.text` | Add, replace or drop system-prompt sections; edit the context blocks of the first message; drop or rewrite injected reminders (`todo_reminder`…); replace a skill's expanded prompt; change the commit/PR attribution text |
| **Turns** | `turn.start`, `turn.step` (streaming), `turn.complete` | See every model step as it streams, with its usage; react when a turn ends |
| **Agents** | `agent.offer`, `agent.spawn` | Hide an agent type from the model, or refuse it; intercept subagent launches |
| **Session** | `session.start`, `session.end`, `session.compact`, `session.measure`, `session.append`, `session.send`, `session.receive`, `session.attach`/`detach` | Bootstrap and tear down; rewrite or skip compaction; get context, cost and rate-limit figures pushed to you; **rewrite any row before it enters the transcript**; filter messages to and from other agents, peers and Remote Control; react when a phone or desktop client attaches |
| **Commands & config** | `command.run`, `command.describe`, `config.set`, `config.describe` | Answer your own slash commands, or wrap built-in ones; react to settings changes |
| **UI** | `ui.render`, `ui.resolve`, `ui.press`, `ui.input`, `ui.select`, `ui.scroll`, `ui.focus`, `ui.message` | Draw or replace built-in components; handle button presses, text input, selects, scrolling and focus; receive messages from a `Client` element |
| **Telemetry** | `telemetry.log`, `telemetry.mark` | See, rewrite or drop telemetry events (`collector` / `anthropic` streams) |
| **Lifecycle** | `plugin.register`, `engine.create` | Refuse other plugins (for example user-tier plugins under a managed policy); add a new noun to `$` for dependent plugins |
| **Classic hooks** | `classic.PreToolUse`, `classic.Stop`, `classic.Notification`, `classic.PermissionRequest`, `classic.SessionEnd`, … | The settings.json hook events, as typed payloads |
| **Every `$` op** | `model.complete`, `fs.read`, `http.fetch`, `process.run`, `state.set`, … | Every `$` call is itself an event, so one plugin can audit, mock or restrict what others do |

---

## 3. What data a mod can read

### About the session and the model
- `$.session.messages()`: the full transcript, with user, assistant, tool-use and tool-result rows.
- `$.session.usage()`: tokens, cost, context %, and the 5 h / 7 d **rate-limit** windows with their reset times. `session.measure` pushes changes, so no polling is needed.
- `$.session.model()`, `.turns()`, `.id()`, `.version()`, `.cwd()`, `.root()`, `.repo()`, `.surfaces()` / `.surface()`.
- `turn.step`: per-step usage (input, output, cache-read and cache-write tokens), streamed live.
- `tool.call`: the input of each tool call and, after `next`, its result (the diff of an Edit, the output of a Bash call…).
- `agent.spawn` and `$.agent.list()`: subagents, their type, prompt and progress.
- `prompt.submit`: what the person typed. `prompt.edit` gives the same while they type.
- `classic.*`: the same payloads the shell hooks get.

### About the machine and the outside world
- `$.fs`: `read` (text or bytes), `write`, `list`, `exists`, `stat` (`resolve: true` returns the `realPath`), `ancestors`.
- `$.process`: `run` (waits for exit, then returns stdout, stderr and code) and `spawn` (streamed). With these, `git`, `gh`, `kubectl`, `docker` and anything else on the PATH are reachable.
- `$.http.fetch`: any HTTP API, such as GitHub, Slack, a CI system or your own backend.
- `$.mcp.call` / `.connect`: any MCP server tool.
- `$.settings.read()`, `$.env.get()`/`.set()`, `$.config.list()`, `$.tool.list()`, `$.command.list()`.

### About itself
- `$.state`: session-scoped, versioned atoms that redraw readers on write. Every key must be declared in `types/index.d.ts`.
- `$.store`: persists **across sessions** (`get` / `set` / `delete` / `keys`).
- `options`: the user's answers to the mod's `userConfig` entries, set from the config menu and stored in the settings under `pluginConfigs`.
- `$.plugin.root`: the mod's own folder, for assets such as sounds, images and templates.

---

## 4. Interactions a mod can offer

### Where it can draw
| Place | How |
|---|---|
| **Pane** (side panel) | `$.ui.open({ id, title })` plus a `ui.render` hook on `{ component: 'Pane', requestId: id }`. A pane opened by the person seats at any width. A pane opened unasked needs at least 144 terminal columns. `focus` / `closeOnEscape` / `holdToasts` turn it into a modal dialog. |
| **AbovePrompt** band | `ui.render` on `{ component: 'AbovePrompt' }`: one or more rows above the input box. |
| **Status line** | `$.ui.status(text)`; pass `undefined` to clear it. |
| **Toast / notice** | `$.ui.toast(text)`, `$.ui.notice(...)`, `$.ui.log(...)`. |
| **Replace built-ins** | `ui.render` on `AssistantMessage`, `UserMessage`, `ToolUse`, `ToolResult`, `ToolGroup`, `ToolProgress`, `CommandOutput`, `Spinner`, `TurnDuration`, `InfoNotice`, `SessionMode`, `PromptHint`, `AskUserQuestion`: restyle, annotate or hide any row. |
| **Questions** | `$.ui.ask(...)` returns the person's answer to the hook. |
| **Sound / voice** | `$.audio.play({ asset })` for a file bundled with the mod; `$.audio.speak(text)`. |
| **Clipboard / scroll / focus** | `$.ui.copy`, `$.ui.scroll`, `$.ui.focus`. |

### Elements, and which surface has them
| Element | terminal | desktop | vscode | mobile |
|---|:-:|:-:|:-:|:-:|
| `Box`, `Text`, `Button` (hotkey, variant, `role="dismiss"`), `Markdown` (`onLinkPress`) | ✓ | ✓ | ✓ | ✓ |
| `Input`, `Select` | ✓ | ✓ | ✓ | – |
| `Svg` | – | ✓ | ✓ | ✓ |
| `Raster`, `Image` (kitty graphics) | ✓ | | | |
| `Client` (a region your own surface module draws, two-way `surface.post`) | ✓ | ✓ | – | – |

The person's input comes back as `ui.press`, `ui.input`, `ui.select` and `ui.message`
events, or through each element's own `onPress` / `onSelect` handler. Panes also
give the hook a `viewport` and `bodyColumns`, and support absolute positioning and
hover cards.

### Acting on the session
- **Give the model a tool**: `$.tool.register(...)` lists it as `mcp__<plugin>__<name>`, and a `tool.call` hook serves it.
- **Register an agent type**: `$.agent.register(...)`, or ship `agents/*.md`. It is listed as `<plugin>:<name>`. `$.agent.spawn` launches one.
- **Slash commands**: `$.command.register({ name, description })`, answered by `command.run`. `$.command.run` invokes any command.
- **Drive the conversation**:
  - `$.prompt.submit(text)` queues a new turn when idle;
  - `$.prompt.fill` / `.suggest` pre-fill the input box or set its dim Tab suggestion;
  - `$.turn.abort()` stops a running turn;
  - `$.session.compact()` compacts the conversation;
  - `$.session.append` injects a meta row or a system notice into the transcript;
  - `$.session.send` messages another agent or session.
- **Ask a model yourself**:
  - `$.model.complete(...)` makes a standalone call;
  - `$.model.fork(...)` asks a question **over the current transcript**, cheaply, because it reuses the prompt cache;
  - `$.model.classify(...)` returns a label.
- **Timers**: `$.clock.now / sleep / after / every`. Long-running loops start in `session.start`.
- **Permissions**: `$.tool.check` dry-runs the permission chain without executing anything.
- **Auth**: `$.session.authorize()` gives an auth handle for `$.http.fetch` calls, over https and to first-party hosts only.

---

## 5. Limits and dev loop

- **Limits**:
  - The sandbox has no Node, DOM or global `fetch`. Do I/O through `$`.
  - A hook has about 10 s of its own time.
  - Element keys must be strings.
  - `$.state` keys must be declared in the contract.
  - Mobile has no `Input`, `Select` or `Client`; vscode has no `Client`; the terminal has no `Svg`.
- **Prompt cache**: answers to `tool.describe`, `prompt.section` and `prompt.context` are cached until `$.ui.invalidate(...)`. An unstable answer spends the cache on every turn.
- **Check**:
  - `claude plugin validate <dir>` checks the manifest, the hooks used and the state keys;
  - `tsc -p <dir>` type-checks the mod;
  - `claude plugin test <dir>` runs `*.test.ts` with `claude-code/testing` (mock clock, store and env; `ui.mount` per surface).
- **Run**:
  - `claude --plugin-dir <dir>`, or `CLAUDE_CODE_PLUGIN_DIRS=<dir>` in the `env` of `~/.claude/settings.json`. That also works for Claude Desktop.
  - `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` turns on hot reload.
  - `claude --debug` logs every refused tree and every failed hook.
- **Ship**:
  - Publish through a marketplace repo (`.claude-plugin/marketplace.json`).
  - People install it with `/plugin marketplace add`, then `/plugin install <mod>@<market>`, then `/reload-plugins`.
  - `dependencies` let one plugin use another's typed nouns.

**Worked example in this repo:** `mods/watch-tower`. It covers a pane, the
AbovePrompt band, `turn.step` and `session.measure` for tokens, cost and
rate-limits, `agent.spawn` for the subagent tree, `tool.call` guards for plan
drift, a `$.process` call to git for commits, a slash command, `$.state` and
`$.store` persistence, and tests.

---

## 6. Five use-case ideas

1. **Secret scrubber (security).**
   - Hook `session.append` and `tool.call`'s result. Mask anything that matches API-key, JWT or `.env` patterns before it enters the transcript or the model context. Do the same on `session.send` for outbound messages.
   - Show a toast with the count of redactions. A `$.store` allow-list holds known false positives.
   - *Uses:* rewrite events, transcript control, persistence.

2. **Budget guardian (cost).**
   - Listen to `session.measure` and `turn.step`. Compare the session cost and the 5 h window with a `userConfig` budget.
   - At 80 %, show a status-line warning. At 100 %, call `$.turn.abort()` and open a dialog pane: *Continue with Haiku*, *Compact now* (`$.session.compact`) or *Stop*.
   - *Uses:* pushed metrics, turn control, modal pane, config options.

3. **Infra context guard (safety).**
   - On `tool.call` for `Bash`, parse `kubectl`, `terraform` and `aws` commands. Run `$.process.run('kubectl config current-context')`. If the target matches `prod`, deny the call, or ask with numbered buttons and a preview of the resources it would touch.
   - Add a `prompt.compose` section that tells the model which context is active.
   - *Uses:* tool interception, processes, system-prompt injection, interactive buttons.

4. **PR review cockpit (workflow).**
   - Add a `/review` command that opens a pane listing the open review threads of the current branch's PR, fetched with `$.process.run('gh api …')`.
   - Each thread gets *Fix* and *Reply* buttons:
     - *Fix* calls `$.prompt.submit` with the comment and its file and line;
     - *Reply* posts through `gh`.
   - Register a `mcp__cockpit__resolve_thread` tool so the model can close threads it fixed.
   - *Uses:* commands, pane with buttons, process and HTTP, model-callable tools.

5. **Pair-programming narrator (accessibility and ambient awareness).**
   - When a long turn completes (`turn.complete` with a duration over 2 min), ask `$.model.fork` for a one-sentence summary over the transcript. `$.audio.speak` it, or play a bundled chime when the session is unfocused.
   - On mobile (`session.attach` with `surface: 'mobile'`), draw a compact status card instead.
   - *Uses:* cheap transcript questions, audio, per-surface rendering.
