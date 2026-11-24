const STORAGE_PREFIX = 'gramio:mission-rematches:';
const REMATCH_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function readRematches(userId) {
  if (!userId || typeof userId !== 'string') return [];

  try {
    const serialized = window.localStorage.getItem(getStorageKey(userId));
    if (!serialized) return [];

    const value = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];

    return value.filter((item) => (
      item
      && typeof item.skill === 'string'
      && typeof item.questionId === 'string'
      && Number.isFinite(item.dueAt)
      && Math.abs(item.dueAt) <= 8.64e15
    )).map(({ skill, questionId, dueAt }) => ({ skill, questionId, dueAt }));
  } catch {
    return [];
  }
}

function writeRematches(userId, rematches) {
  if (!userId || typeof userId !== 'string') return;

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(rematches));
  } catch {
    // Storage may be unavailable, full, or disabled. Missions remain usable without it.
  }
}

export function getScheduledRematches(userId) {
  return readRematches(userId).sort((left, right) => left.dueAt - right.dueAt);
}

export function scheduleRematch(userId, { skill, questionId } = {}, { retry = false, now = Date.now() } = {}) {
  if (
    !userId
    || typeof userId !== 'string'
    || typeof skill !== 'string'
    || !skill
    || typeof questionId !== 'string'
    || !questionId
    || !Number.isFinite(now)
  ) return;

  const rematches = readRematches(userId);
  const existingIndex = rematches.findIndex((item) => item.skill === skill);
  const dueAt = existingIndex >= 0 && !retry
    ? rematches[existingIndex].dueAt
    : now + REMATCH_DELAY_MS;
  const next = { skill, questionId, dueAt };

  if (existingIndex >= 0) rematches[existingIndex] = next;
  else rematches.push(next);
  writeRematches(userId, rematches);
}

export function resolveRematch(userId, skill) {
  if (!userId || typeof userId !== 'string' || typeof skill !== 'string' || !skill) return;

  const rematches = readRematches(userId);
  const remaining = rematches.filter((item) => item.skill !== skill);
  if (remaining.length !== rematches.length) writeRematches(userId, remaining);
}
