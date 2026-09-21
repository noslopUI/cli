// Where agents keep their files. Every path starts from the home directory or
// an environment variable the OS sets for it, never a hardcoded user folder, so
// the tests can point all of them at a throwaway directory.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

export const home = (): string => homedir();

/** `%APPDATA%` on Windows (Roaming), where Electron apps and Devin keep user config. */
export function appData(): string {
  return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
}

/** `$XDG_CONFIG_HOME`, or `~/.config` — the Linux/macOS home for CLI config. */
export function xdgConfig(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

/** Where a VS Code-family app keeps its user settings, per OS. */
export function vscodeUserDir(product = 'Code'): string {
  if (process.platform === 'win32') return join(appData(), product, 'User');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', product, 'User');
  return join(xdgConfig(), product, 'User');
}

/** The skills folder several agents share: Codex, Cursor, OpenCode, VS Code. */
export const sharedSkillPath = (): string => join(homedir(), '.agents', 'skills', 'noslopui', 'SKILL.md');

export function onPath(binary: string): boolean {
  const paths = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const suffixes = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of paths) {
    for (const suffix of suffixes) {
      try {
        if (existsSync(join(dir, binary + suffix))) return true;
      } catch {
        // An unreadable PATH entry is not our problem; keep looking.
      }
    }
  }
  return false;
}
