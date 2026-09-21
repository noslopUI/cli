// The shared shape of every agent whose MCP config is a JSON file.
//
// Seven of the eight agents keep their servers in a JSON object keyed by
// server name; they differ only in where the file is, what the object is
// called (`mcpServers`, `servers`, `mcp`), and which fields a remote server
// takes (`url` or `serverUrl`, plus `type: "http"`, `transport: "http"` or
// `type: "remote"`). Each adapter states those facts and nothing else; the
// rules for editing a file we don't own live here once, in `lib/json-file.ts`
// underneath:
//
//   · back up before the first write, merge, never touch another entry
//   · keep fields on our own entry that we didn't put there
//   · write atomically, and stop cold on a file that doesn't parse
//   · read the entry back — several of these files have another writer

import { existsSync } from 'node:fs';
import type { Adapter, InstallResult, ServerEntry, SkillResult, StatusResult } from './types.js';
import { backupFile, detectIndent, readJsonFile, writeJsonFile, type JsonObject } from '../lib/json-file.js';
import { installSkillAt, removeSkillAt } from '../lib/skill-file.js';
import { onPath } from '../lib/paths.js';

/** The name the server appears under in every agent. */
export const SERVER_NAME = 'noslopui';

export type JsonAdapterSpec = {
  id: string;
  label: string;
  configPath: () => string;
  /** The object holding every server: `mcpServers`, `servers`, `mcp`. */
  container: string;
  /** Which field carries the endpoint on a remote entry. */
  urlField: 'url' | 'serverUrl';
  /** Fields a remote entry needs besides the url and headers, e.g. `{ type: 'http' }`. */
  fixed?: JsonObject;
  /** Files or folders whose presence means the agent is installed. */
  detectPaths: () => string[];
  /** Commands whose presence on PATH means the agent is installed. */
  detectBinaries?: string[];
  /** Where the skill goes, or null for an agent with no skills folder. */
  skillPath: () => string | null;
  /** Said when the read-back doesn't match, e.g. "quit Claude Code first". */
  readBackHint?: string;
};

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

export class JsonConfigAdapter implements Adapter {
  readonly id: string;
  readonly label: string;

  constructor(protected readonly spec: JsonAdapterSpec) {
    this.id = spec.id;
    this.label = spec.label;
  }

  configPath(): string {
    return this.spec.configPath();
  }

  skillPath(): string | null {
    return this.spec.skillPath();
  }

  async detect(): Promise<boolean> {
    try {
      if ((this.spec.detectBinaries ?? []).some(onPath)) return true;
      return this.spec.detectPaths().some((p) => existsSync(p));
    } catch {
      return false;
    }
  }

  async install(entry: ServerEntry): Promise<InstallResult> {
    const path = this.configPath();
    const config = readJsonFile(path) ?? {};
    const backupPath = backupFile(path);

    const servers = isObject(config[this.spec.container]) ? (config[this.spec.container] as JsonObject) : {};
    const replacedExisting = SERVER_NAME in servers;

    // Spread the existing entry so anything the agent (or the user) added to
    // it that we don't know about survives the update.
    const existing = isObject(servers[SERVER_NAME]) ? (servers[SERVER_NAME] as JsonObject) : {};
    const existingHeaders = isObject(existing.headers) ? existing.headers : {};
    // The other spelling of the url field would be read instead of ours by an
    // agent that accepts both, so it goes.
    const { url: _url, serverUrl: _serverUrl, ...rest } = existing;

    servers[SERVER_NAME] = {
      ...rest,
      ...(this.spec.fixed ?? {}),
      [this.spec.urlField]: entry.url,
      headers: { ...existingHeaders, Authorization: `Bearer ${entry.key}` },
    };
    config[this.spec.container] = servers;

    writeJsonFile(path, config, { indent: existsSync(path) ? detectIndent(path) : 2 });

    // Read back: a successful write is not the same as a config that says
    // what we think it says, when something else may rewrite the file.
    const after = await this.status();
    if (!after.installed || after.url !== entry.url || !after.hasKey) {
      throw new Error(
        `The entry was written to ${path} but reading it back didn't show it.${this.spec.readBackHint ? ` ${this.spec.readBackHint}` : ''}`,
      );
    }
    return { configPath: path, backupPath, method: 'config-file', replacedExisting };
  }

  async status(): Promise<StatusResult> {
    const path = this.configPath();
    const config = readJsonFile(path);
    const servers = config && isObject(config[this.spec.container]) ? (config[this.spec.container] as JsonObject) : null;
    const entry = servers && isObject(servers[SERVER_NAME]) ? (servers[SERVER_NAME] as JsonObject) : null;
    if (!entry) return { installed: false, configPath: path, url: null, hasKey: false };

    const raw = entry[this.spec.urlField];
    const url = typeof raw === 'string' ? raw : null;
    const headers = isObject(entry.headers) ? entry.headers : {};
    const auth = typeof headers.Authorization === 'string' ? headers.Authorization : '';
    const hasKey = /^Bearer\s+\S+/i.test(auth);

    let problem: string | undefined;
    if (!url) problem = `The entry has no "${this.spec.urlField}".`;
    else if (!hasKey) problem = 'The entry has no Authorization header, so the agent will be asked to sign in.';
    else {
      for (const [field, value] of Object.entries(this.spec.fixed ?? {})) {
        if (entry[field] !== value) {
          problem = `The entry's ${field} is "${String(entry[field])}", expected "${String(value)}".`;
          break;
        }
      }
    }
    return { installed: true, configPath: path, url, hasKey, ...(problem ? { problem } : {}) };
  }

  async configuredKey(): Promise<string | null> {
    try {
      const config = readJsonFile(this.configPath());
      const servers = config && isObject(config[this.spec.container]) ? (config[this.spec.container] as JsonObject) : null;
      const entry = servers && isObject(servers[SERVER_NAME]) ? (servers[SERVER_NAME] as JsonObject) : null;
      const headers = entry && isObject(entry.headers) ? entry.headers : {};
      const auth = typeof headers.Authorization === 'string' ? headers.Authorization : '';
      return auth.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
    } catch {
      return null;
    }
  }

  async uninstall(): Promise<boolean> {
    const path = this.configPath();
    const config = readJsonFile(path);
    const servers = config && isObject(config[this.spec.container]) ? (config[this.spec.container] as JsonObject) : null;
    if (!config || !servers || !(SERVER_NAME in servers)) return false;

    backupFile(path);
    delete servers[SERVER_NAME];
    writeJsonFile(path, config, { indent: detectIndent(path) });
    return true;
  }

  async installSkill(markdown: string): Promise<SkillResult | null> {
    const path = this.skillPath();
    return path ? installSkillAt(path, markdown) : null;
  }

  async removeSkill(): Promise<boolean> {
    const path = this.skillPath();
    return path ? removeSkillAt(path) : false;
  }
}
