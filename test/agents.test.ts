// Every JSON-config agent, against fixture configs in a throwaway HOME.
//
// One table, one set of promises: whatever file an agent keeps, installing
// noslopUI must add exactly our entry in that agent's shape, leave every
// neighbour and unrelated key alone, refuse a file it can't parse, and take
// only our entry back out. Claude Code has its own, older suite
// (claude-code.test.ts); Codex's TOML has codex.test.ts.

import { deepStrictEqual, ok as assertOk, strictEqual } from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { antigravity, cursor, devin, opencode, vscode, windsurf } from '../src/adapters/json-agents.js';
import { ADAPTERS } from '../src/adapters/index.js';
import { CodexAdapter } from '../src/adapters/codex.js';
import type { JsonConfigAdapter } from '../src/adapters/json-adapter.js';
import { ConfigUnreadableError } from '../src/lib/json-file.js';
import { remove } from '../src/commands/remove.js';

const URL_A = 'https://noslopui.com/api/mcp';
const KEY_A = 'nsui_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const KEY_B = 'nsui_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const MARKDOWN = '---\nname: noslopui\n---\n\nrules\n';

let home: string;
const saved: Record<string, string | undefined> = {};
const ENV = ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME'] as const;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'noslopui-agents-'));
  for (const k of ENV) saved[k] = process.env[k];
  // Every path an adapter can reach starts from one of these, so pointing all
  // of them into the temp dir means no test can touch the real machine.
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.APPDATA = join(home, 'AppData', 'Roaming');
  process.env.XDG_CONFIG_HOME = join(home, '.config');
  strictEqual(homedir(), home, 'the test HOME did not take effect');
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

type Case = {
  make: () => JsonConfigAdapter;
  container: string;
  /** Our entry exactly as the agent's docs describe it. */
  expected: (url: string, key: string) => Record<string, unknown>;
};

const CASES: Case[] = [
  { make: cursor, container: 'mcpServers', expected: (url, key) => ({ url, headers: { Authorization: `Bearer ${key}` } }) },
  { make: vscode, container: 'servers', expected: (url, key) => ({ type: 'http', url, headers: { Authorization: `Bearer ${key}` } }) },
  { make: devin, container: 'mcpServers', expected: (url, key) => ({ transport: 'http', url, headers: { Authorization: `Bearer ${key}` } }) },
  { make: windsurf, container: 'mcpServers', expected: (url, key) => ({ serverUrl: url, headers: { Authorization: `Bearer ${key}` } }) },
  {
    make: opencode,
    container: 'mcp',
    expected: (url, key) => ({ type: 'remote', enabled: true, url, headers: { Authorization: `Bearer ${key}` } }),
  },
  { make: antigravity, container: 'mcpServers', expected: (url, key) => ({ serverUrl: url, headers: { Authorization: `Bearer ${key}` } }) },
];

const read = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
function write(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8');
}

