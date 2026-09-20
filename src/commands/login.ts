// `noslopui login` — a fresh key for an agent that's already set up.
//
// The case this exists for: the key was revoked, or it belongs to the wrong
// account. It swaps the key in place and leaves everything else — the skill,
// the server entry's other fields, every other configured server — alone.

import { init, type InitOptions } from './init.js';
import { ADAPTERS } from '../adapters/index.js';
import { say, warn, hint } from '../lib/ui.js';

export async function login(options: Omit<InitOptions, 'skill'>): Promise<number> {
  const configured: string[] = [];
  for (const adapter of ADAPTERS) {
    if (!(await adapter.detect())) continue;
    if ((await adapter.status()).installed) configured.push(adapter.id);
  }

  if (!configured.length) {
    say();
    warn('No agent here has noslopUI set up yet.');
    hint('Run "npx noslopui init" — it does the sign-in and the setup together.');
    say();
    return 1;
  }

  // Same path as init, minus the skill: this is only about the key.
  return init({ ...options, agents: options.agents?.length ? options.agents : configured, skill: false });
}
