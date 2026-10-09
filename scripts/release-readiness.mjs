#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const supabase = process.platform === 'win32' ? 'supabase.exe' : 'supabase';

const workspaceSteps = {
  web: [
    [pnpm, ['--filter', '@wayfare/web', 'run', 'lint']],
    [pnpm, ['--filter', '@wayfare/web', 'run', 'typecheck']],
    [pnpm, ['--filter', '@wayfare/web', 'run', 'test']],
    [pnpm, ['--filter', '@wayfare/web', 'run', 'build']],
  ],
  mobile: [
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'lint']],
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'typecheck']],
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'test']],
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'format:check']],
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'doctor']],
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'config:check']],
  ],
  all: [
    [pnpm, ['run', 'lint']],
    [pnpm, ['run', 'typecheck']],
    [pnpm, ['run', 'test']],
    [pnpm, ['run', 'format:check']],
    [pnpm, ['run', 'build']],
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'doctor']],
    [pnpm, ['--filter', '@wayfare/mobile', 'run', 'config:check']],
  ],
  database: [
    [supabase, ['migration', 'list', '--linked']],
    [supabase, ['db', 'push', '--linked', '--dry-run']],
  ],
};

const aliases = { db: 'database' };
const requestedTarget = process.argv[2];
const target = aliases[requestedTarget] ?? requestedTarget;

if (requestedTarget === '--help' || requestedTarget === '-h') {
  console.log('Usage: node scripts/release-readiness.mjs <web|mobile|all|database>');
  process.exit(0);
}

if (!target || !(target in workspaceSteps)) {
  console.error('Choose one release target: web, mobile, all, or database.');
  process.exit(2);
}

for (const [command, args] of workspaceSteps[target]) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n${target} release-readiness checks passed.`);