for (const c of CASES) {
  const label = c.make().label;
  describe(label, () => {
    test('writes into the temp home, never the real one', () => {
      assertOk(c.make().configPath().startsWith(home), c.make().configPath());
      const skill = c.make().skillPath();
      assertOk(!skill || skill.startsWith(home), String(skill));
    });

    test('creates the config with our entry in the documented shape', async () => {
      const a = c.make();
      const result = await a.install({ url: URL_A, key: KEY_A });
      strictEqual(result.replacedExisting, false);
      strictEqual(result.backupPath, null);
      deepStrictEqual(read(a.configPath())[c.container].noslopui, c.expected(URL_A, KEY_A));
    });

    test('leaves every other server and every unrelated key exactly as it was', async () => {
      const a = c.make();
      const neighbours = {
        other: { url: 'https://other.test/mcp', headers: { Authorization: 'Bearer someone-elses' } },
        local: { command: 'npx', args: ['-y', 'thing'] },
      };
      write(a.configPath(), { theme: 'dark', [c.container]: neighbours });
      const result = await a.install({ url: URL_A, key: KEY_A });
      const after = read(a.configPath());
      strictEqual(after.theme, 'dark');
      deepStrictEqual(after[c.container].other, neighbours.other);
      deepStrictEqual(after[c.container].local, neighbours.local);
      assertOk(result.backupPath && existsSync(result.backupPath), 'no backup');
    });

    test('re-installing swaps the key, keeps fields we did not add, drops the other url spelling', async () => {
      const a = c.make();
      write(a.configPath(), {
        [c.container]: { noslopui: { url: 'https://old.test', serverUrl: 'https://old.test', timeout: 9000, headers: { 'X-Mine': '1', Authorization: `Bearer ${KEY_A}` } } },
      });
      const result = await a.install({ url: URL_A, key: KEY_B });
      strictEqual(result.replacedExisting, true);
      const entry = read(a.configPath())[c.container].noslopui;
      strictEqual(entry.timeout, 9000);
      strictEqual(entry.headers['X-Mine'], '1');
      strictEqual(entry.headers.Authorization, `Bearer ${KEY_B}`);
      const other = 'url' in c.expected(URL_A, KEY_A) ? 'serverUrl' : 'url';
      assertOk(!(other in entry), `the ${other} spelling survived`);
    });

    test('refuses a config it cannot parse, and changes nothing', async () => {
      const a = c.make();
      write(a.configPath(), '{ "broken": ');
      let threw = false;
      try {
        await a.install({ url: URL_A, key: KEY_A });
      } catch (err) {
        threw = err instanceof ConfigUnreadableError;
      }
      assertOk(threw, 'expected ConfigUnreadableError');
      strictEqual(readFileSync(a.configPath(), 'utf8'), '{ "broken": ');
    });

    test('status and configuredKey report the key without status leaking it', async () => {
      const a = c.make();
      await a.install({ url: URL_A, key: KEY_A });
      const status = await a.status();
      strictEqual(status.installed, true);
      strictEqual(status.url, URL_A);
      strictEqual(status.hasKey, true);
      strictEqual(status.problem, undefined);
      assertOk(!JSON.stringify(status).includes(KEY_A), 'status leaked the key');
      strictEqual(await a.configuredKey(), KEY_A);
    });

    test('uninstall removes only our entry', async () => {
      const a = c.make();
      write(a.configPath(), { keep: true, [c.container]: { other: { url: 'https://other.test' } } });
      await a.install({ url: URL_A, key: KEY_A });
      strictEqual(await a.uninstall(), true);
      const after = read(a.configPath());
      deepStrictEqual(after[c.container], { other: { url: 'https://other.test' } });
      strictEqual(after.keep, true);
      strictEqual(await a.uninstall(), false, 'a second uninstall should be a no-op');
    });

    test('is detected by its config folder', async () => {
      // An empty PATH, so the agent's own command on the test machine (VS
      // Code's `code`, say) can't answer for the folder.
      const path = process.env.PATH;
      process.env.PATH = '';
      try {
        const a = c.make();
        strictEqual(await a.detect(), false, 'detected with nothing there');
        mkdirSync(dirname(a.configPath()), { recursive: true });
        strictEqual(await a.detect(), true);
      } finally {
        process.env.PATH = path;
      }
    });
  });
}

describe('skills folders', () => {
  test('Codex, Cursor, OpenCode and VS Code share ~/.agents/skills', () => {
    const shared = join(home, '.agents', 'skills', 'noslopui', 'SKILL.md');
    for (const a of [new CodexAdapter(), cursor(), opencode(), vscode()]) strictEqual(a.skillPath(), shared, a.label);
  });

  test('Devin and Windsurf share ~/.codeium/windsurf/skills; Antigravity uses ~/.gemini/config/skills', () => {
    const codeium = join(home, '.codeium', 'windsurf', 'skills', 'noslopui', 'SKILL.md');
    strictEqual(devin().skillPath(), codeium);
    strictEqual(windsurf().skillPath(), codeium);
    strictEqual(antigravity().skillPath(), join(home, '.gemini', 'config', 'skills', 'noslopui', 'SKILL.md'));
  });

  test('removing one agent keeps a shared skill another configured agent still reads', async () => {
    const c = cursor();
    const x = new CodexAdapter();
    await c.install({ url: URL_A, key: KEY_A });
    await x.install({ url: URL_A, key: KEY_A });
    await c.installSkill(MARKDOWN);
    await remove({ yes: true, skill: true, agents: ['cursor'] });
    assertOk(existsSync(c.skillPath()!), 'the shared skill was removed while Codex still uses it');
    await remove({ yes: true, skill: true, agents: ['codex'] });
    assertOk(!existsSync(c.skillPath()!), 'the skill should go once nothing uses it');
  });
});

describe('registry', () => {
  test('eight agents, unique ids, matching the server list', () => {
    const ids = ADAPTERS.map((a) => a.id);
    deepStrictEqual(ids, ['claude-code', 'codex', 'cursor', 'vscode', 'devin', 'windsurf', 'opencode', 'antigravity']);
    strictEqual(new Set(ids).size, ids.length);
  });
});
