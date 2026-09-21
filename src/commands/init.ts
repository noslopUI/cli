// `noslopui init` — the whole setup, in one command.
//
//   find the agents → one sign-in in the browser → write each agent's MCP
//   entry → install the skill → say what to do next
//
// Nothing here is silent: every file that gets written is named on screen,
// with its backup, because this command edits configuration the user didn't
// ask us to know about.
//
// The same approval also gives the CLI itself a key (agent id `cli`), saved
// for `noslopui search`, `get` and `whoami` — unless it already has one.

import { spawn } from 'node:child_process';
import { ApiError, mcpUrl, origin, startSignIn, waitForApproval, fetchSkill, type IssuedKey } from '../lib/api.js';
import { ADAPTERS, adapterById, detectAdapters, type Adapter } from '../adapters/index.js';
import { color, confirm, hint, interactive, machineLabel, maskKey, ok, say, step, warn } from '../lib/ui.js';
import { ConfigUnreadableError } from '../lib/json-file.js';
import { readSession, saveSession } from '../lib/session.js';

export type InitOptions = {
  agents?: string[];
  skill: boolean;
  yes: boolean;
  key?: string;
  /** False on a headless machine, or when the user would rather open it themselves. */
  browser?: boolean;
};

/** Best-effort: if it doesn't open, the URL is on screen anyway. */
export function openBrowser(url: string): void {
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

/**
 * The browser half: open a request for these agent ids, show the code, wait
 * for the user to approve it, and hand back one key per id.
 */
export async function signIn(agentIds: string[], browser: boolean): Promise<IssuedKey[]> {
  const machine = machineLabel();
  const started = await startSignIn(machine, agentIds);
  say();
  step('Approve this in your browser, signed in to noslopUI:');
  say();
  say(`    ${color.bold(color.cyan(started.verificationUriComplete))}`);
  say();
  say(`    code ${color.bold(started.userCode)} · this machine is shown as "${machine}" · expires in ${Math.round(started.expiresIn / 60)} minutes`);
  say();
  if (browser) openBrowser(started.verificationUriComplete);
  step('Waiting for approval…');
  const keys = await waitForApproval(started);
  ok(`Approved. ${keys.length === 1 ? 'One key issued' : `${keys.length} keys issued`}.`);
  return keys;
}

const supportedList = () => ADAPTERS.map((a) => a.id).join(', ');

async function chooseAdapters(options: InitOptions): Promise<Adapter[]> {
  if (options.agents?.length) {
    const chosen: Adapter[] = [];
    for (const id of options.agents) {
      const adapter = adapterById(id);
      if (!adapter) throw new Error(`Unknown agent "${id}". Supported: ${supportedList()}.`);
      chosen.push(adapter);
    }
    return chosen;
  }

  const detected = await detectAdapters();
  if (!detected.length) {
    throw new Error(
      `No supported agent found on this machine. noslopUI sets up ${ADAPTERS.map((a) => a.label).join(', ')}.\n  For anything else, add the server by hand: ${origin()}/mcp`,
    );
  }

  say(`Found ${detected.map((a) => color.bold(a.label)).join(', ')}.`);
  if (options.yes || !interactive() || detected.length === 1) {
    if (detected.length === 1 && interactive() && !options.yes) {
      if (!(await confirm(`Set up ${color.bold(detected[0]!.label)}?`, true))) throw new Error('Nothing selected, so nothing was changed.');
    }
    return detected;
  }
  if (await confirm(`Set up all ${detected.length}?`, true)) return detected;

  const chosen: Adapter[] = [];
  for (const adapter of detected) {
    if (await confirm(`Set up ${color.bold(adapter.label)}?`, true)) chosen.push(adapter);
  }
  if (!chosen.length) throw new Error('Nothing selected, so nothing was changed.');
  return chosen;
}

export async function init(options: InitOptions): Promise<number> {
  say();
  say(`${color.bold('noslopUI')} ${color.dim('— hand-crafted components and design systems for your agent')}`);
  say();

  const adapters = await chooseAdapters(options);

  // Either a key the user already has, or one issued through the browser.
  let keys: IssuedKey[];
  if (options.key) {
    keys = adapters.map((a) => ({ agent: a.id, label: a.label, name: 'provided key', key: options.key! }));
    step('Using the key you passed with --key.');
  } else {
    const wantSession = !readSession();
    keys = await signIn([...adapters.map((a) => a.id), ...(wantSession ? ['cli'] : [])], options.browser !== false);
    const session = keys.find((k) => k.agent === 'cli');
    if (session) {
      const path = saveSession(session.key);
      hint(`CLI signed in too, for "noslopui search" and "get" — ${path}`);
    }
  }

  say();
  const restartNeeded: string[] = [];
  const skillsWritten = new Map<string, boolean>();
  let skillText: Awaited<ReturnType<typeof fetchSkill>> | null = null;

  for (const adapter of adapters) {
    const issued = keys.find((k) => k.agent === adapter.id);
    if (!issued) throw new Error(`No key was issued for ${adapter.label}.`);

    const result = await adapter.install({ url: mcpUrl(), key: issued.key });
    ok(`${adapter.label}: ${result.replacedExisting ? 'updated' : 'added'} the noslopui server`);
    hint(`config ${result.configPath}`);
    if (result.backupPath) hint(`backup ${result.backupPath}`);
    hint(`key    ${maskKey(issued.key)} — named "${issued.name}" on your account`);
    restartNeeded.push(adapter.label);

    if (!options.skill) continue;
    const path = adapter.skillPath();
    if (!path) {
      hint(`skill  ${adapter.label} has no skills folder; the rules reach it through the server`);
      continue;
    }
    // Several agents read one folder (~/.agents/skills); write it once.
    if (!skillsWritten.has(path)) {
      skillText ??= await fetchSkill();
      const skill = await adapter.installSkill(skillText.markdown);
      skillsWritten.set(path, skill?.changed ?? false);
      if (skillText.source === 'bundled') {
        warn('That skill came from this package, not the site — it may be behind. Run "npx noslopui update" when you are back online.');
      }
    }
    ok(`${adapter.label}: ${skillsWritten.get(path) ? 'installed' : 'already had'} the noslopUI skill`);
    hint(`skill  ${path}`);
  }

  say();
  say(color.bold('Done. Two things:'));
  say(`  1. Restart ${restartNeeded.join(', ')} so ${restartNeeded.length === 1 ? 'it picks' : 'they pick'} up the new server.`);
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
