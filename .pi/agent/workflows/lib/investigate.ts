import { isAbsolute } from "node:path";

export const MAX_INVESTIGATION_RECORD_CHARS = 8_000;
const MAX_FOLLOW_UPS = 3;

type RecordValue = Record<string, unknown>;
export type InvestigationInput = {
  task: string;
  repository?: string;
  constraints: string;
  maxFollowUps: number;
};
export type Frame = { question: string; scope: string; plan: string };
export type ResearchTrack = {
  status: "completed" | "unavailable" | "inapplicable";
  summary: string;
  evidence: string[];
};
export type Research = { code: ResearchTrack; web: ResearchTrack; internal: ResearchTrack };
export type Assessment = {
  route: "answered" | "follow_up" | "blocked";
  finding: string;
  evidence: string[];
  uncertainty: string[];
  nextStep: string;
  followUp?: string;
};
export type FollowUpRecord = { request: string; research: Research };
export type InvestigationResult = {
  status: "answered" | "needs_evidence" | "blocked";
  assessment: Assessment;
  research?: Research;
  followUps: FollowUpRecord[];
};

function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object");
  if (JSON.stringify(value).length > MAX_INVESTIGATION_RECORD_CHARS)
    throw new Error(`Record must fit within ${MAX_INVESTIGATION_RECORD_CHARS} characters`);
  return value as RecordValue;
}
function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} must be nonempty text`);
  return value;
}
function texts(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.map((item) => text(item, field));
}
export function parseInvestigationInput(value: unknown): InvestigationInput {
  const input = record(value);
  for (const key of Object.keys(input))
    if (!["task", "repository", "constraints", "maxFollowUps"].includes(key))
      throw new Error(`Unknown investigation input field: ${key}`);
  if (input.constraints !== undefined && typeof input.constraints !== "string")
    throw new Error("constraints must be text");
  const maxFollowUps = input.maxFollowUps ?? 2;
  if (!Number.isInteger(maxFollowUps) || Number(maxFollowUps) < 0 || Number(maxFollowUps) > MAX_FOLLOW_UPS)
    throw new Error(`maxFollowUps must be 0..${MAX_FOLLOW_UPS}`);
  const repository = input.repository === undefined ? undefined : text(input.repository, "repository");
  if (repository && !isAbsolute(repository)) throw new Error("repository must be absolute");
  return {
    task: text(input.task, "task"),
    ...(repository ? { repository } : {}),
    constraints: (input.constraints as string | undefined) ?? "",
    maxFollowUps: Number(maxFollowUps),
  };
}
export function parseFrame(value: unknown): Frame {
  const frame = record(value);
  return { question: text(frame.question, "question"), scope: text(frame.scope, "scope"), plan: text(frame.plan, "plan") };
}
function parseTrack(value: unknown): ResearchTrack {
  const track = record(value);
  if (track.status !== "completed" && track.status !== "unavailable" && track.status !== "inapplicable")
    throw new Error("Invalid research track status");
  const evidence = texts(track.evidence, "evidence");
  if (track.status === "completed" && evidence.length === 0)
    throw new Error("Completed research needs evidence references");
  return { status: track.status, summary: text(track.summary, "summary"), evidence };
}
export function parseResearch(value: unknown): Research {
  const research = record(value);
  return { code: parseTrack(research.code), web: parseTrack(research.web), internal: parseTrack(research.internal) };
}
export function parseAssessment(value: unknown): Assessment {
  const assessment = record(value);
  if (assessment.route !== "answered" && assessment.route !== "follow_up" && assessment.route !== "blocked")
    throw new Error("Invalid assessment route");
  const evidence = texts(assessment.evidence, "evidence");
  if (assessment.route === "answered" && evidence.length === 0)
    throw new Error("Answered investigations need evidence references");
  return {
    route: assessment.route,
    finding: text(assessment.finding, "finding"),
    evidence,
    uncertainty: texts(assessment.uncertainty, "uncertainty"),
    nextStep: text(assessment.nextStep, "nextStep"),
    ...(assessment.route === "follow_up" ? { followUp: text(assessment.followUp, "followUp") } : {}),
  };
}
export function investigationResult(options: {
  assessment: Assessment;
  research?: Research;
  followUps: FollowUpRecord[];
}): InvestigationResult {
  return {
    ...options,
    status: options.assessment.route === "follow_up" ? "needs_evidence" : options.assessment.route,
  };
}
