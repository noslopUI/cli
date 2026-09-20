// `noslopui doctor` — what's set up, what's wrong, and what to do about it.
//
// The rule for every line: if something is broken, say the one thing that
// fixes it. A diagnostic that only reports a state leaves the user exactly
// where they started.

import { existsSync, readFileSync } from 'node:fs';
import { checkServer, mcpUrl, origin } from '../lib/api.js';
import { ADAPTERS } from '../adapters/index.js';
import { ConfigUnreadableError, readJsonFile, type JsonObject } from '../lib/json-file.js';
import { SERVER_NAME } from '../adapters/claude-code.js';
import { color, fail, hint, ok, say, warn } from '../lib/ui.js';

/** Read back the configured key so we can ask the server whether it still works. */
function configuredKey(configPath: string): string | null {
  try {
    const config = readJsonFile(configPath);
    const entry = (config?.mcpServers as JsonObject | undefined)?.[SERVER_NAME] as JsonObject | undefined;
    const headers = (entry?.headers ?? {}) as JsonObject;
    const auth = typeof headers.Authorization === 'string' ? headers.Authorization : '';
    const match = auth.match(/^Bearer\s+(\S+)$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function doctor(): Promise<number> {
  let problems = 0;
  say();
  say(`${color.bold('noslopUI doctor')} ${color.dim(`— ${origin()}`)}`);

  say();
  say(color.bold('Server'));
  const reach = await checkServer();
  if (reach.reachable) ok(`${mcpUrl()} — ${reach.detail}`);
  else {
    fail(reach.detail);
    hint('If you are behind a proxy or VPN, that is the usual cause.');
    problems++;
  }

  for (const adapter of ADAPTERS) {
    say();
    say(color.bold(adapter.label));

    if (!(await adapter.detect())) {
      say(`${color.dim('–')} ${color.dim('not installed on this machine')}`);
      continue;
    }

    let status;
    try {
      status = await adapter.status();
    } catch (err) {
      if (err instanceof ConfigUnreadableError) {
        fail(err.message);
        hint('Fix that file by hand — this tool will not overwrite a config it cannot read.');
        problems++;
        continue;
      }
      throw err;
    }

    if (!status.installed) {
      warn('noslopUI is not set up here.');
      hint('Run "npx noslopui init".');
      problems++;
    } else {
      ok(`Configured in ${status.configPath}`);
      if (status.url !== mcpUrl()) {
        warn(`The configured url is ${status.url}, but this CLI expects ${mcpUrl()}.`);
        hint('Run "npx noslopui init" to update it.');
        problems++;
      }
      if (status.problem) {
        warn(status.problem);
        hint('Run "npx noslopui init" to repair the entry.');
        problems++;
      }

      const key = configuredKey(status.configPath);
      if (key) {
        const probe = await checkServer(key);
        if (probe.keyState === 'ok') {
          ok('The configured key works.');
        } else if (probe.keyState === 'rejected') {
          fail(probe.keyDetail ?? 'The configured key was refused.');
          hint(`Create a new key at ${origin()}/account?tab=mcp, or run "npx noslopui login".`);
          problems++;
        }
      }
    }

    const skillPath = adapter.skillPath();
    if (existsSync(skillPath)) {
      let current = '';
      try {
        current = readFileSync(skillPath, 'utf8');
      } catch {
        current = '';
      }
      if (current.includes('noslopui')) ok(`Skill installed at ${skillPath}`);
      else warn(`${skillPath} exists but doesn't look like the noslopUI skill.`);
    } else {
      warn('The skill is not installed.');
      hint('Optional, but it is what makes "build me a website" use noslopUI at all. Run "npx noslopui init".');
    }
  }

  say();
  if (problems === 0) {
    ok('Everything checks out.');
    say();
    return 0;
  }
  fail(`${problems} ${problems === 1 ? 'problem' : 'problems'} found.`);
  say();
  return 1;
}
