import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, mock, test } from 'node:test';
import { loadExtensions } from '../npm/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js';

const extensionFile = path.join(os.homedir(), '.pi/agent/extensions/slack.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-slack-tests-'));
const oldPath = process.env.PATH;
let execute;

before(async () => {
  const loaded = await loadExtensions([extensionFile], root);
  assert.deepEqual(loaded.errors, []);
  execute = loaded.extensions[0].tools.get('slack_fetch').definition.execute;
  fs.writeFileSync(path.join(root, 'claude'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(process.env.SLACK_TEST_STARTED, String(process.pid));
if (process.env.SLACK_TEST_MODE === 'hang') setInterval(() => {}, 1000);
else console.log(JSON.stringify({type:'result',session_id:'fixture',total_cost_usd:0,structured_output:{kind:'message',channel:'fixture',permalink:'fixture',messages:[],summary:'Fetched fixture',answer:''}}));
`, { mode: 0o755 });
  process.env.PATH = `${root}:${oldPath}`;
  mock.method(os, 'homedir', () => root);
});
after(() => {
  process.env.PATH = oldPath;
  mock.restoreAll();
  delete process.env.SLACK_TEST_STARTED;
  delete process.env.SLACK_TEST_MODE;
  fs.rmSync(root, { recursive: true, force: true });
});

function fetch(signal) {
  return execute('fixture', { link: 'https://example.slack.com/archives/C1/p1234567890123456' }, signal, () => {}, { cwd: root });
}

test('cancellation before Slack execution prevents Claude from launching', async () => {
  const marker = path.join(root, 'pre-aborted');
  process.env.SLACK_TEST_STARTED = marker;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetch(controller.signal), { name: 'AbortError' });
  assert.equal(fs.existsSync(marker), false);
});

test('cancelling an active Slack fetch terminates its Claude process', { timeout: 10_000 }, async () => {
  const marker = path.join(root, 'active');
  process.env.SLACK_TEST_STARTED = marker;
  process.env.SLACK_TEST_MODE = 'hang';
  const controller = new AbortController();
  fs.watchFile(marker, { interval: 10 }, stat => {
    if (stat.size > 0) controller.abort();
  });
  try {
    await assert.rejects(fetch(controller.signal), /stopped/);
    const pid = Number(fs.readFileSync(marker, 'utf8'));
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally {
    fs.unwatchFile(marker);
    controller.abort();
    delete process.env.SLACK_TEST_MODE;
  }
});

test('an uncancelled Slack fetch still returns formatted content', async () => {
  process.env.SLACK_TEST_STARTED = path.join(root, 'success');
  const result = await fetch(new AbortController().signal);
  assert.match(result.content[0].text, /Fetched fixture/);
  assert.equal(result.details.channel, 'fixture');
});
