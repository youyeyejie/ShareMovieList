#!/usr/bin/env bash
set -euo pipefail

snapshot=src/watchlists.json
ref=refs/heads/watchlist-snapshot
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

# The public branch contains only the generated JSON, independent of main.
remote_ref=$(git ls-remote origin "$ref")
parent=''
if [[ -n "$remote_ref" ]]; then
  git fetch --no-tags origin "$ref"
  parent=$(git rev-parse FETCH_HEAD)
  previous=$(mktemp)
  trap 'rm -f "$previous"' EXIT
  git show "$parent:watchlists.json" > "$previous"
  if node --input-type=module -e '
    import {readFileSync} from "node:fs";
    const [before, after] = process.argv.slice(1).map(file => JSON.parse(readFileSync(file)).entries);
    process.exitCode = JSON.stringify(before) === JSON.stringify(after) ? 0 : 1;
  ' "$previous" "$snapshot"; then
    echo 'Public watchlist snapshot is already up to date.'
    exit 0
  fi
fi

blob=$(git hash-object -w "$snapshot")
tree=$(printf '100644 blob %s\twatchlists.json\n' "$blob" | git mktree)
if [[ -n "$parent" ]]; then
  commit=$(git commit-tree "$tree" -p "$parent" -m 'chore: publish public watchlist snapshot')
else
  commit=$(git commit-tree "$tree" -m 'chore: publish public watchlist snapshot')
fi
git push origin "$commit:$ref"
