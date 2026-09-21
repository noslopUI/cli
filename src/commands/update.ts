// `noslopui update` — refresh what's already installed, without touching auth.
//
// In practice that means the skill: it's served from noslopui.com and changes
// as the workflow improves, while the config entry only changes if the server
// URL does. Nothing here needs a sign-in, so an expired trial or a revoked key
// doesn't block it. Several agents share one skills folder, so each folder is
// written once.

import { fetchSkill, mcpUrl } from '../lib/api.js';
import { ADAPTERS } from '../adapters/index.js';
import { color, hint, ok, say, warn } from '../lib/ui.js';

export async function update(): Promise<number> {
  say();
  let touched = false;
  let markdown: string | null = null;
  const written = new Map<string, boolean>();

  for (const adapter of ADAPTERS) {
    if (!(await adapter.detect())) continue;
    const status = await adapter.status();
    if (!status.installed) {
      say(`${color.dim('–')} ${adapter.label}: not set up, nothing to update`);
      continue;
    }

    if (status.url !== mcpUrl()) {
      warn(`${adapter.label}: configured for ${status.url}, not ${mcpUrl()}.`);
      hint(`Run "npx noslopui init --agent ${adapter.id}" to move it — that needs a key, so it is not done here.`);
    }

    const path = adapter.skillPath();
    if (!path) {
      ok(`${adapter.label}: no skills folder; the rules reach it through the server`);
      continue;
    }
    if (!written.has(path)) {
      markdown ??= (await fetchSkill()).markdown;
      const skill = await adapter.installSkill(markdown);
      written.set(path, skill?.changed ?? false);
      if (skill?.changed) touched = true;
    }
    ok(`${adapter.label}: skill ${written.get(path) ? 'updated' : 'already current'}`);
    hint(path);
  }

  say();
  if (touched) say('Restart your agents to pick up the new workflow.');
  say();
  return 0;
}
