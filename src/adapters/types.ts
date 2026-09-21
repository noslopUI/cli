// The shape every agent adapter fills in.
//
// Adding an agent is meant to be this file's worth of work and nothing else:
// the facts about its config (most agents are one entry in json-agents.ts),
// one entry in the registry, the same id in the server's CLI_AGENTS, and a
// fixture test. The interesting part of supporting a new agent is finding out
// from its own docs where it keeps things, not writing code.

export type ServerEntry = {
  url: string;
  key: string;
};

export type InstallResult = {
  /** Where the entry was written. */
  configPath: string;
  /** Set when an existing file was copied first. */
  backupPath: string | null;
  /** How it was done — useful in `doctor` output and bug reports. */
  method: 'agent-cli' | 'config-file';
  /** True when an entry was already there and we replaced it. */
  replacedExisting: boolean;
};

export type StatusResult = {
  installed: boolean;
  configPath: string;
  url: string | null;
  /** Never the key itself — only whether one is present. */
  hasKey: boolean;
  /** Present when the config is there but wrong in some way we can name. */
  problem?: string;
};

export type SkillResult = {
  path: string;
  /** False when the file on disk was already identical. */
  changed: boolean;
};

export interface Adapter {
  /** Stable id — matches the server's own list of agents it will issue keys for. */
  readonly id: string;
  /** What to call it on screen. */
  readonly label: string;

  /** Is this agent on this machine? Must never throw. */
  detect(): Promise<boolean>;

  /** Where this agent's user-level MCP config lives. */
  configPath(): string;

  /** Add or replace our server entry. Never touches another server's entry. */
  install(entry: ServerEntry): Promise<InstallResult>;

  /** What's currently configured, for `doctor`. */
  status(): Promise<StatusResult>;

  /** The configured key itself, so `doctor` can ask the server whether it still works. Never printed. */
  configuredKey(): Promise<string | null>;

  /** Remove only our entry. Returns false when there was nothing to remove. */
  uninstall(): Promise<boolean>;

  /**
   * Where a user-level skill goes, and how to write one. Null for an agent
   * with no skills folder — the rules still reach it through the server's
   * own instructions. Several agents share a folder (~/.agents/skills), so
   * callers compare paths before removing one.
   */
  installSkill(markdown: string): Promise<SkillResult | null>;
  skillPath(): string | null;
  removeSkill(): Promise<boolean>;
}
