// What `noslopui search` sends to search_components — in particular the
// --section flag, which picks UI blocks or Motion Lab effects.

import { deepStrictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';
import { searchArguments, type CatalogOptions } from '../src/commands/catalog.js';

const options = (over: Partial<CatalogOptions> = {}): CatalogOptions => ({ args: [], json: false, tags: [], force: false, ...over });

test('a plain search sends the query only', () => {
  deepStrictEqual(searchArguments(options({ args: ['pricing', 'table'] })), { query: 'pricing table' });
});

test('--section motion-lab and its spellings all send motion_lab', () => {
  for (const s of ['motion-lab', 'motion_lab', 'Motion-Lab', 'effects']) {
    deepStrictEqual(searchArguments(options({ section: s })), { section: 'motion_lab' });
  }
});

test('--section ui-blocks sends ui_blocks', () => {
  for (const s of ['ui-blocks', 'ui_blocks', 'blocks']) {
    deepStrictEqual(searchArguments(options({ section: s })), { section: 'ui_blocks' });
  }
});

test('an unknown --section is refused before anything is sent', () => {
  throws(() => searchArguments(options({ section: 'templates' })), /--section takes ui-blocks or motion-lab/);
});

test('section, tags and limit travel together', () => {
  deepStrictEqual(searchArguments(options({ args: ['glass'], section: 'motion-lab', tags: ['tech:webgl'], limit: 5 })), {
    query: 'glass',
    section: 'motion_lab',
    tags: ['tech:webgl'],
    limit: 5,
  });
});
