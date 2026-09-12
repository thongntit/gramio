import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { CurrentUser } from '../users/current-user.decorator';
import { RemoveNotificationSubscriptionDto } from './dto/remove-notification-subscription.dto';
import { UpsertNotificationSubscriptionDto } from './dto/upsert-notification-subscription.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  preferences(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.notifications.getPreferences(user.id);
  }

  @Post('subscription')
  upsert(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: UpsertNotificationSubscriptionDto,
  ) {
    return this.notifications.upsert(user.id, dto);
  }

  @Delete('subscription')
  remove(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: RemoveNotificationSubscriptionDto,
  ) {
    return this.notifications.remove(user.id, dto.endpoint);
  }
}
