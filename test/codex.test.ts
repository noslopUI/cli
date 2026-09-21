// Codex's config.toml, edited without a TOML parser — so these tests are the
// parser's replacement: every byte outside our table must survive, byte for
// byte, and anything we don't recognise must stop the write.

import { ok as assertOk, strictEqual } from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { CodexAdapter } from '../src/adapters/codex.js';
import { ConfigUnreadableError } from '../src/lib/json-file.js';

const URL_A = 'https://noslopui.com/api/mcp';
const KEY_A = 'nsui_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const KEY_B = 'nsui_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

let home: string;
let savedHome: string | undefined;
let savedProfile: string | undefined;
const adapter = () => new CodexAdapter();
const path = () => join(home, '.codex', 'config.toml');
const read = () => readFileSync(path(), 'utf8');
function write(text: string) {
  mkdirSync(join(home, '.codex'), { recursive: true });
  writeFileSync(path(), text, 'utf8');
}

const NEIGHBOURS = `# my codex config
model = "gpt-5"
approval_policy = "on-request"

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_TOKEN"

[profiles.fast]
model = "gpt-5-mini"
`;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'noslopui-codex-'));
  savedHome = process.env.HOME;
  savedProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  strictEqual(homedir(), home);
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  if (savedProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = savedProfile;
});

async function refuses(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    assertOk(err instanceof ConfigUnreadableError, `expected ConfigUnreadableError, got ${String(err)}`);
    return;
  }
  throw new Error('expected a refusal');
}

describe('install', () => {
  test('creates config.toml with our table when there is none', async () => {
    const r = await adapter().install({ url: URL_A, key: KEY_A });
    strictEqual(r.replacedExisting, false);
    strictEqual(
      read(),
      `[mcp_servers.noslopui]\nurl = "${URL_A}"\nhttp_headers = { "Authorization" = "Bearer ${KEY_A}" }\n`,
    );
  });

  test('appends to an existing file and leaves every other byte alone', async () => {
    write(NEIGHBOURS);
    const r = await adapter().install({ url: URL_A, key: KEY_A });
    assertOk(r.backupPath && existsSync(r.backupPath), 'no backup');
    const after = read();
    assertOk(after.startsWith(NEIGHBOURS.trimEnd()), 'the existing content changed');
    assertOk(after.includes('[mcp_servers.noslopui]'), 'our table is missing');
  });

  test('replacing our table swaps url and key, keeps keys the user added, touches nothing else', async () => {
    write(
      `${NEIGHBOURS}\n[mcp_servers.noslopui]\nurl = "https://old.test/mcp"\nbearer_token_env_var = "OLD"\ntool_timeout_sec = 120\n\n[mcp_servers.noslopui.http_headers]\nAuthorization = "Bearer old"\n\n[projects."C:/work"]\ntrust_level = "trusted"\n`,
    );
    const r = await adapter().install({ url: URL_A, key: KEY_B });
    strictEqual(r.replacedExisting, true);
    const after = read();
    assertOk(after.startsWith(NEIGHBOURS.trimEnd()), 'content before our table changed');
    assertOk(after.includes(`url = "${URL_A}"`) && !after.includes('old.test'), 'old url kept');
    assertOk(after.includes(`"Bearer ${KEY_B}"`) && !after.includes('Bearer old'), 'old key kept');
    assertOk(!after.includes('bearer_token_env_var = "OLD"'), 'the env-var key would compete with ours');
    assertOk(!after.includes('[mcp_servers.noslopui.http_headers]'), 'a second http_headers would be a TOML error');
    assertOk(after.includes('tool_timeout_sec = 120'), "a key the user added was dropped");
    assertOk(after.includes('[projects."C:/work"]\ntrust_level = "trusted"'), 'the table after ours changed');
    strictEqual((after.match(/\[mcp_servers\.noslopui\]/g) ?? []).length, 1, 'our table appears twice');
  });

  test('keeps Windows line endings', async () => {
    write(NEIGHBOURS.replace(/\n/g, '\r\n'));
    await adapter().install({ url: URL_A, key: KEY_A });
    const after = read();
    assertOk(!/[^\r]\n/.test(after), 'a bare LF crept in');
  });

  test('refuses our server declared as an inline table, and changes nothing', async () => {
    const text = `[mcp_servers]\nnoslopui = { url = "https://x.test" }\n`;
    write(text);
    await refuses(() => adapter().install({ url: URL_A, key: KEY_A }));
    strictEqual(read(), text);
  });

  test('refuses our server declared with dotted keys', async () => {
    write(`mcp_servers.noslopui.url = "https://x.test"\n`);
    await refuses(() => adapter().install({ url: URL_A, key: KEY_A }));
  });

  test('a commented-out mention is not a declaration', async () => {
    write(`# noslopui = { url = "https://x.test" }\n`);
    await adapter().install({ url: URL_A, key: KEY_A });
    assertOk(read().startsWith('# noslopui'), 'the comment was lost');
  });
});

describe('status, key and uninstall', () => {
  test('status reports url and key without leaking it; configuredKey returns it', async () => {
    write(NEIGHBOURS);
    await adapter().install({ url: URL_A, key: KEY_A });
    const s = await adapter().status();
    strictEqual(s.installed, true);
    strictEqual(s.url, URL_A);
    strictEqual(s.hasKey, true);
    assertOk(!JSON.stringify(s).includes(KEY_A));
    strictEqual(await adapter().configuredKey(), KEY_A);
  });

  test('a bearer_token_env_var entry counts as having a key', async () => {
    write(`[mcp_servers.noslopui]\nurl = "${URL_A}"\nbearer_token_env_var = "NOSLOPUI_API_KEY"\n`);
    strictEqual((await adapter().status()).hasKey, true);
  });

  test('uninstall takes our table and sub-tables out and leaves the rest byte-identical', async () => {
    write(NEIGHBOURS);
    await adapter().install({ url: URL_A, key: KEY_A });
    strictEqual(await adapter().uninstall(), true);
    strictEqual(read(), NEIGHBOURS);
    strictEqual(await adapter().uninstall(), false);
  });

  test('is detected by ~/.codex', async () => {
    const path = process.env.PATH;
    process.env.PATH = '';
    try {
      strictEqual(await adapter().detect(), false);
      mkdirSync(join(home, '.codex'), { recursive: true });
      strictEqual(await adapter().detect(), true);
    } finally {
      process.env.PATH = path;
    }
  });
});
