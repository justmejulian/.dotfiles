#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const sourceDirectory = () => process.env.PI_AGENT_SOURCE_DIR || path.join(os.homedir(), '.pi/agent');
const fingerprint = value => createHash('sha256').update(value).digest('hex');
const csv = value => typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

async function frontmatterParser() {
  const modulePath = path.join(os.homedir(), '.pi/agent/npm/node_modules/@earendil-works/pi-coding-agent/dist/utils/frontmatter.js');
  return (await import(pathToFileURL(modulePath).href)).parseFrontmatter;
}

export async function readAgents(source = sourceDirectory()) {
  const parse = await frontmatterParser();
  const directory = path.join(source, 'agents');
  return fs.readdirSync(directory).filter(name => name.endsWith('.md')).sort().map(filename => {
    const file = path.join(directory, filename);
    const raw = fs.readFileSync(file, 'utf8');
    const { frontmatter, body } = parse(raw);
    const name = frontmatter.name || filename.slice(0, -3);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) throw new Error(`Invalid agent name in ${file}`);
    return { name, file, raw, body, metadata: frontmatter };
  });
}

function allowedChildren(agent, catalog) {
  const value = agent.metadata.spawning;
  if (!value || value === 'false') return [];
  if (value === true || value === 'true') return catalog.filter(a => a !== agent && a.metadata.enabled !== false).map(a => a.name);
  return csv(value);
}

function findAgent(catalog, name) {
  const agent = catalog.find(agent => agent.name === name);
  if (!agent || agent.metadata.enabled === false) throw new Error(`Agent unavailable or disabled: ${name}`);
  return agent;
}

function writeGenerated(file, contents) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== contents) fs.writeFileSync(file, contents, { mode: 0o600 });
}

function referenceResource(source, profile, name) {
  const target = path.join(source, name);
  if (!fs.existsSync(target)) return;
  const link = path.join(profile, name);
  const existing = fs.lstatSync(link, { throwIfNoEntry: false });
  if (existing) {
    if (!existing.isSymbolicLink() || fs.readlinkSync(link) !== target) throw new Error(`Refusing to replace profile resource: ${link}`);
    return;
  }
  fs.symlinkSync(target, link);
}

function extensionPaths(agent, source) {
  const specified = agent.metadata.extensions;
  if (!specified || specified === 'all' || specified === 'none') return [];
  return csv(specified).flatMap(entry => {
    if (!entry.startsWith('npm:')) return [entry.startsWith('~/') ? path.join(os.homedir(), entry.slice(2)) : path.resolve(source, entry)];
    const spec = entry.slice(4);
    const suffix = spec.lastIndexOf('@');
    const packageName = suffix > 0 ? spec.slice(0, suffix) : spec;
    const root = path.join(source, 'npm/node_modules', packageName);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (!Array.isArray(manifest.pi?.extensions)) throw new Error(`No explicit extension entry for ${packageName}`);
    return manifest.pi.extensions.map(entry => path.resolve(root, entry));
  });
}

