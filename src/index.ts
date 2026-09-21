#!/usr/bin/env node
// noslopui — connect a coding agent to noslopUI, and use the catalog from the
// terminal.
//
// Argument parsing is by hand and stays that way: a tool people run with
// `npx` should download in one tick, and a CLI-argument library is a
// dependency you wait for before anything happens.

import { init, explain } from './commands/init.js';
import { doctor } from './commands/doctor.js';
import { remove } from './commands/remove.js';
import { update } from './commands/update.js';
import { login } from './commands/login.js';
import { logout, whoami } from './commands/account.js';
import { skill } from './commands/skill.js';
import * as catalog from './commands/catalog.js';
import { ADAPTERS } from './adapters/index.js';
import { color, fail, say } from './lib/ui.js';
import { origin } from './lib/api.js';
import { CLI_VERSION as VERSION } from './lib/version.js';

function usage(): void {
  say(`
${color.bold('noslopui')} — hand-crafted UI components and design systems, in your agent.

${color.bold('Usage')}
  npx noslopui <command> [options]

${color.bold('Set up')}
  init                   Set up your agents: one sign-in, then the MCP server and the skill
  doctor                 Check what is set up and what is wrong with it
  update                 Re-download the skill for agents that are set up
  skill                  Install only the skill (for an agent you connected by hand)
  remove                 Take the noslopUI server back out (never touches other servers)

${color.bold('Account')}
  login                  Sign this CLI in (for search and get); --agent <id> re-keys an agent
  whoami                 Show the account and plan this CLI is signed in to
  logout                 Forget this CLI's sign-in

${color.bold('Catalog')}
  search <query>         Search components and blocks       --tag <facet:value>, --framework, --limit
  get <id>               Print a component's code            --format tsx|html|vue, --write <file>
  prompt <id>            Print a component's AI-prompt version
  design-systems [query] Search design systems               --tag theme:dark …
  design-system <id>     Print a design system's DESIGN.md   --write DESIGN.md
  collections            List your saved collections
  collection <name|id>   Show one collection

${color.bold('Options')}
  --agent <id>     Only this agent (repeatable): ${ADAPTERS.map((a) => a.id).join(', ')}
  --no-skill       Do not install the skill (init)
  --no-browser     Do not open a browser; print the URL instead (init, login)
  --skill          Also remove the skill (remove)
  --key <key>      Use a key you already have instead of signing in (init, login)
  --json           Machine-readable output (catalog commands, whoami)
  --force          Overwrite the file --write points at
  -y, --yes        Take the default answer for every question
  -h, --help       Show this
  -v, --version    Show the version

${color.dim(`Server: ${origin()} · NOSLOPUI_ORIGIN points somewhere else · NOSLOPUI_API_KEY signs in without a saved login.`)}
`);
}

type Parsed = {
  command: string;
  args: string[];
  agents: string[];
  tags: string[];
  skill: boolean | null;
  yes: boolean;
  key?: string;
  browser: boolean;
  help: boolean;
  version: boolean;
  json: boolean;
  force: boolean;
  limit?: number;
  format?: string;
  framework?: string;
  write?: string;
};

function parse(argv: string[]): Parsed {
  const parsed: Parsed = { command: '', args: [], agents: [], tags: [], skill: null, yes: false, browser: true, help: false, version: false, json: false, force: false };
  const value = (i: number, name: string) => {
    const v = argv[i];
    if (v === undefined || v.startsWith('-')) throw new Error(`${name} needs a value.`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const take = () => inline ?? value(++i, flag);
    if (flag === '--help' || flag === '-h') parsed.help = true;
    else if (flag === '--version' || flag === '-v') parsed.version = true;
    else if (flag === '--yes' || flag === '-y') parsed.yes = true;
    else if (flag === '--no-skill') parsed.skill = false;
    else if (flag === '--no-browser') parsed.browser = false;
    else if (flag === '--skill') parsed.skill = true;
    else if (flag === '--json') parsed.json = true;
    else if (flag === '--force') parsed.force = true;
    else if (flag === '--agent') parsed.agents.push(take());
    else if (flag === '--tag') parsed.tags.push(take());
    else if (flag === '--key') parsed.key = take();
    else if (flag === '--format') parsed.format = take();
    else if (flag === '--framework') parsed.framework = take();
    else if (flag === '--write' || flag === '-o') parsed.write = take();
    else if (flag === '--limit') {
      const n = Number(take());
      if (!Number.isInteger(n) || n < 1) throw new Error('--limit needs a whole number.');
      parsed.limit = n;
    } else if (!arg.startsWith('-')) {
      if (!parsed.command) parsed.command = arg;
      else parsed.args.push(arg);
    } else throw new Error(`Unknown option "${arg}". Run "npx noslopui --help".`);
  }
  parsed.agents = parsed.agents.filter(Boolean);
  return parsed;
}

async function main(): Promise<number> {
  const args = parse(process.argv.slice(2));
  if (args.version) {
    say(VERSION);
    return 0;
  }
  if (args.help || !args.command) {
    usage();
    return args.command ? 0 : 1;
  }

  const catalogOptions: catalog.CatalogOptions = {
    args: args.args,
    json: args.json,
    tags: args.tags,
    force: args.force,
    ...(args.limit ? { limit: args.limit } : {}),
    ...(args.format ? { format: args.format } : {}),
    ...(args.framework ? { framework: args.framework } : {}),
    ...(args.write ? { write: args.write } : {}),
  };

  switch (args.command) {
    case 'init':
      return init({ agents: args.agents, skill: args.skill !== false, yes: args.yes, browser: args.browser, ...(args.key ? { key: args.key } : {}) });
    case 'doctor':
      return doctor();
    case 'login':
      return login({ agents: args.agents, yes: args.yes, browser: args.browser, ...(args.key ? { key: args.key } : {}) });
    case 'logout':
      return logout();
    case 'whoami':
      return whoami({ json: args.json });
    case 'update':
      return update();
    case 'skill':
      return skill({ agents: args.agents });
    case 'remove':
      return remove({ yes: args.yes, skill: args.skill === true, agents: args.agents });
    case 'search':
      return catalog.search(catalogOptions);
    case 'get':
      return catalog.get(catalogOptions);
    case 'prompt':
      return catalog.prompt(catalogOptions);
    case 'design-systems':
      return catalog.designSystems(catalogOptions);
    case 'design-system':
      return catalog.designSystem(catalogOptions);
    case 'collections':
      return catalog.collections(catalogOptions);
    case 'collection':
      return catalog.collection(catalogOptions);
    default:
      fail(`Unknown command "${args.command}".`);
      usage();
      return 1;
  }
}

// `process.exitCode`, never `process.exit()`. Forcing an exit while a fetch
// socket is still closing trips a libuv assertion on Windows
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"), which prints an
// alarming crash after a run that actually succeeded. Setting the code and
// letting the loop drain is both correct and quiet.
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write('\n');
    fail(explain(err));
    process.stderr.write('\n');
    process.exitCode = 1;
  });
