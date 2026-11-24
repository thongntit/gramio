import { create } from 'zustand';
import {
  ApiError,
  enrollDeck as enrollDeckRequest,
  getToday,
  submitReview,
  unenrollDeck as unenrollDeckRequest,
} from '@/services/openspeakApi';

const INITIAL_STATE = {
  sessionEpoch: 0,
  today: null,
  loadStatus: 'idle',
  loadError: null,
  reviewStatus: 'idle',
  reviewError: null,
  pendingReview: null,
  reviewSnapshot: null,
};

function toStatusError(error) {
  return {
    status: error?.status ?? 0,
    message: error?.message || 'Request failed',
  };
}

function isRetryable(error) {
  return !error?.status || error.status >= 500;
}

async function requireToken(getToken) {
  const token = await getToken();
  if (!token) {
    throw new ApiError(
      401,
      { message: 'Authentication required' },
      '/auth',
    );
  }
  return token;
}

export const useLearningStore = create((set, get) => ({
  ...INITIAL_STATE,

  loadToday: async (getToken, { signal } = {}) => {
    const requestEpoch = get().sessionEpoch;
    const isCurrentSession = () => get().sessionEpoch === requestEpoch;
    set({ loadStatus: 'loading', loadError: null });
    try {
      const token = await requireToken(getToken);
      if (!isCurrentSession()) return null;
      const opts = signal ? { token, signal } : { token };
      const today = await getToday(opts);
      if (!isCurrentSession()) return null;
      set({ today, loadStatus: 'ready', loadError: null });
      return today;
    } catch (error) {
      if (!isCurrentSession()) return null;
      if (error?.name === 'AbortError') {
        set((state) => ({
          loadStatus: state.today ? 'ready' : 'idle',
          loadError: null,
        }));
        return null;
      }
      const loadError = toStatusError(error);
      if (error?.status === 401) {
        set((state) => ({
          ...INITIAL_STATE,
          sessionEpoch: state.sessionEpoch + 1,
          loadStatus: 'error',
          loadError,
        }));
        return null;
      }
      set({
        today: get().today,
        loadStatus: 'error',
        loadError,
      });
      return null;
    }
  },

  enrollDeck: async (deckId, getToken) => {
    const requestEpoch = get().sessionEpoch;
    const isCurrentSession = () => get().sessionEpoch === requestEpoch;
    try {
      const token = await requireToken(getToken);
      if (!isCurrentSession()) return null;
      const response = await enrollDeckRequest(deckId, { token });
      if (!isCurrentSession()) return null;
      set({
        today: response.today,
        loadStatus: 'ready',
        loadError: null,
      });
      return response;
    } catch (error) {
      if (!isCurrentSession()) return null;
      if (error?.status === 401) {
        const loadError = toStatusError(error);
        set((state) => ({
          ...INITIAL_STATE,
          sessionEpoch: state.sessionEpoch + 1,
          loadStatus: 'error',
          loadError,
        }));
      }
      throw error;
    }
  },

  unenrollDeck: async (deckId, getToken) => {
    const requestEpoch = get().sessionEpoch;
    const isCurrentSession = () => get().sessionEpoch === requestEpoch;
    try {
      const token = await requireToken(getToken);
      if (!isCurrentSession()) return null;
      const response = await unenrollDeckRequest(deckId, { token });
      if (!isCurrentSession()) return null;
      set({
        today: response.today,
        loadStatus: 'ready',
        loadError: null,
      });
      return response;
    } catch (error) {
      if (!isCurrentSession()) return null;
      if (error?.status === 401) {
        const loadError = toStatusError(error);
        set((state) => ({
          ...INITIAL_STATE,
          sessionEpoch: state.sessionEpoch + 1,
          loadStatus: 'error',
          loadError,
        }));
      }
      throw error;
    }
  },

  replaceToday: (today) => set({
    today,
    loadStatus: 'ready',
    loadError: null,
  }),

  beginReview: (cardId, rating) => {
    const existing = get().pendingReview;
    if (
      existing?.cardId === cardId
      && existing?.rating === rating
    ) {
      return existing;
    }
    if (get().reviewStatus === 'submitting') return existing;

    const pendingReview = {
      cardId,
      rating,
      clientRequestId: crypto.randomUUID(),
      clientReviewedAt: new Date().toISOString(),
    };
    const today = get().today;
    set({
      today: today?.queue?.length > 1
        ? { ...today, queue: today.queue.slice(1), caughtUp: false }
        : today,
      pendingReview,
      reviewSnapshot: today,
      reviewStatus: 'idle',
      reviewError: null,
    });
    return pendingReview;
  },

  submitPendingReview: async (getToken) => {
    const { pendingReview, reviewStatus, reviewSnapshot, today } = get();
    if (!pendingReview) return null;
    if (reviewStatus === 'submitting') return null;
    const expectedCardId = reviewSnapshot?.queue?.[1]?.card?.id
      ?? reviewSnapshot?.queue?.[0]?.card?.id;
    if (today?.queue?.[0]?.card?.id !== expectedCardId) {
      const reviewError = {
        status: 409,
        message: 'The review session changed. Refresh before rating again.',
      };
      set({
        pendingReview: null,
        reviewSnapshot: null,
        reviewStatus: 'error',
        reviewError,
      });
      return null;
    }
    const requestEpoch = get().sessionEpoch;
    const isCurrentSession = () => get().sessionEpoch === requestEpoch;

    set({ reviewStatus: 'submitting', reviewError: null });
    try {
      const token = await requireToken(getToken);
      if (!isCurrentSession()) return null;
      const response = await submitReview(pendingReview, { token });
      if (!isCurrentSession()) return null;
      set({
        today: response.today,
        loadStatus: 'ready',
        loadError: null,
        pendingReview: null,
        reviewSnapshot: null,
        reviewStatus: 'idle',
        reviewError: null,
      });
      return response;
    } catch (error) {
      if (!isCurrentSession()) return null;
      const reviewError = toStatusError(error);
      if (error?.status === 401) {
        set((state) => ({
          ...INITIAL_STATE,
          sessionEpoch: state.sessionEpoch + 1,
          loadStatus: 'error',
          loadError: reviewError,
          reviewStatus: 'error',
          reviewError,
        }));
      } else if (isRetryable(error)) {
        set({
          reviewStatus: 'retryable-error',
          reviewError,
          pendingReview,
        });
      } else {
        set((state) => ({
          today: state.reviewSnapshot ?? state.today,
          pendingReview: null,
          reviewSnapshot: null,
          reviewStatus: 'error',
          reviewError,
        }));
      }
      return null;
    }
  },

  retryPendingReview: (getToken) => get().submitPendingReview(getToken),

  clearReviewError: () => set({ reviewError: null }),

  resetLearning: () => set((state) => ({
    ...INITIAL_STATE,
    sessionEpoch: state.sessionEpoch + 1,
  })),
}));
