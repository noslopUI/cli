#!/usr/bin/env node
// Runs the compiled tests on every Node version we support.
//
// `node --test "glob/**/*.test.js"` needs Node 22, and `node --test <dir>`
// doesn't behave the same across platforms either. Handing the runner an
// explicit list of files is the one form that works identically on Node 20,
// 22 and 24, on Windows, macOS and Linux — which is exactly the matrix this
// package claims to support.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join('.test-build', 'test');
if (!existsSync(dir)) {
  console.error(`No compiled tests at ${dir}. Run "npm run build:test" first.`);
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => join(dir, f));

if (!files.length) {
  console.error(`No *.test.js files in ${dir}.`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