export async function prepareAgent(name, options = {}) {
  const source = options.source || sourceDirectory();
  const catalog = await readAgents(source);
  const agent = findAgent(catalog, name);
  const direct = allowedChildren(agent, catalog);
  const descendants = new Map();
  function visit(childName) {
    if (descendants.has(childName)) return;
    const child = findAgent(catalog, childName);
    descendants.set(childName, child);
    // Catalog references can cycle; actual launches remain bounded by spawn grants.
    for (const nested of allowedChildren(child, catalog)) visit(nested);
  }
  for (const child of direct) visit(child);

  const profile = path.join(source, 'profiles/agent-cli', name);
  const marker = path.join(profile, '.generated');
  if (fs.existsSync(profile) && (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== 'pi-agent-profile.v1\n')) throw new Error(`Refusing to overwrite unrecognized profile: ${profile}`);
  fs.mkdirSync(path.join(profile, 'agents'), { recursive: true, mode: 0o700 });
  writeGenerated(marker, 'pi-agent-profile.v1\n');
  const hashes = {};
  for (const [childName, child] of descendants) {
    let contents = child.raw;
    if (direct.includes(childName)) {
      if (!/^visible-to:.*$/m.test(contents)) throw new Error(`Explicit visibility required: ${childName}`);
      contents = contents.replace(/^visible-to:.*$/m, 'visible-to: root');
    }
    writeGenerated(path.join(profile, 'agents', `${childName}.md`), contents);
    hashes[childName] = fingerprint(contents);
  }
  for (const filename of fs.readdirSync(path.join(profile, 'agents'))) {
    if (filename.endsWith('.md') && !descendants.has(filename.slice(0, -3))) fs.unlinkSync(path.join(profile, 'agents', filename));
  }

  const originalSettingsPath = path.join(source, 'settings.json');
  const original = fs.existsSync(originalSettingsPath) ? JSON.parse(fs.readFileSync(originalSettingsPath, 'utf8')) : {};
  const settings = { packages: [], quietStartup: true };
  for (const key of ['defaultProvider', 'defaultModel', 'defaultThinkingLevel', 'theme', 'tuiMode']) if (original[key] !== undefined) settings[key] = original[key];
  writeGenerated(path.join(profile, 'settings.json'), JSON.stringify(settings, null, 2) + '\n');
  for (const resource of ['auth.json', 'models.json', 'models-store.json', 'skills']) referenceResource(source, profile, resource);

  const profileExtension = path.join(source, 'launchers/profile.ts');
  const commandsExtension = path.join(source, 'extensions/agent-commands.ts');
  const extensions = [...extensionPaths(agent, source)];
  if (direct.length) extensions.push(path.join(source, 'git/github.com/edxeth/pi-subagents/src/index.ts'));
  extensions.push(commandsExtension, profileExtension);
  for (const file of extensions) if (!fs.existsSync(file)) throw new Error(`Missing installed extension: ${file}`);
  const tools = agent.metadata.tools === 'none' ? [] : agent.metadata.tools && agent.metadata.tools !== 'all' ? csv(agent.metadata.tools) : null;
  const manifest = { schema: 'pi-agent-profile.v1', name, body: agent.body, direct, hashes, profile, source, tools, deny: csv(agent.metadata['deny-tools']), model: agent.metadata.model || null, thinking: agent.metadata.thinking || null };
  writeGenerated(path.join(profile, 'role.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { agent, profile, manifest, extensions: [...new Set(extensions)] };
}

export function launchArguments(prepared, forwarded = []) {
  const args = ['--no-extensions', '--no-mcp', '--no-context-files', '--name', prepared.agent.name];
  for (const extension of prepared.extensions) args.push('--extension', extension);
  if (prepared.manifest.model) args.push('--model', prepared.manifest.model);
  if (prepared.manifest.thinking) args.push('--thinking', prepared.manifest.thinking);
  return [...args, ...forwarded];
}

export function launchEnvironment(prepared, original = process.env) {
  const env = { ...original };
  // A manual named-agent session is a root, never a fabricated protocol child.
  for (const name of Object.keys(env)) if (name.startsWith('PI_SUBAGENT_') && !['PI_SUBAGENT_SPAWN_DEPTH', 'PI_SUBAGENT_SPAWN_WIDTH', 'PI_SUBAGENT_MUX', 'PI_SUBAGENT_PI_COMMAND'].includes(name)) delete env[name];
  const assignedEnv = prepared.agent.metadata.env;
  if (typeof assignedEnv === 'string') for (const line of assignedEnv.split('\n')) {
    const separator = line.indexOf('=');
    if (separator > 0) env[line.slice(0, separator).trim()] = line.slice(separator + 1);
  }
  delete env.PI_ORCHESTRATOR_MODE;
  delete env.PI_CODING_AGENT_SESSION_DIR;
  env.PI_AGENT_SOURCE_DIR = prepared.manifest.source;
  env.PI_AGENT_PROFILE = path.join(prepared.profile, 'role.json');
  env.PI_CODING_AGENT_DIR = prepared.profile;
  env.PI_ARTIFACT_PROJECT_ROOT = path.join(prepared.profile, 'artifacts');
  env.PI_SUBAGENT_SPAWNABLE = prepared.manifest.direct.join(',');
  env.PI_SUBAGENT_SPAWN_BUDGET = String(Number(prepared.agent.metadata['spawn-depth'] || 1));
  return env;
}

async function main() {
  const [name, ...forwarded] = process.argv.slice(2);
  if (!name || name === '--help' || name === '-h') {
    console.log('Usage: pi-agent NAME [Pi options] [initial message]\nStarts a named agent in this terminal. No message means no startup model call.\nExample: pi-agent reviewer\nExample: pi-agent code-investigator "Inspect this repository read-only"');
    return;
  }
  const prepared = await prepareAgent(name);
  const result = spawnSync('pi', launchArguments(prepared, forwarded), { env: launchEnvironment(prepared), stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) process.kill(process.pid, result.signal);
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(`pi-agent: ${error.message}`); process.exitCode = 1; });
}
