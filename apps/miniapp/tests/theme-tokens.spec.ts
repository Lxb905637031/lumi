import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const sourceRoot = join(import.meta.dirname, '../src');
const tokenFile = readFileSync(join(sourceRoot, 'styles/tokens.scss'), 'utf8');

function collectStyles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectStyles(path);
    return path.endsWith('.scss') && path !== join(sourceRoot, 'styles/tokens.scss') ? [path] : [];
  });
}

test('all Lumi color tokens referenced by miniapp styles are defined', () => {
  const usedTokens = new Set(
    collectStyles(sourceRoot).flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/var\((--lumi-color-[\w-]+)/g)].map((match) => match[1]!),
    ),
  );
  const definedTokens = new Set([...tokenFile.matchAll(/(--lumi-color-[\w-]+)\s*:/g)].map((match) => match[1]!));

  assert.deepEqual(
    [...usedTokens].filter((token) => !definedTokens.has(token)),
    [],
    'styles must use tokens from the confirmed theme palette',
  );
});
