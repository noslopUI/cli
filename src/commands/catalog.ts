// The catalog from the terminal: search, get, prompt, design-system,
// design-systems, collections, collection.
//
// Every command is one call to the MCP server's own tools with the CLI's key,
// so the terminal and an agent always see the same thing, and every gate —
// plan, trial, fair use — stays on the server where it belongs.
//
// Output rule: the thing asked for goes to stdout, everything about it goes to
// stderr. `npx noslopui get hero-aurora > Hero.tsx` has to produce a file with
// nothing in it but the component.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { callTool, type ToolResult } from '../lib/api.js';
import { readSession } from '../lib/session.js';
import { color } from '../lib/ui.js';

export type CatalogOptions = {
  args: string[];
  json: boolean;
  tags: string[];
  limit?: number;
  format?: string;
  framework?: string;
  write?: string;
  force: boolean;
};

const out = (s = '') => process.stdout.write(`${s}\n`);
const note = (s = '') => process.stderr.write(`${s}\n`);

function requireKey(): string {
  const session = readSession();
  if (!session) throw new Error('Not signed in. Run "npx noslopui login" first — it takes one approval in the browser.');
  return session.key;
}

function requireArg(options: CatalogOptions, what: string): string {
  const value = options.args.join(' ').trim();
  if (!value) throw new Error(`Say which ${what}.`);
  return value;
}

/** A tool error is the server telling the user something; print it as-is and fail. */
function check(result: ToolResult): ToolResult {
  if (result.isError) throw new Error(result.text);
  return result;
}

/** Notices the server attaches to a result (the trial just started, and so on). */
function notices(data: any): void {
  if (typeof data?.trial === 'string') note(color.yellow(`! ${data.trial}`));
}

