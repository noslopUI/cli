// Reading and writing a config file that belongs to somebody else.
//
// The rules this file exists to enforce, in order of how badly they'd hurt:
//
//   1. If the file doesn't parse, STOP. Never overwrite a config we couldn't
//      read — `~/.claude.json` carries onboarding state, project history and
//      every other MCP server the user has set up. Rewriting it from scratch
//      because we couldn't parse it would be the worst thing this tool could
//      possibly do.
//   2. Back up before the first write, and tell the user where the backup is.
//   3. Merge. Only our own key changes; every sibling is written back exactly
//      as it was read.
//   4. Write atomically — a temp file in the same directory, then rename — so
//      a crash or a full disk can't leave a half-written config behind.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

export class ConfigUnreadableError extends Error {
  constructor(
    readonly path: string,
    readonly cause_: unknown,
  ) {
    const why = cause_ instanceof Error && cause_.message ? ` (${cause_.message})` : '';
    super(`${path} couldn't be read safely${why}, so it was left untouched.`);
    this.name = 'ConfigUnreadableError';
  }
}

export type JsonObject = Record<string, unknown>;

/** Reads a JSON object, or `null` when the file simply isn't there yet. */
export function readJsonFile(path: string): JsonObject | null {
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ConfigUnreadableError(path, err);
  }
  if (!raw.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigUnreadableError(path, err);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigUnreadableError(path, new Error('top level is not an object'));
  }
  return parsed as JsonObject;
}

/**
 * A timestamped copy beside the original: `.claude.json.noslopui-backup-<ts>`.
 * Beside it rather than in a temp directory so the user can find it without
 * being told twice, and timestamped so a second run can't clobber the first
 * backup — which would defeat the point of having one.
 */
export function backupFile(path: string): string | null {
  if (!existsSync(path)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${path}.noslopui-backup-${stamp}`;
  copyFileSync(path, backup);
  return backup;
}

/** Write via a temp file in the same directory, then rename over the target. */
export function writeJsonFile(path: string, value: JsonObject, { indent = 2 }: { indent?: number } = {}): void {
  writeTextFile(path, `${JSON.stringify(value, null, indent)}\n`);
}

/** The same atomic write for a file that isn't JSON (Codex's config.toml). */
export function writeTextFile(path: string, text: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const temp = join(dir, `.noslopui-write-${process.pid}-${Date.now()}.tmp`);
  try {
    writeFileSync(temp, text, 'utf8');
    renameSync(temp, path);
  } catch (err) {
    try {
      if (existsSync(temp)) unlinkSync(temp);
    } catch {
      // The rename is what matters; a stray temp file is not worth a second error.
    }
    throw err;
  }
}

/** Indentation of an existing file, so we write it back the way we found it. */
export function detectIndent(path: string): number {
  try {
    const raw = readFileSync(path, 'utf8');
    const match = raw.match(/\n(\s+)"/);
    if (match?.[1] && !match[1].includes('\t')) return match[1].length;
  } catch {
    // Not worth failing a write over; fall through to the default.
  }
  return 2;
}
