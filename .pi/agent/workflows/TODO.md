# Workflow backlog

Things to change in the develop / address-feedback workflows.

## Decisions UX

- Answer decisions by picking a choice from a list in pi, not by copying
  `/workflow answer <decision-id> <response>`.
- Choosing "Fix first" at the push approval opens the "decided without you"
  list for editing (annotate like decisions.md), so those answers can be
  corrected before pushing.
- Split the push approval into an editable push review (/reply-editor on
  push-review.md; annotations become fix instructions) and a protected
  Push / Stop decision.
