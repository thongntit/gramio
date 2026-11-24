import stories from '../data/englishMissionStories';
import puzzles from '../data/englishMissionPuzzles';

const STORAGE_PREFIX = 'gramio:daily-missions:';
const HISTORY_LIMIT = 90;
const DAILY_POOLS = [
  stories.find(({ id }) => id === 'inbox-rescue')?.rounds ?? [],
  puzzles.find(({ id }) => id === 'meaning-switch')?.rounds ?? [],
  puzzles.find(({ id }) => id === 'vocabulary-taboo')?.rounds ?? [],
];

function formatDateKey(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;

  const year = date.getFullYear();
  if (year < 0 || year > 9999) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${month}-${day}`;
}

function isDateKey(dateKey) {
  if (typeof dateKey !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

export function getDailyMission(date) {
  const dateKey = formatDateKey(date);
  if (!dateKey) return { dateKey: null, rounds: [] };

  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const rounds = DAILY_POOLS.map((available, poolIndex) => {
    if (!available.length) return null;
    // A one-step rotation guarantees a different round on each adjacent day.
    const offset = (dayNumber + poolIndex * 3) % available.length;
    return available[(offset + available.length) % available.length];
  }).filter(Boolean);

  return { dateKey, rounds };
}

function storageKey(userId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function validResult(result) {
  return result
    && Number.isInteger(result.score)
    && Number.isInteger(result.total)
    && result.score >= 0
    && result.total >= 0
    && result.score <= result.total;
}

function readResults(userId) {
  try {
    const serialized = globalThis.localStorage?.getItem(storageKey(userId));
    if (!serialized) return {};
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(Object.entries(parsed).filter(([dateKey, result]) => (
      isDateKey(dateKey) && validResult(result)
    )).map(([dateKey, { score, total }]) => [dateKey, { score, total }]));
  } catch {
    return {};
  }
}

function writeResults(userId, results) {
  const boundedResults = Object.fromEntries(
    Object.entries(results)
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, HISTORY_LIMIT),
  );

  try {
    globalThis.localStorage?.setItem(storageKey(userId), JSON.stringify(boundedResults));
  } catch {
    // Storage can be unavailable or full; the current best is also held in memory.
  }
}

export function getDailyMissionResult(userId, dateKey) {
  if (typeof userId !== 'string' || !userId || !isDateKey(dateKey)) return null;
  const result = readResults(userId)[dateKey] ?? null;
  return result ? { ...result } : null;
}

export function saveDailyMissionResult(userId, dateKey, score, total) {
  if (
    typeof userId !== 'string' || !userId || !isDateKey(dateKey)
    || !validResult({ score, total })
  ) return getDailyMissionResult(userId, dateKey);

  const current = getDailyMissionResult(userId, dateKey);
  const best = current && current.score >= score ? current : { score, total };

  const results = readResults(userId);
  results[dateKey] = best;
  writeResults(userId, results);
  return { ...best };
}
