import { beforeEach, describe, expect, it, vi } from 'vitest';
import stories from '../src/data/englishMissionStories';
import puzzles from '../src/data/englishMissionPuzzles';
import {
  getDailyMission,
  getDailyMissionResult,
  saveDailyMissionResult,
} from '../src/services/dailyMission';

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('daily missions', () => {
  it('selects a stable, mixed round from each configured activity by local date', () => {
    const firstDate = new Date(2026, 10, 24, 23, 59);
    const nextMomentSameDay = new Date(2026, 10, 24, 0, 1);
    const mission = getDailyMission(firstDate);

    expect(mission).toEqual(getDailyMission(nextMomentSameDay));
    expect(mission.dateKey).toBe('2026-11-24');
    expect(mission.rounds).toHaveLength(3);
    expect(mission.rounds[0]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^inbox-/),
    }));
    expect(stories.find(({ id }) => id === 'inbox-rescue').rounds).toContainEqual(mission.rounds[0]);
    expect(mission.rounds[1].id).toMatch(/^meaning-/);
    expect(mission.rounds[2].id).toMatch(/^taboo-/);
    const nextDay = getDailyMission(new Date(2026, 10, 25));
    expect(nextDay.dateKey).toBe('2026-11-25');
    expect(nextDay.rounds.map(({ id }) => id)).not.toEqual(mission.rounds.map(({ id }) => id));
    expect(puzzles.find(({ id }) => id === 'meaning-switch').rounds.map(({ id }) => id))
      .toContain(mission.rounds[1].id);
    expect(puzzles.find(({ id }) => id === 'vocabulary-taboo').rounds.map(({ id }) => id))
      .toContain(mission.rounds[2].id);
  });

  it('persists the best score per user and date, and keeps users isolated', () => {
    expect(getDailyMissionResult('user-a', '2026-11-24')).toBeNull();
    expect(saveDailyMissionResult('user-a', '2026-11-24', 2, 3)).toEqual({ score: 2, total: 3 });
    expect(saveDailyMissionResult('user-a', '2026-11-24', 1, 3)).toEqual({ score: 2, total: 3 });
    expect(saveDailyMissionResult('user-a', '2026-11-24', 3, 3)).toEqual({ score: 3, total: 3 });
    expect(getDailyMissionResult('user-a', '2026-11-24')).toEqual({ score: 3, total: 3 });
    expect(getDailyMissionResult('user-b', '2026-11-24')).toBeNull();
    expect(saveDailyMissionResult('user-b', '2026-11-24', 1, 3)).toEqual({ score: 1, total: 3 });
    expect(JSON.parse(window.localStorage.getItem('gramio:daily-missions:user-a'))['2026-11-24'])
      .toEqual({ score: 3, total: 3 });
    expect(JSON.parse(window.localStorage.getItem('gramio:daily-missions:user-b'))['2026-11-24'])
      .toEqual({ score: 1, total: 3 });
  });

  it('ignores malformed records and tolerates unavailable or full storage', () => {
    window.localStorage.setItem('gramio:daily-missions:user-a', '{invalid');
    expect(getDailyMissionResult('user-a', '2026-11-24')).toBeNull();
    expect(saveDailyMissionResult('user-a', '2026-11-24', 2, 3)).toEqual({ score: 2, total: 3 });

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('storage unavailable', 'SecurityError');
    });
    expect(getDailyMissionResult('user-a', '2026-11-24')).toBeNull();
    expect(saveDailyMissionResult('user-a', '2026-11-24', 2, 3)).toEqual({ score: 2, total: 3 });

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(saveDailyMissionResult('user-c', '2026-11-24', 2, 3)).toEqual({ score: 2, total: 3 });
    expect(getDailyMissionResult('user-c', '2026-11-24')).toBeNull();
  });

  it('rejects invalid dates and invalid scores without throwing', () => {
    expect(getDailyMission(new Date('invalid'))).toEqual({ dateKey: null, rounds: [] });
    expect(getDailyMissionResult('user-a', '2026-02-30')).toBeNull();
    expect(saveDailyMissionResult('user-a', '2026-11-24', 4, 3)).toBeNull();
  });
});
