import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import Button from '@/components/ui/Button';

const DISMISS_KEY = 'gramio-install-prompt-dismissed';

function isStandalone() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true,
  );
}

function isIos() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Private browsing can deny storage; closing the prompt still works.
  }
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [ios] = useState(() => !isStandalone() && isIos());

  useEffect(() => {
    if (isStandalone()) return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    rememberDismissal();
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice?.outcome === 'accepted') dismiss();
    } catch (error) {
      console.error('Install prompt failed', error);
    } finally {
      setInstallEvent(null);
    }
  };

  if (dismissed || (!installEvent && !ios)) return null;

  return (
    <aside
      role="status"
      aria-label="Install Gramio"
      className="pointer-events-auto w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3.5 shadow-[0_12px_36px_rgba(15,22,32,0.16)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(19,127,236,.10)] text-[var(--primary-hex)]">
          {ios ? <Share2 size={18} /> : <Download size={18} />}
        </span>
        <div className="min-w-0 flex-1 pr-5">
          <div className="text-sm font-bold text-[var(--text-1)]">Install Gramio</div>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-2)]">
            {ios
              ? 'Tap Share, then Add to Home Screen for one-tap practice.'
              : 'Keep your daily practice one tap away.'}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-[var(--bg-app)]"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="min-h-11" onClick={dismiss}>
          Not now
        </Button>
        {!ios && (
          <Button size="sm" className="min-h-11" onClick={() => void install()}>
            Install Gramio
          </Button>
        )}
      </div>
    </aside>
  );
}

export { DISMISS_KEY };
