#!/usr/bin/env bash
# Prints the SHA a review of BRANCH (default: the current one) diffs against:
# the merge-base of the branch and its PR's base branch on origin, or
# origin's default branch when the branch has no PR.
set -euo pipefail

branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"
git fetch --quiet origin

base=$(gh pr view "$branch" --json baseRefName -q .baseRefName 2>/dev/null || true)
if [ -z "$base" ]; then
  base=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
fi

head="origin/$branch"
git rev-parse --verify --quiet "$head" >/dev/null || head="$branch"

git merge-base "origin/$base" "$head"
