# Workflow backlog

Things to change in the develop / address-feedback workflows.

## Decisions UX

- Answer decisions by picking a choice from a list in pi. For now the input
  is prefilled with `/workflow answer <decision-id> ` (extension
  workflow-answer-prefill.ts), so only the choice needs typing.
- Choosing "Fix first" at the push approval opens the "decided without you"
  list for editing (annotate like decisions.md), so those answers can be
  corrected before pushing.
- Split the push approval into an editable push review (/reply-editor on
  push-review.md; annotations become fix instructions) and a protected
  Push / Stop decision.

## Setup on a new machine

pi-workflows' resolver runs outside pi and needs pi's own packages next to
it. Without them no workflow starts ("Cannot find package
'@earendil-works/pi-ai'"). Install them at pi's version (`pi --version`),
and again after pi updates:

    cd ~/.pi/agent/npm && npm install --save-exact \
      @earendil-works/pi-ai@<pi version> \
      @earendil-works/pi-coding-agent@<pi version> \
      @earendil-works/pi-tui@<pi version> \
      typebox@<pi's typebox version>
