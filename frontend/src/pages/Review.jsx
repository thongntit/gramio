import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import TypeChip from '@/components/ui/TypeChip';
import ReauthenticateButton from '@/components/ReauthenticateButton';
import useHorizontalSwipe from '@/hooks/useHorizontalSwipe';
import { track } from '@/lib/analytics';
import { useLearningStore } from '@/stores/learningStore';

const REVIEW_BUTTONS = [
  { id: 'again', label: 'Again', color: '#be123c' },
  { id: 'hard', label: 'Hard', color: '#b45309' },
  { id: 'good', label: 'Good', color: '#078838' },
  { id: 'easy', label: 'Easy', color: '#137fec' },
];

const EMPTY_COUNTS = { again: 0, hard: 0, good: 0, easy: 0 };

const SWIPE_FEEDBACK = {
  easy: {
    label: 'Easy',
    className: 'border-[rgba(19,127,236,.3)] bg-[rgba(19,127,236,.12)] text-[var(--primary-hex)]',
  },
  good: {
    label: 'Good',
    className: 'border-[rgba(7,136,56,.3)] bg-[rgba(7,136,56,.12)] text-[#078838] dark:text-[#4ade80]',
  },
  hard: {
    label: 'Hard',
    className: 'border-[rgba(180,83,9,.3)] bg-[rgba(180,83,9,.12)] text-[#b45309] dark:text-[#fbbf24]',
  },
};

function isRenderableReviewCard(card) {
  return Boolean(
    card
    && typeof card.id === 'string'
    && card.id.length > 0
    && typeof card.front === 'string'
    && typeof card.answer === 'string',
  );
}

