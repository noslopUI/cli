// Talking to noslopui.com: the device-code sign-in, and a health probe for
// `doctor`. Everything here is plain fetch against documented endpoints.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLI_VERSION } from './version.js';

export const DEFAULT_ORIGIN = 'https://noslopui.com';

/**
 * Identify ourselves on every request. A tool that talks to a server should
 * say what it is: it makes our own logs readable, and it gives anything
 * sitting in front of the server (a CDN, a bot filter) something honest to
 * recognise instead of a bare runtime default.
 */
export const USER_AGENT = `noslopui-cli/${CLI_VERSION} (+https://github.com/noslopUI/cli)`;

/** Overridable so the flow can be exercised against a local server in tests. */
export const origin = (): string => (process.env.NOSLOPUI_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');

export const mcpUrl = (): string => `${origin()}/api/mcp`;

export type IssuedKey = { agent: string; label: string; name: string; key: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  let res: Response;
  try {
    res = await fetch(`${origin()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(`Could not reach ${origin()}. Check your connection, then run the command again.`);
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // A proxy or captive portal answering instead of us.
    throw new ApiError(`${origin()} returned something that isn't JSON (HTTP ${res.status}).`, res.status);
  }
  return { status: res.status, json };
}

export type StartedSignIn = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

export async function startSignIn(clientName: string, agents: string[]): Promise<StartedSignIn> {
  const { status, json } = await post('/api/cli/auth/start', { clientName, agents });
  if (status !== 201) throw new ApiError(json?.message ?? `Sign-in could not be started (HTTP ${status}).`, status);
  return json as StartedSignIn;
}

export type PollOutcome =
  | { done: false }
  | { done: true; keys: IssuedKey[] };

/** One poll. Everything that isn't "keep waiting" is thrown, with the server's own wording. */
export async function pollSignIn(deviceCode: string): Promise<PollOutcome> {
  const { status, json } = await post('/api/cli/auth/poll', { deviceCode });
  if (status === 200 && json?.status === 'approved') return { done: true, keys: json.keys as IssuedKey[] };
  if (status === 200) return { done: false }; // pending, or told to slow down
  throw new ApiError(json?.message ?? `Sign-in failed (HTTP ${status}).`, status);
}

/**
 * Waits for the browser half to finish. Polls on the interval the server asked
 * for, and gives up when the code the user is looking at has expired.
 */
export async function waitForApproval(started: StartedSignIn, onTick?: (secondsLeft: number) => void): Promise<IssuedKey[]> {
  const deadline = Date.now() + started.expiresIn * 1000;
  const intervalMs = Math.max(1, started.interval) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const outcome = await pollSignIn(started.deviceCode);
    if (outcome.done) return outcome.keys;
    onTick?.(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
  }
  throw new ApiError('The code expired before it was approved. Run the command again to get a new one.');
}

export type ServerCheck = { reachable: boolean; detail: string; keyState?: 'ok' | 'rejected'; keyDetail?: string };

/**
 * `doctor`'s probe: can we reach the MCP server, and does this key still work?
 * Uses list_collections because it's the one gated tool that costs the account
 * nothing — no trial clock, no fair-use count.
 */
export async function checkServer(key?: string): Promise<ServerCheck> {
  let res: Response;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2025-06-18',
    'user-agent': USER_AGENT,
  };
  if (key) headers.authorization = `Bearer ${key}`;
  try {
    res = await fetch(mcpUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: key ? 'tools/call' : 'tools/list',
        params: key ? { name: 'list_collections', arguments: {} } : {},
      }),
    });
  } catch {
    return { reachable: false, detail: `Could not reach ${mcpUrl()}.` };
  }
  if (!res.ok) return { reachable: false, detail: `${mcpUrl()} answered HTTP ${res.status}.` };

  const text = await res.text();
  const line = text.split(/\r?\n/).filter((l) => l.startsWith('data: ')).pop();
  let json: any = null;
  try {
    json = JSON.parse(line ? line.slice(6) : text);
  } catch {
    return { reachable: false, detail: 'The server answered with something unreadable.' };
  }
  if (!key) return { reachable: true, detail: `${(json?.result?.tools ?? []).length} tools available.` };

  const isError = json?.result?.isError === true;
  const body: string = json?.result?.content?.[0]?.text ?? '';
  if (isError) {
    // The server writes these for an agent to relay; they're already the right
    // words for a person, so pass them through rather than inventing our own.
    return { reachable: true, detail: 'Server reachable.', keyState: 'rejected', keyDetail: body.split('. ')[0] };
  }
  return { reachable: true, detail: 'Server reachable.', keyState: 'ok', keyDetail: 'Key accepted.' };
}

export type SkillDownload = { markdown: string; source: 'server' | 'bundled' };

/**
 * The workflow file. Fetched from the site, because the site is where it's
 * assembled — the same text the MCP server sends as its instructions, so the
 * two can never disagree.
 *
 * The copy shipped in this package is a fallback for an unreachable site, not
 * an equal: it's only as fresh as the last publish, so the caller says so.
 */
export async function fetchSkill(): Promise<SkillDownload> {
  try {
    const res = await fetch(`${origin()}/skill/SKILL.md`, { headers: { 'user-agent': USER_AGENT } });
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith('---')) return { markdown: text, source: 'server' };
    }
  } catch {
    // Fall through to the bundled copy.
  }
  const bundled = bundledSkill();
  if (bundled) return { markdown: bundled, source: 'bundled' };
  throw new ApiError(`Could not download the skill from ${origin()}, and this package has no copy to fall back on.`);
}

function bundledSkill(): string | null {
  try {
    // dist/lib/api.js → the package root.
    return readFileSync(fileURLToPath(new URL('../../SKILL.md', import.meta.url)), 'utf8');
  } catch {
    return null;
  }
}
