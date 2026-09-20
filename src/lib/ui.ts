// Terminal output and prompts. No dependencies on purpose: this package is run
// with `npx`, so every dependency is something the user waits to download
// before anything happens.

import { createInterface } from 'node:readline/promises';
import { hostname } from 'node:os';
import { stdin, stdout } from 'node:process';

const useColor = stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const wrap = (open: string, close: string) => (s: string) => (useColor ? `${open}${s}${close}` : s);

export const color = {
  bold: wrap('\u001b[1m', '\u001b[22m'),
  dim: wrap('\u001b[2m', '\u001b[22m'),
  green: wrap('\u001b[32m', '\u001b[39m'),
  yellow: wrap('\u001b[33m', '\u001b[39m'),
  red: wrap('\u001b[31m', '\u001b[39m'),
  cyan: wrap('\u001b[36m', '\u001b[39m'),
};

export const say = (line = '') => stdout.write(`${line}\n`);
export const step = (line: string) => say(`${color.cyan('›')} ${line}`);
export const ok = (line: string) => say(`${color.green('✔')} ${line}`);
export const warn = (line: string) => say(`${color.yellow('!')} ${line}`);
export const fail = (line: string) => say(`${color.red('✘')} ${line}`);
export const hint = (line: string) => say(`  ${color.dim(line)}`);

/** True when there's a human to answer a prompt. */
export const interactive = () => Boolean(stdin.isTTY && stdout.isTTY);

/**
 * A key is only ever shown like this. `npx noslopui init` runs in a terminal
 * people screenshot and paste into issues, and the key is the account.
 */
export function maskKey(key: string): string {
  return key.length <= 11 ? '…' : `${key.slice(0, 11)}…`;
}

export async function confirm(question: string, fallback: boolean): Promise<boolean> {
  if (!interactive()) return fallback;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const suffix = fallback ? 'Y/n' : 'y/N';
    const answer = (await rl.question(`${color.cyan('?')} ${question} ${color.dim(`(${suffix})`)} `)).trim().toLowerCase();
    if (!answer) return fallback;
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

/** Wait for Enter, or return immediately when nobody's watching. */
export async function pressEnter(question: string): Promise<void> {
  if (!interactive()) return;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    await rl.question(`${color.cyan('?')} ${question} `);
  } finally {
    rl.close();
  }
}

/**
 * A name for this machine, used to label the key on the account page and on
 * the approval screen. The hostname only — never a username, path or anything
 * else that would say more about the person than "which laptop is this".
 * `os.hostname()` rather than $HOSTNAME, which isn't exported on every shell.
 */
export function machineLabel(): string {
  let raw = '';
  try {
    raw = hostname();
  } catch {
    raw = '';
  }
  const cleaned = (raw.trim().split('.')[0] ?? '').replace(/[^\w .-]/g, '');
  return cleaned.slice(0, 40) || 'this machine';
}
