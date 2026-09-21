// The CLI's own sign-in — what `noslopui search`, `get` and `whoami` use.
//
// It's an ordinary noslopUI API key, issued for the agent id `cli` by the same
// browser approval `init` uses, and named after this machine on the account
// page, where it can be revoked like any other. It's stored in the user's
// config folder with owner-only permissions, and never printed in full.
//
// Agent keys stay in each agent's own config; this file is only the CLI's.

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { appData, xdgConfig } from './paths.js';

export type Session = { key: string; savedAt: string };

export function sessionPath(): string {
  const dir = process.platform === 'win32' ? join(appData(), 'noslopui') : join(xdgConfig(), 'noslopui');
  return join(dir, 'credentials.json');
}

export function readSession(): Session | null {
  if (process.env.NOSLOPUI_API_KEY) return { key: process.env.NOSLOPUI_API_KEY, savedAt: 'env' };
  const path = sessionPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return typeof parsed?.key === 'string' && parsed.key ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(key: string): string {
  const path = sessionPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ key, savedAt: new Date().toISOString() }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    // mode only applies when the file is created; tighten an existing one too.
    chmodSync(path, 0o600);
  } catch {
    // Windows ignores POSIX modes; the file is under the user's own profile.
  }
  return path;
}

export function clearSession(): boolean {
  const path = sessionPath();
  if (!existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
}
