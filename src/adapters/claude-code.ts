// Claude Code.
//
// User-level MCP servers live at the top level of `~/.claude.json`, under
// `mcpServers`, as `{ type: 'http', url, headers }`. Project-scoped ones live
// under `projects["<path>"].mcpServers` — we never write there: a key in a
// project file is a key that gets committed.
//
// WHY WE WRITE THE FILE RATHER THAN SHELLING OUT TO `claude mcp add`:
// the documented command takes the key as `--header "Authorization: Bearer …"`,
// which puts the key in the process list for as long as the command runs,
// where any other process on the machine can read it. Writing the file
// ourselves keeps the key in two places only — the config and the account.
// The format is small and we verify our write by reading it back.
//
// KNOWN LIMITATION: `~/.claude.json` is also Claude Code's own state file, and
// a running Claude Code rewrites it from memory on all sorts of events. If it
// is open while this runs, it can overwrite our entry when it next saves.
// That's why install tells the user to quit Claude Code first, and why
// `doctor` re-checks rather than trusting that the write stuck.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import type { Adapter, InstallResult, ServerEntry, SkillResult, StatusResult } from './types.js';
import { backupFile, detectIndent, readJsonFile, writeJsonFile, type JsonObject } from '../lib/json-file.js';

/** The name the server appears under. Also what the user types: `/mcp__noslopui__build_ui`. */
export const SERVER_NAME = 'noslopui';
const SKILL_DIR_NAME = 'noslopui';

function onPath(binary: string): boolean {
  const paths = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const suffixes = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of paths) {
    for (const suffix of suffixes) {
      try {
        if (existsSync(join(dir, binary + suffix))) return true;
      } catch {
        // An unreadable PATH entry is not our problem; keep looking.
      }
    }
  }
  return false;
}

export class ClaudeCodeAdapter implements Adapter {
  readonly id = 'claude-code';
  readonly label = 'Claude Code';

  configPath(): string {
    return join(homedir(), '.claude.json');
  }

  skillPath(): string {
    return join(homedir(), '.claude', 'skills', SKILL_DIR_NAME, 'SKILL.md');
  }

  async detect(): Promise<boolean> {
    try {
      return onPath('claude') || existsSync(this.configPath()) || existsSync(join(homedir(), '.claude'));
    } catch {
      return false;
    }
  }

  async install(entry: ServerEntry): Promise<InstallResult> {
    const path = this.configPath();
    const config = readJsonFile(path) ?? {};
    const backupPath = backupFile(path);

    const servers = (
      typeof config.mcpServers === 'object' && config.mcpServers !== null && !Array.isArray(config.mcpServers)
        ? config.mcpServers
        : {}
    ) as JsonObject;
    const replacedExisting = SERVER_NAME in servers;

    // Spread the existing entry so anything Claude Code (or the user) added to
    // it that we don't know about survives the update.
    const existing = (typeof servers[SERVER_NAME] === 'object' && servers[SERVER_NAME] !== null ? servers[SERVER_NAME] : {}) as JsonObject;
    const existingHeaders = (typeof existing.headers === 'object' && existing.headers !== null ? existing.headers : {}) as JsonObject;

    servers[SERVER_NAME] = {
      ...existing,
      type: 'http',
      url: entry.url,
      headers: { ...existingHeaders, Authorization: `Bearer ${entry.key}` },
    };
    config.mcpServers = servers;

    writeJsonFile(path, config, { indent: existsSync(path) ? detectIndent(path) : 2 });

    // Read back: this file has another writer, so a successful write is not
    // the same as a config that says what we think it says.
    const after = await this.status();
    if (!after.installed || after.url !== entry.url || !after.hasKey) {
      throw new Error(
        `The entry was written to ${path} but reading it back didn't show it. If Claude Code is running, quit it and run this again.`,
      );
    }
    return { configPath: path, backupPath, method: 'config-file', replacedExisting };
  }

  async status(): Promise<StatusResult> {
    const path = this.configPath();
    const config = readJsonFile(path);
    if (!config) return { installed: false, configPath: path, url: null, hasKey: false };

    const servers = config.mcpServers as JsonObject | undefined;
    const entry = servers?.[SERVER_NAME] as JsonObject | undefined;
    if (!entry) return { installed: false, configPath: path, url: null, hasKey: false };

    const url = typeof entry.url === 'string' ? entry.url : null;
    const headers = (entry.headers ?? {}) as JsonObject;
    const auth = typeof headers.Authorization === 'string' ? headers.Authorization : '';
    const hasKey = /^Bearer\s+\S+/i.test(auth);

    let problem: string | undefined;
    if (!url) problem = 'The entry has no url.';
    else if (!hasKey) problem = 'The entry has no Authorization header, so gated tools will be refused.';
    else if (entry.type !== 'http') problem = `The entry's type is "${String(entry.type)}", expected "http".`;

    return { installed: true, configPath: path, url, hasKey, ...(problem ? { problem } : {}) };
  }

  async uninstall(): Promise<boolean> {
    const path = this.configPath();
    const config = readJsonFile(path);
    if (!config) return false;
    const servers = config.mcpServers as JsonObject | undefined;
    if (!servers || !(SERVER_NAME in servers)) return false;

    backupFile(path);
    delete servers[SERVER_NAME];
    writeJsonFile(path, config, { indent: detectIndent(path) });
    return true;
  }

  async installSkill(markdown: string): Promise<SkillResult> {
    const path = this.skillPath();
    if (existsSync(path)) {
      try {
        if (readFileSync(path, 'utf8') === markdown) return { path, changed: false };
      } catch {
        // Unreadable but present: fall through and replace it.
      }
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown, 'utf8');
    return { path, changed: true };
  }

  async removeSkill(): Promise<boolean> {
    const path = this.skillPath();
    if (!existsSync(path)) return false;
    // Only our own folder, and only because we created it.
    rmSync(dirname(path), { recursive: true, force: true });
    return true;
  }
}
