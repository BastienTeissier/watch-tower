# UF8: Turn the companion off

## Context

The ASCII companion is there for fun; the agent follow-up is the core. The companion becomes optional and moves out of the way.

## Specification

AAU, in `/config`, I can set `watch-tower.companion` on or off (on by default).

AAU, with the companion on, I see in the pane, from top to bottom:
1. the agent tree and totals
2. commits
3. plan position and drift
4. context %, cache countdown and quota gauges
5. the companion: its state name, its animated sprite, its message, and the `Tap` button when it is alerting

AAU, with the companion off, I see sections 1 to 4 only: no state name, no sprite, no message, no `Tap` button.

## Success Scenario

- AAU, when I switch the setting, the pane redraws with or without the companion, with no restart
- AAU, with the companion off, everything else in the pane and the band behaves the same

## Edge Cases

- AAU, if the companion is off when Claude waits for a permission, nothing in the pane signals it (the engine's own prompt does)
- AAU, if the companion is off, `watch-tower.species` has no visible effect and is kept for when I turn it back on

## Acceptance Criteria

- [ ] `watch-tower.companion` exists in `/config`, default on
- [ ] Off: the pane renders no companion row and no `Tap` button
- [ ] On: the companion is the last section of the pane
- [ ] The agent tree is the first section in both cases
- [ ] Changing the setting takes effect without restarting the session
