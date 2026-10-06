import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationSettings from '@/components/NotificationSettings';
import {
  getNotificationPreferences,
  saveNotificationSubscription,
} from '@/services/openspeakApi';
import { track } from '@/lib/analytics';
import {
  getCurrentPushSubscription,
  getLearnerTimezone,
  getNotificationCapability,
  serializePushSubscription,
  subscribeToPush,
} from '@/services/notificationPush';

const clerk = vi.hoisted(() => ({
  getToken: vi.fn().mockResolvedValue('fresh-token'),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: clerk.getToken }),
}));

vi.mock('@/services/notificationPush', () => ({
  getCurrentPushSubscription: vi.fn(),
  getLearnerTimezone: vi.fn(),
  getNotificationCapability: vi.fn(),
  serializePushSubscription: vi.fn(),
  subscribeToPush: vi.fn(),
}));

vi.mock('@/services/openspeakApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getNotificationPreferences: vi.fn(),
    saveNotificationSubscription: vi.fn(),
    removeNotificationSubscription: vi.fn(),
  };
});

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getNotificationCapability.mockReturnValue({ supported: true, reason: null });
  getCurrentPushSubscription.mockResolvedValue(null);
  getLearnerTimezone.mockReturnValue('Asia/Ho_Chi_Minh');
  getNotificationPreferences.mockResolvedValue({
    enabled: false,
    reminderTime: '09:00',
    timezone: 'Asia/Ho_Chi_Minh',
    subscriptionCount: 0,
  });
  saveNotificationSubscription.mockResolvedValue({ enabled: true });
  window.Notification = { permission: 'default' };
});

describe('NotificationSettings', () => {
  it('requests enabling only after the learner taps the button', async () => {
    const user = userEvent.setup();
    const subscription = { endpoint: 'https://push.example/subscription' };
    serializePushSubscription.mockReturnValue({
      endpoint: subscription.endpoint,
      keys: { p256dh: 'public-key', auth: 'auth-key' },
      expirationTime: null,
    });
    subscribeToPush.mockResolvedValue({ status: 'granted', subscription });

    render(<NotificationSettings />);

    expect(subscribeToPush).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Enable notifications' }));

    expect(subscribeToPush).toHaveBeenCalledOnce();
    expect(saveNotificationSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: subscription.endpoint,
        reminderTime: '09:00',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
      { token: 'fresh-token' },
    );
    expect(await screen.findByRole('button', { name: 'Disable on this device' })).toBeInTheDocument();
  });

  it('tracks a successful reminder-time update without exposing subscription data', async () => {
    const user = userEvent.setup();
    const subscription = {
      endpoint: 'https://push.example/private-subscription',
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    serializePushSubscription.mockReturnValue({
      endpoint: subscription.endpoint,
      keys: { p256dh: 'public-key', auth: 'auth-key' },
      expirationTime: null,
    });
    subscribeToPush.mockResolvedValue({ status: 'granted', subscription });

    render(<NotificationSettings />);

    await user.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    fireEvent.change(screen.getByLabelText('Reminder time'), {
      target: { value: '20:30' },
    });

    await waitFor(() => expect(saveNotificationSubscription).toHaveBeenLastCalledWith(
      expect.objectContaining({
        endpoint: subscription.endpoint,
        reminderTime: '20:30',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
      { token: 'fresh-token' },
    ));
    expect(track).toHaveBeenLastCalledWith('notifications_updated', {
      enabled: true,
      reminder_time: '20:30',
    });
  });

  it('tracks enabling and disabling without sending the subscription endpoint', async () => {
    const user = userEvent.setup();
    const subscription = {
      endpoint: 'https://push.example/private-subscription',
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    serializePushSubscription.mockReturnValue({
      endpoint: subscription.endpoint,
      keys: { p256dh: 'public-key', auth: 'auth-key' },
      expirationTime: null,
    });
    subscribeToPush.mockResolvedValue({ status: 'granted', subscription });

    render(<NotificationSettings />);

    await user.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    expect(track).toHaveBeenCalledWith('notifications_updated', {
      enabled: true,
      reminder_time: '09:00',
    });

    await user.click(await screen.findByRole('button', { name: 'Disable on this device' }));
    expect(track).toHaveBeenLastCalledWith('notifications_updated', {
      enabled: false,
    });
  });

  it('does not track a reminder-time update when saving fails', async () => {
    const user = userEvent.setup();
    const subscription = { endpoint: 'https://push.example/subscription' };
    serializePushSubscription.mockReturnValue({
      endpoint: subscription.endpoint,
      keys: { p256dh: 'public-key', auth: 'auth-key' },
      expirationTime: null,
    });
    subscribeToPush.mockResolvedValue({ status: 'granted', subscription });
    saveNotificationSubscription
      .mockReset()
      .mockResolvedValueOnce({ enabled: true })
      .mockRejectedValueOnce(new Error('Network unavailable'));

    render(<NotificationSettings />);

    await user.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    await screen.findByRole('button', { name: 'Disable on this device' });
    track.mockClear();

    fireEvent.change(screen.getByLabelText('Reminder time'), {
      target: { value: '20:30' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    expect(screen.getByLabelText('Reminder time')).toHaveValue('09:00');
    expect(track).not.toHaveBeenCalled();
  });

  it('explains when the current browser cannot receive notifications', async () => {
    getNotificationCapability.mockReturnValue({
      supported: false,
      reason: 'unsupported',
    });

    render(<NotificationSettings />);

    expect(await screen.findByText(/cannot receive Gramio notifications/i)).toBeInTheDocument();
    expect(getNotificationPreferences).not.toHaveBeenCalled();
  });
});
