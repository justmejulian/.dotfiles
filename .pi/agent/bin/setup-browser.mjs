#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const agentDir = path.join(os.homedir(), '.pi/agent');
const prefix = path.join(os.homedir(), '.local');
const env = {
  ...process.env,
  PATH: `${path.join(prefix, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
  PI_CODING_AGENT_DIR: agentDir,
  npm_config_fetch_retries: '0',
  npm_config_fetch_timeout: '30000',
};

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed; setup stopped. Rerun this script after resolving the error.`);
}

try {
  // The user's prefix avoids writes to the Homebrew-managed installation.
  run('npm', ['install', '--global', '--prefix', prefix, 'agent-browser@0.38.1']);
  run(path.join(prefix, 'bin/agent-browser'), ['install']);
  run('pi', ['install', 'npm:pi-agent-browser-native@0.9.6']);
  run('node', [path.join(agentDir, 'npm/node_modules/pi-agent-browser-native/scripts/doctor.mjs')]);

  // Narrowed researcher sessions need an explicit extension declaration.
  const file = path.join(agentDir, 'agents/web-researcher.md');
  const contents = fs.readFileSync(file, 'utf8');
  const match = contents.match(/^extensions: (.+)$/m);
  if (!match) throw new Error('web-researcher.md has no explicit extensions field; review it before enabling browser tools.');
  const extensions = match[1].split(',').map(value => value.trim());
  if (!extensions.some(value => /^npm:pi-agent-browser-native(?:@|$)/.test(value))) {
    const updated = [...extensions, 'npm:pi-agent-browser-native@0.9.6'].join(', ');
    fs.copyFileSync(file, `${file}.before-browser-${Date.now()}`);
    fs.writeFileSync(file, contents.replace(/^extensions: .+$/m, `extensions: ${updated}`));
  }

  console.log('\nBrowser installation and workflow integration complete. Fully quit and restart Pi.');
  console.log('Browser automation remains a last resort under ~/.pi/agent/AGENTS.md and the specialist instructions.');
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
