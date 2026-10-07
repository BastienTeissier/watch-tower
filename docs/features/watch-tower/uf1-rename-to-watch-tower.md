# UF1: Rename the mod to watch-tower

## Context

The mod is named `buddy` after its decorative companion. Its purpose is following agent work, so it takes the (temporary) name `watch-tower`. The companion keeps the name "buddy" as a feature inside it. This flow changes names only, no behaviour.

## Specification

AAU, when I install and run the mod, I see/can:
- install it as `watch-tower@claude-code-mods`
- open the pane with `/watch-tower`, titled "Watch Tower"
- attach, query and detach a plan with `/watch-tower plan <path>`, `/watch-tower plan`, `/watch-tower plan off`
- set the companion's species and the cache lifetime under `watch-tower.*` in `/config`
- read a README and an INTENT that present the mod as an agent follow-up, with the companion as an optional extra

## Success Scenario

- AAU, running `claude --plugin-dir mods/watch-tower`, I see the same pane, band, plan tracking, off-plan guard, gauges and cache countdown as before the rename

## Edge Cases

- AAU, if I had a plan remembered under the old name, it is not restored and I attach it again once
- AAU, if I type `/buddy`, the command does not exist any more

## Acceptance Criteria

- [ ] The marketplace lists `watch-tower` and no `buddy`
- [ ] `/watch-tower` and its `plan` sub-commands work as `/buddy` did
- [ ] Settings are `watch-tower.species` and `watch-tower.cacheTtl`
- [ ] `make check` passes with the same tests as before the rename
- [ ] The root README, the mod README and INTENT.md use the new name and lead with the agent follow-up
- [ ] The rename is delivered as its own change, with no behaviour change in it
