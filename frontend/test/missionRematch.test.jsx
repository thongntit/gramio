import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getScheduledRematches,
  resolveRematch,
  scheduleRematch,
} from '@/services/missionRematch';

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('mission rematches', () => {
  it('persists a missed skill per user and preserves the first due time', () => {
    scheduleRematch('user-a', { skill: 'present-simple', questionId: 'q-1' }, { now: 1_000 });
    scheduleRematch('user-a', { skill: 'present-simple', questionId: 'q-2' }, { now: 2_000 });

    expect(getScheduledRematches('user-a')).toEqual([
      { skill: 'present-simple', questionId: 'q-2', dueAt: 1_000 + THREE_DAYS },
    ]);

    const storedKey = 'gramio:mission-rematches:user-a';
    expect(JSON.parse(window.localStorage.getItem(storedKey))).toEqual(getScheduledRematches('user-a'));
    expect(window.localStorage.getItem('gramio:mission-rematches:user-b')).toBeNull();
  });

  it('isolates user schedules and resolves a completed skill', () => {
    scheduleRematch('user-a', { skill: 'past-simple', questionId: 'a-q' }, { now: 0 });
    scheduleRematch('user-b', { skill: 'past-simple', questionId: 'b-q' }, { now: 0 });

    expect(getScheduledRematches('user-a')[0].questionId).toBe('a-q');
    expect(getScheduledRematches('user-b')[0].questionId).toBe('b-q');

    resolveRematch('user-a', 'past-simple');

    expect(getScheduledRematches('user-a')).toEqual([]);
    expect(getScheduledRematches('user-b')).toHaveLength(1);
  });

  it('moves a retried miss three days from the retry time', () => {
    scheduleRematch('user-a', { skill: 'articles', questionId: 'q-1' }, { now: 10_000 });
    scheduleRematch('user-a', { skill: 'articles', questionId: 'q-2' }, { retry: true, now: 50_000 });

    expect(getScheduledRematches('user-a')).toEqual([
      { skill: 'articles', questionId: 'q-2', dueAt: 50_000 + THREE_DAYS },
    ]);
  });

  it('recovers from corrupt data and ignores storage parse or quota failures', () => {
    window.localStorage.setItem('gramio:mission-rematches:user-a', '{invalid');
    expect(getScheduledRematches('user-a')).toEqual([]);
    scheduleRematch('user-a', { skill: 'tense', questionId: 'q-1' }, { now: 0 });
    expect(getScheduledRematches('user-a')[0].skill).toBe('tense');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(getScheduledRematches('user-a')).toEqual([]);
    expect(() => scheduleRematch('user-a', { skill: 'x', questionId: 'q-x' })).not.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(() => scheduleRematch('user-a', { skill: 'x', questionId: 'q-x' })).not.toThrow();
  });
});