export default function Review() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const today = useLearningStore((state) => state.today);
  const loadStatus = useLearningStore((state) => state.loadStatus);
  const loadError = useLearningStore((state) => state.loadError);
  const reviewStatus = useLearningStore((state) => state.reviewStatus);
  const reviewError = useLearningStore((state) => state.reviewError);
  const pendingReview = useLearningStore((state) => state.pendingReview);
  const reviewSnapshot = useLearningStore((state) => state.reviewSnapshot);
  const loadToday = useLearningStore((state) => state.loadToday);
  const beginReview = useLearningStore((state) => state.beginReview);
  const submitPendingReview = useLearningStore((state) => state.submitPendingReview);
  const retryPendingReview = useLearningStore((state) => state.retryPendingReview);
  const clearReviewError = useLearningStore((state) => state.clearReviewError);
  const [cardUi, setCardUi] = useState({
    cardId: null,
    revealed: false,
    picked: null,
  });
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [reviewedCount, setReviewedCount] = useState(0);
  const refreshedMissingCard = useRef(null);
  const reviewStarted = useRef(false);

  const card = today?.queue?.[0]?.card ?? null;
  const isSubmitting = reviewStatus === 'submitting';
  const currentCardUi = cardUi.cardId === card?.id
    ? cardUi
    : { cardId: card?.id ?? null, revealed: false, picked: null };
  const { revealed, picked } = currentCardUi;
  const hasMCQ = Array.isArray(card?.options) && card.options.length > 0;

  useEffect(() => {
    if (loadStatus === 'idle') {
      void loadToday(getToken);
    }
  }, [getToken, loadStatus, loadToday]);

  useEffect(() => {
    if (
      reviewStarted.current
      || loadStatus !== 'ready'
      || !today
      || today.caughtUp
      || today.queue.length === 0
    ) {
      return;
    }

    reviewStarted.current = true;
    track('review_started', { due_count: today.totalDue });
  }, [loadStatus, today]);

  useEffect(() => {
    if (reviewError?.status !== 404) return;
    const refreshKey = `${card?.id ?? 'empty'}:${reviewError.message}`;
    if (refreshedMissingCard.current === refreshKey) return;
    refreshedMissingCard.current = refreshKey;

    clearReviewError();
    void loadToday(getToken);
  }, [card?.id, clearReviewError, getToken, loadToday, reviewError]);

  const exitReview = () => {
    if (!isSubmitting) navigate('/', { replace: true });
  };

  const submitRating = async (rating) => {
    if (!card || isSubmitting) return;
    const reviewCard = card;
    const answeredCorrectly = hasMCQ && picked
      ? picked === reviewCard.answer
      : null;
    beginReview(reviewCard.id, rating);
    const response = await submitPendingReview(getToken);
    if (response) {
      recordAcceptedRating(rating, reviewCard, answeredCorrectly);
    } else {
      recordFailedRating(rating, reviewCard, 'initial');
    }
  };

  const retryReview = async () => {
    const rating = pendingReview?.rating;
    if (!rating || isSubmitting) return;
    const reviewCard = reviewSnapshot?.queue?.[0]?.card ?? card;
    const reviewHasMCQ = Array.isArray(reviewCard?.options) && reviewCard.options.length > 0;
    const answeredCorrectly = reviewHasMCQ && picked
      ? picked === reviewCard.answer
      : null;
    const response = await retryPendingReview(getToken);
    if (response) {
      recordAcceptedRating(rating, reviewCard, answeredCorrectly);
    } else {
      recordFailedRating(rating, reviewCard, 'retry');
    }
  };

  const recordAcceptedRating = (rating, reviewCard, answeredCorrectly) => {
    const properties = {
      card_id: reviewCard?.id,
      deck_id: reviewCard?.deck_id,
      card_type: reviewCard?.type,
      level: reviewCard?.level,
      rating,
      answered_correctly: answeredCorrectly,
    };
    track('card_answered', properties);
    setCounts((current) => ({
      ...current,
      [rating]: current[rating] + 1,
    }));
    setReviewedCount((current) => current + 1);
  };

  const recordFailedRating = (rating, reviewCard, attempt) => {
    const { reviewError, reviewStatus: currentReviewStatus } = useLearningStore.getState();
    if (!reviewError) return;

    track('card_answer_failed', {
      card_id: reviewCard?.id,
      deck_id: reviewCard?.deck_id,
      card_type: reviewCard?.type,
      level: reviewCard?.level,
      rating,
      attempt,
      status: reviewError.status,
      retryable: currentReviewStatus === 'retryable-error',
    });
  };

  const refreshSession = async () => {
    await loadToday(getToken);
    clearReviewError();
  };

  const swipeEnabled = Boolean(
    hasMCQ && revealed && picked && !isSubmitting && !reviewError,
  );
  const leftSwipeRating = picked === card?.answer ? 'easy' : 'good';
  const { dragX, direction: swipeDirection, pointerHandlers } = useHorizontalSwipe({
    enabled: swipeEnabled,
    onSwipeLeft: () => void submitRating(leftSwipeRating),
    onSwipeRight: () => void submitRating('hard'),
  });
  const swipeRating = swipeDirection === 'left'
    ? leftSwipeRating
    : swipeDirection === 'right' ? 'hard' : null;

  if (loadStatus === 'idle' || loadStatus === 'loading') {
    return <ReviewLoading />;
  }

  if (loadStatus === 'error') {
    return (
      <ReviewLoadError
        error={loadError}
        onRetry={refreshSession}
        onExit={exitReview}
      />
    );
  }

  if (!today || today.caughtUp || today.queue.length === 0) {
    return (
      <ReviewDone
        counts={counts}
        total={reviewedCount}
        onExit={() => navigate('/', { replace: true })}
      />
    );
  }

  if (!isRenderableReviewCard(card)) {
    return <ReviewCardUnavailable onRetry={refreshSession} onExit={exitReview} />;
  }

  const total = reviewedCount + today.totalDue;
  const progressPct = Math.min(
    100,
    Math.round((reviewedCount / Math.max(1, total)) * 100),
  );

  const pick = (option) => {
    if (picked || isSubmitting) return;
    setCardUi({ cardId: card.id, revealed: false, picked: option });
    setTimeout(() => {
      setCardUi((current) => current.cardId === card.id
        ? { ...current, revealed: true }
        : current);
    }, 350);
  };

  return (
    <div className="flex min-h-full flex-col animate-screen-fade-in">
      <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={exitReview}
          disabled={isSubmitting}
          aria-label="Exit review"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={18} strokeWidth={2} />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border-soft)]">
          <div
            className="h-full rounded-full bg-[var(--primary-hex)] transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="min-w-[42px] text-right font-mono text-[12px] font-semibold text-[var(--text-2)]">
          {Math.min(reviewedCount + 1, total)}/{total}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative w-full">
          <div
            className="pointer-events-none absolute bottom-[-16px] left-0 right-0 rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card)] opacity-35"
            style={{ top: 16, transform: 'scale(0.92)' }}
          />
          <div
            className="pointer-events-none absolute bottom-[-8px] left-0 right-0 rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card)] opacity-60"
            style={{ top: 8, transform: 'scale(0.96)' }}
          />

          <div
            key={card.id}
            data-testid="review-card"
            {...pointerHandlers}
            style={{
              touchAction: swipeEnabled ? 'pan-y' : undefined,
              transform: dragX ? `translateX(${dragX}px) rotate(${dragX / 30}deg)` : undefined,
            }}
            className={cn(
              'relative flex min-h-[calc(100dvh-190px)] w-full flex-col rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-[0_6px_20px_rgba(15,22,32,0.04)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.3)]',
              swipeEnabled && 'select-none',
              dragX ? 'transition-none' : 'transition-transform duration-150',
            )}
          >
            {swipeRating && (
              <div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border px-4 py-1.5 text-sm font-bold shadow-sm',
                  SWIPE_FEEDBACK[swipeRating].className,
                )}
              >
                {SWIPE_FEEDBACK[swipeRating].label}
              </div>
            )}
            <div className="mb-4 flex items-center justify-between">
              <TypeChip type={card.type} />
              <span className="font-mono text-[11px] font-semibold uppercase text-[var(--text-2)]">
                {card.level}
              </span>
            </div>

            <div className="whitespace-pre-wrap text-center text-[30px] font-bold leading-[1.2] tracking-tight text-[var(--text-1)]">
              {card.front}
            </div>

            {hasMCQ && (
              <div className="mt-5 flex flex-col gap-2">
                {card.options.map((option, index) => {
                  const correct = revealed && option === card.answer;
                  const wrong = revealed && picked === option && option !== card.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={Boolean(picked) || isSubmitting}
                      onClick={() => pick(option)}
                      className={cn(
                        'flex min-h-11 items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[15px] font-medium transition-all',
                        'border-[var(--border-soft)] bg-[var(--bg-app)]',
                        !picked && 'hover:border-[var(--primary-hex)]',
                        correct && 'border-[rgba(7,136,56,.4)] bg-[rgba(7,136,56,.08)] text-[#078838]',
                        wrong && 'border-[rgba(190,18,60,.4)] bg-[rgba(190,18,60,.08)] text-[#be123c]',
                        picked && !correct && !wrong && 'opacity-60',
                      )}
                    >
                      <span className="inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border border-[var(--border-soft)] bg-[var(--bg-card)] font-mono text-[11px] font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {correct && <Check size={16} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            )}

            {revealed && (
              <div className="mt-5 animate-screen-fade-in border-t border-[var(--border-soft)] pt-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-2)]">
                  Answer
                </div>
                <div
                  aria-label="Correct answer"
                  className="mt-2 text-[18px] font-bold leading-[1.4] text-[var(--text-1)]"
                >
                  {card.answer}
                </div>
                <div className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                  {card.explanation}
                </div>
                {card.example && (
                  <div className="mt-3.5 whitespace-pre-wrap rounded-xl bg-[var(--bg-app)] p-3 text-[13px] italic leading-relaxed text-[var(--text-2)]">
                    {card.example}
                  </div>
                )}
                {hasMCQ && !picked && (
                  <p role="status" className="mt-3 text-center text-sm text-[var(--text-2)]">
                    Choose an answer to swipe, or use a rating below.
                  </p>
                )}
                {!hasMCQ && (
                  <p role="status" className="mt-3 text-center text-sm text-[var(--text-2)]">
                    Use a rating button below to continue.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pb-6">
        {reviewError && reviewError.status !== 404 && (
          <ReviewError
            error={reviewError}
            retryable={reviewStatus === 'retryable-error'}
            submitting={isSubmitting}
            onRetry={retryReview}
            onRefresh={refreshSession}
            onExit={exitReview}
          />
        )}

        {!revealed ? (
          <button
            type="button"
            onClick={() => setCardUi({
              cardId: card.id,
              revealed: true,
              picked: null,
            })}
            disabled={isSubmitting}
            className="h-[52px] w-full rounded-xl bg-[var(--primary-hex)] text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {REVIEW_BUTTONS.map((button) => (
              <button
                key={button.id}
                type="button"
                aria-label={button.label}
                disabled={isSubmitting || Boolean(reviewError)}
                onClick={() => submitRating(button.id)}
                className={cn(
                  'flex min-h-12 items-center justify-center rounded-[14px] border bg-[var(--bg-card)] px-1 text-[13px] font-bold transition-transform active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50',
                  button.id === 'again' && 'border-[rgba(190,18,60,.3)] text-[#be123c]',
                  button.id === 'hard' && 'border-[rgba(180,83,9,.3)] text-[#b45309]',
                  button.id === 'good' && 'border-[rgba(7,136,56,.3)] text-[#078838]',
                  button.id === 'easy' && 'border-[rgba(19,127,236,.3)] text-[var(--primary-hex)]',
                )}
              >
                {button.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewLoading() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center" role="status">
      <div>
        <RefreshCw size={30} className="mx-auto animate-spin text-[var(--primary-hex)]" />
        <div className="mt-3 text-[17px] font-extrabold text-[var(--text-1)]">
          Loading review session
        </div>
        <div className="mt-1 text-[13px] text-[var(--text-2)]">
          Fetching the latest queue from Gramio.
        </div>
      </div>
    </div>
  );
}

function ReviewLoadError({ error, onRetry, onExit }) {
  const status = error?.status ?? 0;
  const title = status === 401
    ? 'Your session expired'
    : status === 404
      ? 'Learning route is unavailable'
      : status >= 500
        ? 'Review is unavailable'
        : 'Could not reach the learning service';

  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <TriangleAlert size={34} className="mx-auto text-[#b45309] dark:text-[#fbbf24]" />
        <div className="mt-3 text-[19px] font-extrabold text-[var(--text-1)]">
          {title}
        </div>
        <div className="mt-1 text-[13px] text-[var(--text-2)]">
          {status === 401
            ? 'Sign in again before reviewing cards.'
            : 'Your queue could not be loaded.'}
        </div>
        <div className="mt-5 flex flex-col items-center gap-2">
          {status === 401 ? (
            <ReauthenticateButton className="h-12 min-w-40 rounded-xl bg-[var(--primary-hex)] px-5 text-[15px] font-semibold text-white" />
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="h-12 min-w-40 rounded-xl bg-[var(--primary-hex)] px-5 text-[15px] font-semibold text-white"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 px-3 text-[14px] font-bold text-[var(--primary-hex)]"
          >
            Back to Today
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewCardUnavailable({ onRetry, onExit }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <TriangleAlert size={34} className="mx-auto text-[#b45309] dark:text-[#fbbf24]" />
        <div className="mt-3 text-[19px] font-extrabold text-[var(--text-1)]">
          Review card is unavailable
        </div>
        <div className="mt-1 text-[13px] text-[var(--text-2)]">
          We could not open the next card. Retry the session or return to Today.
        </div>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="h-12 min-w-40 rounded-xl bg-[var(--primary-hex)] px-5 text-[15px] font-semibold text-white"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 px-3 text-[14px] font-bold text-[var(--primary-hex)]"
          >
            Back to Today
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewError({ error, retryable, submitting, onRetry, onRefresh, onExit }) {
  return (
    <div className="mb-3 rounded-xl border border-[rgba(180,83,9,.25)] bg-[rgba(180,83,9,.07)] p-3 text-[13px] text-[var(--text-1)]">
      <div className="font-bold">
        {retryable ? 'Review was not sent' : error.message}
      </div>
      {retryable && (
        <div className="mt-0.5 text-[var(--text-2)]">
          Your card stayed in place. Retry the same review safely.
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={retryable ? onRetry : onRefresh}
          className="min-h-11 rounded-lg bg-[var(--bg-card)] px-3 font-bold text-[var(--primary-hex)] disabled:opacity-50"
        >
          {retryable ? 'Retry review' : 'Refresh session'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onExit}
          className="min-h-11 rounded-lg px-3 font-bold text-[var(--primary-hex)] disabled:opacity-50"
        >
          Back to Today
        </button>
      </div>
    </div>
  );
}

function ReviewDone({ counts, total, onExit }) {
  const remembered = counts.good + counts.easy;
  const accuracy = total ? Math.round((remembered / total) * 100) : 0;
  const completionTracked = useRef(false);

  useEffect(() => {
    if (total === 0 || completionTracked.current) return;

    completionTracked.current = true;
    track('review_completed', {
      cards_reviewed: total,
      again: counts.again,
      hard: counts.hard,
      good: counts.good,
      easy: counts.easy,
      accuracy,
    });
  }, [accuracy, counts, total]);

  return (
    <div className="flex flex-col items-center px-6 py-16 text-center animate-screen-fade-in">
      <div className="mb-4 inline-flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[rgba(7,136,56,.10)] text-[#078838] dark:bg-[rgba(74,222,128,.14)] dark:text-[#4ade80]">
        <Check size={42} strokeWidth={2} />
      </div>
      <div className="text-[26px] font-extrabold tracking-tight text-[var(--text-1)]">
        Session complete
      </div>
      <div className="mb-6 mt-1.5 text-[14px] text-[var(--text-2)]">
        {total > 0
          ? `You reviewed ${total} cards · ${accuracy}% remembered well`
          : 'Your review queue is caught up.'}
      </div>

      {total > 0 && (
        <div className="mb-5 grid w-full grid-cols-4 gap-2">
          {REVIEW_BUTTONS.map((button) => (
            <div
              key={button.id}
              className="rounded-card border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 text-center"
            >
              <div className="text-[20px] font-extrabold" style={{ color: button.color }}>
                {counts[button.id]}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-eyebrow text-[var(--text-2)]">
                {button.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className="h-12 w-full rounded-xl bg-[var(--primary-hex)] text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
      >
        Back to Today
      </button>
    </div>
  );
}
