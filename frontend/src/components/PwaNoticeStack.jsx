import InstallPrompt from './InstallPrompt';
import OfflineIndicator from './OfflineIndicator';
import ReloadPrompt from './ReloadPrompt';

export default function PwaNoticeStack({ showInstall = true }) {
  return (
    <div
      data-testid="pwa-notice-stack"
      className="pointer-events-none absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-50 flex flex-col gap-3 sm:left-auto sm:w-[min(360px,calc(100%-2rem))]"
    >
      {showInstall && <InstallPrompt />}
      <ReloadPrompt />
      <OfflineIndicator />
    </div>
  );
}
