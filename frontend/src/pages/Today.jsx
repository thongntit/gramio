import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  CreditCard,
  Flame,
  Languages,
  Lightbulb,
  Map,
  Moon,
  RefreshCw,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import ReauthenticateButton from '@/components/ReauthenticateButton';
import { useLearningStore } from '@/stores/learningStore';
import { useThemeStore } from '@/stores/themeStore';

const TODAY_LABEL = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export default function Today() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { isDark, toggleTheme } = useThemeStore();
  const today = useLearningStore((state) => state.today);
  const loadStatus = useLearningStore((state) => state.loadStatus);
  const loadError = useLearningStore((state) => state.loadError);
  const loadToday = useLearningStore((state) => state.loadToday);

  useEffect(() => {
    if (loadStatus === 'idle') {
      void loadToday(getToken);
    }
  }, [getToken, loadStatus, loadToday]);

  let content;
  if (loadStatus === 'idle' || loadStatus === 'loading') {
    content = <TodayLoading />;
  } else if (loadStatus === 'error') {
    content = (
      <TodayError
        error={loadError}
        onRetry={() => loadToday(getToken)}
      />
    );
  } else if (!today || today.caughtUp || today.queue.length === 0) {
    content = <TodayCaughtUp onBrowse={() => navigate('/library')} />;
  } else {
    content = (
      <TodayReady
        today={today}
        onStart={() => navigate('/review')}
        onBrowse={() => navigate('/library')}
      />
    );
  }

  return (
    <div className="animate-screen-fade-in">
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <div className="text-[13px] font-semibold text-[var(--text-2)]">
            {TODAY_LABEL}
          </div>
          <div className="mt-0.5 text-[24px] font-extrabold tracking-tight text-[var(--text-1)]">
            Today
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-1)]"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>
      {content}
      <div className="px-4 pb-5 pt-4">
        <Link
          to="/missions"
          className="flex min-h-14 items-center gap-3 rounded-card border border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-hex)]"
        >
          <Map size={21} className="shrink-0 text-[var(--primary-hex)]" aria-hidden="true" />
          <span className="flex-1 font-bold">English Missions</span>
          <ArrowRight size={17} className="shrink-0 text-[var(--text-2)]" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function TodayLoading() {
  return (
    <div className="px-4 pt-2" role="status">
      <Card className="p-6 text-center">
        <RefreshCw
          size={28}
          className="mx-auto animate-spin text-[var(--primary-hex)]"
          aria-hidden="true"
        />
        <div className="mt-3 text-[15px] font-bold text-[var(--text-1)]">
          Loading Today
        </div>
        <div className="mt-1 text-[13px] text-[var(--text-2)]">
          Fetching your latest review queue.
        </div>
      </Card>
    </div>
  );
}

function TodayError({ error, onRetry }) {
  const status = error?.status ?? 0;
  const copy = status === 401
    ? {
      title: 'Your session expired',
      detail: 'Sign in again before loading your learning queue.',
    }
    : status === 404
      ? {
        title: 'Learning route is unavailable',
        detail: 'The deployed backend does not expose Today yet.',
      }
      : status >= 500
        ? {
          title: 'Today is unavailable',
          detail: 'The learning service had a server error.',
        }
        : {
          title: 'Could not reach the learning service',
          detail: 'Check your connection and try again.',
        };

  return (
    <div className="px-4 pt-2">
      <Card className="p-6 text-center">
        <TriangleAlert
          size={32}
          className="mx-auto text-[#b45309] dark:text-[#fbbf24]"
          aria-hidden="true"
        />
        <div className="mt-3 text-[17px] font-extrabold text-[var(--text-1)]">
          {copy.title}
        </div>
        <div className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
          {copy.detail}
        </div>
        {status === 401 ? (
          <ReauthenticateButton className="mt-5 h-12 w-full rounded-xl bg-[var(--primary-hex)] px-4 text-[15px] font-semibold text-white active:scale-[0.98]" />
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 h-12 w-full rounded-xl bg-[var(--primary-hex)] px-4 text-[15px] font-semibold text-white active:scale-[0.98]"
          >
            Retry
          </button>
        )}
      </Card>
    </div>
  );
}

