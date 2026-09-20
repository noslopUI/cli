// Things about the package itself that only break at publish time, when
// nobody is watching.

import { strictEqual, ok as assertOk } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));

test('the version in the code matches package.json', async () => {
  const { CLI_VERSION } = await import('../src/lib/version.js');
  strictEqual(CLI_VERSION, pkg.version, 'src/lib/version.ts and package.json disagree');
});

test('the bin entry points at something the build actually produces', () => {
  strictEqual(pkg.bin.noslopui, 'dist/index.js');
  assertOk(pkg.files.includes('dist'), 'dist is not in the published files');
});

test('packing builds first', () => {
  // `npm pack` runs prepack, not prepublishOnly. Without this the tarball
  // shipped with no dist/ at all: install fine, then fail at run time.
  assertOk(pkg.scripts.prepack?.includes('build'), 'prepack does not build');
});

test('the package has no runtime dependencies', () => {
  // It is run with npx; every dependency is download time before anything happens.
  strictEqual(pkg.dependencies, undefined, `unexpected dependencies: ${Object.keys(pkg.dependencies ?? {}).join(', ')}`);
});
