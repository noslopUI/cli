// `noslopui doctor` — what's set up, what's wrong, and what to do about it.
//
// The rule for every line: if something is broken, say the one thing that
// fixes it. A diagnostic that only reports a state leaves the user exactly
// where they started.

import { existsSync, readFileSync } from 'node:fs';
import { checkServer, mcpUrl, origin, whoami } from '../lib/api.js';
import { ADAPTERS } from '../adapters/index.js';
import { ConfigUnreadableError } from '../lib/json-file.js';
import { readSession } from '../lib/session.js';
import { color, fail, hint, ok, say, warn } from '../lib/ui.js';

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

  say();
  say(color.bold('This CLI'));
  const session = readSession();
  if (!session) {
    say(`${color.dim('–')} ${color.dim('not signed in (only needed for "noslopui search" and "get"; run "npx noslopui login")')}`);
  } else {
    try {
      const account = await whoami(session.key);
      ok(`Signed in as ${account.email ?? 'your account'} (${account.plan})`);
    } catch (err) {
      fail((err as Error).message);
      hint('Run "npx noslopui login" to sign in again.');
      problems++;
    }
  }

  let anyAgent = false;
  for (const adapter of ADAPTERS) {
    if (!(await adapter.detect())) continue;
    anyAgent = true;
    say();
    say(color.bold(adapter.label));

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
      hint(`Run "npx noslopui init --agent ${adapter.id}".`);
      problems++;
    } else {
      ok(`Configured in ${status.configPath}`);
      if (status.url !== mcpUrl()) {
        warn(`The configured url is ${status.url}, but this CLI expects ${mcpUrl()}.`);
        hint(`Run "npx noslopui init --agent ${adapter.id}" to update it.`);
        problems++;
      }
      if (status.problem) {
        warn(status.problem);
        hint(`Run "npx noslopui init --agent ${adapter.id}" to repair the entry.`);
        problems++;
      }

      const key = await adapter.configuredKey();
      if (key) {
        const probe = await checkServer(key);
        if (probe.keyState === 'ok') {
          ok('The configured key works.');
        } else if (probe.keyState === 'rejected') {
          fail(probe.keyDetail ?? 'The configured key was refused.');
          hint(`Run "npx noslopui login --agent ${adapter.id}" for a fresh key.`);
          problems++;
        }
      }
    }

    const skillPath = adapter.skillPath();
    if (!skillPath) {
      say(`${color.dim('–')} ${color.dim('no skills folder; the rules reach it through the server')}`);
    } else if (existsSync(skillPath)) {
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
      hint('Optional, but it is what makes "build me a website" use noslopUI at all. Run "npx noslopui update".');
    }
  }

  if (!anyAgent) {
    say();
    warn(`None of the agents this CLI sets up were found (${ADAPTERS.map((a) => a.label).join(', ')}).`);
    hint(`Any other MCP client can be connected by hand: ${origin()}/mcp`);
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
