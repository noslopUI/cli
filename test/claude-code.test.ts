// The adapter's contract, against fixture configs in a throwaway HOME.
//
// These tests exist for one reason: this tool edits a file it doesn't own,
// which holds the user's other MCP servers and Claude Code's own state. Every
// test here is a way that could go wrong.

import { deepStrictEqual, ok as assertOk, strictEqual, throws, match } from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { ClaudeCodeAdapter, SERVER_NAME } from '../src/adapters/claude-code.js';
import { ConfigUnreadableError } from '../src/lib/json-file.js';

const URL_A = 'https://noslopui.com/api/mcp';
const KEY_A = 'nsui_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const KEY_B = 'nsui_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

let home: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

/** A config shaped like the real thing: our neighbours, and Claude Code's own state. */
function writeConfig(value: unknown) {
  writeFileSync(join(home, '.claude.json'), JSON.stringify(value, null, 2), 'utf8');
}
function readConfig(): any {
  return JSON.parse(readFileSync(join(home, '.claude.json'), 'utf8'));
}
const adapter = () => new ClaudeCodeAdapter();

const POPULATED = {
  numStartups: 412,
  userID: 'abc123',
  projects: {
    'C:/work/thing': { mcpServers: { 'project-only': { type: 'http', url: 'https://example.test/mcp' } }, history: ['a', 'b'] },
  },
  mcpServers: {
    'chrome-devtools': { type: 'stdio', command: 'npx', args: ['-y', 'chrome-devtools-mcp'] },
    other: { type: 'http', url: 'https://other.test/mcp', headers: { Authorization: 'Bearer someone-elses-key' } },
  },
  hasCompletedOnboarding: true,
};

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'noslopui-test-'));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  // homedir() reads USERPROFILE on Windows and HOME elsewhere.
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  strictEqual(homedir(), home, 'the test HOME did not take effect');
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
});

describe('install', () => {
  test('creates the config when there is none', async () => {
    const result = await adapter().install({ url: URL_A, key: KEY_A });
    strictEqual(result.replacedExisting, false);
    strictEqual(result.backupPath, null, 'nothing existed, so nothing to back up');
    deepStrictEqual(readConfig().mcpServers[SERVER_NAME], {
      type: 'http',
      url: URL_A,
      headers: { Authorization: `Bearer ${KEY_A}` },
    });
  });

  test('leaves every other server and every unrelated key exactly as it was', async () => {
    writeConfig(POPULATED);
    await adapter().install({ url: URL_A, key: KEY_A });
    const after = readConfig();

    deepStrictEqual(after.mcpServers['chrome-devtools'], POPULATED.mcpServers['chrome-devtools']);
    deepStrictEqual(after.mcpServers.other, POPULATED.mcpServers.other, "someone else's key was modified");
    deepStrictEqual(after.projects, POPULATED.projects, 'project state was modified');
    strictEqual(after.numStartups, 412);
    strictEqual(after.userID, 'abc123');
    strictEqual(after.hasCompletedOnboarding, true);
  });

  test('backs the file up before the first write', async () => {
    writeConfig(POPULATED);
    const result = await adapter().install({ url: URL_A, key: KEY_A });
    assertOk(result.backupPath, 'no backup was made');
    deepStrictEqual(JSON.parse(readFileSync(result.backupPath, 'utf8')), POPULATED, 'the backup is not the original');
  });

  test('a second install keeps the first backup instead of clobbering it', async () => {
    writeConfig(POPULATED);
    await adapter().install({ url: URL_A, key: KEY_A });
    await new Promise((r) => setTimeout(r, 5));
    await adapter().install({ url: URL_A, key: KEY_B });
    const backups = readdirSync(home).filter((f) => f.includes('noslopui-backup'));
    strictEqual(backups.length, 2, `expected two backups, got ${backups.length}`);
  });

  test('replacing an existing entry swaps the key and says so', async () => {
    writeConfig(POPULATED);
    await adapter().install({ url: URL_A, key: KEY_A });
    const result = await adapter().install({ url: URL_A, key: KEY_B });
    strictEqual(result.replacedExisting, true);
    strictEqual(readConfig().mcpServers[SERVER_NAME].headers.Authorization, `Bearer ${KEY_B}`);
  });

  test('keeps fields on our own entry that we did not put there', async () => {
    writeConfig({ mcpServers: { [SERVER_NAME]: { type: 'http', url: URL_A, timeout: 30000, headers: { 'X-Custom': 'keep me' } } } });
    await adapter().install({ url: URL_A, key: KEY_A });
    const entry = readConfig().mcpServers[SERVER_NAME];
    strictEqual(entry.timeout, 30000, 'an unknown field on our entry was dropped');
    strictEqual(entry.headers['X-Custom'], 'keep me', 'an unknown header was dropped');
    strictEqual(entry.headers.Authorization, `Bearer ${KEY_A}`);
  });

  test('never writes into a project scope', async () => {
    writeConfig(POPULATED);
    await adapter().install({ url: URL_A, key: KEY_A });
    const projects = readConfig().projects;
    for (const project of Object.values<any>(projects)) {
      assertOk(!(SERVER_NAME in (project.mcpServers ?? {})), 'wrote a key into a project config');
    }
  });

  test('refuses a config it cannot parse, and changes nothing', async () => {
    const path = join(home, '.claude.json');
    writeFileSync(path, '{ "mcpServers": { oh no', 'utf8');
    await throws2(async () => adapter().install({ url: URL_A, key: KEY_A }), ConfigUnreadableError);
    strictEqual(readFileSync(path, 'utf8'), '{ "mcpServers": { oh no', 'the unreadable file was modified');
    strictEqual(readdirSync(home).filter((f) => f.includes('noslopui-backup')).length, 0);
  });

  test('refuses a config whose top level is not an object', async () => {
    writeFileSync(join(home, '.claude.json'), '[1, 2, 3]', 'utf8');
    await throws2(async () => adapter().install({ url: URL_A, key: KEY_A }), ConfigUnreadableError);
  });

  test('treats an empty file as an empty config rather than an error', async () => {
    writeFileSync(join(home, '.claude.json'), '', 'utf8');
    await adapter().install({ url: URL_A, key: KEY_A });
    strictEqual(readConfig().mcpServers[SERVER_NAME].url, URL_A);
  });

  test('leaves no temp files behind', async () => {
    writeConfig(POPULATED);
    await adapter().install({ url: URL_A, key: KEY_A });
    strictEqual(readdirSync(home).filter((f) => f.includes('noslopui-write')).length, 0);
  });
});

