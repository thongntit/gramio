import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  getToday,
  submitReview,
} from '@/services/openspeakApi';
import { useLearningStore } from '@/stores/learningStore';
import Review from '@/pages/Review';
import { track } from '@/lib/analytics';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const reviewSource = readFileSync(path.resolve(testDir, '../src/pages/Review.jsx'), 'utf8');

const clerk = vi.hoisted(() => ({ signOut: vi.fn() }));
const analytics = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: () => Promise.resolve('fresh-token') }),
  useClerk: () => ({ signOut: clerk.signOut }),
}));

vi.mock('@/services/openspeakApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getToday: vi.fn(),
    submitReview: vi.fn(),
  };
});

vi.mock('@/lib/analytics', () => ({
  track: analytics.track,
}));

const CARD = {
  id: 'be7d7592-2e3d-4a41-8cf5-20f1ea90f4fd',
  deck_id: '9bb9dfab-3572-44c0-a6cf-bd49edc30563',
  type: 'grammar',
  level: 'A1',
  front: 'She ___ here.',
  answer: 'works',
  explanation: 'Use present simple for a routine.',
  example: 'She works here.',
  options: ['work', 'works'],
  content_key: 'present-simple-1',
  content_version: 'v1',
  sort_order: 1,
};

const NEXT_CARD = {
  ...CARD,
  id: '22a4cd0f-768f-4446-90e6-62aa019a1490',
  type: 'vocab',
  front: 'mitigate',
  answer: 'make less severe',
  explanation: 'To reduce the seriousness of something.',
  example: 'Trees mitigate flood risk.',
  options: null,
  content_key: 'mitigate',
  sort_order: 2,
};

function queueItem(card) {
  return {
    card,
    progress: {
      stage: 'new',
      due_at: '2026-07-18T00:00:00.000Z',
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
  };
}

const TODAY = {
  queue: [queueItem(CARD)],
  totalDue: 1,
  countsByType: { grammar: 1 },
  countsByDeck: { [CARD.deck_id]: 1 },
  caughtUp: false,
  serverTimestamp: '2026-07-18T00:00:00.000Z',
};

const NEXT_TODAY = {
  ...TODAY,
  queue: [queueItem(NEXT_CARD)],
  countsByType: { vocab: 1 },
  serverTimestamp: '2026-07-18T00:01:00.000Z',
};

const UNUSABLE_TODAY = {
  ...TODAY,
  queue: [{
    ...queueItem(CARD),
    card: null,
  }],
};

const CAUGHT_UP = {
  ...TODAY,
  queue: [],
  totalDue: 0,
  countsByType: {},
  countsByDeck: {},
  caughtUp: true,
  serverTimestamp: '2026-07-18T00:02:00.000Z',
};

function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/review']}>
      <Routes>
        <Route path="/review" element={<Review />} />
        <Route path="/" element={<div>Today route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function revealAndRate(user, rating) {
  await user.click(screen.getByRole('button', { name: /show answer/i }));
  await user.click(screen.getByRole('button', { name: new RegExp(`^${rating}`, 'i') }));
}

async function selectAndReveal(user, option) {
  await user.click(screen.getByText(option, { exact: true }));
  await screen.findByLabelText('Correct answer');
}

async function armSwipe() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 260));
  });
}

async function swipeReviewCard({ fromX, toX, fromY = 180, toY = fromY }) {
  const card = screen.getByTestId('review-card');
  const pointer = { pointerId: 1, pointerType: 'touch' };
  fireEvent.pointerDown(card, { ...pointer, clientX: fromX, clientY: fromY });
  await armSwipe();
  fireEvent.pointerMove(card, { ...pointer, clientX: toX, clientY: toY });
  fireEvent.pointerUp(card, { ...pointer, clientX: toX, clientY: toY });
}

beforeEach(() => {
  vi.clearAllMocks();
  useLearningStore.getState().resetLearning();
});

