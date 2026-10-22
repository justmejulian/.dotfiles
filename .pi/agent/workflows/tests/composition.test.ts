import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  discoverWorkflows,
  resolveWorkflowRef,
  loadWorkflowFile,
  WorkflowEngine,
  WorkflowRunStore,
  type WorkflowDefinition,
  type WorkflowNodeContext,
  type WorkflowActionContext,
  type AgentStepRequest,
} from "@osolmaz/pi-workflows";
import {
  guard,
  loopDecision,
  observe,
  parseAuthority,
  parsePlan,
  parseReview,
  parseStage,
  prepare,
  scopeText,
  type ReviewReady,
  type ImplementReady,
  type Prepared,
} from "../lib/stages.ts";
import { roles, runClaude } from "../lib/claude.ts";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "personal-workflow-tests-"));
const bin = path.join(root, "bin"),
  queue = path.join(root, "claude.json"),
  calls = path.join(root, "calls.jsonl");
const oldPath = process.env.PATH;
let sequence = 0;
const finding = {
  id: "F1",
  source: "spec",
  severity: "blocker",
  file: "endpoint.ts",
  line: 1,
  problem: "missing endpoint marker",
  requiredChange: "add marker",
  documentedRule: false,
};
const approvedPlan = {
  summary: "Endpoint marker",
  risks: [],
  steps: [
    {
      title: "Add marker",
      goal: "Add endpoint marker",
      files: ["endpoint.ts"],
      acceptance: ["marker exists"],
      checks: ["full suite"],
    },
  ],
};
const authority = {
  edit: true,
  commit: true,
  files: ["endpoint.ts"],
  includeUncommitted: true,
};

