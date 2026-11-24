import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const appSource = read('../src/App.jsx');
const tabBarSource = read('../src/components/TabBar.jsx');
const frontendPackage = JSON.parse(read('../package.json'));
const bunLock = read('../bun.lock');
const envExample = read('../.env.example');
const staticManifest = JSON.parse(
  read('../public/assets/manifest.webmanifest'),
);
const viteConfig = read('../vite.config.mjs');
const serviceWorker = read('../src/sw.js');

const legacyRuntimeFiles = [
  '../src/pages/Home.jsx',
  '../src/pages/Practice.jsx',
  '../src/pages/Progress.jsx',
  '../src/stores/pronunciationStore.js',
  '../src/services/azureSpeech.js',
  '../src/services/wordService.js',
  '../src/components/ui/PhonemeChip.jsx',
  '../src/lib/score.js',
];

test('registered routes and tabs expose only Gramio MVP surfaces', () => {
  const routes = [...appSource.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/gs)]
    .map((match) => match[1]);
  const tabs = [
    ...tabBarSource.matchAll(/\{\s*to: '([^']+)',\s*label: '([^']+)'/g),
  ].map((match) => ({ to: match[1], label: match[2] }));

  assert.deepEqual(routes, ['/', '/review', '/library', '/profile']);
  assert.deepEqual(tabs, [
    { to: '/', label: 'Today' },
    { to: '/review', label: 'Review' },
    { to: '/library', label: 'Library' },
    { to: '/profile', label: 'Profile' },
  ]);
});

test('legacy pronunciation runtime files are absent', () => {
  const remainingFiles = legacyRuntimeFiles.filter((relativePath) =>
    existsSync(new URL(relativePath, import.meta.url)),
  );

  assert.deepEqual(remainingFiles, []);
});

test('frontend dependency graph excludes Azure Speech', () => {
  assert.equal(
    frontendPackage.dependencies?.['microsoft-cognitiveservices-speech-sdk'],
    undefined,
  );
  assert.doesNotMatch(bunLock, /microsoft-cognitiveservices-speech-sdk/);
});

test('environment template excludes Azure Speech configuration', () => {
  assert.doesNotMatch(envExample, /VITE_AZURE_SPEECH_(KEY|REGION)/);
});

test('both PWA manifest sources describe Gramio', () => {
  assert.equal(staticManifest.name, 'Gramio');
  assert.equal(staticManifest.short_name, 'Gramio');
  assert.match(staticManifest.description, /grammar and vocabulary/i);
  assert.equal(staticManifest.id, '/');
  assert.equal(staticManifest.start_url, '/');
  assert.equal(staticManifest.scope, '/');
  assert.equal(staticManifest.lang, 'en');
  assert.equal(staticManifest.display, 'standalone');
  assert.match(viteConfig, /name: 'Gramio'/);
  assert.match(viteConfig, /short_name: 'Gramio'/);
  assert.match(viteConfig, /grammar and vocabulary/i);
  assert.match(viteConfig, /id: '\/'/);
  assert.match(viteConfig, /start_url: '\/'/);
  assert.match(viteConfig, /scope: '\/'/);
  assert.match(viteConfig, /lang: 'en'/);
});

test('service worker serves the cached app shell for offline navigation', () => {
  assert.match(serviceWorker, /NavigationRoute/);
  assert.match(serviceWorker, /createHandlerBoundToURL\('\/index\.html'\)/);
});
