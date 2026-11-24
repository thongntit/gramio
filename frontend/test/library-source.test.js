import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(testDir, '../src');

function readSource(relativePath) {
  const sourcePath = path.join(sourceRoot, relativePath);
  return existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '';
}

const librarySource = readSource('pages/Library.jsx');
const deckRowSource = readSource('components/LibraryDeckRow.jsx');
const deckDetailSource = readSource('components/LibraryDeckDetail.jsx');
const appSource = readSource('App.jsx');
const todaySource = readSource('pages/Today.jsx');

test('Library no longer uses prototype learning data or progress copy', () => {
  assert.doesNotMatch(librarySource, /from ['"]@\/data\/srsData['"]/);
  assert.doesNotMatch(librarySource, /\b(DECKS|CARDS)\b/);
  assert.doesNotMatch(librarySource, /deck\.(due|learning|mastered)/);
  assert.doesNotMatch(librarySource, /(card|c)\.stage/);
  assert.match(librarySource, /Try again/);
  assert.notEqual(deckRowSource, '');
  assert.notEqual(deckDetailSource, '');
});

test('Library is protected and Today does not pass a prototype deck id', () => {
  assert.match(appSource, /<PrivateRoute>[\s\S]*<AppShell \/>[\s\S]*<\/PrivateRoute>/);
  assert.match(appSource, /<Route path="\/library" element=\{<Library \/>\}/);
  assert.doesNotMatch(todaySource, /openDeckId/);
  assert.match(todaySource, /navigate\(['"]\/library['"]\)/);
});
