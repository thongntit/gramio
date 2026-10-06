import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { WordsModule } from './words/words.module';
import { CollectionsModule } from './collections/collections.module';
import { AuthModule } from './auth/auth.module';
import { LearningDataModule } from './learning/learning-data.module';
import { LearningContentModule } from './learning-content/learning-content.module';
import { UsersModule } from './users/users.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        CORS_ORIGIN: Joi.string().required(),
        CLERK_SECRET_KEY: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        VAPID_SUBJECT: Joi.string().uri().optional(),
        VAPID_PUBLIC_KEY: Joi.string().optional(),
        VAPID_PRIVATE_KEY: Joi.string().optional(),
      }),
    }),
    DatabaseModule,
    WordsModule,
    CollectionsModule,
    UsersModule,
    LearningDataModule,
    LearningContentModule,
    AuthModule,
    ReviewsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
