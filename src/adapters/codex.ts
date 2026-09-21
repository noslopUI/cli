// Codex (the CLI, the IDE extension and the app share one config).
//
// User-level MCP servers live in `~/.codex/config.toml`, one table each:
//
//   [mcp_servers.noslopui]
//   url = "https://noslopui.com/api/mcp"
//   http_headers = { "Authorization" = "Bearer nsui_…" }
//
// Checked against learn.chatgpt.com/docs/extend/mcp (2026-09-21): `url`,
// `http_headers` (a static map) and `bearer_token_env_var` are all supported.
// We write the static header, like every other agent, so the key lives in the
// config and nowhere else — an env var would have to be set in every shell
// Codex is ever started from, which is exactly the fragility this tool exists
// to remove.
//
// NO TOML PARSER. This package has zero runtime dependencies, so instead of
// parsing the file we edit one table and leave every other byte as it was:
// find `[mcp_servers.noslopui]` (and any `[mcp_servers.noslopui.*]`
// sub-tables), replace our keys in it, keep any other key the user put there.
// If our server appears in a form we don't recognise — an inline table under
// `[mcp_servers]`, or a dotted key — we stop and say so, rather than guess.
// Skills: Codex reads user-level skills from ~/.agents/skills
// (learn.chatgpt.com/docs/build-skills).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, InstallResult, ServerEntry, SkillResult, StatusResult } from './types.js';
import { backupFile, ConfigUnreadableError, writeTextFile } from '../lib/json-file.js';
import { home, onPath, sharedSkillPath } from '../lib/paths.js';
import { installSkillAt, removeSkillAt } from '../lib/skill-file.js';
import { SERVER_NAME } from './json-adapter.js';

