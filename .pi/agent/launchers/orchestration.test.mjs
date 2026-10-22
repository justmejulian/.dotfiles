import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { loadExtensions } from '../npm/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js';

const file = path.join(os.homedir(), '.pi/agent/extensions/orchestration.ts');
async function setup(flag = false, entries = []) {
  const loaded = await loadExtensions([file], process.cwd());
  assert.deepEqual(loaded.errors, []);
  loaded.runtime.flagValues.set('orchestrator', flag);
  loaded.runtime.appendEntry = (customType, data) => entries.push({ type: 'custom', customType, data });
  loaded.runtime.setActiveTools = () => assert.fail('Instruction-only mode must not change tools');
  loaded.runtime.setModel = () => assert.fail('Instruction-only mode must not change models');
  loaded.runtime.sendMessage = () => assert.fail('No model-triggering message should be sent');
  const ctx = { hasUI: true, ui: { setStatus() {}, notify() {} }, sessionManager: { getBranch: () => entries } };
  return { extension: loaded.extensions[0], ctx, entries };
}
function prompt() {
  return { systemPromptOptions: { customPrompt: 'existing base', sections: { existing: 'preserve' }, selectedTools: ['read', 'bash'] } };
}

test('plain Pi receives no orchestration section or mode-state entry', async () => {
  const { extension, ctx, entries } = await setup();
  extension.handlers.get('session_start')[0]({ reason: 'startup' }, ctx);
  const event = prompt();
  extension.handlers.get('before_agent_start')[0](event, ctx);
  assert.deepEqual(event, prompt());
  assert.deepEqual(entries, []);
});

test('CLI opt-in adds one lazily loaded section without replacing base prompt/tools', async () => {
  const { extension, ctx, entries } = await setup(true);
  extension.handlers.get('session_start')[0]({ reason: 'startup' }, ctx);
  const event = prompt();
  extension.handlers.get('before_agent_start')[0](event, ctx);
  assert.match(event.systemPromptOptions.sections.orchestration, /default flow is context/);
  assert.equal(event.systemPromptOptions.customPrompt, 'existing base');
  assert.equal(event.systemPromptOptions.sections.existing, 'preserve');
  assert.deepEqual(event.systemPromptOptions.selectedTools, ['read', 'bash']);
  assert.deepEqual(entries, [{ type: 'custom', customType: 'orchestration-mode', data: { enabled: true } }]);
});

test('slash command enables/disables guidance locally and preserves off across reload', async () => {
  const { extension, ctx, entries } = await setup(true);
  extension.handlers.get('session_start')[0]({ reason: 'startup' }, ctx);
  const command = extension.commands.get('orchestration');
  await command.handler('off', ctx);
  let event = prompt();
  extension.handlers.get('before_agent_start')[0](event, ctx);
  assert.deepEqual(event, prompt());
  extension.handlers.get('session_start')[0]({ reason: 'reload' }, ctx);
  event = prompt();
  extension.handlers.get('before_agent_start')[0](event, ctx);
  assert.deepEqual(event, prompt());
  await command.handler('', ctx);
  extension.handlers.get('before_agent_start')[0](event, ctx);
  assert.ok(event.systemPromptOptions.sections.orchestration);
  const count = entries.length;
  await command.handler('status', ctx);
  await command.handler('invalid', ctx);
  assert.equal(entries.length, count);
});

test('mode restores from session metadata but never turns managed workers into orchestrators', async () => {
  const entries = [{ type: 'custom', customType: 'orchestration-mode', data: { enabled: true } }];
  const { extension, ctx } = await setup(false, entries);
  extension.handlers.get('session_start')[0]({ reason: 'startup' }, ctx);
  const event = prompt();
  extension.handlers.get('before_agent_start')[0](event, ctx);
  assert.ok(event.systemPromptOptions.sections.orchestration);
  const previous = process.env.PI_SUBAGENT_AGENT;
  process.env.PI_SUBAGENT_AGENT = 'implementer';
  try {
    extension.handlers.get('session_start')[0]({ reason: 'startup' }, ctx);
    await extension.commands.get('orchestration').handler('on', ctx);
    const child = prompt();
    extension.handlers.get('before_agent_start')[0](child, ctx);
    assert.deepEqual(child, prompt());
  } finally {
    if (previous === undefined) delete process.env.PI_SUBAGENT_AGENT;
    else process.env.PI_SUBAGENT_AGENT = previous;
  }
});
