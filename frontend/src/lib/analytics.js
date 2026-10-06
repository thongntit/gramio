export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

const POSTHOG_OPTIONS = {
  autocapture: false,
  capture_pageview: false,
  disable_session_recording: true,
  persistence: 'localStorage',
};

const SENSITIVE_PROPERTY = /(^|_)(answer|front|explanation|example|content|text)(_|$)/i;
const SAFE_PROFILE_PROPERTIES = new Set(['auth_provider']);

export function getAnalyticsConfig(env = import.meta.env) {
  const key = typeof env?.VITE_POSTHOG_KEY === 'string'
    ? env.VITE_POSTHOG_KEY.trim()
    : '';
  const configuredHost = typeof env?.VITE_POSTHOG_HOST === 'string'
    ? env.VITE_POSTHOG_HOST.trim()
    : '';

  return {
    key,
    host: (configuredHost || DEFAULT_POSTHOG_HOST).replace(/\/$/, ''),
  };
}

function sanitizeEventProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties ?? {}).filter(([key, value]) => (
      value !== undefined
      && !SENSITIVE_PROPERTY.test(key)
    )),
  );
}

function sanitizeProfileProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties ?? {}).filter(([key, value]) => (
      SAFE_PROFILE_PROPERTIES.has(key) && value !== undefined
    )),
  );
}

export function createAnalytics({
  client: initialClient = null,
  env = import.meta.env,
  loadClient = () => import('posthog-js').then(({ default: loadedClient }) => loadedClient),
} = {}) {
  const { key, host } = getAnalyticsConfig(env);
  let client = initialClient;
  let initialized = false;
  let loadingPromise = null;
  let initializationRequested = false;
  const pendingCalls = [];

  const flushPendingCalls = () => {
    const calls = pendingCalls.splice(0);
    calls.forEach(({ method, args }) => {
      try {
        client[method](...args);
      } catch {
        // Analytics must never affect the learning experience.
      }
    });
  };

  const initializeClient = (loadedClient) => {
    try {
      loadedClient.init(key, {
        api_host: host,
        ...POSTHOG_OPTIONS,
      });
      client = loadedClient;
      initialized = true;
      flushPendingCalls();
      return true;
    } catch {
      return false;
    }
  };

  const startLoading = () => {
    if (initialized || !key || loadingPromise) return true;

    if (client) {
      return initializeClient(client);
    }

    try {
      loadingPromise = loadClient()
        .then((module) => {
          const loadedClient = module?.default ?? module;
          if (!loadedClient || !initializeClient(loadedClient)) {
            throw new Error('Unable to initialize analytics');
          }
        })
        .catch(() => {
          pendingCalls.length = 0;
          loadingPromise = null;
        });
    } catch {
      pendingCalls.length = 0;
      loadingPromise = null;
      return false;
    }

    return true;
  };

  const callClient = (method, args) => {
    if (!key || !initializationRequested) return false;
    if (!initialized) {
      pendingCalls.push({ method, args });
      return true;
    }

    try {
      client[method](...args);
      return true;
    } catch {
      return false;
    }
  };

  return {
    init({ defer = false } = {}) {
      if (initialized || !key) return false;
      initializationRequested = true;
      return defer || startLoading();
    },

    track(event, properties = {}) {
      if (typeof event !== 'string' || !event) return false;
      return callClient('capture', [event, sanitizeEventProperties(properties)]);
    },

    identifyUser(userId, properties = {}) {
      if (typeof userId !== 'string' || !userId) return false;
      return callClient('identify', [userId, sanitizeProfileProperties(properties)]);
    },

    reset() {
      return callClient('reset', []);
    },
  };
}

const analytics = createAnalytics();

export const initAnalytics = () => {
  if (!analytics.init({ defer: true })) return false;

  if (typeof window === 'undefined') return analytics.init();

  const schedule = typeof window.requestIdleCallback === 'function'
    ? (callback) => window.requestIdleCallback(callback, { timeout: 2000 })
    : (callback) => window.setTimeout(callback, 0);

  schedule(() => analytics.init());
  return true;
};
export const track = (event, properties) => analytics.track(event, properties);
export const identifyUser = (userId, properties) => analytics.identifyUser(userId, properties);
export const resetAnalytics = () => analytics.reset();
