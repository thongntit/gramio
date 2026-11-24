import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const rootApp = readFileSync(new URL('../src/components/RootApp.jsx', import.meta.url), 'utf8');
const appShell = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
const analytics = readFileSync(new URL('../src/lib/analytics.js', import.meta.url), 'utf8');
const reloadPrompt = readFileSync(new URL('../src/components/ReloadPrompt.jsx', import.meta.url), 'utf8');

test('root entry does not block routes behind a health loader', () => {
  assert.doesNotMatch(source, /AppLoader/);
});

test('initializes optional product analytics before rendering the app', () => {
  assert.match(source, /import \{ initAnalytics \} from ['"]\.\/lib\/analytics['"]/);
  assert.match(source, /initAnalytics\(\)/);
});

test('keeps the optional analytics SDK out of the initial bundle', () => {
  assert.doesNotMatch(analytics, /import\s+posthog\s+from\s+['"]posthog-js['"]/);
  assert.match(analytics, /import\(['"]posthog-js['"]\)/);
});

test('loads Clerk with the authenticated app instead of the root entry', () => {
  assert.doesNotMatch(source, /import\s+\{[^}]*ClerkProvider[^}]*\}\s+from\s+['"]@clerk\/clerk-react['"]/);
  assert.doesNotMatch(source, /import\(['"]@clerk\/clerk-react['"]\)/);
  assert.match(rootApp, /import\(['"]@clerk\/clerk-react['"]\)/);
  assert.match(rootApp, /<ClerkProvider publishableKey=\{PUBLISHABLE_KEY\}>/);
});

test('tracks route views inside the application router', () => {
  assert.match(app, /AnalyticsTracker/);
});

test('keeps the app shell and bottom navigation behind authentication', () => {
  assert.match(
    app,
    /<Route\s+element=\{[\s\S]*?<PrivateRoute>\s*<AppShell \/>\s*<\/PrivateRoute>[\s\S]*?\}\s*>/s,
  );
  assert.doesNotMatch(app, /<Route element=\{<AppShell \/>\}>/);
});

test('installed iOS PWA extends the Gramio background behind a translucent status bar', () => {
  assert.match(html, /name="viewport" content="[^"]*viewport-fit=cover/);
  assert.match(
    html,
    /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/,
  );
  assert.match(appShell, /pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(appShell, /pb-\[env\(safe-area-inset-bottom\)\]/);
});

test('offline-ready notice describes the cached app shell without promising offline reviews', () => {
  assert.match(reloadPrompt, /App shell ready offline/);
  assert.match(reloadPrompt, /new reviews still need a connection/i);
  assert.doesNotMatch(reloadPrompt, /use this app without an internet connection/i);
});

test('lazy-loads route screens behind an accessible loading boundary', () => {
  assert.match(app, /const Review = lazy\(\(\) => import\(['"]\.\/pages\/Review['"]\)\)/);
  assert.match(app, /const Library = lazy\(\(\) => import\(['"]\.\/pages\/Library['"]\)\)/);
  assert.match(appShell, /<Suspense fallback=\{<RouteLoading \/>\}>/);
  assert.match(appShell, /role="status"/);
});
