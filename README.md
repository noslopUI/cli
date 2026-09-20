# noslopui

Connect your coding agent to [noslopUI](https://noslopui.com) — hand-crafted UI components and portable design systems, over MCP.

```bash
npx noslopui@latest init
```

That one command finds your agent, signs you in through the browser, adds the MCP server to your agent's **user-level** config, and installs the workflow skill. Restart your agent and ask it to build something.

## Why

Ask any agent for a landing page and you get the same page: gradient headline, purple on purple, three cards, everything centred. noslopUI gives it a real catalog to work from — components someone designed, and design systems that are a set of rules rather than a folder of parts, so a five-page build reads as one site.

The MCP server is what your agent calls. The skill is what makes it think to call it at all when you say "build me a website" — so `init` installs both, and you can skip the skill with `--no-skill`.

## Commands

| | |
|---|---|
| `npx noslopui init` | Set up an agent: sign in, add the server, install the skill |
| `npx noslopui doctor` | Check what's set up, and say what to do about anything that isn't |
| `npx noslopui login` | Get a fresh key for an agent that's already set up |
| `npx noslopui update` | Re-download the skill |
| `npx noslopui remove` | Take the noslopUI server back out |

Options: `--agent <id>`, `--no-skill`, `--no-browser`, `--key <key>`, `-y/--yes`.

## Supported agents

**Claude Code.** That's the list.

Other agents are added one at a time, and only after a real install has been done on a real machine, end to end — an agent named here is one we're claiming works. The server enforces the same list: asking for a key for an agent that hasn't passed gets refused, so an out-of-date copy of this CLI can't get one either.

## What it does to your machine

It edits your agent's user-level config, and nothing else. Concretely, for Claude Code:

- Adds one entry, `noslopui`, under `mcpServers` in `~/.claude.json`.
- **Copies the file first.** The backup is written next to the original as `.claude.json.noslopui-backup-<timestamp>`, and its path is printed.
- **Never touches another server's entry**, or any of the other state Claude Code keeps in that file.
- **Never writes to a project config.** A key in a project file is a key that gets committed.
- **Stops if the config doesn't parse.** It will not overwrite a file it couldn't read — that file is the only copy of your setup, and guessing at its contents would be worse than doing nothing.
- Writes the skill to `~/.claude/skills/noslopui/SKILL.md`.

`remove` takes the entry back out and leaves everything else, including the skill unless you pass `--skill`. It does **not** revoke your key: the key belongs to your account, not to this machine. Revoke it at [noslopui.com/account](https://noslopui.com/account?tab=mcp).

### If Claude Code is running

`~/.claude.json` is also Claude Code's own state file, and a running Claude Code rewrites it from memory. Quit it before running `init`, or the entry can be overwritten seconds later. `doctor` re-reads the file rather than trusting the write, so it will tell you if that happened.

## Your key

`init` issues one key per agent, named after the agent and this machine, so you can tell them apart and revoke one without breaking the others. The key is written to your agent's config and nowhere else — this tool never prints it in full, and never sends it anywhere except noslopui.com.

`--key <key>` skips the browser and uses a key you already made on the account page, for CI or a machine with no browser.

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

Adding an agent is one module implementing `Adapter` (`src/adapters/types.ts`), one line in the registry, and a real install before it goes in the list.

## Licence

MIT
