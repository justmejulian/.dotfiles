import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getEffectiveAgentDefinitions } from '../git/github.com/edxeth/pi-subagents/src/agents/definitions.ts';
import { getAgentListEntries } from '../git/github.com/edxeth/pi-subagents/src/agents/agent-list.ts';
import { resolveSubagentExtensions } from '../git/github.com/edxeth/pi-subagents/src/launch/policy.ts';
import { loadExtensions } from '../npm/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js';

const agentDir = fileURLToPath(new URL('../', import.meta.url));

test('installed parser discovers connector specialists with root-only read-only toolsets and real extensions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-definitions-'));
  const config = path.join(root, 'config');
  const previous = process.env.PI_CODING_AGENT_DIR;
  fs.mkdirSync(path.join(config, 'agents'), { recursive: true });
  fs.symlinkSync(path.join(agentDir, 'extensions'), path.join(config, 'extensions'));
  fs.symlinkSync(path.join(agentDir, 'lib'), path.join(config, 'lib'));
  fs.symlinkSync(path.join(agentDir, 'npm'), path.join(config, 'npm'));
  for (const name of ['slack', 'linear']) fs.copyFileSync(path.join(agentDir, `agents/${name}.md`), path.join(config, `agents/${name}.md`));
  process.env.PI_CODING_AGENT_DIR = config;
  try {
    const definitions = getEffectiveAgentDefinitions(root);
    assert.deepEqual(definitions.map(definition => definition.name), ['linear', 'slack']);
    for (const definition of definitions) {
      assert.equal(definition.mode, 'background');
      assert.equal(definition.async, false);
      assert.equal(definition.autoExit, true);
      assert.equal(definition.sessionMode, 'lineage-only');
      assert.equal(definition.spawning, false);
      assert.deepEqual(definition.visibleTo, ['root']);
      assert.equal(definition.skills, 'none');
      assert.match(definition.description, /[Ss]earch/);
      const extensionPath = path.join(config, `extensions/${definition.name}.ts`);
      assert.deepEqual(resolveSubagentExtensions(definition), [extensionPath]);
      const loaded = await loadExtensions([extensionPath], root);
      assert.deepEqual(loaded.errors, []);
      assert.deepEqual(definition.tools.split(',').sort(), [...loaded.extensions[0].tools.keys()].sort());
      assert.ok(!definition.tools.includes('subagent'));
    }
    const rootRoster = getAgentListEntries(root, definition => definition.sessionMode);
    assert.deepEqual(rootRoster.map(entry => entry.name), ['linear', 'slack']);
    const childRoster = getAgentListEntries(root, definition => definition.sessionMode, { callerAgent: 'implementer', callerSpawnable: true });
    assert.deepEqual(childRoster, []);
    const linear = definitions.find(definition => definition.name === 'linear');
    assert.equal(linear.tools, 'linear_fetch');
    assert.match(linear.body, /search is unavailable/);
    assert.ok(!linear.body.includes('linear_search'));
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
