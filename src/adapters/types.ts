// The shape every agent adapter fills in.
//
// Adding an agent is meant to be this file's worth of work and nothing else:
// one module implementing `Adapter`, one entry in the registry, one row in the
// project's Phase 0 table, and one real install before it's offered on the
// site. Deliberately small, because the interesting part of supporting a new
// agent is finding out how it actually behaves, not writing code.

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

  /** Remove only our entry. Returns false when there was nothing to remove. */
  uninstall(): Promise<boolean>;

  /** Where a user-level skill goes, and how to write one. */
  installSkill(markdown: string): Promise<SkillResult>;
  skillPath(): string;
  removeSkill(): Promise<boolean>;
}
