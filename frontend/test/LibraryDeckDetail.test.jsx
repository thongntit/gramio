import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LibraryDeckDetail from '@/components/LibraryDeckDetail';
import {
  ApiError,
  enrollDeck,
  getContentDeckCards,
  unenrollDeck,
} from '@/services/openspeakApi';
import { useLearningStore } from '@/stores/learningStore';
import { track } from '@/lib/analytics';

vi.mock('@/services/openspeakApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enrollDeck: vi.fn(),
    getContentDeckCards: vi.fn(),
    unenrollDeck: vi.fn(),
  };
});

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

const DECK = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'articles-a-an-the',
  name: 'Articles: a, an, and the',
  description: 'Choose English articles naturally.',
  type: 'grammar',
  level: 'beginner',
  cardCount: 20,
  isLearning: false,
};

const CARD = {
  id: '33333333-3333-4333-8333-333333333333',
  contentKey: 'articles-001',
  type: 'grammar',
  level: 'beginner',
  front: 'She is ___ honest person.',
  answer: 'an',
  explanation: 'Use an before a vowel sound.',
  example: null,
  options: ['a', 'an', 'the'],
};

const TODAY = {
  queue: [{
    card: {
      ...CARD,
      deck_id: DECK.id,
      content_key: CARD.contentKey,
      content_version: 'starter@2026.07.1',
      sort_order: 1,
    },
    progress: {
      stage: 'new',
      due_at: '2026-07-27T00:00:00.000Z',
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      repetitions: 0,
      lapses: 0,
      last_reviewed_at: null,
      last_rating: null,
      scheduler_version: 'fsrs-v1',
    },
  }],
  totalDue: 20,
  countsByType: { grammar: 20 },
  countsByDeck: { [DECK.id]: 20 },
  caughtUp: false,
  serverTimestamp: '2026-07-27T00:00:00.000Z',
};

const ENROLLMENT = {
  deckId: DECK.id,
  isLearning: true,
  enrolledCardCount: 20,
  today: TODAY,
};

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderDetail({
  deck = DECK,
  getToken = vi.fn().mockResolvedValue('fresh-token'),
  onLearningChanged = vi.fn(),
} = {}) {
  const onBack = vi.fn();
  render(
    <LibraryDeckDetail
      deck={deck}
      getToken={getToken}
      onBack={onBack}
      onLearningChanged={onLearningChanged}
    />,
  );
  return { getToken, onBack, onLearningChanged };
}

beforeEach(() => {
  vi.clearAllMocks();
  useLearningStore.getState().resetLearning();
  getContentDeckCards.mockResolvedValue({
    data: [CARD],
    total: 1,
    limit: 50,
    offset: 0,
    hasNext: false,
    hasPrev: false,
  });
});

describe('LibraryDeckDetail enrollment', () => {
  it('tracks a successful deck enrollment without sending card content', async () => {
    const user = userEvent.setup();
    renderDetail();
    enrollDeck.mockResolvedValue(ENROLLMENT);

    await user.click(screen.getByRole('button', { name: /learn deck/i }));

    expect(track).toHaveBeenCalledWith('deck_enrolled', {
      deck_id: DECK.id,
      deck_slug: DECK.slug,
      deck_type: DECK.type,
      level: DECK.level,
      card_count: DECK.cardCount,
    });
  });

  it('tracks a successful deck unenrollment without sending card content', async () => {
    const user = userEvent.setup();
    renderDetail({ deck: { ...DECK, isLearning: true } });
    const stoppedToday = { ...TODAY, queue: [], totalDue: 0, caughtUp: true };
    unenrollDeck.mockResolvedValue({
      deckId: DECK.id,
      isLearning: false,
      today: stoppedToday,
    });

    await user.click(screen.getByRole('button', { name: /stop learning/i }));

    expect(track).toHaveBeenCalledWith('deck_unenrolled', {
      deck_id: DECK.id,
      deck_slug: DECK.slug,
      deck_type: DECK.type,
      level: DECK.level,
      card_count: DECK.cardCount,
    });
  });

  it('learns the whole deck and immediately replaces Today', async () => {
    const user = userEvent.setup();
    const props = renderDetail();
    enrollDeck.mockResolvedValue(ENROLLMENT);

    await user.click(screen.getByRole('button', { name: /learn deck/i }));

    expect(enrollDeck).toHaveBeenCalledWith(DECK.id, {
      token: 'fresh-token',
    });
    expect(props.onLearningChanged).toHaveBeenCalledWith(DECK.id, true);
    expect(useLearningStore.getState().today).toBe(TODAY);
    expect(
      await screen.findByRole('button', { name: /stop learning/i }),
    ).toBeEnabled();
  });

  it('keeps enrollment single-flight while the request is pending', async () => {
    const user = userEvent.setup();
    const request = deferred();
    enrollDeck.mockReturnValue(request.promise);
    renderDetail();

    const learn = screen.getByRole('button', { name: /learn deck/i });
    await user.click(learn);
    await user.click(learn);

    expect(enrollDeck).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: /adding deck/i }),
    ).toBeDisabled();

    request.resolve(ENROLLMENT);
    expect(
      await screen.findByRole('button', { name: /stop learning/i }),
    ).toBeEnabled();
  });

  it.each([
    [401, 'Your session expired. Please sign in again.'],
    [500, 'Could not add this deck. Try again.'],
  ])('keeps Learn available after status %s', async (status, message) => {
    const user = userEvent.setup();
    enrollDeck.mockRejectedValue(
      new ApiError(status, { message: 'failure' }, `/decks/${DECK.id}/enroll`),
    );
    renderDetail();

    await user.click(screen.getByRole('button', { name: /learn deck/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: /learn deck/i })).toBeEnabled();
    expect(useLearningStore.getState().today).toBeNull();
  });

  it('renders a durable stop-learning state from the Library response', () => {
    renderDetail({ deck: { ...DECK, isLearning: true } });

    expect(
      screen.getByRole('button', { name: /stop learning/i }),
    ).toBeEnabled();
    expect(enrollDeck).not.toHaveBeenCalled();
  });

  it('stops learning and replaces Today without deleting progress', async () => {
    const user = userEvent.setup();
    const props = renderDetail({ deck: { ...DECK, isLearning: true } });
    const stoppedToday = { ...TODAY, queue: [], totalDue: 0, caughtUp: true };
    unenrollDeck.mockResolvedValue({
      deckId: DECK.id,
      isLearning: false,
      today: stoppedToday,
    });

    await user.click(screen.getByRole('button', { name: /stop learning/i }));

    expect(unenrollDeck).toHaveBeenCalledWith(DECK.id, {
      token: 'fresh-token',
    });
    expect(props.onLearningChanged).toHaveBeenCalledWith(DECK.id, false);
    expect(useLearningStore.getState().today).toBe(stoppedToday);
    expect(
      await screen.findByRole('button', { name: /learn deck/i }),
    ).toBeEnabled();
  });

  it('keeps Stop learning available after a request failure', async () => {
    const user = userEvent.setup();
    unenrollDeck.mockRejectedValue(
      new ApiError(500, { message: 'failure' }, `/decks/${DECK.id}/enrollment`),
    );
    renderDetail({ deck: { ...DECK, isLearning: true } });

    await user.click(screen.getByRole('button', { name: /stop learning/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not stop learning this deck. Try again.',
    );
    expect(
      screen.getByRole('button', { name: /stop learning/i }),
    ).toBeEnabled();
  });
});
