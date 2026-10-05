# claude-code-mods

My [Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/):
small hooks modules that watch a session, draw in it and step into its flow.
Needs Claude Code 2.1.287 or newer.

## The mods

| Mod | What it does | Command |
| --- | --- | --- |
| [**buddy**](mods/buddy/README.md) | An ASCII companion pane mirroring what Claude is doing, with quota gauges, the attached plan's position, session vitals, subagents, the prompt cache countdown, and a guard that holds edits to files the plan does not list | `/buddy`, `/buddy plan <path>` |

## Install

From a clone, as a marketplace:

```sh
git clone <this repo> ~/workspace/claude-code-mods
claude plugin marketplace add ~/workspace/claude-code-mods
claude plugin install buddy@claude-code-mods
```

Restart Claude Code, then type `/buddy`.

Or try a mod for one session without installing it (it hot-reloads on save):

```sh
claude --plugin-dir mods/buddy     # or: make dev MOD=buddy
```

## Develop

```sh
make check              # validate the marketplace, validate + test every mod
make dev MOD=buddy      # run Claude Code with the mod loaded from disk
make typecheck MOD=buddy
```

`make typecheck` reads the API types the engine lays in
`mods/<mod>/.claude-plugin/types/` each time it loads the mod (gitignored), so
run `make dev` once before it.

A mod is a folder under `mods/` with `.claude-plugin/plugin.json`,
`hooks/hooks.json` naming one hooks module, an optional `types/index.d.ts`
state contract and `tests/*.test.ts`. Add its entry to
`.claude-plugin/marketplace.json`.

A mod is code that runs inside Claude Code on your machine, with the access
Claude Code has: read a mod before you install it.
