#!/bin/bash

# Get issue_name
branch_name=$(git branch --show-current)

issue_name=""
if [[ $branch_name =~ ([A-Z]+-[0-9]+) ]]; then
    issue_name="${BASH_REMATCH[1]}"
fi


# Add Semantic Commit Messages Type
#
# Types: https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716#semantic-commit-messages
commit_types=(
    "feat: new feature for the user, not a new feature for build script"
    "fix: bug fix for the user, not a fix to a build script"
    "docs: changes to the documentation"
    "style: formatting, missing semi colons, etc; no production code change"
    "refactor: refactoring production code, eg. renaming a variable"
    "test: adding missing tests, refactoring tests; no production code change"
    "chore: updating grunt tasks etc; no production code change"
)

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2
SHA1=$3

# Only trigger for certain commit types (e.g., not for merge commits)
if [ -z "$COMMIT_MSG_FILE" ] || [ -n "$2" ]; then
    exit 0
fi

# fzf to select a commit type
selected=$(printf "%s\n" "${commit_types[@]}" | fzf --height=10 --border --ansi --prompt="Select commit type: ")

if [ -z "$selected" ]; then
    exit 1
fi

# Extract the commit type (e.g., feat:)
commit_type=$(echo "$selected" | awk '{print $1}')

# Extract the body starting from the second line and append to the original commit message
tail -n +2 "$COMMIT_MSG_FILE" >> "$COMMIT_MSG_FILE.bak"

# Prepend the commit type to the commit message
echo "$issue_name $commit_type " > "$COMMIT_MSG_FILE"

cat "$COMMIT_MSG_FILE.bak" >> "$COMMIT_MSG_FILE" 2>/dev/null || true

rm "$COMMIT_MSG_FILE.bak"