before(() => {
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_CALLS, JSON.stringify(args)+'\\n');
const q = JSON.parse(fs.readFileSync(process.env.MOCK_QUEUE, 'utf8'));
if (!q.length) process.exit(93);
const next=q.shift(); fs.writeFileSync(process.env.MOCK_QUEUE,JSON.stringify(q));
if(next.hang) { fs.writeFileSync(process.env.MOCK_QUEUE+'.started', String(process.pid)); setInterval(()=>{},1000); }
else if(next.fail) process.exit(92);
else console.log(JSON.stringify({type:'result',structured_output:next,session_id:'mock',total_cost_usd:0}));
`,
    { mode: 0o755 },
  );
  process.env.PATH = `${bin}:${oldPath}`;
  process.env.MOCK_QUEUE = queue;
  process.env.MOCK_CALLS = calls;
});
after(() => {
  process.env.PATH = oldPath;
  delete process.env.MOCK_QUEUE;
  delete process.env.MOCK_CALLS;
  fs.rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  }).trim();
}
function fixture() {
  const dir = path.join(root, String(++sequence)),
    repository = path.join(dir, "pi-workflow-e2e"),
    runDir = path.join(dir, "run");
  fs.mkdirSync(repository, { recursive: true });
  fs.mkdirSync(runDir);
  git(repository, "init", "-q", "-b", "task");
  git(repository, "config", "user.name", "Workflow test");
  git(repository, "config", "user.email", "test@example.invalid");
  git(repository, "config", "commit.gpgsign", "false");
  fs.writeFileSync(path.join(repository, "endpoint.ts"), "initial\n");
  fs.writeFileSync(path.join(repository, "unrelated.txt"), "unrelated\n");
  git(repository, "add", "endpoint.ts", "unrelated.txt");
  git(repository, "-c", "core.hooksPath=/dev/null", "commit", "-qm", "initial");
  const base = git(repository, "rev-parse", "HEAD");
  const input = {
    repository,
    base,
    branch: "task",
    task: "Add endpoint marker",
    runDir,
    scope: { paths: ["endpoint.ts"], includeUncommitted: true },
  };
  return { dir, repository, input, setup: prepare(input, "test") };
}
function replies(...values: unknown[]) {
  fs.writeFileSync(queue, JSON.stringify(values));
  fs.writeFileSync(calls, "");
}
const clean = () => ({ summary: "clean", findings: [] });
const issues = () => ({ summary: "marker needed", findings: [finding] });
const checked = () => ({
  items: [{ id: "F1", decision: "fix", reason: "endpoint.ts:1 has no marker" }],
});
async function definition(name: string) {
  return (await resolveWorkflowRef(name, { cwd: root, homeDir: os.homedir() }))
    .definition;
}
function harness(
  dir: string,
  executor?: (request: AgentStepRequest) => Promise<unknown>,
  onEvent?: ConstructorParameters<typeof WorkflowEngine>[0]["onEvent"],
) {
  const store = new WorkflowRunStore(
    path.join(dir, `state-${++sequence}.sqlite`),
  );
  const engine = new WorkflowEngine({
    store,
    onEvent,
    executor: {
      async runAgentStep(request) {
        const output = await (executor
          ? executor(request)
          : Promise.reject(
              new Error(`unexpected model step ${request.contract.nodeId}`),
            ));
        const accepted = await request.accept(output);
        if (!accepted.ok) throw new Error(accepted.error);
        return { output: accepted.value };
      },
    },
  });
  return { engine, store };
}
function mockVerify(w: WorkflowDefinition, passed: boolean | (() => boolean)) {
  for (const [id, node] of Object.entries(w.nodes))
    if (id === "verify" || id.endsWith("/verify")) {
      assert.equal(node.nodeType, "action");
      w.nodes[id] = {
        nodeType: "action",
        effect: { type: "test.verify", recovery: "idempotent", request: {} },
        timeoutMs: 1000,
        run: () => ({
          passed: typeof passed === "function" ? passed() : passed,
          tail: "mock full suite",
        }),
      };
    }
}
function implementer(repository: string, mode = "done") {
  let n = 0;
  return async (request: AgentStepRequest) => {
    assert.match(request.contract.nodeId, /implement|fix_verify/);
    if (mode === "failed")
      return {
        status: "needs_answer",
        commit: null,
        summary: "scope decision",
        checks: [],
        notes: "do not guess",
      };
    fs.appendFileSync(path.join(repository, "endpoint.ts"), `marker ${++n}\n`);
    git(repository, "add", "--", "endpoint.ts");
    git(
      repository,
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-qm",
      "fix: endpoint marker",
      ...(request.contract.nodeId.endsWith("fix_verify")
        ? ["--amend", "--no-edit"]
        : []),
    );
    return {
      status: "done",
      commit: git(repository, "rev-parse", "HEAD"),
      summary: "marker added",
      checks: [{ command: "mock suite", result: "passed" }],
      notes: "",
    };
  };
}
function ready(setup: Prepared): ReviewReady {
  return {
    setup,
    revision: observe(setup),
    summary: "clean",
    blocking: [],
    noted: [],
    skipped: [],
    evidence: [],
  };
}

// Definitions are resolved through the installed package, including all nested mounts.
test("installed discovery and all seven definitions resolve", async () => {
  const names = (
    await discoverWorkflows({ cwd: root, homeDir: os.homedir() })
  ).map((w) => w.name);
  for (const name of [
    "plan",
    "implement",
    "review",
    "publish",
    "refine",
    "develop",
    "address-feedback",
  ]) {
    assert.ok(names.includes(name));
    await definition(name);
  }
  const develop = await definition("develop");
  assert.ok(develop.nodes["refine/review/final_review"]);
  assert.ok(develop.nodes["publish/approve"]);
  const feedback = await definition("address-feedback");
  assert.ok(feedback.nodes["review/check_findings"]);
  assert.equal(feedback.nodes.final_review, undefined);
});

test("runtime scope, authority, plan and child output contracts reject malformed input", () => {
  assert.throws(() => parseStage({}), /object/);
  assert.throws(
    () => parseAuthority({ ...authority, commit: false }),
    /authority/,
  );
  assert.throws(
    () => parseAuthority({ ...authority, files: ["../outside"] }),
    /relative/,
  );
  assert.throws(() => parsePlan({ ...approvedPlan, steps: [] }), /steps/);
  assert.throws(() => parseReview({ blocking: [] }), /noted/);
});

test("review is read-only and reviewer/checker use identical committed + dirty + untracked scope", async () => {
  const f = fixture();
  fs.appendFileSync(
    path.join(f.repository, "endpoint.ts"),
    "unstaged marker\n",
  );
  fs.writeFileSync(path.join(f.repository, "other-marker.ts"), "untracked\n");
  f.input.scope.paths.push("other-marker.ts");
  const before = observe(f.input);
  replies(issues(), checked());
  const { engine, store } = harness(f.dir);
  try {
    const result = await engine.run(await definition("review"), f.input);
    assert.equal(
      result.state.status,
      "completed",
      JSON.stringify(result.state.error),
    );
    const output = parseReview(result.state.finalOutput);
    assert.equal(output.blocking.length, 1);
    assert.equal(output.evidence.length, 1);
    assert.deepEqual(observe(f.input), before);
    const prompts = fs
      .readFileSync(calls, "utf8")
      .trim()
      .split("\n")
      .map((s) => JSON.parse(s) as string[])
      .map((args) => args[args.indexOf("-p") + 1]);
    const exact = scopeText(f.input, before);
    assert.equal(prompts.length, 2);
    for (const p of prompts) assert.ok(p.includes(exact));
    assert.match(exact, /index AND unstaged/);
    assert.match(exact, /untracked/);
    for (const role of [roles.finalReview, roles.checker])
      assert.ok(
        !role.tools.some((t) => /Edit|Write|git push|gh pr create/.test(t)),
      );
  } finally {
    store.close();
  }
});

test("clean review skips checker; missing checker coverage and failed review block", async () => {
  const f = fixture();
  for (const answer of [
    [clean()],
    [issues(), { items: [] }],
    [{ fail: true }],
  ]) {
    replies(...answer);
    const { engine, store } = harness(f.dir);
    try {
      const r = await engine.run(await definition("review"), f.input);
      assert.equal(r.state.status, "completed");
      assert.equal(
        Boolean((r.state.finalOutput as { reason?: string }).reason),
        answer.length > 1 || "fail" in answer[0],
      );
    } finally {
      store.close();
    }
  }
});

test("skeptical validation separates blocking, noted and skipped findings with evidence", async () => {
  const f = fixture();
  const note = {
      ...finding,
      id: "F2",
      source: "standards",
      documentedRule: false,
    },
    skip = { ...finding, id: "F3" };
  replies(
    { summary: "three findings", findings: [finding, note, skip] },
    {
      items: [
        {
          id: "F1",
          decision: "fix",
          reason: "endpoint.ts:1 violates the task",
        },
        {
          id: "F2",
          decision: "fix",
          reason: "endpoint.ts:1 is a smell, not a documented rule",
        },
        {
          id: "F3",
          decision: "skip",
          reason: "endpoint.ts:1 already handles the input",
        },
      ],
    },
  );
  const { engine, store } = harness(f.dir);
  try {
    const r = await engine.run(await definition("review"), f.input);
    const o = parseReview(r.state.finalOutput);
    assert.equal(o.blocking[0].id, "F1");
    assert.equal(o.noted[0].id, "F2");
    assert.equal(o.skipped[0].id, "F3");
    assert.equal(o.evidence.length, 3);
  } finally {
    store.close();
  }
});

test("validated clean-code findings reach refinement as blockers and are repaired", async () => {
  const f = fixture();
  const cleanCodeFinding = { ...finding, source: "clean-code", problem: "G25: unnamed constant" };
  replies({ summary: "clean-code finding", findings: [cleanCodeFinding] }, checked(), clean());
  const w = await definition("refine");
  mockVerify(w, true);
  const repair = implementer(f.repository);
  let repairs = 0;
  const { engine, store } = harness(f.dir, async request => {
    assert.match(request.prompt, /G25: unnamed constant/);
    repairs++;
    return repair(request);
  });
  try {
    const r = await engine.run(w, { ...f.input, authority });
    assert.equal(r.state.status, "completed", JSON.stringify(r.state.error));
    const o = r.state.finalOutput as { rounds: number; review: ReviewReady };
    assert.equal(repairs, 1);
    assert.equal(o.rounds, 1);
    assert.deepEqual(o.review.blocking, []);
    const checkedReview = ready(f.setup);
    assert.throws(() => parseReview({ ...checkedReview, blocking: [{ ...cleanCodeFinding, source: "unknown" }] }), /invalid finding/);
    const reviewCall = JSON.parse(fs.readFileSync(calls, "utf8").split("\n")[0]) as string[];
    const schema = JSON.parse(reviewCall[reviewCall.indexOf("--json-schema") + 1]);
    assert.ok(schema.properties.findings.items.properties.source.enum.includes("clean-code"));
  } finally {
    store.close();
  }
});

test("review blocks when its repository evidence changes between reviewer and checker", async () => {
  const f = fixture();
  replies(issues(), checked());
  const { engine, store } = harness(f.dir, undefined, (event) => {
    if (event.type === "node_finished" && event.nodeId === "final_review")
      fs.appendFileSync(
        path.join(f.repository, "endpoint.ts"),
        "concurrent edit\\n",
      );
  });
  try {
    const r = await engine.run(await definition("review"), f.input);
    assert.match((r.state.finalOutput as { reason: string }).reason, /changed/);
  } finally {
    store.close();
  }
});

test("review snapshot notices index-only changes and committed-only scope excludes working-tree evidence", () => {
  const f = fixture(),
    original = observe(f.input);
  fs.writeFileSync(path.join(f.repository, "endpoint.ts"), "staged\n");
  git(f.repository, "add", "endpoint.ts");
  fs.writeFileSync(path.join(f.repository, "endpoint.ts"), "initial\n");
  assert.notEqual(observe(f.input).digest, original.digest);
  const committed = {
    ...f.input,
    scope: { paths: ["endpoint.ts"], includeUncommitted: false },
  };
  assert.match(scopeText(committed, observe(committed)), /Exclude index/);
});

test("refine freezes a relative base across repairs and keeps publication receipts compatible", async () => {
  const f = fixture();
  fs.appendFileSync(path.join(f.repository, "endpoint.ts"), "original change\n");
  git(f.repository, "add", "endpoint.ts");
  git(f.repository, "-c", "core.hooksPath=/dev/null", "commit", "-qm", "original change");
  replies(issues(), checked(), clean());
  const w = await definition("refine");
  mockVerify(w, true);
  const { engine, store } = harness(f.dir, implementer(f.repository));
  try {
    const r = await engine.run(w, { ...f.input, base: "HEAD~1", authority });
    assert.equal(r.state.status, "completed", JSON.stringify(r.state.error));
    const o = r.state.finalOutput as { review: ReviewReady; implementation: ImplementReady };
    assert.equal(o.review.setup.base, f.input.base);
    assert.equal(o.review.revision.base, f.input.base);
    assert.equal(o.implementation.setup.base, f.input.base);
    const reviewPrompts = fs.readFileSync(calls, "utf8").trim().split("\n")
      .map(line => JSON.parse(line) as string[])
      .map(args => args[args.indexOf("-p") + 1])
      .filter(prompt => prompt.startsWith("Final review."));
    assert.equal(reviewPrompts.length, 2);
    for (const prompt of reviewPrompts)
      assert.ok(prompt.includes(`Exact review scope (the same for reviewer and checker): base ${f.input.base},`));
    const publication = await definition("publish");
    const snapshot = publication.nodes.snapshot;
    assert.ok(snapshot.nodeType === "action" && "run" in snapshot);
    const result = await snapshot.run({ input: o } as unknown as WorkflowActionContext) as { route: string };
    assert.equal(result.route, "approve");
  } finally {
    store.close();
  }
});

test("refine repairs validated blockers, verifies, re-enters review with fresh child state, preserves unrelated dirt", async () => {
  const f = fixture();
  fs.appendFileSync(path.join(f.repository, "unrelated.txt"), "user work\n");
  fs.appendFileSync(
    path.join(f.repository, "endpoint.ts"),
    "authorized dirty work\n",
  );
  replies(issues(), checked(), clean());
  const w = await definition("refine");
  mockVerify(w, true);
  const { engine, store } = harness(f.dir, implementer(f.repository));
  try {
    const r = await engine.run(w, { ...f.input, authority });
    assert.equal(r.state.status, "completed", JSON.stringify(r.state.error));
    const o = r.state.finalOutput as {
      rounds: number;
      implementation: { commits: string[] };
      review: ReviewReady;
    };
    assert.equal(o.rounds, 1);
    assert.equal(o.review.blocking.length, 0);
    assert.equal(o.implementation.commits.length, 1);
    assert.match(
      fs.readFileSync(path.join(f.repository, "unrelated.txt"), "utf8"),
      /user work/,
    );
    assert.equal(git(f.repository, "diff", "--cached", "--name-only"), "");
    assert.equal(
      git(f.repository, "show", "--format=", "--name-only", "HEAD"),
      "endpoint.ts",
    );
  } finally {
    store.close();
  }
});

test("refine never infers edit/commit authority, and refuses out-of-scope findings", async () => {
  for (const auth of [undefined, { ...authority, files: ["other.ts"] }]) {
    const f = fixture();
    replies(issues(), checked());
    const { engine, store } = harness(f.dir);
    try {
      const r = await engine.run(await definition("refine"), {
        ...f.input,
        authority: auth,
      });
      assert.match(
        (r.state.finalOutput as { reason: string }).reason,
        /blocked/,
      );
      assert.equal(git(f.repository, "rev-parse", "HEAD"), f.input.base);
    } finally {
      store.close();
    }
  }
});

test("dirty target and staged unrelated work block before implementer; unrelated unstaged work is preserved", async () => {
  const f = fixture();
  const revision = observe(f.setup);
  assert.equal(guard(f.setup, revision, parseAuthority(authority)), null);
  fs.appendFileSync(path.join(f.repository, "endpoint.ts"), "user work\n");
  assert.match(
    guard(
      f.setup,
      observe(f.setup),
      parseAuthority({ ...authority, includeUncommitted: false }),
    )!,
    /dirty/,
  );
  git(f.repository, "add", "endpoint.ts");
  assert.match(
    guard(f.setup, observe(f.setup), parseAuthority(authority))!,
    /index/,
  );
  const { engine, store } = harness(f.dir);
  try {
    const r = await engine.run(await definition("implement"), {
      ...f.input,
      authority,
      approved: true,
      plan: approvedPlan,
    });
    assert.match((r.state.finalOutput as { reason: string }).reason, /index/);
  } finally {
    store.close();
  }
});

test("implementer failure and bounded verify repair failures return blocked without review or publication", async () => {
  for (const mode of ["failed", "done"]) {
    const f = fixture();
    const w = await definition("implement");
    mockVerify(w, false);
    const { engine, store } = harness(f.dir, implementer(f.repository, mode));
    try {
      const r = await engine.run(w, {
        ...f.input,
        authority,
        approved: true,
        plan: approvedPlan,
      });
      assert.equal(r.state.status, "completed");
      assert.ok((r.state.finalOutput as { reason: string }).reason);
      assert.equal(
        r.state.steps.filter((s) => s.nodeId === "fix_verify").length,
        mode === "done" ? 2 : 0,
      );
    } finally {
      store.close();
    }
  }
});

test("each approved plan step has its own passing verify; repairs amend only owned commit", async () => {
  const f = fixture();
  const w = await definition("implement");
  let verifies = 0;
  mockVerify(w, () => ++verifies !== 1);
  const { engine, store } = harness(f.dir, implementer(f.repository));
  try {
    const r = await engine.run(w, {
      ...f.input,
      authority,
      approved: true,
      plan: {
        ...approvedPlan,
        steps: [...approvedPlan.steps, ...approvedPlan.steps],
      },
    });
    assert.equal(r.state.status, "completed", JSON.stringify(r.state.error));
    assert.equal(
      (r.state.finalOutput as { commits: string[] }).commits.length,
      2,
    );
    assert.equal(verifies, 3);
    assert.equal(
      git(f.repository, "rev-list", "--count", `${f.input.base}..HEAD`),
      "2",
    );
  } finally {
    store.close();
  }
});

test("round exhaustion and unchanged finding/revision stop refinement", async () => {
  const f = fixture(),
    current = { ...ready(f.setup), blocking: [finding] } as ReviewReady;
  assert.equal(loopDecision(1, 3, current, current), "blocked");
  assert.equal(loopDecision(3, 3, current), "blocked");
  replies(issues(), checked(), issues(), checked());
  const w = await definition("refine");
  mockVerify(w, true);
  const { engine, store } = harness(f.dir, implementer(f.repository));
  try {
    const r = await engine.run(w, { ...f.input, authority, maxRounds: 1 });
    assert.match(
      (r.state.finalOutput as { reason: string }).reason,
      /round limit/,
    );
    assert.equal(
      r.state.steps.filter((s) => s.nodeId.endsWith("/implement")).length,
      1,
    );
  } finally {
    store.close();
  }
});

test("publication waits on protected human gate; resume preserves exact request and cannot implicitly push", async () => {
  const f = fixture(),
    review = ready(f.setup),
    implementation = {
      setup: f.setup,
      revision: review.revision,
      verification: { passed: true, tail: "mock suite" },
      commits: [review.revision.head],
    };
  const w = await definition("publish");
  const { engine, store } = harness(f.dir);
  try {
    const r = await engine.run(w, { review, implementation });
    assert.equal(r.state.status, "waiting");
    assert.equal(r.state.currentNode, "approve");
    const request = await store.readCheckpoint(
      r.runId,
      r.state.currentAttemptId!,
    );
    assert.equal(request?.request.kind, "decision");
    assert.ok(
      w.nodes.approve.nodeType === "checkpoint" &&
        w.nodes.approve.humanDecision,
    );
    await assert.rejects(engine.resumeRun(w, r.runId), /status waiting/);
    assert.equal(
      (await store.readCheckpoint(r.runId, r.state.currentAttemptId!))?.request
        .requestId,
      request?.request.requestId,
    );
    assert.equal(
      r.state.steps.some((s) => s.nodeId === "push"),
      false,
    );
  } finally {
    store.close();
  }
});

test("publication rejects dirty/stale verification and changed state after approval before push", async () => {
  const f = fixture(),
    review = ready(f.setup),
    implementation = {
      setup: f.setup,
      revision: review.revision,
      verification: { passed: true, tail: "mock suite" },
      commits: [review.revision.head],
    };
  const w = await definition("publish"),
    { engine, store } = harness(f.dir);
  try {
    const stale = {
      ...implementation,
      revision: { ...implementation.revision, head: "stale" },
    };
    let r = await engine.run(w, { review, implementation: stale });
    assert.match((r.state.finalOutput as { reason: string }).reason, /stale/);
    fs.appendFileSync(path.join(f.repository, "endpoint.ts"), "user work\n");
    r = await engine.run(w, { review, implementation });
    assert.match((r.state.finalOutput as { reason: string }).reason, /clean/);
    const push = w.nodes.push;
    assert.ok(push.nodeType === "action" && "run" in push);
    await assert.rejects(
      () =>
        Promise.resolve(
          push.run({
            input: { review, implementation },
            outputs: { snapshot: { revision: review.revision } },
            signal: new AbortController().signal,
          } as unknown as WorkflowActionContext),
        ),
      /changed after approval/,
    );
  } finally {
    store.close();
  }
});

test("pause/resume holds the composed run at a boundary and does not duplicate accepted review", async () => {
  const f = fixture();
  replies(clean());
  const w = await definition("refine");
  let paused = false;
  const { engine, store } = harness(f.dir, undefined, (event) => {
    if (
      !paused &&
      event.type === "node_finished" &&
      event.nodeId === "review/snapshot"
    ) {
      paused = true;
      engine.pause();
      setImmediate(() => engine.resume());
    }
  });
  try {
    const r = await engine.run(w, f.input);
    assert.equal(r.state.status, "completed");
    assert.equal(fs.readFileSync(calls, "utf8").trim().split("\n").length, 1);
  } finally {
    store.close();
  }
});

test("composed develop maps planning, implementation, review and publication contracts with mocked approvals/effects", async () => {
  const f = fixture();
  replies(
    { status: "done", decided: [], questions: [] },
    approvedPlan,
    { verdict: "approved", findings: [] },
    clean(),
    { url: "https://example.invalid/pull/1" },
  );
  const w = await definition("develop");
  mockVerify(w, true);
  // Only test copies replace gates/effects; the standalone protected-gate test uses the real decision.
  assert.ok(
    w.nodes.approve_plan.nodeType === "checkpoint" &&
      w.nodes["publish/approve"].nodeType === "checkpoint",
  );
  w.nodes.approve_plan = {
    nodeType: "compute",
    run: () => ({ choice: "implement" }),
  };
  w.nodes["publish/approve"] = {
    nodeType: "compute",
    run: () => ({ choice: "push" }),
  };
  w.nodes["plan/setup"] = {
    nodeType: "action",
    effect: { type: "test.setup", recovery: "idempotent", request: {} },
    run: () => ({ ...f.setup, notes: f.input.task, linearId: null }),
  };
  let pushes = 0,
    opened = 0;
  w.nodes["publish/push"] = {
    nodeType: "action",
    effect: { type: "test.push", recovery: "manual", request: {} },
    run: () => {
      pushes++;
      return { head: git(f.repository, "rev-parse", "HEAD") };
    },
  };
  w.nodes["publish/open_review"] = {
    nodeType: "action",
    effect: { type: "test.open", recovery: "manual", request: {} },
    run: () => {
      opened++;
      return { ok: true };
    },
  };
  const execute = implementer(f.repository);
  const { engine, store } = harness(f.dir, async (request) =>
    request.contract.nodeId === "plan/start"
      ? { ...f.input, notes: f.input.task, linearId: null, piPane: "" }
      : execute(request),
  );
  try {
    const r = await engine.run(w, { task: "Add endpoint marker" });
    assert.equal(r.state.status, "completed", JSON.stringify(r.state.error));
    assert.equal(
      (r.state.finalOutput as { url: string }).url,
      "https://example.invalid/pull/1",
    );
    assert.equal(pushes, 1);
    assert.equal(opened, 1);
    assert.equal(
      r.state.steps.filter((s) => s.nodeId.endsWith("/verify")).length,
      1,
    );
  } finally {
    store.close();
  }
});

test("park/resume in a child reuses accepted snapshots without replaying review effects", async () => {
  const f = fixture();
  replies(clean());
  const w = await definition("refine");
  let parked = false;
  const { engine, store } = harness(f.dir, undefined, (event) => {
    if (
      !parked &&
      event.type === "node_finished" &&
      event.nodeId === "review/snapshot"
    ) {
      parked = true;
      engine.park();
    }
  });
  try {
    const first = await engine.run(w, f.input);
    assert.equal(parked, true);
    assert.equal(fs.readFileSync(calls, "utf8"), "");
    const resumed = await engine.resumeRun(w, first.runId);
    assert.equal(
      resumed.state.status,
      "completed",
      JSON.stringify(resumed.state.error),
    );
    assert.equal(
      resumed.state.steps.filter((s) => s.nodeId === "review/snapshot").length,
      1,
    );
    assert.equal(fs.readFileSync(calls, "utf8").trim().split("\n").length, 1);
  } finally {
    store.close();
  }
});

test("stale review revision and mutation during verification block safe continuation", async () => {
  const f = fixture(),
    expectedRevision = observe(f.setup);
  fs.appendFileSync(
    path.join(f.repository, "endpoint.ts"),
    "new dirty evidence\\n",
  );
  const { engine, store } = harness(f.dir, implementer(f.repository));
  try {
    let w = await definition("implement");
    mockVerify(w, true);
    let r = await engine.run(w, {
      ...f.input,
      authority,
      approved: true,
      plan: approvedPlan,
      expectedRevision,
    });
    assert.match((r.state.finalOutput as { reason: string }).reason, /stale/);
    w = await definition("implement");
    mockVerify(w, () => {
      fs.appendFileSync(
        path.join(f.repository, "unrelated.txt"),
        "concurrent user edit\\n",
      );
      return true;
    });
    r = await engine.run(w, {
      ...f.input,
      authority,
      approved: true,
      plan: approvedPlan,
    });
    assert.ok((r.state.finalOutput as { reason: string }).reason);
    assert.equal(
      r.state.steps.some((s) => s.nodeId === "ready"),
      false,
    );
  } finally {
    store.close();
  }
});

test("cancellation during child review stays terminal; Claude observes abort and no implementer starts", async () => {
  const f = fixture();
  replies({ hang: true });
  const w = await definition("refine");
  const { engine, store } = harness(f.dir, undefined, (event) => {
    if (event.type === "node_started" && event.nodeId === "review/final_review")
      setImmediate(() => engine.cancel());
  });
  try {
    const r = await engine.run(w, { ...f.input, authority });
    assert.equal(r.state.status, "cancelled");
    assert.equal(
      r.state.steps.some((s) => s.nodeId === "implement/implement"),
      false,
    );
  } finally {
    store.close();
  }
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    runClaude({
      role: "checker",
      cwd: f.repository,
      runDir: f.input.runDir,
      prompt: "mock",
      signal: aborted.signal,
    }),
  );
});

test("expected review and verification timeouts return blocked exits", async () => {
  for (const name of ["review", "implement"]) {
    const f = fixture(),
      w = await definition(name),
      id = name === "review" ? "final_review" : "verify";
    const node = w.nodes[id];
    assert.ok(node.nodeType === "action");
    w.nodes[id] = {
      nodeType: "action",
      effect: node.effect,
      timeoutMs: 10,
      run: ({ signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new Error("mock timeout")),
            { once: true },
          ),
        ),
    };
    const { engine, store } = harness(f.dir, implementer(f.repository));
    try {
      const r = await engine.run(
        w,
        name === "review"
          ? f.input
          : { ...f.input, authority, approved: true, plan: approvedPlan },
      );
      assert.equal(r.state.status, "completed");
      assert.ok((r.state.finalOutput as { reason: string }).reason);
      assert.ok(
        r.state.steps.some((s) => s.nodeId === id && s.outcome === "timed_out"),
      );
    } finally {
      store.close();
    }
  }
});

test("review artifacts cannot be directed into the repository, including via symlinks", () => {
  const f = fixture();
  assert.throws(
    () => prepare({ ...f.input, runDir: f.repository }, "test"),
    /outside/,
  );
  const link = path.join(f.dir, "artifact-link");
  fs.symlinkSync(f.repository, link);
  assert.throws(
    () =>
      prepare({ ...f.input, runDir: path.join(link, "new-artifacts") }, "test"),
    /outside/,
  );
  assert.equal(fs.existsSync(path.join(f.repository, "new-artifacts")), false);
  assert.throws(
    () => parseAuthority({ ...authority, files: [":(exclude)endpoint.ts"] }),
    /relative/,
  );
  assert.throws(
    () => parseAuthority({ ...authority, files: [".Git/config"] }),
    /relative/,
  );
});

test("address-feedback rejects changed state after its human approval", async () => {
  const f = fixture(),
    w = await loadWorkflowFile(
      path.join(
        os.homedir(),
        ".pi/agent/workflows/address-feedback.workflow.ts",
      ),
    ),
    node = w.nodes.push_route;
  assert.ok(node.nodeType === "action" && "run" in node);
  const approved = observe({
    ...f.setup,
    scope: { paths: [], includeUncommitted: true },
  });
  fs.appendFileSync(
    path.join(f.repository, "endpoint.ts"),
    "changed after approval\\n",
  );
  assert.throws(
    () =>
      node.run({
        outputs: { setup: f.setup, approve_snapshot: approved },
      } as unknown as WorkflowActionContext),
    /changed after human approval/,
  );
});

test("Claude cancellation stops an already-running mock process", async () => {
  const f = fixture();
  replies({ hang: true });
  const started = `${queue}.started`;
  fs.rmSync(started, { force: true });
  const controller = new AbortController();
  fs.watchFile(started, { interval: 10 }, (stat) => {
    if (stat.size > 0) controller.abort();
  });
  try {
    await assert.rejects(
      runClaude({
        role: "checker",
        cwd: f.repository,
        runDir: f.input.runDir,
        prompt: "mock",
        signal: controller.signal,
        timeoutMs: 10_000,
      }),
      /stopped/,
    );
    const pid = Number(fs.readFileSync(started, "utf8"));
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
  } finally {
    fs.unwatchFile(started);
  }
});