describe('status', () => {
  test('reports nothing when the config is absent', async () => {
    const status = await adapter().status();
    strictEqual(status.installed, false);
    strictEqual(status.hasKey, false);
  });

  test('reports the url and that a key is present, without exposing it', async () => {
    await adapter().install({ url: URL_A, key: KEY_A });
    const status = await adapter().status();
    strictEqual(status.installed, true);
    strictEqual(status.url, URL_A);
    strictEqual(status.hasKey, true);
    assertOk(!JSON.stringify(status).includes(KEY_A), 'status leaked the key');
  });

  test('names the problem when the entry has no key', async () => {
    writeConfig({ mcpServers: { [SERVER_NAME]: { type: 'http', url: URL_A } } });
    const status = await adapter().status();
    strictEqual(status.hasKey, false);
    match(status.problem ?? '', /Authorization/);
  });

  test('names the problem when the entry is the wrong transport', async () => {
    writeConfig({ mcpServers: { [SERVER_NAME]: { type: 'stdio', url: URL_A, headers: { Authorization: `Bearer ${KEY_A}` } } } });
    match((await adapter().status()).problem ?? '', /expected "http"/);
  });
});

describe('uninstall', () => {
  test('removes only our entry', async () => {
    writeConfig(POPULATED);
    await adapter().install({ url: URL_A, key: KEY_A });
    strictEqual(await adapter().uninstall(), true);
    const after = readConfig();
    assertOk(!(SERVER_NAME in after.mcpServers), 'our entry is still there');
    deepStrictEqual(after.mcpServers.other, POPULATED.mcpServers.other);
    deepStrictEqual(after.mcpServers['chrome-devtools'], POPULATED.mcpServers['chrome-devtools']);
    strictEqual(after.numStartups, 412);
  });

  test('is a no-op when nothing is installed', async () => {
    writeConfig(POPULATED);
    strictEqual(await adapter().uninstall(), false);
    deepStrictEqual(readConfig(), POPULATED);
  });
});

describe('skill', () => {
  const MARKDOWN = '---\nname: noslopui\n---\n\nrules\n';

  test('writes to the user-level skills folder', async () => {
    const result = await adapter().installSkill(MARKDOWN);
    strictEqual(result.changed, true);
    strictEqual(result.path, join(home, '.claude', 'skills', 'noslopui', 'SKILL.md'));
    strictEqual(readFileSync(result.path, 'utf8'), MARKDOWN);
  });

  test('says nothing changed when the file is already identical', async () => {
    await adapter().installSkill(MARKDOWN);
    strictEqual((await adapter().installSkill(MARKDOWN)).changed, false);
  });

  test('overwrites an older version', async () => {
    await adapter().installSkill('---\nname: noslopui\n---\n\nold\n');
    const result = await adapter().installSkill(MARKDOWN);
    strictEqual(result.changed, true);
    strictEqual(readFileSync(result.path, 'utf8'), MARKDOWN);
  });

  test('removing takes our folder and leaves other skills alone', async () => {
    const otherSkill = join(home, '.claude', 'skills', 'someone-elses', 'SKILL.md');
    mkdirSync(join(home, '.claude', 'skills', 'someone-elses'), { recursive: true });
    writeFileSync(otherSkill, 'not ours', 'utf8');
    await adapter().installSkill(MARKDOWN);

    strictEqual(await adapter().removeSkill(), true);
    assertOk(!existsSync(join(home, '.claude', 'skills', 'noslopui')), 'our skill folder survived');
    assertOk(existsSync(otherSkill), "another agent's skill was deleted");
    strictEqual(await adapter().removeSkill(), false, 'a second removal should be a no-op');
  });
});

describe('detect', () => {
  test('finds Claude Code by its config file', async () => {
    writeConfig(POPULATED);
    strictEqual(await adapter().detect(), true);
  });

  test('finds Claude Code by its home folder', async () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    strictEqual(await adapter().detect(), true);
  });
});

/** node:assert has no async throws that checks the error type, so: */
async function throws2(fn: () => Promise<unknown>, type: new (...args: any[]) => Error): Promise<void> {
  try {
    await fn();
  } catch (err) {
    assertOk(err instanceof type, `expected ${type.name}, got ${String(err)}`);
    return;
  }
  throw new Error(`expected ${type.name} to be thrown`);
}

// Referenced so the import is used even when the suite is filtered.
void throws;
