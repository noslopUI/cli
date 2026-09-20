// `noslopui remove` — take our entry back out, leave everything else alone.
//
// Removing the config entry does NOT revoke the key: the key belongs to the
// account, not to this machine, and someone removing a local config hasn't
// asked us to change their account. We say where to revoke it instead.

import { ADAPTERS } from '../adapters/index.js';
import { origin } from '../lib/api.js';
import { color, confirm, hint, ok, say, warn } from '../lib/ui.js';

export async function remove(options: { yes: boolean; skill: boolean }): Promise<number> {
  say();
  let removedAnything = false;

  for (const adapter of ADAPTERS) {
    if (!(await adapter.detect())) continue;

    const status = await adapter.status();
    if (!status.installed) {
      say(`${color.dim('–')} ${adapter.label}: nothing to remove`);
      continue;
    }

    if (!options.yes && !(await confirm(`Remove the noslopui server from ${color.bold(adapter.label)}?`, true))) {
      say(`${color.dim('–')} ${adapter.label}: left alone`);
      continue;
    }

    if (await adapter.uninstall()) {
      ok(`${adapter.label}: removed the noslopui server (other servers untouched)`);
      removedAnything = true;
    }
    if (options.skill && (await adapter.removeSkill())) {
      ok(`${adapter.label}: removed the skill`);
    }
  }

  say();
  if (removedAnything) {
    warn('Your API key still exists and still works.');
    hint(`Revoke it at ${origin()}/account?tab=mcp if this machine should no longer have access.`);
  }
  say();
  return 0;
}
