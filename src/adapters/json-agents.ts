// Every agent whose MCP config is a JSON file, apart from Claude Code (which
// has its own module for its history). Each entry is only facts, and each fact
// is from that vendor's own documentation, checked 2026-09-21:
//
//   Cursor       cursor.com/docs/context/mcp, …/context/skills
//   VS Code      code.visualstudio.com/docs/copilot/customization/mcp-servers, …/agent-skills
//   Devin        docs.devin.ai/cli/extensibility/mcp/configuration, …/skills
//   Windsurf     docs.devin.ai/desktop/cascade/mcp (the legacy Cascade agent)
//   OpenCode     opencode.ai/docs/config, …/mcp-servers, …/skills
//   Antigravity  antigravity.google/docs/mcp
//
// Windsurf shipped as Devin Desktop in June 2026 and now has two agents with
// two config files: Devin Local (the default for new tabs, and the Devin CLI)
// reads the Devin CLI's config; the legacy Cascade agent still reads
// ~/.codeium/windsurf/mcp_config.json. They're two adapters, so each is
// detected, written and checked on its own. Both read skills from
// ~/.codeium/windsurf/skills, so they share one copy.

import { join } from 'node:path';
import { JsonConfigAdapter } from './json-adapter.js';
import { appData, home, sharedSkillPath, vscodeUserDir, xdgConfig } from '../lib/paths.js';

const devinConfigDir = () => (process.platform === 'win32' ? join(appData(), 'devin') : join(xdgConfig(), 'devin'));
const windsurfSkillPath = () => join(home(), '.codeium', 'windsurf', 'skills', 'noslopui', 'SKILL.md');

export const cursor = () =>
  new JsonConfigAdapter({
    id: 'cursor',
    label: 'Cursor',
    configPath: () => join(home(), '.cursor', 'mcp.json'),
    container: 'mcpServers',
    urlField: 'url',
    detectPaths: () => [join(home(), '.cursor')],
    detectBinaries: ['cursor'],
    skillPath: sharedSkillPath,
  });

export const vscode = () =>
  new JsonConfigAdapter({
    id: 'vscode',
    label: 'VS Code',
    configPath: () => join(vscodeUserDir(), 'mcp.json'),
    container: 'servers',
    urlField: 'url',
    fixed: { type: 'http' },
    detectPaths: () => [vscodeUserDir()],
    detectBinaries: ['code'],
    skillPath: sharedSkillPath,
  });

export const devin = () =>
  new JsonConfigAdapter({
    id: 'devin',
    label: 'Devin Desktop',
    configPath: () => join(devinConfigDir(), 'mcp_config.json'),
    container: 'mcpServers',
    urlField: 'url',
    fixed: { transport: 'http' },
    detectPaths: () => [devinConfigDir()],
    detectBinaries: ['devin'],
    skillPath: windsurfSkillPath,
  });

export const windsurf = () =>
  new JsonConfigAdapter({
    id: 'windsurf',
    label: 'Windsurf (Cascade)',
    configPath: () => join(home(), '.codeium', 'windsurf', 'mcp_config.json'),
    container: 'mcpServers',
    urlField: 'serverUrl',
    detectPaths: () => [join(home(), '.codeium', 'windsurf')],
    detectBinaries: ['windsurf'],
    skillPath: windsurfSkillPath,
  });

export const opencode = () =>
  new JsonConfigAdapter({
    id: 'opencode',
    label: 'OpenCode',
    // OpenCode also reads opencode.jsonc. We only ever write the .json file:
    // a .jsonc may carry comments that a JSON round trip would delete, and
    // the reader refuses a file it can't parse rather than rewrite it.
    configPath: () => join(xdgConfig(), 'opencode', 'opencode.json'),
    container: 'mcp',
    urlField: 'url',
    fixed: { type: 'remote', enabled: true },
    detectPaths: () => [join(xdgConfig(), 'opencode')],
    detectBinaries: ['opencode'],
    skillPath: sharedSkillPath,
  });

export const antigravity = () =>
  new JsonConfigAdapter({
    id: 'antigravity',
    label: 'Antigravity',
    configPath: () => join(home(), '.gemini', 'config', 'mcp_config.json'),
    container: 'mcpServers',
    urlField: 'serverUrl',
    detectPaths: () => [join(home(), '.gemini', 'config'), join(home(), '.gemini', 'antigravity')],
    detectBinaries: ['antigravity'],
    skillPath: () => join(home(), '.gemini', 'config', 'skills', 'noslopui', 'SKILL.md'),
  });
