import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('notification_subscriptions')
@Index('uq_notification_subscriptions_endpoint', ['endpoint'], {
  unique: true,
})
@Index('idx_notification_subscriptions_schedule', ['enabled', 'reminder_time'])
export class NotificationSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'text' })
  endpoint!: string;

  @Column({ type: 'text' })
  p256dh!: string;

  @Column({ type: 'text' })
  auth!: string;

  @Column({ type: 'bigint', nullable: true })
  expiration_time!: string | null;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string;

  @Column({ type: 'char', length: 5, default: '09:00' })
  reminder_time!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'date', nullable: true })
  last_notified_local_date!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
