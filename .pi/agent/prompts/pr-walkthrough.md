---
description: Open a paced PR walkthrough with Pi on the left and Neovim/Atlas on the right
argument-hint: "[PR URL or number]"
---
Set up an interactive, human-paced PR walkthrough for: ${@:-the current branch's pull request}.

Read the `review-with-me` skill and its terminal, Foxglove, and context references. Use that skill for the walkthrough, not an autonomous review or findings dump.

## Set up the review tab

- Resolve the PR and repository with GitHub CLI; validate the target before using it in commands. Preserve the current branch and all unrelated work. Do not edit production code, launch the app, or publish comments/reviews.
- This request authorizes a new Herdr tab with a fresh interactive Pi guide on the LEFT and Neovim with Atlas on the RIGHT. Read `herdr --skill`, verify `HERDR_ENV=1`, and inspect the installed CLI and current layout before controlling anything. If outside Herdr, explain that automatic layout setup is unavailable; do not control another session.
- Inspect the existing Neovim sidebar integration/configuration first. A fresh Pi may automatically create its right-hand Neovim sidebar; reuse that instead of creating a duplicate editor. Otherwise create the right split explicitly. Preserve the repository cwd and use returned IDs, not guessed IDs.
- Create a clearly labeled PR review tab, start a fresh Pi there using `herdr agent start` (no model override), and open `Atlas review <validated PR URL>` in its right-hand Neovim. Inspect foreground processes before sending input. Do not type shell commands into an editor or agent. Verify the final layout actually has Pi left and Neovim right.
- Prompt the fresh Pi to read the `review-with-me` skill and references, resolve and pin the current PR revisions, inspect source using immutable revisions, and prepare its short opening map. Include the actual PR URL and live editor/Pi pane IDs. Authorize it to navigate the review Neovim throughout the walkthrough: switch files, select Atlas/Diffview entries, jump to symbols/lines, and show relevant context at the current stop without asking permission for each navigation action. It must inspect the supported editor integration, preserve unsaved buffers, and target the actual review editor. Tell it to pause for the human after the map and after each logical stop. No automatic review verdicts, edits, reviewed-marker changes, or publication. Give it ownership of the walkthrough so this launching session does not duplicate the review.
- Find the PR's deployed app-party preview URL from deployment statuses or successful deployment logs. Do not infer a URL from a branch name. Include the verified link in the handoff and final response; explicitly report if no successful preview is available.
- Focus the new review tab when setup is complete. Report the tab name, layout, and preview link concisely. If setup partially fails, inspect actual state and report it rather than blindly creating more panes or resending prompts.
