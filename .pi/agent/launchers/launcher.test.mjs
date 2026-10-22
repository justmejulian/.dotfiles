import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { prepareAgent, readAgents, launchArguments, launchEnvironment } from './pi-agent.mjs';
import { loadExtensions } from '../npm/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js';

const source = path.join(os.homedir(), '.pi/agent');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-agent-tests-'));
const fixture = path.join(root, 'source');
fs.mkdirSync(fixture);
fs.symlinkSync(path.join(source, 'npm'), path.join(fixture, 'npm'));
for (const directory of ['agents', 'launchers']) fs.cpSync(path.join(source, directory), path.join(fixture, directory), { recursive: true });
fs.mkdirSync(path.join(fixture, 'extensions'));
fs.copyFileSync(path.join(source, 'extensions/agent-commands.ts'), path.join(fixture, 'extensions/agent-commands.ts'));
fs.mkdirSync(path.join(fixture, 'git/github.com/edxeth/pi-subagents/src'), { recursive: true });
fs.writeFileSync(path.join(fixture, 'git/github.com/edxeth/pi-subagents/src/index.ts'), 'export default () => {};');
fs.writeFileSync(path.join(fixture, 'settings.json'), JSON.stringify({ defaultProvider: 'openai-codex', defaultModel: 'gpt-6.1-sol', secretForTest: 'do-not-copy' }));
fs.writeFileSync(path.join(fixture, 'auth.json'), 'test-only-placeholder');
after(() => fs.rmSync(root, { recursive: true, force: true }));

function environment(values) {
  const saved = { ...process.env };
  Object.assign(process.env, values);
  return () => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  };
}

async function profileExtension(prepared) {
  const restore = environment({ PI_AGENT_PROFILE: path.join(prepared.profile, 'role.json') });
  try {
    const loaded = await loadExtensions([path.join(source, 'launchers/profile.ts')], root);
    assert.deepEqual(loaded.errors, []);
    return loaded;
  } finally { restore(); }
}

function fakeContext(cwd = root) {
  return { cwd, hasUI: true, ui: { setStatus() {}, notify() {} }, sessionManager: { getBranch: () => [] } };
}

test('profile derives nested visibility without altering canonical agents or copying credentials', async () => {
  const before = fs.readFileSync(path.join(fixture, 'agents/scout.md'), 'utf8');
  const prepared = await prepareAgent('implementer', { source: fixture });
  assert.deepEqual(prepared.manifest.direct, ['scout', 'fixer']);
  assert.equal(Object.keys(prepared.manifest.hashes).length, 2);
  assert.match(fs.readFileSync(path.join(prepared.profile, 'agents/scout.md'), 'utf8'), /visible-to: root/);
  assert.equal(fs.readFileSync(path.join(fixture, 'agents/scout.md'), 'utf8'), before);
  assert.equal(fs.readlinkSync(path.join(prepared.profile, 'auth.json')), path.join(fixture, 'auth.json'));
  assert.ok(!fs.readFileSync(path.join(prepared.profile, 'settings.json'), 'utf8').includes('do-not-copy'));
  assert.ok(!launchArguments(prepared).includes('--print'));
  const env = launchEnvironment(prepared, { PI_SUBAGENT_AGENT: 'old-child', PI_SUBAGENT_PARENT_SESSION: 'old-parent', PI_SUBAGENT_AUTO_EXIT: '1', PI_SUBAGENT_SPAWN_DEPTH: '2', PI_SUBAGENT_SPAWN_WIDTH: '3' });
  assert.equal(env.PI_SUBAGENT_AGENT, undefined);
  assert.equal(env.PI_SUBAGENT_PARENT_SESSION, undefined);
  assert.equal(env.PI_SUBAGENT_AUTO_EXIT, undefined);
  assert.equal(env.PI_SUBAGENT_SPAWN_DEPTH, '2');
  assert.equal(env.PI_SUBAGENT_SPAWN_WIDTH, '3');
  assert.equal(env.PI_SUBAGENT_SPAWN_BUDGET, '1');
});

test('unknown agents and unrecognized profiles fail without overwriting user data', async () => {
  await assert.rejects(prepareAgent('../outside', { source: fixture }), /unavailable/);
  const directory = path.join(fixture, 'profiles/agent-cli/scout');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'keep'), 'user data');
  await assert.rejects(prepareAgent('scout', { source: fixture }), /unrecognized profile/);
  assert.equal(fs.readFileSync(path.join(directory, 'keep'), 'utf8'), 'user data');
  fs.rmSync(directory, { recursive: true });
});

test('every personal agent can be prepared as a standalone profile', async () => {
  const agents = await readAgents(fixture);
  assert.equal(agents.length, 11);
  assert.ok(!agents.some(agent => agent.name.startsWith('exp-dev-')));
  for (const agent of agents) {
    const prepared = await prepareAgent(agent.name, { source: fixture });
    assert.equal(prepared.manifest.name, agent.name);
    assert.equal(launchEnvironment(prepared).PI_SUBAGENT_AGENT, undefined);
    assert.ok(prepared.extensions.every(file => fs.existsSync(file)), agent.name);
  }
});

