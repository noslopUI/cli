#!/usr/bin/env node
// Pulls SKILL.md from noslopui.com into this repo.
//
// The workflow has exactly one source, and it isn't here: it's assembled on
// the server from `src/lib/agent/` in the website repo and served at
// /skill/SKILL.md. That's what the MCP server sends as its instructions, what
// the `build_ui` prompt expands to, and what `npx noslopui init` installs.
//
// This repo keeps a copy only so `npx skills add noslopUI/cli` has a file to
// find, and so the published package has something to fall back on when the
// site is unreachable. A copy that can drift is a copy worth checking, so CI
// runs this with --check and fails if it has.
//
//   node scripts/sync-skill.mjs           update SKILL.md
//   node scripts/sync-skill.mjs --check   fail if it is out of date

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORIGIN = (process.env.NOSLOPUI_ORIGIN || 'https://noslopui.com').replace(/\/$/, '');
const TARGET = fileURLToPath(new URL('../SKILL.md', import.meta.url));
const check = process.argv.includes('--check');

const res = await fetch(`${ORIGIN}/skill/SKILL.md`);
if (!res.ok) {
  console.error(`Could not download the skill: HTTP ${res.status}`);
  process.exitCode = 1;
} else {
  const latest = await res.text();
  if (!latest.startsWith('---')) {
    console.error('What came back does not look like a skill file.');
    process.exitCode = 1;
  } else {
    const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
    if (current === latest) {
      console.log('SKILL.md is up to date.');
    } else if (check) {
      console.error(`SKILL.md is out of date with ${ORIGIN}/skill/SKILL.md. Run "npm run sync-skill" and commit the result.`);
      process.exitCode = 1;
    } else {
      writeFileSync(TARGET, latest, 'utf8');
      console.log(`SKILL.md updated from ${ORIGIN} (${latest.length} bytes).`);
    }
  }
}
