import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Missions from '@/pages/Missions';
import stories from '@/data/englishMissionStories';
import puzzles from '@/data/englishMissionPuzzles';
import grammarBank from '@/data/grammarContrastDrills.json';
import { getDailyMission, getDailyMissionResult } from '@/services/dailyMission';
import { getScheduledRematches, scheduleRematch } from '@/services/missionRematch';

const USER_ID = 'user-missions-test';
const ACTIVITIES = [...stories, ...puzzles];
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ userId: 'user-missions-test' }) }));

beforeEach(() => localStorage.clear());

function renderMissions(theme = 'light') {
  return render(
    <div className={theme === 'dark' ? 'dark' : undefined}>
      <MemoryRouter initialEntries={['/missions']}><Missions /></MemoryRouter>
    </div>,
  );
}

function visibleRound(rounds) {
  return rounds.find(({ prompt }) => screen.queryByRole('heading', { name: prompt, exact: true }));
}

async function chooseAnswer(user, round) {
  for (const id of round.answer) {
    const { text } = round.choices.find((choice) => id === choice.id);
    await user.click(screen.getByRole('button', { name: text, exact: true }));
  }
  if (round.kind !== 'choice') {
    await user.click(screen.getByRole('button', { name: 'Check answer', exact: true }));
  }
}

