const DEFAULT_BASE = 'https://gramio-api.thongnt.dev/api';

function apiBase() {
  const env = import.meta.env?.VITE_OPENSPEAK_API_URL;
  return (env && env.replace(/\/$/, '')) || DEFAULT_BASE;
}

export class ApiError extends Error {
  constructor(status, body, path) {
    super(body?.message || `Request failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

async function request(path, {
  params,
  signal,
  token,
  method = 'GET',
  body,
} = {}) {
  const url = new URL(`${apiBase()}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { message: `Network error: ${err.message}` }, path);
  }

  let responseBody = null;
  const text = await res.text();
  if (text) {
    try { responseBody = JSON.parse(text); }
    catch { responseBody = { message: text }; }
  }
  if (!res.ok) throw new ApiError(res.status, responseBody, path);
  return responseBody;
}

export function getWords(params = {}, opts = {}) {
  return request('/words', { params, ...opts });
}

export function getWordById(id, opts = {}) {
  return request(`/words/${encodeURIComponent(id)}`, opts);
}

export function getCollections(params = {}, opts = {}) {
  return request('/collections', { params, ...opts });
}

export function getCollectionById(id, opts = {}) {
  return request(`/collections/${encodeURIComponent(id)}`, opts);
}

export function getCollectionWords(id, params = {}, opts = {}) {
  return request(`/collections/${encodeURIComponent(id)}/words`, {
    params,
    ...opts,
  });
}

export function getContentDecks(params = {}, opts = {}) {
  return request('/content/decks', { params, ...opts });
}

export function getContentDeckCards(slug, params = {}, opts = {}) {
  return request(`/content/decks/${encodeURIComponent(slug)}/cards`, {
    params,
    ...opts,
  });
}

export function enrollDeck(deckId, opts = {}) {
  return request(`/decks/${encodeURIComponent(deckId)}/enroll`, {
    ...opts,
    method: 'POST',
  });
}

export function unenrollDeck(deckId, opts = {}) {
  return request(`/decks/${encodeURIComponent(deckId)}/enrollment`, {
    ...opts,
    method: 'DELETE',
  });
}

export function getProfileSummary(opts = {}) {
  return request('/me/summary', opts);
}

export function getNotificationPreferences(opts = {}) {
  return request('/notifications', opts);
}

export function saveNotificationSubscription(payload, opts = {}) {
  return request('/notifications/subscription', {
    ...opts,
    method: 'POST',
    body: payload,
  });
}

export function removeNotificationSubscription(payload, opts = {}) {
  return request('/notifications/subscription', {
    ...opts,
    method: 'DELETE',
    body: payload,
  });
}

export function getToday(opts = {}) {
  return request('/today', opts);
}

export function submitReview(payload, opts = {}) {
  return request('/reviews', { ...opts, method: 'POST', body: payload });
}

export function getHealth(opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 5000);
  return request('/health', { ...opts, signal: opts.signal ?? controller.signal }).finally(
    () => clearTimeout(timer),
  );
}
