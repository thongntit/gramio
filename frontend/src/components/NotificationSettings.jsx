import { useEffect, useState } from 'react';
import { Bell, BellOff, Clock3, LoaderCircle } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  getNotificationPreferences,
  removeNotificationSubscription,
  saveNotificationSubscription,
} from '@/services/openspeakApi';
import {
  getCurrentPushSubscription,
  getLearnerTimezone,
  getNotificationCapability,
  serializePushSubscription,
  subscribeToPush,
} from '@/services/notificationPush';

function capabilityCopy(reason) {
  if (reason === 'not-configured') {
    return 'Notifications are not configured for this deployment yet.';
  }
  return 'This browser cannot receive Gramio notifications.';
}

export default function NotificationSettings() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState('loading');
  const [permission, setPermission] = useState('default');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [subscription, setSubscription] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const capability = getNotificationCapability();

  useEffect(() => {
    let active = true;

    async function load() {
      if (!capability.supported) {
        setStatus(capability.reason);
        return;
      }
      try {
        const [localSubscription, token] = await Promise.all([
          getCurrentPushSubscription(),
          getToken(),
        ]);
        if (!token) throw new Error('Authentication required');
        const preferences = await getNotificationPreferences({ token });
        if (!active) return;
        setSubscription(localSubscription);
        setReminderTime(preferences.reminderTime || '09:00');
        setPermission(window.Notification.permission);
        setStatus(
          localSubscription && preferences.enabled
            ? 'enabled'
            : window.Notification.permission === 'denied'
              ? 'denied'
              : 'disabled',
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Could not load notification settings.');
        setStatus('error');
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [capability.reason, capability.supported, getToken]);

  const persistSubscription = async (nextSubscription, nextTime = reminderTime) => {
    const token = await getToken();
    if (!token) throw new Error('Authentication required');
    await saveNotificationSubscription(
      {
        ...serializePushSubscription(nextSubscription),
        reminderTime: nextTime,
        timezone: getLearnerTimezone(),
      },
      { token },
    );
  };

  const handleToggle = async () => {
    setError('');
    setSaving(true);
    try {
      if (status === 'enabled' && subscription) {
        const token = await getToken();
        await removeNotificationSubscription(
          { endpoint: subscription.endpoint },
          { token },
        );
        await subscription.unsubscribe();
        setSubscription(null);
        setStatus('disabled');
        return;
      }

      const result = await subscribeToPush();
      setPermission(window.Notification.permission);
      if (result.status !== 'granted' || !result.subscription) {
        setStatus(result.status === 'denied' ? 'denied' : 'disabled');
        return;
      }
      await persistSubscription(result.subscription);
      setSubscription(result.subscription);
      setStatus('enabled');
    } catch (toggleError) {
      setError(toggleError.message || 'Could not update notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (event) => {
    const nextTime = event.target.value;
    setReminderTime(nextTime);
    if (status !== 'enabled' || !subscription || nextTime.length !== 5) return;
    setError('');
    setSaving(true);
    try {
      await persistSubscription(subscription, nextTime);
    } catch (timeError) {
      setError(timeError.message || 'Could not save reminder time.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="px-4 mb-[18px]" aria-label="Learning reminders">
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3.5 p-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-app)] text-[var(--text-1)]">
            {status === 'enabled' ? <Bell size={18} /> : <BellOff size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-[var(--text-1)]">
              Daily review reminders
            </div>
            <p className="mt-0.5 text-xs leading-5 text-[var(--text-2)]">
              We’ll notify you once a day only when reviews are due.
            </p>
          </div>
          {status === 'loading' && <LoaderCircle size={18} className="animate-spin text-[var(--text-2)]" />}
        </div>

        {status === 'unsupported' || status === 'not-configured' ? (
          <p className="border-t border-[var(--border-soft)] px-4 py-3 text-xs leading-5 text-[var(--text-2)]">
            {capabilityCopy(status)}
          </p>
        ) : status === 'error' ? (
          <p role="alert" className="border-t border-[var(--border-soft)] px-4 py-3 text-xs leading-5 text-[#be123c]">
            {error}
          </p>
        ) : status !== 'loading' ? (
          <div className="border-t border-[var(--border-soft)] px-4 py-3.5">
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-[var(--text-1)]" htmlFor="reminder-time">
              <span className="inline-flex items-center gap-2"><Clock3 size={16} /> Reminder time</span>
              <input
                id="reminder-time"
                type="time"
                value={reminderTime}
                onChange={handleTimeChange}
                disabled={saving}
                className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-app)] px-2.5 text-sm text-[var(--text-1)]"
              />
            </label>
            {permission === 'denied' && (
              <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">
                Notifications are blocked in your browser. Allow them in browser settings, then try again.
              </p>
            )}
            {error && <p role="alert" className="mt-2 text-xs leading-5 text-[#be123c]">{error}</p>}
            <Button
              className="mt-3 w-full"
              variant={status === 'enabled' ? 'outline' : 'primary'}
              size="sm"
              disabled={saving || status === 'denied'}
              onClick={handleToggle}
            >
              {saving ? 'Saving…' : status === 'enabled' ? 'Disable on this device' : 'Enable notifications'}
            </Button>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