describe('English Missions', () => {
  it('includes unique rounds and an independent rematch for each skill', () => {
    const allRounds = ACTIVITIES.flatMap(({ rounds }) => rounds);
    const replayable = ACTIVITIES.filter(({ id }) => id !== 'missing-parcel').flatMap(({ rounds }) => rounds);
    const grammarSkills = new Set(grammarBank.map(({ id }) => id));
    const roundIds = new Set(allRounds.map(({ id }) => id));
    expect(ACTIVITIES.map(({ id }) => id)).toEqual([
      'missing-parcel', 'inbox-rescue', 'same-scene', 'meaning-switch', 'vocabulary-taboo',
    ]);
    expect(roundIds.size).toBe(allRounds.length);
    for (const { id, kind, choices, answer, rematchKey, forbiddenWords, outcomes } of allRounds) {
      const optionIds = choices.map((choice) => choice.id);
      expect(new Set(optionIds).size).toBe(choices.length);
      expect(new Set(answer).size).toBe(answer.length);
      expect(answer.every((item) => optionIds.includes(item))).toBe(true);
      expect(grammarSkills.has(rematchKey) || replayable.some(
        (round) => round.id !== id && round.rematchKey === rematchKey,
      )).toBe(true);
      if (kind === 'choice') expect(answer).toHaveLength(1);
      if (kind === 'order') {
        expect(answer).toHaveLength(choices.length);
        expect(optionIds).not.toEqual(answer);
      }
      if (kind === 'build') {
        expect(forbiddenWords.length).toBeGreaterThan(0);
        expect(answer.length).toBeLessThan(choices.length);
      }
      if (outcomes) expect(optionIds.every((item) => outcomes[item])).toBe(true);
    }
  });

  it.each(['light', 'dark'])('solves the parcel case including its timeline in %s mode', async (theme) => {
    const user = userEvent.setup();
    const parcel = stories.find(({ id }) => id === 'missing-parcel');
    renderMissions(theme);

    expect(screen.getAllByRole('button')).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: /the missing parcel/i }));
    for (const [index, round] of parcel.rounds.entries()) {
      expect(screen.getByRole('heading', { name: round.prompt, exact: true })).toBeInTheDocument();
      if (round.kind === 'order') expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled();
      await chooseAnswer(user, round);
      expect(within(screen.getByRole('status')).getByText(round.explanation)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: index === parcel.rounds.length - 1 ? 'See results' : 'Next question' }));
    }
    expect(screen.getByRole('heading', { name: 'Mission complete' })).toBeInTheDocument();
    expect(screen.getByText('You got 5 of 5 correct.')).toBeInTheDocument();
    expect(getScheduledRematches(USER_ID)).toEqual([]);
  });

  it('shows the reply for the selected inbox choice and schedules the missed skill', async () => {
    const user = userEvent.setup();
    const inbox = stories.find(({ id }) => id === 'inbox-rescue');
    renderMissions();

    await user.click(screen.getByRole('button', { name: /inbox rescue/i }));
    const round = visibleRound(inbox.rounds);
    const choice = round.choices.find(({ id }) => id !== round.answer[0]);
    await user.click(screen.getByRole('button', { name: choice.text, exact: true }));

    expect(screen.getByRole('status')).toHaveTextContent(round.outcomes[choice.id]);
    expect(getScheduledRematches(USER_ID)).toEqual([
      expect.objectContaining({ skill: round.rematchKey, questionId: round.id }),
    ]);
  });

  it('rotates through the perspectives in Same Scene and opens a meaning switch puzzle', async () => {
    const user = userEvent.setup();
    const scene = stories.find(({ id }) => id === 'same-scene');
    const meaning = puzzles.find(({ id }) => id === 'meaning-switch');
    renderMissions();

    await user.click(screen.getByRole('button', { name: /same scene/i }));
    for (let index = 0; index < 3; index += 1) {
      const round = scene.rounds[index];
      expect(screen.getByRole('heading', { name: round.prompt, exact: true })).toBeInTheDocument();
      await chooseAnswer(user, round);
      await user.click(screen.getByRole('button', { name: 'Next question' }));
    }
    await user.click(screen.getByRole('button', { name: 'Back to Missions' }));
    await user.click(screen.getByRole('button', { name: /meaning switch/i }));
    await chooseAnswer(user, visibleRound(meaning.rounds));
    expect(screen.getByRole('status')).toHaveTextContent('Correct');
  });

  it('builds a taboo definition from pieces and supports undo', async () => {
    const user = userEvent.setup();
    const taboo = puzzles.find(({ id }) => id === 'vocabulary-taboo');
    renderMissions();

    await user.click(screen.getByRole('button', { name: /vocabulary taboo/i }));
    const round = visibleRound(taboo.rounds);
    const { text } = round.choices.find(({ id }) => id === round.answer[0]);
    expect(screen.getByText(round.forbiddenWords.join(', '))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: text, exact: true }));
    expect(within(screen.getByRole('list')).getByText(text)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo last' }));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await chooseAnswer(user, round);
    expect(screen.getByRole('status')).toHaveTextContent('Correct');
  });

  it('serves a due Rematch in a different context and clears a correct response', async () => {
    const user = userEvent.setup();
    const inbox = stories.find(({ id }) => id === 'inbox-rescue');
    const missed = inbox.rounds.find(({ rematchKey }) => rematchKey === 'future-intent');
    scheduleRematch(USER_ID, { skill: missed.rematchKey, questionId: missed.id }, {
      now: Date.now() - 4 * 24 * 60 * 60 * 1000,
    });
    renderMissions();

    await user.click(screen.getByRole('button', { name: /the rematch.*1 ready/i }));
    await screen.findByRole('heading', { name: 'The Rematch' });
    const rematch = visibleRound(ACTIVITIES.flatMap(({ rounds }) => rounds));
    expect(rematch.id).not.toBe(missed.id);
    expect(rematch.rematchKey).toBe(missed.rematchKey);
    await chooseAnswer(user, rematch);
    expect(getScheduledRematches(USER_ID)).toEqual([]);
  });

  it.each(['light', 'dark'])('plays the daily set and restores its score in %s mode', async (theme) => {
    const user = userEvent.setup();
    const { dateKey, rounds } = getDailyMission(new Date());
    const page = renderMissions(theme);
    await user.click(screen.getByRole('button', { name: /^daily mission/i }));

    for (const [index, round] of rounds.entries()) {
      expect(screen.getByRole('heading', { name: round.prompt, exact: true })).toBeInTheDocument();
      await chooseAnswer(user, round);
      if (index < rounds.length - 1) expect(getDailyMissionResult(USER_ID, dateKey)).toBeNull();
      await user.click(screen.getByRole('button', { name: index === rounds.length - 1 ? 'See results' : 'Next question' }));
    }

    expect(screen.getByText('You got 3 of 3 correct.')).toBeInTheDocument();
    expect(getDailyMissionResult(USER_ID, dateKey)).toEqual({ score: 3, total: 3 });
    page.unmount();
    renderMissions(theme);
    expect(screen.getByRole('button', { name: /daily mission.*best today: 3\/3/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^daily mission/i }));
    expect(screen.getByRole('heading', { name: rounds[0].prompt, exact: true })).toBeInTheDocument();
  });
});
