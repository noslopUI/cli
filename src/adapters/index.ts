// The adapter registry — every agent `npx noslopui init` can set up.
//
// The server keeps the same list (CLI_AGENTS in the website's lib/cli-auth.ts)
// and refuses a key for any agent not on it, so the two change together.
// Order is the order they're offered in.

import { ClaudeCodeAdapter } from './claude-code.js';
import { CodexAdapter } from './codex.js';
import { antigravity, cursor, devin, opencode, vscode, windsurf } from './json-agents.js';
import type { Adapter } from './types.js';

export const ADAPTERS: Adapter[] = [
  new ClaudeCodeAdapter(),
  new CodexAdapter(),
  cursor(),
  vscode(),
  devin(),
  windsurf(),
  opencode(),
  antigravity(),
];

export function adapterById(id: string): Adapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

/** Adapters whose agent is actually on this machine. */
export async function detectAdapters(): Promise<Adapter[]> {
  const found: Adapter[] = [];
  for (const adapter of ADAPTERS) {
    if (await adapter.detect()) found.push(adapter);
  }
  return found;
}

export type { Adapter } from './types.js';
