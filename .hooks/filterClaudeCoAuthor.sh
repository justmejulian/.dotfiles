#!/bin/sh
#
# Filter out Claude Code co-author attribution from commit messages.
# Based on https://gist.github.com/panphora/1cf274e089ef4257e958101cf6f327b1
#
# Use as (or source from) a commit-msg hook.

COMMIT_MSG_FILE=$1

# Remove Claude-specific Co-Authored-By lines (any capitalisation).
# Other Co-Authored-By lines (human contributors) are kept.
perl -i -ne 'print unless /^Co-Authored-By: Claude\b/i' "$COMMIT_MSG_FILE"

# Remove trailing blank lines (but keep the message content)
perl -0777 -i -pe 's/\n+\z/\n/' "$COMMIT_MSG_FILE"
