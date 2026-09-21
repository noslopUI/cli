# noslopui

Connect your coding agent to [noslopUI](https://noslopui.com) — hand-crafted UI components and portable design systems, over MCP.

```bash
npx noslopui@latest init
```

That one command finds the agents on your machine, signs you in once through the browser, adds the MCP server to each agent's **user-level** config, and installs the workflow skill. Restart your agents and ask one to build something.

## Why

Ask any agent for a landing page and you get the same page: gradient headline, purple on purple, three cards, everything centred. noslopUI gives it a real catalog to work from — components someone designed, and design systems that are a set of rules rather than a folder of parts, so a five-page build reads as one site.

The MCP server is what your agent calls. The skill is what makes it think to call it at all when you say "build me a website" — so `init` installs both, and you can skip the skill with `--no-skill`.

## Supported agents

| Agent | `--agent` | Config it writes | Skill it installs |
|---|---|---|---|
| Claude Code | `claude-code` | `~/.claude.json` | `~/.claude/skills/noslopui/` |
| Codex | `codex` | `~/.codex/config.toml` | `~/.agents/skills/noslopui/` |
| Cursor | `cursor` | `~/.cursor/mcp.json` | `~/.agents/skills/noslopui/` |
| VS Code (Copilot) | `vscode` | your user `mcp.json` ¹ | `~/.agents/skills/noslopui/` |
| Devin Desktop | `devin` | `~/.config/devin/mcp_config.json` ² | `~/.codeium/windsurf/skills/noslopui/` |
| Windsurf (Cascade) | `windsurf` | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/skills/noslopui/` |
| OpenCode | `opencode` | `~/.config/opencode/opencode.json` | `~/.agents/skills/noslopui/` |
| Antigravity | `antigravity` | `~/.gemini/config/mcp_config.json` | `~/.gemini/config/skills/noslopui/` |

¹ `%APPDATA%\Code\User\mcp.json` on Windows, `~/Library/Application Support/Code/User/mcp.json` on macOS, `~/.config/Code/User/mcp.json` on Linux.
² `%APPDATA%\devin\mcp_config.json` on Windows. Windsurf became Devin Desktop in June 2026: its default agent (Devin Local) reads this file, the older Cascade agent reads the Windsurf one, so they're set up separately.

Every path and field comes from that agent's own documentation. Several agents read the same skills folder, so one copy there serves all of them.

Anything else that speaks MCP over HTTP can be connected by hand — add `https://noslopui.com/api/mcp` and sign in when it asks. Steps for each client: [noslopui.com/mcp](https://noslopui.com/mcp).

## Commands

**Set up**

| | |
|---|---|
| `npx noslopui init` | Set up your agents: one sign-in, then the server and the skill for each |
| `npx noslopui doctor` | Check what's set up, and say what to do about anything that isn't |
| `npx noslopui update` | Re-download the skill |
| `npx noslopui skill` | Install only the skill, for an agent you connected by hand (`--agent <id>`) |
| `npx noslopui remove` | Take the noslopUI server back out |

**Account**

| | |
|---|---|
| `npx noslopui login` | Sign this CLI in, for the catalog commands below |
| `npx noslopui login --agent <id>` | A fresh key for an agent that's already set up |
| `npx noslopui whoami` | The account and plan this CLI is signed in to |
| `npx noslopui logout` | Forget this CLI's sign-in |

**Catalog**

| | |
|---|---|
| `npx noslopui search <query>` | Search components and blocks (`--tag style:editorial`, `--framework`, `--limit`) |
| `npx noslopui get <id>` | Print a component's code, or `--write src/Hero.tsx` (`--format tsx\|html\|vue`) |
| `npx noslopui prompt <id>` | Print a component's AI-prompt version |
| `npx noslopui design-systems [query]` | Search design systems (`--tag theme:dark`) |
| `npx noslopui design-system <id>` | Print a DESIGN.md, or `--write DESIGN.md` |
| `npx noslopui collections` | Your saved collections |
| `npx noslopui collection <name>` | What's in one |

The catalog commands call the same MCP tools your agent does, with the same access: search and collections are free on every account; code, prompts and DESIGN.md files need a paid plan or the account's free trial. Output is only the thing you asked for, so `get <id> > Hero.tsx` works; `--json` gives the raw result.

Options: `--agent <id>` (repeatable), `--no-skill`, `--no-browser`, `--key <key>`, `--json`, `--force`, `-y/--yes`.

## What it does to your machine

It edits your agents' user-level config, and nothing else:

- Adds one entry, `noslopui`, to each agent you choose, in the file listed above.
- **Copies the file first.** The backup sits next to the original as `<file>.noslopui-backup-<timestamp>`, and its path is printed.
- **Never touches another server's entry**, or anything else in the file. Codex's `config.toml` is edited table by table: every line outside `[mcp_servers.noslopui]` is left byte for byte as it was.
- **Never writes to a project config.** A key in a project file is a key that gets committed.
- **Stops if the config doesn't parse**, or if the `noslopui` entry is written in a form it doesn't recognise. It will not overwrite a file it couldn't read — that file is the only copy of your setup.
- Writes the skill to the folders listed above.
- Saves the CLI's own sign-in in `~/.config/noslopui/credentials.json` (`%APPDATA%\noslopui\` on Windows), readable only by you.

`remove` takes the entry back out and leaves everything else, including the skill unless you pass `--skill` — and even then it keeps a skill folder another configured agent still reads. It does **not** revoke your key: the key belongs to your account, not to this machine. Revoke it at [noslopui.com/account](https://noslopui.com/account?tab=mcp).

### If Claude Code is running

`~/.claude.json` is also Claude Code's own state file, and a running Claude Code rewrites it from memory. Quit it before running `init`, or the entry can be overwritten seconds later. `doctor` re-reads the file rather than trusting the write, so it will tell you if that happened.

## Your keys

`init` issues one key per agent, named after the agent and this machine, so you can tell them apart on the account page and revoke one without breaking the others — plus one for the CLI itself if it isn't signed in yet. Keys are written to each agent's config and nowhere else; this tool never prints one in full, and never sends it anywhere except noslopui.com.

`--key <key>` skips the browser and uses a key you already made on the account page, for CI or a machine with no browser. `NOSLOPUI_API_KEY` does the same for the catalog commands.

## The skill

The workflow has one source, and it isn't this repo: it's assembled on the server and served at [noslopui.com/skill/SKILL.md](https://noslopui.com/skill/SKILL.md). That's the same text the MCP server sends as its `instructions` on every connection, so an agent gets the rules whether or not the skill is installed.

`init` downloads it fresh. The copy in this repo exists so `npx skills add noslopUI/cli` has something to find, and as a fallback when the site is unreachable — `npm run sync-skill` refreshes it and CI fails if it has drifted.

## Development

```bash
npm install
npm run build
npm test          # adapter contract tests, against fixture configs in a throwaway HOME
npm run typecheck
```

`NOSLOPUI_ORIGIN` points the CLI at a different server, which is how the flow is exercised against a local one.

Adding an agent is its facts in `src/adapters/json-agents.ts` (or its own module, if its config isn't JSON), one line in the registry, the same id in the server's `CLI_AGENTS`, and a row in `test/agents.test.ts`.

## Licence

MIT
