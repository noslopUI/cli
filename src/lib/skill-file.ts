// Writing and removing the skill file. Shared by every adapter, because several
// agents read the same folder (`~/.agents/skills/` is read by Codex, Cursor,
// OpenCode and VS Code alike) — one copy there serves all of them.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SkillResult } from '../adapters/types.js';

export function installSkillAt(path: string, markdown: string): SkillResult {
  if (existsSync(path)) {
    try {
      if (readFileSync(path, 'utf8') === markdown) return { path, changed: false };
    } catch {
      // Unreadable but present: fall through and replace it.
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdown, 'utf8');
  return { path, changed: true };
}

export function removeSkillAt(path: string): boolean {
  if (!existsSync(path)) return false;
  // Only our own folder (…/skills/noslopui/), and only because we created it.
  rmSync(dirname(path), { recursive: true, force: true });
  return true;
}