function TodayCaughtUp({ onBrowse }) {
  return (
    <div className="px-4 pt-2">
      <Card className="p-7 text-center">
        <div className="mx-auto inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(7,136,56,.10)] text-[#078838] dark:bg-[rgba(74,222,128,.14)] dark:text-[#4ade80]">
          <Check size={34} strokeWidth={2.2} />
        </div>
        <div className="mt-4 text-[24px] font-extrabold tracking-tight text-[var(--text-1)]">
          You’re caught up
        </div>
        <div className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-2)]">
          No cards are due right now. Come back later for your next review.
        </div>
        <button
          type="button"
          onClick={onBrowse}
          className="mt-6 h-12 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-app)] text-[15px] font-semibold text-[var(--text-1)] active:scale-[0.98]"
        >
          Browse library
        </button>
      </Card>
    </div>
  );
}

function TodayReady({ today, onStart, onBrowse }) {
  const byType = today.countsByType ?? {};

  return (
    <>
      <section className="relative mx-4 mb-3.5 flex items-center gap-3.5 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#137fec] to-[#0a5fb5] px-4 py-3.5 text-white">
        <span className="pointer-events-none absolute -right-8 -top-8 h-[140px] w-[140px] rounded-full bg-white/10" />
        <div className="relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/[0.18]">
          <Flame size={22} />
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <div className="text-[18px] font-extrabold tracking-tight">
            Daily practice
          </div>
          <div className="mt-0.5 text-[13px] opacity-85">
            Your queue is synced with Gramio.
          </div>
        </div>
      </section>

      <div className="px-4">
        <Card className="p-[22px]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-eyebrow text-[var(--text-2)]">
                Cards due
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[56px] font-extrabold leading-none tracking-tightest text-[var(--text-1)]">
                  {today.totalDue}
                </span>
                <span className="text-[18px] font-bold text-[var(--text-2)]">
                  to review
                </span>
              </div>
            </div>
            <div className="inline-flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-[18px] bg-[rgba(19,127,236,.10)] text-[var(--primary-hex)]">
              <CreditCard size={28} strokeWidth={1.8} />
            </div>
          </div>

          <div className="mb-4 mt-4 flex flex-wrap gap-1.5">
            {byType.vocab > 0 && (
              <TypeChip icon={<Languages size={12} />} label={`${byType.vocab} vocab`} variant="vocab" />
            )}
            {byType.grammar > 0 && (
              <TypeChip icon={<BookOpen size={12} />} label={`${byType.grammar} grammar`} variant="grammar" />
            )}
            {byType.tip > 0 && (
              <TypeChip icon={<Lightbulb size={12} />} label={`${byType.tip} tips`} variant="tip" />
            )}
          </div>

          <button
            type="button"
            onClick={onStart}
            className="flex h-[52px] w-full items-center justify-between rounded-xl bg-[var(--primary-hex)] px-[18px] text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5">
              <CreditCard size={18} strokeWidth={1.8} />
              Start review session
            </span>
            <ArrowRight size={18} strokeWidth={2} />
          </button>
        </Card>
      </div>

      <div className="px-4 pb-4 pt-3 text-center">
        <button
          type="button"
          onClick={onBrowse}
          className="min-h-11 px-4 text-[13px] font-semibold text-[var(--primary-hex)]"
        >
          Browse library
        </button>
      </div>
    </>
  );
}

function TypeChip({ icon, label, variant }) {
  const variants = {
    vocab: 'bg-[rgba(19,127,236,.10)] text-[#137fec] dark:bg-[rgba(96,165,250,.15)] dark:text-[#60a5fa]',
    grammar: 'bg-[rgba(124,58,237,.10)] text-[#7c3aed] dark:bg-[rgba(167,139,250,.15)] dark:text-[#a78bfa]',
    tip: 'bg-[rgba(234,88,12,.10)] text-[#ea580c] dark:bg-[rgba(251,146,60,.15)] dark:text-[#fb923c]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.02em] ${variants[variant]}`}>
      {icon} {label}
    </span>
  );
}
