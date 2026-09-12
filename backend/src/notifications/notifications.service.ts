import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { LearningService } from '../learning/learning.service';
import { NotificationSubscription } from './notification-subscription.entity';
import { UpsertNotificationSubscriptionDto } from './dto/upsert-notification-subscription.dto';

const REMINDER_INTERVAL_MS = 60_000;
const DEFAULT_REMINDER_TIME = '09:00';
const DEFAULT_TIMEZONE = 'UTC';

type LocalSchedule = { dateKey: string; minuteOfDay: number };

function localSchedule(now: Date, timezone: string): LocalSchedule {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    throw new BadRequestException('Invalid timezone');
  }
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  ) as Record<string, string>;
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
  };
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private interval: ReturnType<typeof setInterval> | undefined;

  constructor(
    @InjectRepository(NotificationSubscription)
    private readonly subscriptions: Repository<NotificationSubscription>,
    private readonly learning: LearningService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.isPushConfigured()) {
      this.logger.warn(
        'Push reminders are disabled: configure VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY.',
      );
      return;
    }
    this.interval = setInterval(() => {
      void this.dispatchDueReminders();
    }, REMINDER_INTERVAL_MS);
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  isPushConfigured() {
    return Boolean(
      this.config.get<string>('VAPID_SUBJECT') &&
      this.config.get<string>('VAPID_PUBLIC_KEY') &&
      this.config.get<string>('VAPID_PRIVATE_KEY'),
    );
  }

  async getPreferences(userId: string) {
    const subscriptions = await this.subscriptions.find({
      where: { user_id: userId, enabled: true },
      order: { updated_at: 'DESC' },
    });
    const current = subscriptions[0];
    return {
      enabled: subscriptions.length > 0,
      reminderTime: current?.reminder_time ?? DEFAULT_REMINDER_TIME,
      timezone: current?.timezone ?? DEFAULT_TIMEZONE,
      subscriptionCount: subscriptions.length,
    };
  }

  async upsert(userId: string, dto: UpsertNotificationSubscriptionDto) {
    if (!this.isPushConfigured()) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured on the server',
      );
    }
    this.assertTimezone(dto.timezone);

    let subscription = await this.subscriptions.findOneBy({
      endpoint: dto.endpoint,
    });
    if (!subscription) {
      subscription = this.subscriptions.create({ endpoint: dto.endpoint });
    }
    subscription.user_id = userId;
    subscription.p256dh = dto.keys.p256dh;
    subscription.auth = dto.keys.auth;
    subscription.expiration_time =
      dto.expirationTime == null ? null : String(dto.expirationTime);
    subscription.timezone = dto.timezone;
    subscription.reminder_time = dto.reminderTime;
    subscription.enabled = true;
    await this.subscriptions.save(subscription);
    return this.getPreferences(userId);
  }

  async remove(userId: string, endpoint: string) {
    await this.subscriptions.delete({ user_id: userId, endpoint });
    return this.getPreferences(userId);
  }

  async dispatchDueReminders(now = new Date()) {
    if (!this.isPushConfigured()) return { sent: 0, removed: 0 };

    this.configurePush();
    const activeSubscriptions = await this.subscriptions.find({
      where: { enabled: true },
    });
    let sent = 0;
    let removed = 0;

    for (const subscription of activeSubscriptions) {
      const schedule = localSchedule(now, subscription.timezone);
      if (schedule.minuteOfDay < timeToMinutes(subscription.reminder_time)) {
        continue;
      }
      if (subscription.last_notified_local_date === schedule.dateKey) {
        continue;
      }

      const today = await this.learning.getToday(subscription.user_id, now);
      if (!today.totalDue) continue;

      const claimed = await this.claim(subscription.id, schedule.dateKey);
      if (!claimed) continue;

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: 'Gramio review reminder',
            body: `You have ${today.totalDue} review${today.totalDue === 1 ? '' : 's'} due.`,
            url: '/review',
            tag: 'gramio-daily-review',
          }),
          { TTL: 3_600 },
        );
        sent += 1;
      } catch (error) {
        const statusCode = this.pushStatusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          await this.subscriptions.delete({ id: subscription.id });
          removed += 1;
        } else {
          this.logger.error(
            `Failed to send reminder for subscription ${subscription.id}`,
          );
        }
      }
    }
    return { sent, removed };
  }

  private async claim(id: string, dateKey: string) {
    const result = await this.subscriptions
      .createQueryBuilder()
      .update(NotificationSubscription)
      .set({ last_notified_local_date: dateKey })
      .where('id = :id', { id })
      .andWhere(
        '(last_notified_local_date IS NULL OR last_notified_local_date <> :dateKey)',
        { dateKey },
      )
      .execute();
    return result.affected === 1;
  }

  private configurePush() {
    webpush.setVapidDetails(
      this.config.getOrThrow<string>('VAPID_SUBJECT'),
      this.config.getOrThrow<string>('VAPID_PUBLIC_KEY'),
      this.config.getOrThrow<string>('VAPID_PRIVATE_KEY'),
    );
  }

  private assertTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('Invalid timezone');
    }
  }

  private pushStatusCode(error: unknown) {
    if (typeof error !== 'object' || error === null) return undefined;
    return 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined;
  }
}
