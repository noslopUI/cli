#!/usr/bin/env node
// noslopui — connect a coding agent to noslopUI.
//
// Argument parsing is by hand and stays that way: a tool people run with
// `npx` should download in one tick, and a CLI-argument library is a
// dependency you wait for before anything happens.

import { init, explain } from './commands/init.js';
import { doctor } from './commands/doctor.js';
import { remove } from './commands/remove.js';
import { update } from './commands/update.js';
import { login } from './commands/login.js';
import { color, fail, say } from './lib/ui.js';
import { origin } from './lib/api.js';
import { CLI_VERSION as VERSION } from './lib/version.js';



function usage(): void {
  say(`
${color.bold('noslopui')} — hand-crafted UI components and design systems, in your agent.

${color.bold('Usage')}
  npx noslopui <command> [options]

${color.bold('Commands')}
  init        Set up an agent: sign in, add the MCP server, install the skill
  doctor      Check what is set up and what is wrong with it
  login       Get a fresh key for an agent that is already set up
  update      Re-download the skill for agents that are set up
  remove      Take the noslopUI server back out (never touches other servers)

${color.bold('Options')}
  --agent <id>     Set up a specific agent instead of detecting (claude-code)
  --no-skill       Do not install the skill (init)
  --no-browser     Do not open a browser; print the URL instead (init, login)
  --skill          Also remove the skill (remove)
  --key <key>      Use a key you already have instead of signing in (init, login)
  -y, --yes        Take the default answer for every question
  -h, --help       Show this
  -v, --version    Show the version

${color.dim(`Server: ${origin()} · set NOSLOPUI_ORIGIN to point somewhere else.`)}
`);
}

type Parsed = { command: string; agents: string[]; skill: boolean | null; yes: boolean; key?: string; browser: boolean; help: boolean; version: boolean };

function parse(argv: string[]): Parsed {
  const parsed: Parsed = { command: '', agents: [], skill: null, yes: false, browser: true, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--version' || arg === '-v') parsed.version = true;
    else if (arg === '--yes' || arg === '-y') parsed.yes = true;
    else if (arg === '--no-skill') parsed.skill = false;
    else if (arg === '--no-browser') parsed.browser = false;
    else if (arg === '--skill') parsed.skill = true;
    else if (arg === '--agent') parsed.agents.push(String(argv[++i] ?? ''));
    else if (arg.startsWith('--agent=')) parsed.agents.push(arg.slice('--agent='.length));
    else if (arg === '--key') parsed.key = String(argv[++i] ?? '');
    else if (arg.startsWith('--key=')) parsed.key = arg.slice('--key='.length);
    else if (!arg.startsWith('-') && !parsed.command) parsed.command = arg;
    else throw new Error(`Unknown option "${arg}". Run "npx noslopui --help".`);
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

  switch (args.command) {
    case 'init':
      return init({ agents: args.agents, skill: args.skill !== false, yes: args.yes, browser: args.browser, ...(args.key ? { key: args.key } : {}) });
    case 'doctor':
      return doctor();
    case 'login':
      return login({ agents: args.agents, yes: args.yes, browser: args.browser, ...(args.key ? { key: args.key } : {}) });
    case 'update':
      return update();
    case 'remove':
      return remove({ yes: args.yes, skill: args.skill === true });
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
    say();
    fail(explain(err));
    say();
    process.exitCode = 1;
  });
