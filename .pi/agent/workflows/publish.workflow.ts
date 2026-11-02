// Publication is always a protected human decision, bound to exact Git state.
import os from "node:os";
import path from "node:path";
import {
  action,
  compute,
  defineWorkflow,
  humanDecision,
  humanDecisionEdge,
  idempotentEffect,
  manualEffect,
  runShellAction,
  shell,
} from "@osolmaz/pi-workflows";
import { runClaude } from "./lib/claude.ts";
import { hasSkill } from "./lib/develop.ts";
import { MINUTE, obj, pushChoices, str } from "./lib/nodes.ts";
import {
  object,
  observe,
  parseBlocked,
  parseImplemented,
  parseReview,
  text,
  type Revision,
} from "./lib/stages.ts";

export default defineWorkflow({
  name: "publish",
  source: import.meta.url,
  input: (value: unknown) => {
    const v = object(value);
    return {
      review: parseReview(v.review),
      implementation: parseImplemented(v.implementation),
    };
  },
  startAt: "snapshot",
  maxSteps: 10,
  exits: {
    ready: {
      from: "ready",
      validate: (v: unknown): { url: string; head: string } => {
        const o = object(v);
        return { url: text(o.url, "url"), head: text(o.head, "head") };
      },
    },
    blocked: { from: "blocked", validate: parseBlocked },
    revise: {
      from: "revise",
      validate: (v: unknown): { instructions: string } => ({
        instructions: text(object(v).instructions, "instructions"),
      }),
    },
  },
  nodes: {
    snapshot: action({
      effect: idempotentEffect("publish.snapshot"),
      timeoutMs: MINUTE,
      run: ({ input: rawInput }) => {
        const input = rawInput as {
          review: ReturnType<typeof parseReview>;
          implementation: ReturnType<typeof parseImplemented>;
        };
        const revision = observe(input.review.setup);
        const reason =
          input.review.setup.repository !==
            input.implementation.setup.repository ||
          input.review.setup.base !== input.implementation.setup.base ||
          input.review.setup.branch !== input.implementation.setup.branch
            ? "repository/base/branch evidence mismatch"
            : ["main", "master"].includes(revision.branch)
              ? "refusing publication from default branch"
              : input.implementation.commits.at(-1) !== revision.head
                ? "verification commit receipt does not match HEAD"
                : input.review.blocking.length
                  ? "review still has blockers"
                  : Object.keys(revision.dirty).length || revision.staged.length
                    ? "publication requires a clean worktree and index"
                    : JSON.stringify(revision) !==
                          JSON.stringify(input.review.revision) ||
                        JSON.stringify(revision) !==
                          JSON.stringify(input.implementation.revision)
                      ? "review/verification evidence is stale or mismatched"
                      : null;
        return { revision, reason, route: reason ? "blocked" : "approve" };
      },
    }),
    approve: humanDecision({
      audience: "operator",
      choices: pushChoices,
      request: ({ input: rawInput, outputs }) => {
        const input = rawInput as {
          review: ReturnType<typeof parseReview>;
          implementation: ReturnType<typeof parseImplemented>;
        };
        const revision = (outputs.snapshot as { revision: Revision }).revision;
        return {
          title: `Push ${revision.branch} and open a draft PR?`,
          subject: {
            repository: input.review.setup.repository,
            revision,
            review: input.review,
            verification: input.implementation.verification,
          },
          presentation: {
            schema: "pi-workflows.decision-presentation.v1",
            summary: `Publish ${revision.head} on ${revision.branch}; full verify passed and validated review has no blockers.`,
            blocks: [
              {
                kind: "paragraph",
                text: `Repository: ${input.review.setup.repository}. Base: ${revision.base}. Run files: ${input.review.setup.runDir}`,
              },
              {
                kind: "bullets",
                items: input.review.noted.length
                  ? input.review.noted.map((f) => `${f.file}: ${f.problem}`)
                  : ["No noted findings"],
              },
            ],
          },
        };
      },
    }),
    push: action({
      effect: manualEffect("publish.push"),
      timeoutMs: 6 * MINUTE,
      run: async ({ input: rawInput, outputs, signal }) => {
        const input = rawInput as {
          review: ReturnType<typeof parseReview>;
          implementation: ReturnType<typeof parseImplemented>;
        };
        signal.throwIfAborted();
        const approved = (outputs.snapshot as { revision: Revision }).revision;
        if (
          JSON.stringify(observe(input.review.setup)) !==
          JSON.stringify(approved)
        )
          throw new Error(
            "Git state changed after approval; request a fresh approval",
          );
        // Push the approved object, never a potentially changed HEAD. No force.
        const receipt = await runShellAction(
          {
            command: "git",
            args: [
              "push",
              "-u",
              "origin",
              `${approved.head}:refs/heads/${approved.branch}`,
            ],
            cwd: input.review.setup.repository,
            timeoutMs: 5 * MINUTE,
          },
          signal,
        );
        return { head: approved.head, receipt };
      },
    }),
    create_pr: action({
      effect: manualEffect("publish.create-pr"),
      timeoutMs: 20 * MINUTE,
      run: async ({ input: rawInput, signal }) => {
        const input = rawInput as {
          review: ReturnType<typeof parseReview>;
          implementation: ReturnType<typeof parseImplemented>;
        };
        const setup = input.review.setup;
        if (
          JSON.stringify(observe(setup)) !==
          JSON.stringify(input.review.revision)
        )
          throw new Error("state changed before draft PR creation");
        const skill = hasSkill(setup.repository, "pull-request-creation")
          ? "the repo's pull-request-creation skill"
          : "mattpocock-skills:pr";
        return (
          await runClaude<{ url: string }>({
            role: "prWriter",
            cwd: setup.repository,
            runDir: setup.runDir,
            signal,
            schema: obj({ url: str }),
            prompt: `The approved commit ${input.review.revision.head} on branch ${setup.branch} is pushed. Use the Skill tool to run ${skill}, then gh pr create --draft --head ${JSON.stringify(setup.branch)} --assignee jv-foxglove --label 'ai review'. Never push, merge, mark ready, or delete branches. Base the body on diff against ${setup.base}. ${setup.linearId ? `Linear issue: ${setup.linearId}.` : ""} Full verify passed; use the supplied evidence instead of rerunning it: ${JSON.stringify(input.implementation.verification)}. Task: ${setup.task}. Return the draft PR URL.`,
          })
        ).output;
      },
    }),
    open_review: shell({
      effect: manualEffect("publish.open-review"),
      timeoutMs: 3 * MINUTE,
      exec: ({ input: rawInput, outputs }) => {
        const input = rawInput as {
          review: ReturnType<typeof parseReview>;
          implementation: ReturnType<typeof parseImplemented>;
        };
        return {
          command: "bash",
          args: [
            path.join(
              os.homedir(),
              ".config/herdr/local-plugins/pr-review/open.sh",
            ),
            input.review.setup.repository,
            (outputs.create_pr as { url: string }).url,
            input.review.setup.piPane,
          ],
          cwd: input.review.setup.repository,
          timeoutMs: 2 * MINUTE,
          allowNonZeroExit: true,
        };
      },
    }),
    ready: compute({
      run: ({ input: rawInput, outputs }) => {
        const input = rawInput as { review: ReturnType<typeof parseReview> };
        return {
          url: (outputs.create_pr as { url: string }).url,
          head: input.review.revision.head,
        };
      },
    }),
    revise: compute({
      run: ({ outputs }) => ({
        instructions: (outputs.approve as { input: { instructions: string } })
          .input.instructions,
      }),
    }),
    blocked: compute({
      run: ({ outputs, results }) => ({
        reason:
          (outputs.snapshot as { reason?: string } | undefined)?.reason ??
          "Publication stopped or failed; inspect saved effects before retrying.",
        evidence: results,
      }),
    }),
  },
  edges: [
    {
      from: "snapshot",
      switch: {
        on: "$.route",
        cases: { approve: "approve", blocked: "blocked" },
      },
    },
    humanDecisionEdge({
      from: "approve",
      choices: pushChoices,
      cases: { push: "push", fix: "revise", stop: "blocked" },
    }),
    {
      from: "push",
      switch: {
        on: "$result.outcome",
        cases: { ok: "create_pr", failed: "blocked", timed_out: "blocked" },
      },
    },
    {
      from: "create_pr",
      switch: {
        on: "$result.outcome",
        cases: { ok: "open_review", failed: "blocked", timed_out: "blocked" },
      },
    },
    { from: "open_review", to: "ready" },
  ],
});