describe('Review', () => {
  it('tracks a review lifecycle with safe card metadata', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockResolvedValue({ duplicate: false, today: CAUGHT_UP });

    renderReview();

    expect(track).toHaveBeenCalledWith('review_started', { due_count: 1 });
    await selectAndReveal(user, CARD.answer);
    await user.click(screen.getByRole('button', { name: 'Good' }));

    expect(track).toHaveBeenCalledWith('card_answered', {
      card_id: CARD.id,
      deck_id: CARD.deck_id,
      card_type: CARD.type,
      level: CARD.level,
      rating: 'good',
      answered_correctly: true,
    });
    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('review_completed', {
      cards_reviewed: 1,
      again: 0,
      hard: 0,
      good: 1,
      easy: 0,
      accuracy: 100,
    });
  });

  it('tracks failed review submissions with retry context and safe card metadata', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview
      .mockRejectedValueOnce(new ApiError(503, { message: 'Service unavailable' }, '/reviews'))
      .mockRejectedValueOnce(new ApiError(503, { message: 'Service unavailable' }, '/reviews'));

    renderReview();

    await revealAndRate(user, 'Good');
    await user.click(await screen.findByRole('button', { name: /retry review/i }));
    await screen.findByRole('button', { name: /retry review/i });

    expect(track.mock.calls.filter(([event]) => event === 'card_answer_failed')).toEqual([
      ['card_answer_failed', {
        card_id: CARD.id,
        deck_id: CARD.deck_id,
        card_type: CARD.type,
        level: CARD.level,
        rating: 'good',
        attempt: 'initial',
        status: 503,
        retryable: true,
      }],
      ['card_answer_failed', {
        card_id: CARD.id,
        deck_id: CARD.deck_id,
        card_type: CARD.type,
        level: CARD.level,
        rating: 'good',
        attempt: 'retry',
        status: 503,
        retryable: true,
      }],
    ]);
  });

  it('renders the backend queue head and answer fields', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);

    renderReview();

    expect(screen.getByText(CARD.front)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByLabelText('Correct answer')).toHaveTextContent(CARD.answer);
    expect(screen.getByText(CARD.explanation)).toBeInTheDocument();
    expect(screen.getByText(CARD.example)).toBeInTheDocument();
  });

  it('keeps a revealed answer and all rating actions in normal scroll flow', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockResolvedValue({ duplicate: false, today: NEXT_TODAY });

    renderReview();

    await user.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByText(CARD.explanation)).toBeInTheDocument();
    for (const label of ['Again', 'Hard', 'Good', 'Easy']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
    await user.click(screen.getByRole('button', { name: 'Good' }));
    expect(submitReview).toHaveBeenCalledOnce();

    expect(reviewSource).toContain('flex min-h-full flex-col animate-screen-fade-in');
    expect(reviewSource).not.toContain('min-h-0 flex-1 px-4 pb-3');
    expect(reviewSource).toContain('min-h-[calc(100dvh-190px)]');
  });

  it.each([
    ['correct left', 'works', { fromX: 240, toX: 120 }, 'easy'],
    ['correct right', 'works', { fromX: 120, toX: 240 }, 'hard'],
    ['wrong left', 'work', { fromX: 240, toX: 120 }, 'good'],
    ['wrong right', 'work', { fromX: 120, toX: 240 }, 'hard'],
  ])('%s swipe submits %s', async (_description, option, gesture, rating) => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockResolvedValue({ duplicate: false, today: NEXT_TODAY });
    renderReview();

    await selectAndReveal(user, option);
    await swipeReviewCard(gesture);

    await vi.waitFor(() => expect(submitReview).toHaveBeenCalledOnce());
    expect(submitReview.mock.calls[0][0]).toEqual(
      expect.objectContaining({ cardId: CARD.id, rating }),
    );
    expect(await screen.findByText(NEXT_CARD.front)).toBeInTheDocument();
  });

  it('shows the mapped rating while an eligible card is dragged', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();

    await selectAndReveal(user, CARD.answer);
    const card = screen.getByTestId('review-card');
    const pointer = { pointerId: 1, pointerType: 'touch' };
    fireEvent.pointerDown(card, { ...pointer, clientX: 240, clientY: 180 });
    await armSwipe();
    fireEvent.pointerMove(card, { ...pointer, clientX: 180, clientY: 180 });

    expect(screen.getByText('Easy', { selector: '[aria-hidden="true"]' })).toBeInTheDocument();
    fireEvent.pointerCancel(card, pointer);
  });

  it('does not pull the card sideways during a near-vertical scroll', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();

    await selectAndReveal(user, CARD.answer);
    const card = screen.getByTestId('review-card');
    const pointer = { pointerId: 1, pointerType: 'touch' };
    fireEvent.pointerDown(card, { ...pointer, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(card, { ...pointer, clientX: 184, clientY: 185 });

    expect(screen.queryByText('Easy', { selector: '[aria-hidden="true"]' })).not.toBeInTheDocument();
    fireEvent.pointerCancel(card, pointer);
  });

  it('keeps scrolling available when a vertical gesture drifts sideways', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();

    await selectAndReveal(user, CARD.answer);
    const card = screen.getByTestId('review-card');
    const pointer = { pointerId: 1, pointerType: 'touch' };
    fireEvent.pointerDown(card, { ...pointer, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(card, { ...pointer, clientX: 230, clientY: 180 });

    expect(screen.queryByText('Hard', { selector: '[aria-hidden="true"]' })).not.toBeInTheDocument();
    expect(card).not.toHaveClass('transition-none');
    fireEvent.pointerCancel(card, pointer);
  });

  it('tracks an intentional horizontal drag without a transform transition', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();

    await selectAndReveal(user, CARD.answer);
    const card = screen.getByTestId('review-card');
    const pointer = { pointerId: 1, pointerType: 'touch' };
    fireEvent.pointerDown(card, { ...pointer, clientX: 240, clientY: 180 });
    await armSwipe();
    fireEvent.pointerMove(card, { ...pointer, clientX: 180, clientY: 180 });

    expect(card).toHaveClass('transition-none');
    expect(card).not.toHaveClass('transition-transform');
    fireEvent.pointerCancel(card, pointer);
  });

  it('does not submit from a swipe before a multiple-choice answer is selected', async () => {
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();

    await swipeReviewCard({ fromX: 240, toX: 120 });

    expect(submitReview).not.toHaveBeenCalled();
  });

  it('does not submit from a direct Show answer reveal without a selection', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();

    await user.click(screen.getByRole('button', { name: /show answer/i }));
    await swipeReviewCard({ fromX: 240, toX: 120 });

    expect(screen.getByText(/choose an answer to swipe/i)).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('does not submit from a guided-recall swipe after the answer is shown', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(NEXT_TODAY);
    renderReview();

    await user.click(screen.getByRole('button', { name: /show answer/i }));
    await swipeReviewCard({ fromX: 240, toX: 120 });

    expect(screen.getByText(/use a rating button below/i)).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('does not submit for short or vertical touch drags', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();

    await selectAndReveal(user, CARD.answer);
    await swipeReviewCard({ fromX: 200, toX: 180 });
    await swipeReviewCard({ fromX: 200, toX: 160, fromY: 180, toY: 300 });

    expect(submitReview).not.toHaveBeenCalled();
  });

  it('does not submit a second swipe while the first rating is pending', async () => {
    const user = userEvent.setup();
    const request = deferred();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockReturnValue(request.promise);
    renderReview();

    await selectAndReveal(user, CARD.answer);
    await swipeReviewCard({ fromX: 240, toX: 120 });
    await vi.waitFor(() => expect(submitReview).toHaveBeenCalledOnce());
    await swipeReviewCard({ fromX: 120, toX: 240 });

    expect(submitReview).toHaveBeenCalledOnce();
    request.resolve({ duplicate: false, today: NEXT_TODAY });
    expect(await screen.findByText(NEXT_CARD.front)).toBeInTheDocument();
  });

  it('does not submit from a swipe while a retryable review error is visible', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockRejectedValueOnce(
      new ApiError(500, { message: 'failure' }, '/reviews'),
    );
    renderReview();

    await selectAndReveal(user, CARD.answer);
    await swipeReviewCard({ fromX: 240, toX: 120 });
    await screen.findByRole('button', { name: /retry review/i });
    await swipeReviewCard({ fromX: 120, toX: 240 });

    expect(submitReview).toHaveBeenCalledOnce();
  });

  it('disables ratings until POST resolves then renders the returned next card', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    let resolveReview;
    submitReview.mockReturnValue(new Promise((resolve) => {
      resolveReview = resolve;
    }));
    renderReview();

    await revealAndRate(user, 'Good');

    expect(screen.getByRole('button', { name: /^good/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /exit review/i })).toBeDisabled();
    resolveReview({ duplicate: false, today: NEXT_TODAY });

    expect(await screen.findByText(NEXT_CARD.front)).toBeInTheDocument();
    expect(screen.queryByText(CARD.front)).not.toBeInTheDocument();
  });

  it('records only the rating whose single in-flight submit is accepted', async () => {
    const user = userEvent.setup();
    const request = deferred();
    submitReview.mockReturnValue(request.promise);
    useLearningStore.getState().replaceToday(TODAY);
    renderReview();
    await user.click(screen.getByRole('button', { name: /show answer/i }));
    const good = screen.getByRole('button', { name: /^good/i });
    const easy = screen.getByRole('button', { name: /^easy/i });

    act(() => {
      good.click();
      easy.click();
    });
    await vi.waitFor(() => expect(submitReview).toHaveBeenCalled());
    request.resolve({ duplicate: false, today: CAUGHT_UP });

    expect(await screen.findByText(/you reviewed 1 cards/i)).toBeInTheDocument();
    expect(submitReview).toHaveBeenCalledOnce();
  });

  it('retries a transient failure with the identical request and completes', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview
      .mockRejectedValueOnce(new ApiError(500, { message: 'failure' }, '/reviews'))
      .mockResolvedValueOnce({ duplicate: true, today: CAUGHT_UP });
    renderReview();

    await revealAndRate(user, 'Good');

    const retry = await screen.findByRole('button', { name: /retry review/i });
    const firstPayload = submitReview.mock.calls[0][0];
    await user.click(retry);

    expect(submitReview.mock.calls[1][0]).toEqual(firstPayload);
    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
  });

  it('hard-refreshes Today state before showing a direct review route', async () => {
    getToday.mockResolvedValue(TODAY);

    renderReview();

    expect(screen.getByText(/loading review session/i)).toBeInTheDocument();
    expect(await screen.findByText(CARD.front)).toBeInTheDocument();
    expect(getToday).toHaveBeenCalledOnce();
  });

  it('offers a real reauthentication action when loading returns 401', async () => {
    const user = userEvent.setup();
    getToday.mockRejectedValue(
      new ApiError(401, { message: 'Authentication required' }, '/today'),
    );

    renderReview();

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sign in again/i }));
    expect(clerk.signOut).toHaveBeenCalledWith({ redirectUrl: '/' });
  });

  it('lets a learner return to Today when the review queue cannot load', async () => {
    const user = userEvent.setup();
    getToday.mockRejectedValue(
      new ApiError(503, { message: 'Service unavailable' }, '/today'),
    );

    renderReview();

    expect(await screen.findByText(/review is unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to today/i }));

    expect(screen.getByText('Today route')).toBeInTheDocument();
  });

  it('recovers from an unusable queued card without rendering card fields', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(UNUSABLE_TODAY);
    getToday.mockResolvedValue(NEXT_TODAY);

    renderReview();

    expect(screen.getByText(/review card is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByTestId('review-card')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^retry$/i }));

    expect(await screen.findByText(NEXT_CARD.front)).toBeInTheDocument();
  });

  it('shows recovery when the server returns an unusable next card', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockResolvedValue({ duplicate: false, today: UNUSABLE_TODAY });

    renderReview();

    await revealAndRate(user, 'Good');

    expect(await screen.findByText(/review card is unavailable/i)).toBeInTheDocument();
  });

  it('keeps a retryable review pending when the learner returns to Today', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockRejectedValue(
      new ApiError(503, { message: 'Service unavailable' }, '/reviews'),
    );
    renderReview();

    await revealAndRate(user, 'Good');
    await screen.findByRole('button', { name: /retry review/i });
    await user.click(screen.getByRole('button', { name: /back to today/i }));

    expect(screen.getByText('Today route')).toBeInTheDocument();
    expect(useLearningStore.getState().pendingReview).toEqual(
      expect.objectContaining({ cardId: CARD.id, rating: 'good' }),
    );
  });

  it('refreshes Today once after a submitted card returns 404', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockRejectedValue(
      new ApiError(404, { message: 'Card not found' }, '/reviews'),
    );
    getToday.mockResolvedValue(NEXT_TODAY);
    renderReview();

    await revealAndRate(user, 'Hard');

    expect(await screen.findByText(NEXT_CARD.front)).toBeInTheDocument();
    expect(getToday).toHaveBeenCalledOnce();
  });

  it('requires a session refresh after a 409 conflict', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(TODAY);
    submitReview.mockRejectedValue(
      new ApiError(409, { message: 'Request conflict' }, '/reviews'),
    );
    getToday.mockResolvedValue(NEXT_TODAY);
    renderReview();

    await revealAndRate(user, 'Easy');

    expect(await screen.findByText(/request conflict/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /refresh session/i }));
    expect(await screen.findByText(NEXT_CARD.front)).toBeInTheDocument();
  });

  it('returns from Complete to the caught-up Today route', async () => {
    const user = userEvent.setup();
    useLearningStore.getState().replaceToday(CAUGHT_UP);
    renderReview();

    await user.click(screen.getByRole('button', { name: /back to today/i }));

    expect(screen.getByText('Today route')).toBeInTheDocument();
  });
});

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
