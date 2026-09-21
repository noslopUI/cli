// `noslopui remove` — take our entry back out, leave everything else alone.
//
// Removing the config entry does NOT revoke the key: the key belongs to the
// account, not to this machine, and someone removing a local config hasn't
// asked us to change their account. We say where to revoke it instead.
//
// Several agents share a skills folder (~/.agents/skills), so a skill is only
// removed once no agent that's still set up reads it.

import { ADAPTERS, adapterById, type Adapter } from '../adapters/index.js';
import { origin } from '../lib/api.js';
import { color, confirm, hint, ok, say, warn } from '../lib/ui.js';

export async function remove(options: { yes: boolean; skill: boolean; agents?: string[] }): Promise<number> {
  say();
  let removedAnything = false;
  const targets: Adapter[] = options.agents?.length
    ? options.agents.map((id) => {
        const a = adapterById(id);
        if (!a) throw new Error(`Unknown agent "${id}". Supported: ${ADAPTERS.map((x) => x.id).join(', ')}.`);
        return a;
      })
    : ADAPTERS;
  const removed: Adapter[] = [];

  for (const adapter of targets) {
    if (!options.agents?.length && !(await adapter.detect())) continue;

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
      removed.push(adapter);
    }
  }

  if (options.skill) {
    const stillUsing = async (path: string) => {
      for (const other of ADAPTERS) {
        if (removed.includes(other) || other.skillPath() !== path) continue;
        if ((await other.status().catch(() => ({ installed: false }))).installed) return other;
      }
      return null;
    };
    const done = new Set<string>();
    for (const adapter of removed) {
      const path = adapter.skillPath();
      if (!path || done.has(path)) continue;
      done.add(path);
      const user = await stillUsing(path);
      if (user) {
        say(`${color.dim('–')} kept the skill at ${path}: ${user.label} still uses it`);
      } else if (await adapter.removeSkill()) {
        ok(`removed the skill at ${path}`);
      }
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
