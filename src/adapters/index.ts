// The adapter registry.
//
// One entry today. Every other agent stays out of this list until it has been
// installed for real, end to end, on a real machine — an agent that appears
// here is an agent we're promising works.

import { ClaudeCodeAdapter } from './claude-code.js';
import type { Adapter } from './types.js';

export const ADAPTERS: Adapter[] = [new ClaudeCodeAdapter()];

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
