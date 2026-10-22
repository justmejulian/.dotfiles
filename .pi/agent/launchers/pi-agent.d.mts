export interface NamedAgent {
  name: string;
  file: string;
  raw: string;
  body: string;
  metadata: Record<string, unknown>;
}
export function sourceDirectory(): string;
export function readAgents(source?: string): Promise<NamedAgent[]>;
export function prepareAgent(name: string, options?: { source?: string }): Promise<{
  agent: NamedAgent;
  profile: string;
  manifest: Record<string, unknown>;
  extensions: string[];
}>;
export function launchArguments(prepared: Awaited<ReturnType<typeof prepareAgent>>, forwarded?: string[]): string[];
export function launchEnvironment(prepared: Awaited<ReturnType<typeof prepareAgent>>, original?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
