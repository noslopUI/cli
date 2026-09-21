// `noslopui skill` — install only the skill, for someone who connected an
// agent by hand (a connector sign-in, or a config they wrote). It never
// touches an agent's MCP config, so a sign-in stays a sign-in.

import { fetchSkill } from '../lib/api.js';
import { ADAPTERS, adapterById, detectAdapters, type Adapter } from '../adapters/index.js';
import { hint, ok, say, warn } from '../lib/ui.js';

export async function skill(options: { agents?: string[] }): Promise<number> {
  say();
  let targets: Adapter[];
  if (options.agents?.length) {
    targets = options.agents.map((id) => {
      const a = adapterById(id);
      if (!a) throw new Error(`Unknown agent "${id}". Supported: ${ADAPTERS.map((x) => x.id).join(', ')}.`);
      return a;
    });
  } else {
    targets = await detectAdapters();
    if (!targets.length) throw new Error(`No supported agent found. Pass one with --agent: ${ADAPTERS.map((a) => a.id).join(', ')}.`);
  }

  const download = await fetchSkill();
  if (download.source === 'bundled') warn('Using the copy in this package — the site was unreachable, so it may be behind.');
  const written = new Map<string, boolean>();
  for (const adapter of targets) {
    const path = adapter.skillPath();
    if (!path) {
      ok(`${adapter.label}: no skills folder; the rules reach it through the server`);
      continue;
    }
    if (!written.has(path)) written.set(path, (await adapter.installSkill(download.markdown))?.changed ?? false);
    ok(`${adapter.label}: skill ${written.get(path) ? 'installed' : 'already current'}`);
    hint(path);
  }
  say();
  say('Restart your agent to pick it up.');
  say();
  return 0;
}
