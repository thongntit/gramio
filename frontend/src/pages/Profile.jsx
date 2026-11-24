import { useEffect, useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  ChevronRight,
  Lock,
  LogOut,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import NotificationSettings from '@/components/NotificationSettings';
import { getProfileSummary } from '@/services/openspeakApi';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/cn';

function initialsOf(user) {
  const first = user?.firstName?.[0] ?? '';
  const last = user?.lastName?.[0] ?? '';
  if (first || last) return `${first}${last}`.toUpperCase();
  const email = user?.primaryEmailAddress?.emailAddress;
  return email ? email.slice(0, 2).toUpperCase() : '?';
}

function ListRow({ icon, title, subtitle, right, danger, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors',
        'active:bg-black/[0.02] dark:active:bg-white/[0.03]',
        'border-b border-[var(--border-soft)] last:border-b-0',
        danger && 'text-[#e11d48]',
      )}
    >
      <span
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--bg-app)]',
          danger ? 'text-[#e11d48]' : 'text-[var(--text-1)]',
        )}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={cn('block text-[15px] font-semibold', danger ? 'text-[#e11d48]' : 'text-[var(--text-1)]')}>
          {title}
        </span>
        {subtitle && (
          <span className="block text-xs text-[var(--text-2)]">{subtitle}</span>
        )}
      </span>
      {right ?? <ChevronRight size={16} className="text-[var(--text-2)]" />}
    </button>
  );
}

function Toggle({ on }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-block h-[26px] w-11 rounded-full transition-colors',
        on ? 'bg-[var(--primary-hex)]' : 'bg-[var(--border-soft)]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-all',
          on ? 'left-5' : 'left-0.5',
        )}
      />
    </span>
  );
}

export default function Profile() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const { isDark, toggleTheme } = useThemeStore();
  const [summary, setSummary] = useState(null);
  const [summaryStatus, setSummaryStatus] = useState('loading');
  const [summaryRetryKey, setSummaryRetryKey] = useState(0);

  const name = user?.fullName || user?.firstName || user?.username || 'You';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  const openClerkProfile = () => clerk.openUserProfile();
  const handleSignOut = () => clerk.signOut();

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const response = await getProfileSummary({ token });
        if (!active) return;
        setSummary(response);
        setSummaryStatus('ready');
      } catch {
        if (!active) return;
        setSummary(null);
        setSummaryStatus('error');
      }
    }

    void loadSummary();
    return () => {
      active = false;
    };
  }, [getToken, summaryRetryKey]);

  const retrySummary = () => {
    setSummaryStatus('loading');
    setSummaryRetryKey((current) => current + 1);
  };

  const stats = summary && [
    { value: summary.reviewsCompleted, label: 'Reviews' },
    { value: summary.learningDecks, label: 'Learning decks' },
    { value: summary.dueNow, label: 'Due now' },
  ];

  return (
    <div className="animate-screen-fade-in">
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text-1)]">
          Profile
        </h1>
        <button
          type="button"
          onClick={openClerkProfile}
          aria-label="Account settings"
          className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-1)] hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
        >
          <SettingsIcon size={18} />
        </button>
      </header>

      <div className="px-4 mb-[18px]">
        <Card className="flex items-center gap-3.5 p-[18px]">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={`${name} profile`}
              className="h-14 w-14 rounded-[18px] object-cover"
            />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#137fec] to-[#0a5fb5] text-[22px] font-extrabold tracking-tight text-white">
              {initialsOf(user)}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold tracking-snug text-[var(--text-1)] truncate">
              {name}
            </div>
            {email && (
              <div className="text-[13px] text-[var(--text-2)] mt-0.5 truncate">
                {email}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={openClerkProfile}>
            Edit
          </Button>
        </Card>
      </div>

      <section className="px-4 mb-[18px]" aria-label="Learning summary">
        {summaryStatus === 'loading' && (
          <div className="py-4 text-center text-[13px] text-[var(--text-2)]" role="status">
            Loading learning stats…
          </div>
        )}
        {summaryStatus === 'error' && (
          <Card className="p-4 text-center">
            <p role="alert" className="text-[13px] text-[var(--text-2)]">
              Learning stats are unavailable right now.
            </p>
            <button
              type="button"
              onClick={retrySummary}
              className="mt-3 min-h-11 rounded-xl bg-[var(--primary-hex)] px-4 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </Card>
        )}
        {summaryStatus === 'ready' && (
          <div className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <Card key={stat.label} className="px-3.5 py-3.5 text-center">
                <div className="text-[22px] font-extrabold tracking-tight text-[var(--text-1)]">
                  {stat.value}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-eyebrow text-[var(--text-2)] mt-0.5">
                  {stat.label}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <h2 className="px-5 mb-2.5 text-[12px] font-bold uppercase tracking-eyebrow text-[var(--text-2)]">
        Preferences
      </h2>
      <div className="px-4 mb-[18px]">
        <Card className="overflow-hidden">
          <ListRow
            icon={isDark ? <Moon size={18} /> : <Sun size={18} />}
            title="Appearance"
            subtitle={`${isDark ? 'Dark' : 'Light'} mode`}
            right={<Toggle on={isDark} />}
            onClick={toggleTheme}
          />
        </Card>
      </div>

      <NotificationSettings />

      <h2 className="px-5 mb-2.5 text-[12px] font-bold uppercase tracking-eyebrow text-[var(--text-2)]">
        Account
      </h2>
      <div className="px-4 mb-[18px]">
        <Card className="overflow-hidden">
          <ListRow
            icon={<Lock size={18} />}
            title="Password & security"
            onClick={openClerkProfile}
          />
          <ListRow
            icon={<LogOut size={18} />}
            title="Sign out"
            danger
            right={<span />}
            onClick={handleSignOut}
          />
        </Card>
      </div>

      <div className="text-center text-[11px] text-[var(--text-2)] py-2 pb-4">
        Gramio · v0.5.0
      </div>
    </div>
  );
}
