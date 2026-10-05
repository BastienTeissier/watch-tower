# Intent

My understanding of what this project is for, written so it can be corrected.

## The problem

I run Claude Code as a delegation engine: I hand it a plan (`/implement-plan
docs/features/<feature>/plan.md`), a review, or a production bug, and it works
through commit, PR and CI largely on its own. That works, but while it runs I
am blind to three things:

1. **Where the plan stands.** Which phase, which task, what is next. Today I
   find out by asking "where are you?" or by reading the transcript.
2. **What the session is costing and doing.** Context fill, quotas, cost, how
   long the turn has run, what each subagent is busy with, whether the prompt
   cache is about to go cold.
3. **Whether the work is still the work I asked for.** Files edited that the
   plan never mentioned, commits whose title is not in the plan.

And when something does drift, I only learn about it afterwards, in review.

## What this repo is

A personal marketplace of Claude Code mods: small hooks modules that run inside
a session, observe its events, draw in it, and can step into its flow. Each mod
lives under `mods/<name>/` and is installable on its own.

It is the on-screen, no-hardware sibling of
[claude-ble-buddy](https://github.com/BastienTeissier/claude-ble-buddy), where
the same Buddy runs on an ESP32 over BLE.

## What `buddy` is for

One pane (and a one-line band on narrow terminals) that answers, at a glance:

- **Am I on plan?** Phase, task X of Y, the next task. A task is done when a
  commit carries its title from the plan; the mod then ticks the box in the
  plan file, so the file stays the source of truth across sessions.
- **How is the session doing?** Context %, cost, turn time, tool count, 5h/7d
  quotas, prompt cache countdown, git branch and dirty count.
- **Who is working?** One line per subagent with what it is doing right now.
- **Is it drifting?** Count of off-plan files and off-plan commits.

And one intervention: an edit to a file no plan task lists is held until I
allow it or deny it. The point is to be asked at the moment of drift rather
than to discover it in the diff.

The ASCII companion is the Buddy's state at a glance (thinking, running a
command, editing, waiting on me), kept from the hardware version.

## Principles

- **The plan file is the contract.** The mod reads the plans as `create-plan`
  already writes them (`## N. To Do List`, `### Phase`, checkboxes with a
  `type(scope): title` and a `Files:` line). It asks nothing new of the plan.
- **Observe by default, intervene rarely.** Every intervention is something I
  chose; a session with no plan attached is never held.
- **Evidence over self-report.** Progress comes from commits and edits, not
  from Claude saying a task is done.
- **Pure logic apart from wiring.** Parsing, position, vitals, agents and the
  cache clock are pure modules with unit tests; only `register.tsx` touches the
  engine.
- **Borrow openly.** Subagent lines follow agent-radar and the cache countdown
  follows token-weather, both from
  [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods).

## Where it could go

Use cases identified but not built, in rough order of value to my workflow:

- **Phase gate**: hold the next phase's edits until I press Continue, which is
  the phase-confirmation rule my CLAUDE.md already asks for.
- **Commit guard**: deny a commit with more than 3 files, a `Co-authored-by`
  line, or a title the plan does not name.
- **Push guard**: hold `git push` until the checks ran this session.
- **Steering buttons**: pause after this task, skip a task, re-read the plan.

## Not the goal

- Not a general-purpose plan manager: it serves my plan format and my flow.
- Not a replacement for review or CI: it surfaces drift early, it does not
  judge the code.
- Not a polished public product yet: local repo, no remote, no CI, and the mod
  has so far only been exercised by `claude plugin test`, not in a live session.