function writeOut(path: string, text: string, force: boolean): void {
  const target = resolve(path);
  if (existsSync(target) && !force) throw new Error(`${target} already exists. Pass --force to overwrite it.`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  note(`${color.green('✔')} wrote ${target}`);
}

const truncate = (s: string, n: number) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');

export async function search(options: CatalogOptions): Promise<number> {
  const key = requireKey();
  const r = check(
    await callTool(key, 'search_components', {
      ...(options.args.length ? { query: options.args.join(' ') } : {}),
      ...(options.tags.length ? { tags: options.tags } : {}),
      ...(options.framework ? { framework: options.framework } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    }),
  );
  if (options.json) return out(JSON.stringify(r.data, null, 2)), 0;
  const results: any[] = r.data?.results ?? [];
  if (!results.length) {
    note('Nothing matched. Try fewer words, or no tags.');
    return 1;
  }
  for (const item of results) {
    out(`${color.bold(item.name)}  ${color.dim(item.id)}`);
    if (item.description) out(`  ${truncate(item.description, 110)}`);
    out(`  ${color.cyan(item.url)}`);
    out();
  }
  note(color.dim(`Get one with "npx noslopui get <id>".`));
  return 0;
}

export async function designSystems(options: CatalogOptions): Promise<number> {
  const key = requireKey();
  const r = check(
    await callTool(key, 'search_design_systems', {
      ...(options.args.length ? { query: options.args.join(' ') } : {}),
      ...(options.tags.length ? { tags: options.tags } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    }),
  );
  if (options.json) return out(JSON.stringify(r.data, null, 2)), 0;
  const results: any[] = r.data?.results ?? [];
  if (!results.length) {
    note('Nothing matched.');
    return 1;
  }
  for (const ds of results) {
    const inspired = ds.inspiredBy ? color.dim(` · inspired by ${ds.inspiredBy}`) : '';
    out(`${color.bold(ds.name)}  ${color.dim(ds.id)}${inspired}`);
    if (ds.description) out(`  ${truncate(ds.description, 110)}`);
    if (ds.tags?.length) out(`  ${color.dim(ds.tags.join(' · '))}`);
    out(`  ${color.cyan(ds.previewUrl)}`);
    out();
  }
  note(color.dim(`Get its DESIGN.md with "npx noslopui design-system <id> --write DESIGN.md".`));
  return 0;
}

export async function get(options: CatalogOptions): Promise<number> {
  const key = requireKey();
  const id = requireArg(options, 'component (its id, from "npx noslopui search")');
  const r = check(await callTool(key, 'get_component_code', { id }));
  notices(r.data);
  if (options.json) return out(JSON.stringify(r.data, null, 2)), 0;

  const snippets: Array<{ language: string; code: string }> = r.data?.snippets ?? [];
  if (!snippets.length) throw new Error('This item has no published code.');
  const chosen = options.format ? snippets.filter((s) => s.language === options.format) : snippets;
  if (!chosen.length) {
    throw new Error(`No ${options.format} version. Available: ${snippets.map((s) => s.language).join(', ')}.`);
  }
  if (options.write) {
    if (chosen.length > 1) throw new Error(`Several formats (${chosen.map((s) => s.language).join(', ')}) — pick one with --format.`);
    writeOut(options.write, chosen[0]!.code, options.force);
    return 0;
  }
  if (chosen.length === 1) {
    out(chosen[0]!.code);
    return 0;
  }
  for (const s of chosen) {
    note(color.dim(`── ${s.language} ──`));
    out(s.code);
  }
  return 0;
}

export async function prompt(options: CatalogOptions): Promise<number> {
  const key = requireKey();
  const id = requireArg(options, 'component');
  const r = check(await callTool(key, 'get_component_prompt', { id }));
  notices(r.data);
  if (options.json) return out(JSON.stringify(r.data, null, 2)), 0;
  if (options.write) writeOut(options.write, r.data?.promptText ?? '', options.force);
  else out(r.data?.promptText ?? '');
  return 0;
}

export async function designSystem(options: CatalogOptions): Promise<number> {
  const key = requireKey();
  const id = requireArg(options, 'design system (its id, from "npx noslopui design-systems")');
  const r = check(await callTool(key, 'get_design_system_file', { id }));
  notices(r.data);
  if (options.json) return out(JSON.stringify(r.data, null, 2)), 0;
  if (options.write) writeOut(options.write, r.data?.designMd ?? '', options.force);
  else out(r.data?.designMd ?? '');
  return 0;
}

export async function collections(options: CatalogOptions): Promise<number> {
  const key = requireKey();
  const r = check(await callTool(key, 'list_collections'));
  if (options.json) return out(JSON.stringify(r.data, null, 2)), 0;
  const list: any[] = r.data?.collections ?? [];
  if (!list.length) {
    note('No collections yet. Save items on noslopui.com to make one.');
    return 0;
  }
  for (const c of list) out(`${color.bold(c.name)}  ${color.dim(`${c.itemCount} ${c.itemCount === 1 ? 'item' : 'items'} · ${c.id}`)}`);
  return 0;
}

export async function collection(options: CatalogOptions): Promise<number> {
  const key = requireKey();
  const which = requireArg(options, 'collection (a name or an id)');
  // Ids are opaque; try the name first, since that's what people type.
  let r = await callTool(key, 'get_collection', { name: which });
  if (r.isError) r = await callTool(key, 'get_collection', { listId: which });
  check(r);
  if (options.json) return out(JSON.stringify(r.data, null, 2)), 0;
  out(color.bold(r.data?.collection ?? which));
  const systems: any[] = r.data?.designSystems ?? [];
  if (systems.length) out(`${color.dim('design system:')} ${systems.map((d) => `${d.name} (${d.id})`).join(', ')}`);
  out();
  for (const item of r.data?.items ?? []) {
    out(`${item.name}  ${color.dim(`${item.kind === 'design_systems' ? 'design system' : 'block'} · ${item.id}`)}`);
  }
  return 0;
}
