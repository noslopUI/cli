// `noslopui whoami` and `noslopui logout` — the CLI's own session.

import { origin, whoami as fetchAccount } from '../lib/api.js';
import { clearSession, readSession, sessionPath } from '../lib/session.js';
import { color, hint, ok, say, warn } from '../lib/ui.js';

export async function whoami(options: { json: boolean }): Promise<number> {
  const session = readSession();
  if (!session) {
    if (options.json) say(JSON.stringify({ signedIn: false }));
    else {
      say();
      warn('Not signed in.');
      hint('Run "npx noslopui login".');
      say();
    }
    return 1;
  }
  const account = await fetchAccount(session.key);
  if (options.json) {
    say(JSON.stringify({ signedIn: true, ...account }, null, 2));
    return 0;
  }
  const plan =
    account.plan === 'paid'
      ? 'paid plan'
      : account.plan === 'trial'
        ? account.trialEndsAt
          ? `free trial, ends ${new Date(account.trialEndsAt).toLocaleDateString()}`
          : 'free trial, not started yet — the first unlock starts it'
        : 'free — search and collections; code and DESIGN.md files need a plan';
  say();
  ok(`${color.bold(account.email ?? 'Signed in')} · ${plan}`);
  hint(session.savedAt === 'env' ? 'key from NOSLOPUI_API_KEY' : `key saved in ${sessionPath()}`);
  say();
  return 0;
}

export async function logout(): Promise<number> {
  say();
  if (clearSession()) {
    ok('Signed out on this machine.');
    hint(`The key still exists on your account — revoke it at ${origin()}/account?tab=mcp if this machine shouldn't have it.`);
  } else {
    warn('Not signed in, so nothing to do.');
  }
  if (process.env.NOSLOPUI_API_KEY) hint('NOSLOPUI_API_KEY is still set in this shell.');
  say();
  return 0;
}
