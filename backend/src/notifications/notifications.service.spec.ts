import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationSubscription } from './notification-subscription.entity';

jest.mock('web-push', () => ({
  __esModule: true,
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

function subscription(overrides: Partial<NotificationSubscription> = {}) {
  return {
    id: 'subscription-1',
    user_id: 'user-1',
    endpoint: 'https://push.example/subscription-1',
    p256dh: 'public-key',
    auth: 'auth-key',
    expiration_time: null,
    timezone: 'Asia/Ho_Chi_Minh',
    reminder_time: '09:00',
    enabled: true,
    last_notified_local_date: null,
    ...overrides,
  } as NotificationSubscription;
}

function harness({ affected = 1 } = {}) {
  const execute = jest.fn().mockResolvedValue({ affected });
  const builder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute,
  };
  const repositories = {
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(builder),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const learning = { getToday: jest.fn() };
  const config = new ConfigService({
    VAPID_SUBJECT: 'mailto:test@example.com',
    VAPID_PUBLIC_KEY: 'public-vapid-key',
    VAPID_PRIVATE_KEY: 'private-vapid-key',
  });
  return {
    service: new NotificationsService(
      repositories as any,
      learning as any,
      config,
    ),
    repositories,
    learning,
    execute,
  };
}

describe('NotificationsService', () => {
  beforeEach(() => {
    (webpush.setVapidDetails as jest.Mock).mockReset();
    (webpush.sendNotification as jest.Mock).mockReset().mockResolvedValue({});
  });

  afterEach(() => jest.clearAllMocks());

  it('sends one daily reminder when the learner has due reviews', async () => {
    const h = harness();
    h.repositories.find.mockResolvedValue([subscription()]);
    h.learning.getToday.mockResolvedValue({ totalDue: 2 });

    const result = await h.service.dispatchDueReminders(
      new Date('2026-08-16T02:00:00.000Z'),
    );

    expect(result).toEqual({ sent: 1, removed: 0 });
    expect(h.learning.getToday).toHaveBeenCalledWith(
      'user-1',
      new Date('2026-08-16T02:00:00.000Z'),
    );
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: subscription().endpoint }),
      expect.stringContaining('You have 2 reviews due.'),
      { TTL: 3_600 },
    );
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('does not claim or send when no reviews are due', async () => {
    const h = harness();
    h.repositories.find.mockResolvedValue([subscription()]);
    h.learning.getToday.mockResolvedValue({ totalDue: 0 });

    const result = await h.service.dispatchDueReminders(
      new Date('2026-08-16T02:00:00.000Z'),
    );

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(h.execute).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('removes a subscription when the push provider reports it expired', async () => {
    const h = harness();
    h.repositories.find.mockResolvedValue([subscription()]);
    h.learning.getToday.mockResolvedValue({ totalDue: 1 });
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({
      statusCode: 410,
    });

    const result = await h.service.dispatchDueReminders(
      new Date('2026-08-16T02:00:00.000Z'),
    );

    expect(result).toEqual({ sent: 0, removed: 1 });
    expect(h.repositories.delete).toHaveBeenCalledWith({
      id: 'subscription-1',
    });
  });

  it('does not send when another worker already claimed the local day', async () => {
    const h = harness({ affected: 0 });
    h.repositories.find.mockResolvedValue([subscription()]);
    h.learning.getToday.mockResolvedValue({ totalDue: 1 });

    const result = await h.service.dispatchDueReminders(
      new Date('2026-08-16T02:00:00.000Z'),
    );

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
