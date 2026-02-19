#!/usr/bin/env sh
# Wrapper for "git commit" when the environment (e.g. Cursor) passes
# --trailer but your Git is older than 2.32 and does not support it.
# Strips --trailer and its argument, then runs git commit with the rest.
# Usage: ./scripts/git-commit.sh -m "message"

set -e

# Skip --trailer and its value, pass everything else to git commit
ARGS=""
skip=0
for a in "$@"; do
  if [ "$skip" -eq 1 ]; then
    skip=0
    continue
  fi
  if [ "$a" = "--trailer" ]; then
    skip=1
    continue
  fi
  ARGS="$ARGS $(printf '%s' "$a" | sed "s/'/'\\\\''/g")"
done

eval "set -- $ARGS"
exec git commit "$@"
