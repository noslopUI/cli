// `noslopui update` — refresh what's already installed, without touching auth.
//
// In practice that means the skill: it's served from noslopui.com and changes
// as the workflow improves, while the config entry only changes if the server
// URL does. Nothing here needs a sign-in, so an expired trial or a revoked key
// doesn't block it.

import { fetchSkill, mcpUrl } from '../lib/api.js';
import { ADAPTERS } from '../adapters/index.js';
import { color, hint, ok, say, warn } from '../lib/ui.js';

export async function update(): Promise<number> {
  say();
  let touched = false;
  let markdown: string | null = null;

  for (const adapter of ADAPTERS) {
    if (!(await adapter.detect())) continue;
    const status = await adapter.status();
    if (!status.installed) {
      say(`${color.dim('–')} ${adapter.label}: not set up, nothing to update`);
      continue;
    }

    if (status.url !== mcpUrl()) {
      warn(`${adapter.label}: configured for ${status.url}, not ${mcpUrl()}.`);
      hint('Run "npx noslopui init" to move it — that needs a key, so it is not done here.');
    }

    markdown ??= (await fetchSkill()).markdown;
    const skill = await adapter.installSkill(markdown);
    if (skill.changed) {
      ok(`${adapter.label}: skill updated`);
      hint(skill.path);
      touched = true;
    } else {
      ok(`${adapter.label}: skill already current`);
    }
  }

  say();
  if (touched) say(`Restart your agent to pick up the new workflow.`);
  say();
  return 0;
}
