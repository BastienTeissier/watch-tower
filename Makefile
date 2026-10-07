MODS := $(notdir $(wildcard mods/*))
MOD ?= watch-tower

.PHONY: check typecheck dev

## Validate the marketplace, then validate and test every mod.
check:
	claude plugin validate .
	@for mod in $(MODS); do \
		claude plugin validate mods/$$mod && claude plugin test mods/$$mod || exit 1; \
	done

## Type-check one mod. Needs the types the engine lays at load: run `make dev` once first.
typecheck:
	npx -y -p typescript tsc -p mods/$(MOD)

## Start Claude Code with one mod loaded from disk, hot-reloaded on save.
dev:
	claude --plugin-dir mods/$(MOD)
