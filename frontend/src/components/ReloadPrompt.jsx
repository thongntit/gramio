import { useRegisterSW } from 'virtual:pwa-register/react';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
      // Check for updates every hour
      r && setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 z-50 sm:left-auto sm:w-80">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {offlineReady ? (
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {offlineReady ? 'App shell ready offline' : 'New version available'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {offlineReady
                ? 'You can reopen Gramio without a connection, but new reviews still need a connection.'
                : 'A new version is available. Refresh to update.'}
            </p>
          </div>
          <button
            onClick={close}
            className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {!offlineReady && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => updateServiceWorker(true)}
              className="flex-1 bg-primary text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={close}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReloadPrompt;
