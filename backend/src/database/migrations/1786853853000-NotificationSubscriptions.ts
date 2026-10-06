import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationSubscriptions1786853853000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        expiration_time BIGINT,
        timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
        reminder_time CHAR(5) NOT NULL DEFAULT '09:00',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_notified_local_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_notification_subscriptions_endpoint UNIQUE (endpoint),
        CONSTRAINT fk_notification_subscriptions_user FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notification_subscriptions_schedule
      ON notification_subscriptions(enabled, reminder_time)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX idx_notification_subscriptions_schedule',
    );
    await queryRunner.query('DROP TABLE notification_subscriptions');
  }
}