test('direct specialist CLI launches one Pi process with no initial message or fabricated child identity', () => {
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  const trace = path.join(root, 'launch.json');
  fs.writeFileSync(path.join(bin, 'pi'), '#!/usr/bin/env node\nrequire("fs").writeFileSync(process.env.LAUNCH_TRACE, JSON.stringify({args:process.argv.slice(2),profile:process.env.PI_CODING_AGENT_DIR,identity:process.env.PI_SUBAGENT_AGENT}));\n', { mode: 0o755 });
  const result = spawnSync(path.join(os.homedir(), '.local/bin/pi-agent'), ['code-investigator'], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PI_AGENT_SOURCE_DIR: fixture, LAUNCH_TRACE: trace }, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  const launched = JSON.parse(fs.readFileSync(trace, 'utf8'));
  assert.equal(launched.identity, undefined);
  assert.equal(launched.profile, path.join(fixture, 'profiles/agent-cli/code-investigator'));
  assert.equal(launched.args[launched.args.indexOf('--name') + 1], 'code-investigator');
  assert.equal(launched.args[launched.args.indexOf('--model') + 1], 'openai-codex/gpt-6.1-sol');
  assert.ok(!launched.args.includes('--print'));
});

test('native loader registers every personal agent slash command without launching Herdr or a model', async () => {
  const loaded = await loadExtensions([path.join(source, 'extensions/agent-commands.ts')], root);
  assert.deepEqual(loaded.errors, []);
  const commands = loaded.extensions[0].commands;
  assert.ok(commands.has('agent'));
  for (const agent of await readAgents(source)) assert.ok(commands.has(agent.name), agent.name);
});

test('standalone specialist profile binds its role/tools and blocks writes or undelegated children', async () => {
  fs.writeFileSync(path.join(fixture, 'agents/read-only-test.md'), '---\nname: read-only-test\ntools: read,bash,grep,find,ls\nspawning: false\nextensions: none\n---\nRead-only fixture role.\n');
  const prepared = await prepareAgent('read-only-test', { source: fixture });
  const loaded = await profileExtension(prepared);
  const allowed = ['read', 'bash', 'grep', 'find', 'ls'];
  let active = ['read', 'bash', 'edit', 'write'];
  loaded.runtime.getAllTools = () => [...allowed, ...active].map(name => ({ name }));
  loaded.runtime.getActiveTools = () => active;
  loaded.runtime.setActiveTools = tools => { active = tools; };
  const extension = loaded.extensions[0];
  const ctx = fakeContext();
  await extension.handlers.get('session_start')[0]({ reason: 'startup' }, ctx);
  assert.deepEqual(active, allowed);
  const event = { messageType: 'user', systemPromptOptions: {} };
  await extension.handlers.get('before_agent_start')[0](event, ctx);
  assert.match(event.systemPromptOptions.customPrompt, /Read-only fixture role/);
  assert.ok(!event.systemPromptOptions.customPrompt.startsWith('---'));
  const check = extension.handlers.get('tool_call')[0];
  assert.equal((await check({ toolName: 'write', input: {} }, ctx)).block, true);
  assert.equal((await check({ toolName: 'subagent', input: { agent: 'fixer' } }, ctx)).block, true);
  assert.throws(() => extension.handlers.get('before_agent_start')[0]({ messageType: 'custom', systemPromptOptions: {} }, ctx), /idle/);
});

test('standalone implementer rejects project overrides shadowing its helpers', async () => {
  const prepared = await prepareAgent('implementer', { source: fixture });
  const loaded = await profileExtension(prepared);
  loaded.runtime.getAllTools = () => ['read','bash','edit','write','subagent','subagent_resume','subagent_kill'].map(name => ({ name }));
  loaded.runtime.getActiveTools = () => ['read','bash','edit','write'];
  loaded.runtime.setActiveTools = () => {};
  const extension = loaded.extensions[0];
  const ctx = fakeContext();
  await extension.handlers.get('session_start')[0]({ reason: 'startup' }, ctx);
  const check = extension.handlers.get('tool_call')[0];
  assert.equal(await check({ toolName: 'subagent', input: { agent: 'scout' } }, ctx), undefined);
  const cwd = path.join(root, 'project');
  fs.mkdirSync(path.join(cwd, '.pi/agents'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.pi/agents/override.md'), '---\nname: scout\n---\noverride');
  assert.equal((await check({ toolName: 'subagent', input: { agent: 'scout', cwd } }, ctx)).block, true);
});

test('slash command opens one standalone tab and safely quotes arbitrary task text', async () => {
  const bin = path.join(root, 'herdr-bin');
  const trace = path.join(root, 'herdr.jsonl');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'herdr'), `#!/usr/bin/env node
const fs=require('fs'); const a=process.argv.slice(2); fs.appendFileSync(process.env.HERDR_TEST_TRACE,JSON.stringify(a)+'\\n');
if(a[0]==='pane'&&a[1]==='current') console.log(JSON.stringify({result:{pane:{pane_id:'w1:p1',workspace_id:'w1',tab_id:'w1:t1'}}}));
if(a[0]==='tab'&&a[1]==='create') console.log(JSON.stringify({result:{tab:{tab_id:'w1:t2'},root_pane:{pane_id:'w1:p2'}}}));
`, { mode: 0o755 });
  const restore = environment({ PATH: `${bin}:${process.env.PATH}`, HERDR_ENV: '1', HERDR_PANE_ID: 'w1:p1', HERDR_TEST_TRACE: trace });
  try {
    const loaded = await loadExtensions([path.join(source, 'extensions/agent-commands.ts')], root);
    assert.deepEqual(loaded.errors, []);
    const ctx = { ...fakeContext(), waitForIdle: async () => {} };
    await loaded.extensions[0].commands.get('implementer').handler("Inspect 'quoted' text; $(touch /not-executed)", ctx);
    const operations = fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(operations.filter(a => a[0] === 'tab' && a[1] === 'create').length, 1);
    const run = operations.find(a => a[0] === 'pane' && a[1] === 'run');
    assert.ok(run);
    assert.match(run[3], /pi-agent/);
    assert.match(run[3], /implementer/);
    assert.match(run[3], /'\\''quoted'\\''/);
    assert.equal(fs.existsSync('/not-executed'), false);
  } finally { restore(); }
});
