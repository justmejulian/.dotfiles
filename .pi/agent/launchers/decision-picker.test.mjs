import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { loadExtensions } from '../npm/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-decision-picker-tests-'));
const oldPath = process.env.PATH;
const prefix = '/workflow answer decision-abcd ';

before(() => {
  fs.writeFileSync(path.join(root, 'sqlite3'), `#!/usr/bin/env node
console.log(process.argv.at(-1).includes('count(*)') ? '0' : JSON.stringify({push:{label:'Push'},fix:{label:'Fix',input:{name:'instructions',prompt:'What should change?',maxLength:1000}}}));
`, { mode: 0o755 });
  process.env.PATH = `${root}:${oldPath}`;
});
after(() => {
  process.env.PATH = oldPath;
  fs.rmSync(root, { recursive: true, force: true });
});

async function picker(initial = '') {
  const loaded = await loadExtensions([path.join(os.homedir(), '.pi/agent/extensions/workflow-answer-prefill.ts')], root);
  assert.deepEqual(loaded.errors, []);
  let editor = initial;
  const messages = [];
  loaded.runtime.sendMessage = (...args) => messages.push(args);
  const ctx = {
    sessionManager: {
      getBranch: () => [{ type: 'custom_message', customType: 'pi-workflows-interaction', content: 'Pending decision', details: { requestId: 'decision-abcd' }, id: 'entry' }],
    },
    ui: {
      getEditorText: () => editor,
      setEditorText: value => { editor = value; },
      pasteToEditor: value => { editor += value; },
      select: async () => 'Push',
      notify() {},
    },
  };
  return { ctx, messages, editor: () => editor, run: () => loaded.extensions[0].commands.get('decide').handler('', ctx) };
}

test('an empty editor receives an answer command without submitting it', async () => {
  const p = await picker();
  await p.run();
  assert.equal(p.editor(), `${prefix}{"choice":"push"}`);
  assert.deepEqual(p.messages, []);
});

test('a draft present before the picker is preserved and the command is shown without triggering a turn', async () => {
  const p = await picker('My unfinished message');
  await p.run();
  assert.equal(p.editor(), 'My unfinished message');
  assert.equal(p.messages.length, 1);
  const [message, options] = p.messages[0];
  assert.ok(message.content.includes(`${prefix}{"choice":"push"}`));
  assert.equal(message.display, true);
  assert.ok(!options?.triggerTurn);
});

test('a draft entered while the picker is open is preserved', async () => {
  const p = await picker();
  p.ctx.ui.select = async () => { p.ctx.ui.setEditorText('Typed during selection'); return 'Push'; };
  await p.run();
  assert.equal(p.editor(), 'Typed during selection');
  assert.equal(p.messages.length, 1);
});

test('a draft entered during the text dialog is preserved with the complete answer', async () => {
  const p = await picker();
  p.ctx.ui.select = async () => 'Fix …';
  p.ctx.ui.input = async () => { p.ctx.ui.setEditorText('Typed during input'); return 'Repair the marker'; };
  await p.run();
  assert.equal(p.editor(), 'Typed during input');
  const command = p.messages[0][0].content.split('\n\n').at(-1);
  assert.deepEqual(JSON.parse(command.slice(prefix.length)), { choice: 'fix', input: { instructions: 'Repair the marker' } });
});

test('cancelling the picker preserves drafts and only prefills an empty editor', async () => {
  for (const draft of ['', 'Keep this draft']) {
    const p = await picker(draft);
    p.ctx.ui.select = async () => undefined;
    await p.run();
    assert.equal(p.editor(), draft || prefix);
    assert.equal(p.messages.length, draft ? 1 : 0);
  }
});
