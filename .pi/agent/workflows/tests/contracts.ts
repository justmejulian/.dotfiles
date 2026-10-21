// Compile-time composition contracts (checked by npm run typecheck).
import {
  includeWorkflow,
  type WorkflowIncludedResult,
} from "@osolmaz/pi-workflows";
import review from "../review.workflow.ts";
import implement from "../implement.workflow.ts";

includeWorkflow(review, {
  // @ts-expect-error a child requires explicit repository, base, task and scope
  input: () => ({ task: "review only" }),
});
includeWorkflow(implement, {
  // @ts-expect-error implementation requires explicit approved plan and authority
  input: () => ({
    repository: "/tmp/repo",
    base: "HEAD",
    task: "fix",
    scope: { paths: [], includeUncommitted: true },
  }),
});
type ReviewExit = WorkflowIncludedResult<typeof review>["exit"];
// @ts-expect-error parents can only use the child's declared named exits
const badExit: ReviewExit = "final_review";
void badExit;