/** `[mcp_servers.noslopui]` or one of its sub-tables, in any quoting TOML allows. */
const OUR_HEADER = new RegExp(`^\\s*\\[\\s*mcp_servers\\s*\\.\\s*(?:${SERVER_NAME}|"${SERVER_NAME}"|'${SERVER_NAME}')\\s*(\\]|\\.)`);
/** `[mcp_servers.noslopui.http_headers]` — replaced by our inline map, or TOML would see the key twice. */
const OUR_HEADERS_SUBTABLE = new RegExp(`^\\s*\\[\\s*mcp_servers\\s*\\.\\s*["']?${SERVER_NAME}["']?\\s*\\.\\s*["']?http_headers["']?\\s*\\]`);
const ANY_HEADER = /^\s*\[/;
/** Our server declared some other way: `noslopui = {…}` or `mcp_servers.noslopui.url = …`. */
const FOREIGN_FORM = new RegExp(`^\\s*(?:mcp_servers\\s*\\.\\s*)?["']?${SERVER_NAME}["']?\\s*(?:=|\\.)`);
/** Keys we own inside our table; every other key the user wrote there is kept. */
const OUR_KEYS = /^\s*(url|http_headers|bearer_token_env_var)\s*=/;

const tomlString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

type Parsed = {
  lines: string[];
  eol: string;
  /** Line ranges [start, end) of our table and its sub-tables. */
  blocks: Array<[number, number]>;
};

function parse(path: string): Parsed | null {
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ConfigUnreadableError(path, err);
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const blocks: Array<[number, number]> = [];
  let open: number | null = null;
  lines.forEach((line, i) => {
    if (ANY_HEADER.test(line)) {
      if (open !== null) {
        blocks.push([open, i]);
        open = null;
      }
      if (OUR_HEADER.test(line)) open = i;
      return;
    }
    if (open === null && !line.trim().startsWith('#') && FOREIGN_FORM.test(line)) {
      throw new ConfigUnreadableError(path, new Error(`"${SERVER_NAME}" is declared in a form this tool doesn't edit`));
    }
  });
  if (open !== null) blocks.push([open, lines.length]);
  return { lines, eol, blocks };
}

function ourLines(parsed: Parsed): string[] {
  return parsed.blocks.flatMap(([a, b]) => parsed.lines.slice(a, b));
}

export class CodexAdapter implements Adapter {
  readonly id = 'codex';
  readonly label = 'Codex';

  configPath(): string {
    return join(home(), '.codex', 'config.toml');
  }

  skillPath(): string {
    return sharedSkillPath();
  }

  async detect(): Promise<boolean> {
    try {
      return onPath('codex') || existsSync(join(home(), '.codex'));
    } catch {
      return false;
    }
  }

  async install(entry: ServerEntry): Promise<InstallResult> {
    const path = this.configPath();
    const parsed = parse(path);
    const backupPath = backupFile(path);
    const lines = parsed?.lines ?? [];
    const eol = parsed?.eol ?? '\n';
    const blocks = parsed?.blocks ?? [];
    const replacedExisting = blocks.length > 0;

    // Keys the user added to our main table (enabled, tool_timeout_sec, …)
    // and any sub-table other than http_headers survive the rewrite.
    const kept: string[] = [];
    const keptSubtables: string[] = [];
    for (const [a, b] of blocks) {
      const header = lines[a] ?? '';
      const body = lines.slice(a + 1, b);
      if (OUR_HEADERS_SUBTABLE.test(header)) continue;
      if (/\]\s*(#.*)?$/.test(header) && new RegExp(`${SERVER_NAME}["']?\\s*\\]`).test(header)) {
        kept.push(...body.filter((l) => !OUR_KEYS.test(l)));
      } else {
        keptSubtables.push(header, ...body);
      }
    }
    while (kept.length && !kept[kept.length - 1]!.trim()) kept.pop();

    const block = [
      `[mcp_servers.${SERVER_NAME}]`,
      `url = ${tomlString(entry.url)}`,
      `http_headers = { "Authorization" = ${tomlString(`Bearer ${entry.key}`)} }`,
      ...kept,
      '',
      ...keptSubtables,
    ];
    while (block.length && !block[block.length - 1]!.trim()) block.pop();

    let out: string[];
    if (blocks.length) {
      const first = blocks[0]![0];
      const inBlocks = (i: number) => blocks.some(([a, b]) => i >= a && i < b);
      out = [...lines.slice(0, first).filter((_, i) => !inBlocks(i)), ...block, '', ...lines.slice(first).filter((_, j) => !inBlocks(first + j))];
    } else {
      const body = [...lines];
      while (body.length && !body[body.length - 1]!.trim()) body.pop();
      out = body.length ? [...body, '', ...block] : [...block];
    }
    while (out.length && !out[out.length - 1]!.trim()) out.pop();
    writeTextFile(path, out.join(eol) + eol);

    const after = await this.status();
    if (!after.installed || after.url !== entry.url || !after.hasKey) {
      throw new Error(`The entry was written to ${path} but reading it back didn't show it.`);
    }
    return { configPath: path, backupPath, method: 'config-file', replacedExisting };
  }

  async status(): Promise<StatusResult> {
    const path = this.configPath();
    const parsed = parse(path);
    if (!parsed || !parsed.blocks.length) return { installed: false, configPath: path, url: null, hasKey: false };
    const text = ourLines(parsed).join('\n');
    const url = text.match(/^\s*url\s*=\s*"([^"]*)"/m)?.[1] ?? null;
    const hasKey = /"?Authorization"?\s*=\s*"Bearer\s+\S+"/i.test(text) || /^\s*bearer_token_env_var\s*=/m.test(text);
    let problem: string | undefined;
    if (!url) problem = 'The entry has no url.';
    else if (!hasKey) problem = 'The entry has no Authorization header, so Codex will be asked to sign in ("codex mcp login noslopui").';
    return { installed: true, configPath: path, url, hasKey, ...(problem ? { problem } : {}) };
  }

  async configuredKey(): Promise<string | null> {
    try {
      const parsed = parse(this.configPath());
      if (!parsed) return null;
      return ourLines(parsed).join('\n').match(/"?Authorization"?\s*=\s*"Bearer\s+([^"\s]+)"/i)?.[1] ?? null;
    } catch {
      return null;
    }
  }

  async uninstall(): Promise<boolean> {
    const path = this.configPath();
    const parsed = parse(path);
    if (!parsed || !parsed.blocks.length) return false;
    backupFile(path);
    const inBlocks = (i: number) => parsed.blocks.some(([a, b]) => i >= a && i < b);
    const out = parsed.lines.filter((_, i) => !inBlocks(i));
    // Collapse the blank lines our table leaves behind.
    const tidy = out.filter((l, i) => l.trim() || (out[i - 1]?.trim() ?? '') !== '');
    while (tidy.length && !tidy[tidy.length - 1]!.trim()) tidy.pop();
    writeTextFile(path, tidy.length ? tidy.join(parsed.eol) + parsed.eol : '');
    return true;
  }

  async installSkill(markdown: string): Promise<SkillResult> {
    return installSkillAt(this.skillPath(), markdown);
  }

  async removeSkill(): Promise<boolean> {
    return removeSkillAt(this.skillPath());
  }
}
