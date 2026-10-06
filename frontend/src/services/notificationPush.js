const VAPID_PUBLIC_KEY = import.meta.env?.VITE_VAPID_PUBLIC_KEY;

export function getNotificationCapability() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'unsupported' };
  }
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { supported: false, reason: 'unsupported' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { supported: false, reason: 'not-configured' };
  }
  return { supported: true, reason: null };
}

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function getCurrentPushSubscription() {
  const capability = getNotificationCapability();
  if (!capability.supported) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush() {
  const capability = getNotificationCapability();
  if (!capability.supported) {
    throw new Error(
      capability.reason === 'not-configured'
        ? 'Push notifications are not configured for this app yet.'
        : 'Push notifications are not supported in this browser.',
    );
  }
  if (window.Notification.permission === 'denied') {
    return { status: 'denied', subscription: null };
  }

  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') {
    return { status: permission, subscription: null };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY),
  });
  return { status: 'granted', subscription };
}

export function serializePushSubscription(subscription) {
  return typeof subscription.toJSON === 'function'
    ? subscription.toJSON()
    : subscription;
}

export function getLearnerTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
