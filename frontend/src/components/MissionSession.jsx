import { useState } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';

const PRIMARY_ACTION = 'min-h-12 w-full rounded-xl bg-[var(--primary-hex)] px-4 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-hex)]';
const SECONDARY_ACTION = 'min-h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-hex)]';

export default function MissionSession({ session, onAnswer, onExit }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const { title, rounds } = session;
  const round = rounds[index];

  function recordAnswer(correct) {
    if (correct) setScore((previous) => previous + 1);
    onAnswer(round, correct);
  }

  if (!round) {
    return (
      <section className="mx-auto max-w-lg px-5 py-12 text-center">
        <Check className="mx-auto mb-4 text-[var(--primary-hex)]" size={38} aria-hidden="true" />
        <h1 className="text-2xl font-extrabold text-[var(--text-1)]">Mission complete</h1>
        <p className="mb-7 mt-3 text-[var(--text-2)]">You got {score} of {rounds.length} correct.</p>
        <button type="button" onClick={onExit} className={PRIMARY_ACTION}>Back to Missions</button>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-4">
      <header className="mb-4 flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={onExit} aria-label="Back to Missions" className={SECONDARY_ACTION}>
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold leading-tight text-[var(--text-1)]">{title}</h1>
          <p className="text-sm text-[var(--text-2)]">Question {index + 1} of {rounds.length}</p>
        </div>
      </header>
      <MissionQuestion
        key={round.id}
        round={round}
        onAnswer={recordAnswer}
        onNext={() => setIndex((previous) => previous + 1)}
        isLast={index === rounds.length - 1}
      />
    </div>
  );
}

function MissionQuestion({ round, onAnswer, onNext, isLast }) {
  const [selection, setSelection] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const { kind, choices, answer, outcomes, forbiddenWords } = round;
  const isChoice = kind === 'choice';
  const isOrder = kind === 'order';
  const correct = selection.length === answer.length
    && answer.every((id, index) => id === selection[index]);
  const choiceText = (id) => choices.find((choice) => choice.id === id)?.text;

  function submit(ids) {
    const matches = ids.length === answer.length && answer.every((id, index) => id === ids[index]);
    setSubmitted(true);
    onAnswer(matches);
  }

  function choose(id) {
    if (isChoice) {
      setSelection([id]);
      submit([id]);
    } else {
      setSelection((previous) => [...previous, id]);
    }
  }

  return (
    <section className="rounded-card border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-[var(--text-1)] sm:p-6">
      {round.context && <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-[var(--text-2)]">{round.context}</p>}
      <h2 className="text-lg font-bold leading-snug">{round.prompt}</h2>

      {forbiddenWords?.length > 0 && (
        <p className="mt-3 text-sm text-[var(--text-2)]">Blocked words: <strong>{forbiddenWords.join(', ')}</strong></p>
      )}
      {!isChoice && (
        <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-app)] p-3">
          <p className="mb-2 text-sm font-semibold">{isOrder ? 'Your timeline' : 'Your definition'}</p>
          {selection.length ? (
            <ol className="list-inside list-decimal space-y-1 text-sm" aria-live="polite">
              {selection.map((id) => <li key={id}>{choiceText(id)}</li>)}
            </ol>
          ) : (
            <p className="text-sm text-[var(--text-2)]">Tap the pieces below in order.</p>
          )}
          {!submitted && (
            <button
              type="button"
              className={cn(SECONDARY_ACTION, 'mt-3 inline-flex items-center gap-1.5')}
              onClick={() => setSelection((previous) => previous.slice(0, -1))}
              disabled={selection.length === 0}
            >
              <RotateCcw size={14} aria-hidden="true" /> Undo last
            </button>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {choices.map(({ id, text }) => (
          <button
            type="button"
            key={id}
            onClick={() => choose(id)}
            disabled={submitted || selection.includes(id)}
            className={cn(
              SECONDARY_ACTION,
              'min-h-12 break-words text-left',
              isChoice && submitted && answer.includes(id) && 'border-emerald-600 text-emerald-700 dark:text-emerald-300',
              isChoice && submitted && selection.includes(id) && !correct && 'border-rose-600 text-rose-700 dark:text-rose-300',
            )}
          >
            {text}
          </button>
        ))}
      </div>

      {!isChoice && !submitted && (
        <button
          type="button"
          className={cn(PRIMARY_ACTION, 'mt-4')}
          disabled={isOrder ? selection.length !== choices.length : selection.length === 0}
          onClick={() => submit(selection)}
        >
          Check answer
        </button>
      )}

      {submitted && (
        <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
          <div role="status" className="space-y-2">
            <p className={cn('font-bold', correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
              {correct ? 'Correct' : 'Not quite'}
            </p>
            {outcomes?.[selection[0]] && <p className="text-sm">Reply: {outcomes[selection[0]]}</p>}
            {!correct && (
              <p className="text-sm font-semibold">
                {isOrder ? 'Correct order: ' : 'Correct answer: '}
                {answer.map(choiceText).join(isOrder ? ' → ' : ' ')}
              </p>
            )}
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{round.explanation}</p>
            {round.example && <p className="text-sm italic text-[var(--text-2)]">{round.example}</p>}
          </div>
          <button type="button" className={cn(PRIMARY_ACTION, 'mt-4')} onClick={onNext}>
            {isLast ? 'See results' : 'Next question'}
          </button>
        </div>
      )}
    </section>
  );
}
