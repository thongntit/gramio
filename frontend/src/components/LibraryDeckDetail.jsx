import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CircleMinus,
  Languages,
  Lightbulb,
  LoaderCircle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import TypeChip from '@/components/ui/TypeChip';
import { ApiError, getContentDeckCards } from '@/services/openspeakApi';
import { track } from '@/lib/analytics';
import { useLearningStore } from '@/stores/learningStore';

const TYPE_META = {
  vocab: { Icon: Languages, color: '#137fec' },
  grammar: { Icon: BookOpen, color: '#7c3aed' },
  tip: { Icon: Lightbulb, color: '#ea580c' },
};

export default function LibraryDeckDetail({
  deck,
  getToken,
  onBack,
  onLearningChanged,
}) {
  const [cards, setCards] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isLearning, setIsLearning] = useState(Boolean(deck.isLearning));
  const [enrollmentStatus, setEnrollmentStatus] = useState('idle');
  const [enrollmentError, setEnrollmentError] = useState(null);
  const enrollDeck = useLearningStore((state) => state.enrollDeck);
  const unenrollDeck = useLearningStore((state) => state.unenrollDeck);
  const meta = TYPE_META[deck.type] ?? TYPE_META.vocab;
  const Icon = meta.Icon;

  useEffect(() => {
    const controller = new AbortController();

    async function loadCards() {
      setStatus('loading');
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError(401, { message: 'Authentication required' }, `/content/decks/${deck.slug}/cards`);
        }
        const response = await getContentDeckCards(
          deck.slug,
          { limit: 50, offset: 0 },
          { token, signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setCards(response.data);
          setStatus('success');
        }
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError(requestError.status === 401
            ? 'Your session expired. Please sign in again.'
            : 'Library cards are unavailable right now.');
          setStatus('error');
        }
      }
    }

    loadCards();
    return () => controller.abort();
  }, [deck.slug, getToken, retryKey]);

  async function updateLearning(nextIsLearning) {
    if (nextIsLearning === isLearning || enrollmentStatus === 'loading') return;
    setEnrollmentStatus('loading');
    setEnrollmentError(null);
    try {
      const response = nextIsLearning
        ? await enrollDeck(deck.id, getToken)
        : await unenrollDeck(deck.id, getToken);
      if (!response) {
        setEnrollmentStatus('idle');
        return;
      }
      setIsLearning(nextIsLearning);
      setEnrollmentStatus('success');
      track(nextIsLearning ? 'deck_enrolled' : 'deck_unenrolled', {
        deck_id: deck.id,
        deck_slug: deck.slug,
        deck_type: deck.type,
        level: deck.level,
        card_count: deck.cardCount,
      });
      onLearningChanged?.(deck.id, nextIsLearning);
    } catch (requestError) {
      setEnrollmentStatus('error');
      setEnrollmentError(
        requestError.status === 401
          ? 'Your session expired. Please sign in again.'
          : nextIsLearning
            ? 'Could not add this deck. Try again.'
            : 'Could not stop learning this deck. Try again.',
      );
    }
  }

  return (
    <div className="animate-screen-fade-in">
      <header className="flex items-center px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Library"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-1)]"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
      </header>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-3.5">
          <div
            className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: `${meta.color}18`, color: meta.color }}
          >
            <Icon size={26} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <TypeChip type={deck.type} />
            <h1 className="mt-1.5 text-[22px] font-extrabold leading-[1.15] tracking-tight text-[var(--text-1)]">
              {deck.name}
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Card className="p-4">
          <button
            type="button"
            onClick={() => updateLearning(!isLearning)}
            disabled={enrollmentStatus === 'loading'}
            aria-busy={enrollmentStatus === 'loading'}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:cursor-default disabled:active:scale-100 ${
              isLearning
                ? 'border border-[rgba(190,18,60,.25)] bg-[rgba(190,18,60,.08)] text-[#be123c] dark:border-[rgba(253,164,175,.24)] dark:bg-[rgba(253,164,175,.12)] dark:text-[#fda4af]'
                : 'bg-[var(--primary-hex)] text-white'
            }`}
          >
            {enrollmentStatus === 'loading' ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : isLearning ? (
              <CircleMinus size={18} aria-hidden="true" />
            ) : (
              <BookOpen size={18} aria-hidden="true" />
            )}
            {enrollmentStatus === 'loading'
              ? isLearning ? 'Removing deck…' : 'Adding deck…'
              : isLearning ? 'Stop learning' : 'Learn deck'}
          </button>
          <p className="mt-2 text-center text-xs leading-relaxed text-[var(--text-2)]">
            {isLearning
              ? `Remove all ${deck.cardCount} active cards from your review schedule. Your history is kept.`
              : `Add all ${deck.cardCount} active cards to Today now.`}
          </p>
          {enrollmentError && (
            <p
              role="alert"
              aria-live="polite"
              className="mt-2 text-center text-xs font-semibold text-[#b42318] dark:text-[#fda29b]"
            >
              {enrollmentError}
            </p>
          )}
        </Card>
      </div>

      <div className="mb-2.5 flex items-center justify-between px-5">
        <span className="text-[12px] font-bold uppercase tracking-eyebrow text-[var(--text-2)]">
          Cards in this deck ({cards.length})
        </span>
      </div>
      <div className="px-4 pb-4">
        <Card className="overflow-hidden">
          {status === 'loading' && (
            <div className="p-7 text-center text-[13px] text-[var(--text-2)]">Loading cards…</div>
          )}
          {status === 'error' && (
            <div className="p-7 text-center text-[13px] text-[var(--text-2)]">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-3 min-h-11 rounded-xl bg-[var(--primary-hex)] px-4 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          )}
          {status === 'success' && cards.length === 0 && (
            <div className="p-7 text-center text-[13px] text-[var(--text-2)]">
              <p>This deck has no active cards.</p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-3 min-h-11 rounded-xl bg-[var(--primary-hex)] px-4 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          )}
          {status === 'success' && cards.map((card) => (
            <div key={card.id} className="border-b border-[var(--border-soft)] px-4 py-3.5 last:border-b-0">
              <div className="text-[14px] font-semibold tracking-snug text-[var(--text-1)]">{card.front}</div>
              <div className="mt-0.5 text-xs text-[var(--text-2)]">{card.answer}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
