// `noslopui login` — sign the CLI itself in, like `21st login`.
//
// Saves a key for the agent id `cli` to this machine's config folder, which is
// what `search`, `get`, `design-system`, `collections` and `whoami` use. It
// doesn't touch any agent's config: `init` does that.
//
// `login --agent <id>` is the other job: a fresh key for an agent that's
// already set up (its key was revoked, or belongs to the wrong account). It
// swaps the key in place and leaves the skill and every other server alone.

import { init, signIn } from './init.js';
import { whoami } from '../lib/api.js';
import { saveSession } from '../lib/session.js';
import { hint, ok, say } from '../lib/ui.js';

export async function login(options: { agents?: string[]; yes: boolean; browser: boolean; key?: string }): Promise<number> {
  if (options.agents?.length) {
    return init({ ...options, skill: false });
  }

  say();
  let key: string;
  if (options.key) {
    key = options.key;
  } else {
    const keys = await signIn(['cli'], options.browser);
    key = keys.find((k) => k.agent === 'cli')?.key ?? '';
    if (!key) throw new Error('No key was issued for the CLI.');
  }
  const account = await whoami(key);
  const path = saveSession(key);
  ok(`Signed in as ${account.email ?? 'your account'}.`);
  hint(`saved to ${path}`);
  hint('Set up an agent with "npx noslopui init", or search with "npx noslopui search <query>".');
  say();
  return 0;
}
