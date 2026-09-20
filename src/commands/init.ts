// `noslopui init` — the whole setup, in one command.
//
//   detect the agent → sign in in the browser → write the MCP entry →
//   install the skill → say what to do next
//
// Nothing here is silent: every file that gets written is named on screen,
// with its backup, because this command edits configuration the user didn't
// ask us to know about.

import { spawn } from 'node:child_process';
import { ApiError, mcpUrl, origin, startSignIn, waitForApproval, fetchSkill, type IssuedKey } from '../lib/api.js';
import { adapterById, detectAdapters, type Adapter } from '../adapters/index.js';
import { color, confirm, hint, interactive, machineLabel, maskKey, ok, say, step, warn } from '../lib/ui.js';
import { ConfigUnreadableError } from '../lib/json-file.js';

export type InitOptions = {
  agents?: string[];
  skill: boolean;
  yes: boolean;
  key?: string;
  /** False on a headless machine, or when the user would rather open it themselves. */
  browser?: boolean;
};

/** Best-effort: if it doesn't open, the URL is on screen anyway. */
function openBrowser(url: string): void {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Headless, locked down, or no desktop — the printed URL covers it.
  }
}

async function chooseAdapters(options: InitOptions): Promise<Adapter[]> {
  if (options.agents?.length) {
    const chosen: Adapter[] = [];
    for (const id of options.agents) {
      const adapter = adapterById(id);
      if (!adapter) throw new Error(`Unknown agent "${id}". Supported: ${(await detectAdapters()).map((a) => a.id).join(', ') || 'claude-code'}.`);
      chosen.push(adapter);
    }
    return chosen;
  }

  const detected = await detectAdapters();
  if (!detected.length) {
    throw new Error(
      'No supported agent found on this machine. noslopUI sets up Claude Code today; install it first, or add the server by hand from https://noslopui.com/mcp.',
    );
  }

  const chosen: Adapter[] = [];
  for (const adapter of detected) {
    if (options.yes || !interactive()) {
      chosen.push(adapter);
    } else if (await confirm(`Set up ${color.bold(adapter.label)}?`, true)) {
      chosen.push(adapter);
    }
  }
  if (!chosen.length) throw new Error('Nothing selected, so nothing was changed.');
  return chosen;
}

export async function init(options: InitOptions): Promise<number> {
  say();
  say(`${color.bold('noslopUI')} ${color.dim('— hand-crafted components and design systems for your agent')}`);
  say();

  const adapters = await chooseAdapters(options);
  for (const adapter of adapters) ok(`Found ${adapter.label}`);

  // Either a key the user already has, or one issued through the browser.
  let keys: IssuedKey[];
  if (options.key) {
    keys = adapters.map((a) => ({ agent: a.id, label: a.label, name: 'provided key', key: options.key! }));
    step('Using the key you passed with --key.');
  } else {
    const machine = machineLabel();
    const started = await startSignIn(
      machine,
      adapters.map((a) => a.id),
    );
    say();
    step(`Approve this in your browser, signed in to noslopUI:`);
    say();
    say(`    ${color.bold(color.cyan(started.verificationUriComplete))}`);
    say();
    say(`    code ${color.bold(started.userCode)} · this machine is shown as "${machine}" · expires in ${Math.round(started.expiresIn / 60)} minutes`);
    say();
    if (options.browser !== false) openBrowser(started.verificationUriComplete);
    step('Waiting for approval…');
    keys = await waitForApproval(started);
    ok(`Approved. ${keys.length === 1 ? 'One key issued' : `${keys.length} keys issued`}.`);
  }

  say();
  const restartNeeded: string[] = [];
  for (const adapter of adapters) {
    const issued = keys.find((k) => k.agent === adapter.id) ?? keys[0];
    if (!issued) throw new Error(`No key was issued for ${adapter.label}.`);

    const result = await adapter.install({ url: mcpUrl(), key: issued.key });
    ok(`${adapter.label}: ${result.replacedExisting ? 'updated' : 'added'} the noslopui server`);
    hint(`config ${result.configPath}`);
    if (result.backupPath) hint(`backup ${result.backupPath}`);
    hint(`key    ${maskKey(issued.key)} — named "${issued.name}" on your account`);
    restartNeeded.push(adapter.label);

    if (options.skill) {
      const download = await fetchSkill();
      const skill = await adapter.installSkill(download.markdown);
      ok(`${adapter.label}: ${skill.changed ? 'installed' : 'already had'} the noslopUI skill`);
      hint(`skill  ${skill.path}`);
      if (download.source === 'bundled') {
        warn('That skill came from this package, not the site — it may be behind. Run "npx noslopui update" when you are back online.');
      }
    }
  }

  say();
  say(color.bold('Done. Two things:'));
  say(`  1. Restart ${restartNeeded.join(' and ')} so it picks up the new server.`);
  say(`  2. Try it: ${color.cyan('"build me a landing page for a coffee roastery"')}`);
  say();
  hint(`Revoke a key any time at ${origin()}/account?tab=mcp · check the setup with "npx noslopui doctor"`);
  say();
  return 0;
}

/** Turns the errors this command can hit into something worth reading. */
export function explain(err: unknown): string {
  if (err instanceof ConfigUnreadableError) {
    return `${err.message}\n  Fix or move that file, then run this again. Nothing was written.`;
  }
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
