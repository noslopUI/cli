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

import { join } from 'node:path';
import { JsonConfigAdapter, SERVER_NAME } from './json-adapter.js';
import type { SkillResult } from './types.js';
import { home } from '../lib/paths.js';
import { installSkillAt } from '../lib/skill-file.js';

export { SERVER_NAME };

export class ClaudeCodeAdapter extends JsonConfigAdapter {
  constructor() {
    super({
      id: 'claude-code',
      label: 'Claude Code',
      configPath: () => join(home(), '.claude.json'),
      container: 'mcpServers',
      urlField: 'url',
      fixed: { type: 'http' },
      detectPaths: () => [join(home(), '.claude.json'), join(home(), '.claude')],
      detectBinaries: ['claude'],
      skillPath: () => join(home(), '.claude', 'skills', 'noslopui', 'SKILL.md'),
      readBackHint: 'If Claude Code is running, quit it and run this again.',
    });
  }

  override skillPath(): string {
    return join(home(), '.claude', 'skills', 'noslopui', 'SKILL.md');
  }

  override async installSkill(markdown: string): Promise<SkillResult> {
    return installSkillAt(this.skillPath(), markdown);
  }
}
