import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clapperboard, Inbox, Layers, PackageSearch, RotateCcw, Shuffle } from 'lucide-react';
import MissionSession from '@/components/MissionSession';
import stories from '@/data/englishMissionStories';
import puzzles from '@/data/englishMissionPuzzles';
import sampleWithoutReplacement from '@/lib/sampleWithoutReplacement';
import { getScheduledRematches, resolveRematch, scheduleRematch } from '@/services/missionRematch';

const ACTIVITIES = [...stories, ...puzzles];
const REPLAYABLE_ROUNDS = ACTIVITIES
  .filter(({ id }) => id !== 'missing-parcel')
  .flatMap(({ rounds }) => rounds);
const ICONS = {
  'missing-parcel': PackageSearch,
  'inbox-rescue': Inbox,
  'same-scene': Clapperboard,
  'meaning-switch': Shuffle,
  'vocabulary-taboo': Layers,
};
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function grammarRound(question, skill) {
  return {
    id: question.id,
    kind: 'choice',
    prompt: question.front,
    choices: question.options.map((text) => ({ id: text, text })),
    answer: [question.answer],
    explanation: question.explanation,
    example: question.example,
    rematchKey: skill,
  };
}

async function selectRematches(due) {
  const pending = due.map((entry) => ({
    ...entry,
    candidates: REPLAYABLE_ROUNDS.filter(
      (round) => round.rematchKey === entry.skill && round.id !== entry.questionId,
    ),
  }));
  const grammarBank = pending.some(({ candidates }) => !candidates.length)
    ? (await import('@/data/grammarContrastDrills.json')).default
    : [];

  return pending.flatMap(({ candidates, skill, questionId }) => {
    if (candidates.length) return sampleWithoutReplacement(candidates, 1);
    const questions = grammarBank.find((topic) => topic.id === skill)?.questions
      .filter(({ id }) => id !== questionId) ?? [];
    return sampleWithoutReplacement(questions, 1)
      .map((question) => grammarRound(question, skill));
  }).slice(0, 5);
}

export default function Missions() {
  const { userId } = useAuth();
  return <MissionHub key={userId} userId={userId} />;
}

function MissionHub({ userId }) {
  const [session, setSession] = useState(null);
  const [scheduled, setScheduled] = useState(() => getScheduledRematches(userId));
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const dueCount = scheduled.filter(({ dueAt }) => dueAt <= now).length;
  const nextDue = scheduled[0]?.dueAt;
  const rematchLabel = dueCount > 0
    ? `${dueCount} ready`
    : nextDue
      ? `Next practice ${DATE_FORMAT.format(nextDue)}`
      : 'Missed skills come back in a new situation';

  function startActivity(activity) {
    setStatus('');
    const rounds = activity.roundLimit
      ? sampleWithoutReplacement(activity.rounds, activity.roundLimit)
      : activity.rounds;
    setSession({ title: activity.title, rounds });
  }

  async function startRematch() {
    const startedAt = Date.now();
    const entries = getScheduledRematches(userId);
    setScheduled(entries);
    setNow(startedAt);
    const due = entries.filter(({ dueAt }) => dueAt <= startedAt);
    if (!due.length) {
      setStatus(entries.length ? 'Your next rematch will appear on the scheduled day.' : 'Miss a question in a mission or grammar drill to schedule a rematch.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const rounds = await selectRematches(due);
      if (rounds.length) setSession({ title: 'The Rematch', rounds, isRematch: true });
      else setStatus('There are no alternate questions for these rematches yet.');
    } catch {
      setStatus('Could not load rematches. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function recordAnswer(round, correct) {
    if (correct) {
      if (session.isRematch) resolveRematch(userId, round.rematchKey);
    } else {
      scheduleRematch(userId, { skill: round.rematchKey, questionId: round.id }, { retry: session.isRematch });
    }
    setScheduled(getScheduledRematches(userId));
    setNow(Date.now());
  }

  if (session) {
    return (
      <MissionSession
        session={session}
        onExit={() => setSession(null)}
        onAnswer={recordAnswer}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-screen-fade-in px-4 pb-7 pt-4">
      <header className="mb-5 flex items-center gap-3">
        <Link
          to="/"
          aria-label="Back to Today"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-1)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-1)]">English Missions</h1>
      </header>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACTIVITIES.map(({ id, title, description, ...activity }) => (
          <MissionTile
            key={id}
            icon={ICONS[id]}
            title={title}
            description={description}
            onClick={() => startActivity({ title, ...activity })}
            disabled={loading}
          />
        ))}
        <MissionTile
          icon={RotateCcw}
          title="The Rematch"
          description={loading ? 'Loading rematches…' : rematchLabel}
          onClick={startRematch}
          disabled={loading}
        />
      </div>
      {status && <p role="status" className="mt-3 text-sm text-[var(--text-2)]">{status}</p>}
    </div>
  );
}

function MissionTile({ icon, title, description, onClick, disabled }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[72px] w-full items-center gap-3 rounded-card border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 text-left disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-hex)]"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-app)] text-[var(--primary-hex)]">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-tight text-[var(--text-1)]">{title}</span>
        <span className="mt-1 block text-sm leading-snug text-[var(--text-2)]">{description}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-[var(--text-2)]" aria-hidden="true" />
    </button>
  );
}
