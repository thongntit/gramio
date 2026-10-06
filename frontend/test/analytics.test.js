import { describe, expect, it, vi } from 'vitest';
import {
  createAnalytics,
  getAnalyticsConfig,
} from '@/lib/analytics';

function fakeClient() {
  return {
    capture: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    reset: vi.fn(),
  };
}

describe('analytics client', () => {
  it('uses the configured PostHog host and privacy-safe defaults', () => {
    expect(getAnalyticsConfig({
      VITE_POSTHOG_KEY: '  phc_test  ',
      VITE_POSTHOG_HOST: 'https://eu.i.posthog.com/',
    })).toEqual({
      key: 'phc_test',
      host: 'https://eu.i.posthog.com',
    });

    expect(getAnalyticsConfig({ VITE_POSTHOG_KEY: 'phc_test' })).toEqual({
      key: 'phc_test',
      host: 'https://us.i.posthog.com',
    });
  });

  it('does not send anything until a public key is configured', () => {
    const client = fakeClient();
    const analytics = createAnalytics({
      client,
      env: {},
    });

    expect(analytics.init()).toBe(false);
    expect(analytics.track('page_viewed', { path: '/today' })).toBe(false);
    expect(analytics.identifyUser('user_123')).toBe(false);
    expect(analytics.reset()).toBe(false);
    expect(client.init).not.toHaveBeenCalled();
    expect(client.capture).not.toHaveBeenCalled();
  });

  it('initializes once and removes learning content from event properties', () => {
    const client = fakeClient();
    const analytics = createAnalytics({
      client,
      env: {
        VITE_POSTHOG_KEY: 'phc_test',
        VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
      },
    });

    expect(analytics.init()).toBe(true);
    expect(analytics.init()).toBe(false);
    expect(client.init).toHaveBeenCalledOnce();
    expect(client.init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://eu.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      persistence: 'localStorage',
    });

    expect(analytics.track('card_answered', {
      card_id: 'card_123',
      deck_id: 'deck_123',
      answer: 'works',
      front: 'She ___ here.',
      answered_correctly: true,
    })).toBe(true);
    expect(client.capture).toHaveBeenCalledWith('card_answered', {
      card_id: 'card_123',
      deck_id: 'deck_123',
      answered_correctly: true,
    });
  });

  it('loads the analytics SDK lazily and flushes events queued during startup', async () => {
    const client = fakeClient();
    let resolveClient;
    const loadClient = vi.fn(() => new Promise((resolve) => {
      resolveClient = resolve;
    }));
    const analytics = createAnalytics({
      env: { VITE_POSTHOG_KEY: 'phc_test' },
      loadClient,
    });

    expect(analytics.init({ defer: true })).toBe(true);
    expect(loadClient).not.toHaveBeenCalled();
    expect(analytics.track('page_viewed', { path: '/' })).toBe(true);
    expect(analytics.init()).toBe(true);
    expect(loadClient).toHaveBeenCalledOnce();
    expect(client.init).not.toHaveBeenCalled();

    resolveClient(client);
    await vi.waitFor(() => expect(client.init).toHaveBeenCalledOnce());

    expect(client.init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      persistence: 'localStorage',
    });
    expect(client.capture).toHaveBeenCalledWith('page_viewed', { path: '/' });
  });

  it('identifies and resets the learner without sending personal profile fields', () => {
    const client = fakeClient();
    const analytics = createAnalytics({
      client,
      env: { VITE_POSTHOG_KEY: 'phc_test' },
    });
    analytics.init();

    expect(analytics.identifyUser('user_123', {
      email: 'thong@example.com',
      auth_provider: 'clerk',
    })).toBe(true);
    expect(client.identify).toHaveBeenCalledWith('user_123', {
      auth_provider: 'clerk',
    });
    expect(analytics.reset()).toBe(true);
    expect(client.reset).toHaveBeenCalledOnce();
  });
});
